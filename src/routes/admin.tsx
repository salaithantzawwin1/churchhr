import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import type { AppEnv } from "../env";
import { getDb, type DB } from "../db/client";
import {
  ageGroups, isRegionScopedType, lookupOptions, OPTION_TYPE_LABELS, OPTION_TYPE_LABELS_EN, OPTION_TYPES, regions,
  rolePermissions, roles, userRoles, userStateAssignments, users, type OptionType,
} from "../db/schema";
import { requirePermission } from "../middleware";
import { ForbiddenPage } from "../views/errors";
import { flashFromQuery } from "../flash";
import { hashPassword, parseIterations } from "../auth";
import { findOption, loadAllOptions, PARENT_TYPE, OPTION_RAW_COLUMN, isOptionType, type OptionRow } from "../lookup";
import { PERMISSIONS, type Permission } from "../rbac";
import { getDict } from "../i18n";
import { s } from "../util";
import { Layout } from "../views/layout";
import {
  AddAgeGroupForm, AddOptionForm, AddRegionForm, AdminOptionsPage, AdminRolesPage, AdminUserEditPage, AdminUsersPage,
  EditAgeGroupForm, EditOptionForm, EditRegionForm, RoleFormFragment, UserFormFragment,
  type AdminRoleRow, type AdminUserRow, type OptionUsage,
} from "../views/admin";

export const adminRoutes = new Hono<AppEnv>();

/** Maps a dictionary key (e.g. adm.errRoleBad) pushed by validateAssignments to its text. */
function renderKey(t: (k: string) => string) {
  return (key: string) => (key.startsWith("adm.") ? t(key) : key);
}

function multi(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return typeof v === "string" ? [v] : [];
}

function ints(vals: string[]): number[] {
  return vals.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
}

const errRedirect = (to: string, msg: string) =>
  `${to}${to.includes("?") ? "&" : "?"}err=${encodeURIComponent(msg)}`;

// ---------- State-scoped option management ----------
// A user with options.manage but without the all-states wildcard is a State
// Manager: they may add/update/deactivate the four region-scoped option types
// (Township, Home Cell, Group, Family Group) inside their own assigned states
// only — never global options (regionId 0), other states' options, the
// State/Region tab, or Age Groups.

type OptionScope = { scopeAll: boolean; stateIds: number[] };

function optionScopeOf(c: { get: (k: "scopeAll" | "stateIds") => any }): OptionScope {
  return { scopeAll: !!c.get("scopeAll"), stateIds: (c.get("stateIds") ?? []) as number[] };
}

/** True when the user manages options across every state (global admin). */
function isOptionsAdmin(scope: OptionScope): boolean {
  return scope.scopeAll;
}

/** Can this scope manage the given option type at all? */
function canManageType(scope: OptionScope, type: string): boolean {
  return isOptionsAdmin(scope) || isRegionScopedType(type);
}

/** Effective state an option is anchored to: parent's state wins (Home Cell
 * inherits its Township's state, Family Group its Home Cell's). */
function effectiveRegion(row: { regionId: number; parentId: number | null }, byId: Map<number, { regionId: number; parentId: number | null }>): number {
  if (row.parentId != null) {
    const parent = byId.get(row.parentId);
    if (parent && parent.regionId !== 0) return parent.regionId;
  }
  return row.regionId;
}

/** May this scope manage the option (by its effective region)? */
function canManageOption(scope: OptionScope, effectiveRegionId: number): boolean {
  return isOptionsAdmin(scope) || effectiveRegionId !== 0 && scope.stateIds.includes(effectiveRegionId);
}

/** 403 for state managers touching admin-only option areas. */
function forbidden(c: any) {
  return c.html(<ForbiddenPage path={new URL(c.req.url).pathname} lang={c.get("lang")} />, 403);
}

type RoleInfo = { id: number; name: string; description: string | null; is_system: number; permissions: string[] };

async function loadRoles(db: DB): Promise<RoleInfo[]> {
  const roleRows = await db
    .select({ id: roles.id, name: roles.name, description: roles.description, isSystem: roles.isSystem })
    .from(roles)
    .orderBy(roles.id);
  const permRows = await db.select({ roleId: rolePermissions.roleId, permission: rolePermissions.permission })
    .from(rolePermissions);
  return roleRows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    is_system: r.isSystem,
    permissions: permRows.filter((p) => p.roleId === r.id).map((p) => p.permission),
  }));
}

async function loadAdminUsers(db: DB, lang: "mm" | "en"): Promise<AdminUserRow[]> {
  const stateCol = lang === "en" ? "r3.name_en" : "r3.name";
  const rows = await db.all<AdminUserRow & { state_ids: string | null }>(
    sql.raw(`
    SELECT u.id, u.username, u.active, u.must_change_password, u.created_at,
      COALESCE((
        SELECT group_concat(r2.name, ', ')
        FROM user_roles ur JOIN roles r2 ON r2.id = ur.role_id
        WHERE ur.user_id = u.id
      ), '') AS role_names,
      COALESCE((
        SELECT group_concat(${stateCol}, ', ')
        FROM user_state_assignments sa JOIN regions r3 ON r3.id = sa.region_id
        WHERE sa.user_id = u.id
      ), '') AS state_names_raw,
      (SELECT group_concat(sa.region_id) FROM user_state_assignments sa WHERE sa.user_id = u.id) AS state_ids
    FROM users u ORDER BY u.id`),
  );
  return rows.map((r: any) => ({
    ...r,
    state_names: r.state_names_raw || "",
    state_ids: r.state_ids ? String(r.state_ids).split(",").map((x) => Number(x)) : [],
  }));
}

async function userAssignments(db: DB, userId: number) {
  const roleRows = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId));
  const stateRows = await db.select({ regionId: userStateAssignments.regionId })
    .from(userStateAssignments).where(eq(userStateAssignments.userId, userId));
  return {
    selectedRoles: roleRows.map((r) => r.roleId),
    selectedStates: stateRows.filter((r) => r.regionId !== 0).map((r) => r.regionId),
    allStates: stateRows.some((r) => r.regionId === 0),
  };
}

// ---------- Users ----------

adminRoutes.get("/users", requirePermission("users.manage"), async (c) => {
  const db = getDb(c.env);
  const [usersList, roleList, regionsList] = [await loadAdminUsers(db, c.get("lang")), await loadRoles(db), await loadRegionsLite(db, c.get("lang"))];
  return c.html(
    <AdminUsersPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))}
      users={usersList} roles={roleList} regions={regionsList}
      editUser={null} createErrors={[]} editErrors={[]}
      lang={c.get("lang")}
    />,
  );
});

async function loadRegionsLite(db: DB, lang: "mm" | "en" = "mm"): Promise<{ id: number; name: string }[]> {
  const rows = await db.all<{ id: number; name: string; name_en: string }>(sql`SELECT id, name, name_en FROM regions ORDER BY id`);
  return rows.map((r) => ({ id: r.id, name: lang === "en" && r.name_en ? r.name_en : r.name }));
}

adminRoutes.get("/users/:id/edit", requirePermission("users.manage"), async (c) => {
  const db = getDb(c.env);
  const id = Number(c.req.param("id"));
  const t = getDict(c.get("lang"));
  if (!Number.isInteger(id) || id < 1 || id === c.get("user").id) {
    return c.redirect(errRedirect("/admin/users", t("adm.errSelfEdit")), 302);
  }
  const usersList = await loadAdminUsers(db, c.get("lang"));
  const target = usersList.find((u) => u.id === id);
  if (!target) return c.redirect(errRedirect("/admin/users", t("adm.errNoAccount")), 302);
  const assignments = await userAssignments(db, id);
  return c.html(
    <AdminUserEditPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))}
      editUser={{ ...target, ...assignments }}
      roles={await loadRoles(db)} regions={await loadRegionsLite(db, c.get("lang"))} editErrors={[]}
      lang={c.get("lang")} modal={c.req.query("modal") === "1"}
    />,
  );
});

/** Bare create-user form for the js-add-modal fetch. */
adminRoutes.get("/users/new", requirePermission("users.manage"), async (c) => {
  const db = getDb(c.env);
  return c.html(
    <UserFormFragment
      lang={c.get("lang")} errors={[]}
      values={{ username: "", allStates: false, selectedRoles: [], selectedStates: [], active: 1, mustChange: 1 }}
      roles={(await loadRoles(db)) as any} regions={await loadRegionsLite(db, c.get("lang"))}
    />,
  );
});

function parseUserBody(body: Record<string, unknown>, t: (k: string) => string) {
  const username = s(body.username);
  const password = s(body.password);
  const newPassword = s(body.new_password);
  const roleIds = ints(multi(body.roles));
  const statesRaw = ints(multi(body.states));
  const allStates = s(body.all_states) === "1";
  const active = s(body.active) === "1" ? 1 : 0;
  const mustChange = s(body.must_change) === "1" ? 1 : 0;
  const errors: string[] = [];
  if (!/^[A-Za-z0-9_.\-]{3,32}$/.test(username)) errors.push(t("adm.errUsername"));
  return { id: undefined as number | undefined, username, password, newPassword, roleIds, statesRaw, allStates, active, mustChange, errors };
}

async function validateAssignments(db: DB, roleIds: number[], statesRaw: number[], allStates: boolean, errors: string[], _t: (k: string) => string) {
  const roleList = await loadRoles(db);
  if (roleIds.length === 0) errors.push("adm.errRoleRequired");
  if (roleIds.some((id) => !roleList.some((r) => r.id === id))) errors.push("adm.errRoleBad");
  if (!allStates && statesRaw.length === 0) errors.push("adm.errStateRequired");
  if (statesRaw.length > 0) {
    const regionIds = new Set((await loadRegionsLite(db)).map((r) => r.id));
    if (statesRaw.some((id) => !regionIds.has(id))) errors.push("adm.errStateBad");
  }
  return errors.length === 0;
}

/** Renders a bare user form for the modal (X-Requested-With: modal) or falls
 * back to the list-page error redirect. Shared by create and edit handlers.
 * `p.errors` may already hold either i18n keys or already-translated text —
 * map only keys. This is async because the roles/regions lookups may have
 * been clobbered by the earlier validate call in a separate DB pool. */
async function userFail(
  c: any,
  p: { username: string; allStates: boolean; roleIds: number[]; statesRaw: number[]; active: number; mustChange: number; errors: string[]; id: number | undefined },
  roleList: { id: number; name: string }[],
  regionList: { id: number; name: string }[],
) {
  const t = getDict(c.get("lang"));
  const errors = p.errors.map((e) => (e.startsWith("adm.") ? t(e) : e));
  if (c.req.header("X-Requested-With") !== "modal") {
    return c.redirect(errRedirect("/admin/users", errors.map(renderKey(t)).join(" ")), 302);
  }
  return c.html(
    <UserFormFragment
      lang={c.get("lang")} errors={errors}
      values={{ id: p.id, username: p.username, allStates: p.allStates, selectedRoles: p.roleIds, selectedStates: p.statesRaw, active: p.active, mustChange: p.mustChange }}
      roles={roleList} regions={regionList}
    />,
    400,
  );
}

adminRoutes.post("/users", requirePermission("users.manage"), async (c) => {
  const db = getDb(c.env);
  const t = getDict(c.get("lang"));
  const roleList: { id: number; name: string }[] = (await loadRoles(db)) as any;
  const allRegions = await loadRegionsLite(db, c.get("lang"));
  const body = await c.req.parseBody({ all: true });
  const p = parseUserBody(body, t);
  if (p.password.length < 8) p.errors.push(t("adm.errPw8"));
  const dup = await db.select({ id: users.id }).from(users).where(eq(users.username, p.username)).limit(1);
  if (dup.length > 0) p.errors.push(t("adm.errDupUser"));
  if (!(await validateAssignments(db, p.roleIds, p.statesRaw, p.allStates, p.errors, t)) || p.errors.length > 0) {
    return userFail(c, p, roleList, allRegions);
  }

  const passwordHash = await hashPassword(p.password, parseIterations(c.env.PBKDF2_ITERATIONS));
  const created = await db.insert(users)
    .values({ username: p.username, passwordHash, active: p.active, mustChangePassword: p.mustChange })
    .returning({ id: users.id });
  const newId = created[0]!.id;
  for (const roleId of p.roleIds) await db.insert(userRoles).values({ userId: newId, roleId });
  const stateIds = p.allStates ? [0] : p.statesRaw;
  for (const regionId of stateIds) await db.insert(userStateAssignments).values({ userId: newId, regionId });
  return c.redirect("/admin/users?ok=user-created", 302);
});

adminRoutes.post("/users/:id", requirePermission("users.manage"), async (c) => {
  const db = getDb(c.env);
  const id = Number(c.req.param("id"));
  const me = c.get("user").id;
  const t = getDict(c.get("lang"));
  if (!Number.isInteger(id) || id < 1 || id === me) {
    return c.redirect(errRedirect("/admin/users", t("adm.errSelfEdit")), 302);
  }
  const roleList: { id: number; name: string }[] = (await loadRoles(db)) as any;
  const allRegions = await loadRegionsLite(db, c.get("lang"));
  const body = await c.req.parseBody({ all: true });
  const p = parseUserBody(body, t);
  p.id = id;
  const target = await db.select({ id: users.id, username: users.username }).from(users).where(eq(users.id, id)).limit(1);
  if (!target[0]) return c.redirect(errRedirect("/admin/users", t("adm.errNoAccount")), 302);
  const dup = await db.select({ id: users.id }).from(users)
    .where(eq(users.username, p.username)).limit(1);
  if (dup[0] && dup[0].id !== id) p.errors.push(t("adm.errDupUser"));
  if (p.newPassword && p.newPassword.length < 8) p.errors.push(t("adm.errPw8New"));
  if (!(await validateAssignments(db, p.roleIds, p.statesRaw, p.allStates, p.errors, t)) || p.errors.length > 0) {
    return userFail(c, p, roleList, allRegions);
  }

  const updates: Record<string, string | number> = {
    username: p.username, active: p.active, mustChangePassword: p.mustChange,
  };
  if (p.newPassword) {
    updates.passwordHash = await hashPassword(p.newPassword, parseIterations(c.env.PBKDF2_ITERATIONS));
    updates.mustChangePassword = 1;
  }
  await db.update(users).set(updates).where(eq(users.id, id));

  await db.delete(userRoles).where(eq(userRoles.userId, id));
  for (const roleId of p.roleIds) await db.insert(userRoles).values({ userId: id, roleId });
  await db.delete(userStateAssignments).where(eq(userStateAssignments.userId, id));
  for (const regionId of p.allStates ? [0] : p.statesRaw) {
    await db.insert(userStateAssignments).values({ userId: id, regionId });
  }
  return c.redirect("/admin/users?ok=user-updated", 302);
});

// ---------- Roles ----------

function validPerms(vals: string[]): Permission[] {
  const set = new Set(PERMISSIONS as readonly string[]);
  return vals.filter((v): v is Permission => set.has(v));
}

adminRoutes.get("/roles", requirePermission("roles.manage"), async (c) => {
  const db = getDb(c.env);
  return c.html(
    <AdminRolesPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))}
      roles={(await loadRoles(db)) as AdminRoleRow[]} createErrors={[]} saveErrors={[]}
      lang={c.get("lang")}
    />,
  );
});

/** Bare new-role form for the js-add-modal fetch. */
adminRoutes.get("/roles/new", requirePermission("roles.manage"), (c) => {
  const lang = c.get("lang");
  return c.html(
    <RoleFormFragment lang={lang} errors={!!c.req.query("errors") ? [] : []} values={{}} />,
  );
});

adminRoutes.post("/roles", requirePermission("roles.manage"), async (c) => {
  const db = getDb(c.env);
  const body = await c.req.parseBody({ all: true });
  const name = s(body.name);
  const description = s(body.description);
  const perms = validPerms(multi(body.permissions));
  const t = getDict(c.get("lang"));
  const fromModal = c.req.header("X-Requested-With") === "modal";
  const fail = (msg: string) =>
    fromModal
      ? c.html(
          <RoleFormFragment lang={c.get("lang")} errors={[msg]} values={{ name, description, permissions: perms }} />,
          400,
        )
      : c.redirect(errRedirect("/admin/roles", msg), 302);
  if (name.length < 2) return fail(t("adm.errRoleName"));
  const dup = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1);
  if (dup[0]) return fail(t("adm.errRoleDup"));
  const created = await db.insert(roles)
    .values({ name, description: description || null, isSystem: 0 })
    .returning({ id: roles.id });
  const roleId = created[0]!.id;
  for (const p of perms) await db.insert(rolePermissions).values({ roleId, permission: p });
  return c.redirect("/admin/roles?ok=role-created", 302);
});

async function loadRoleOrRedirect(db: DB, rawId: string) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) return null;
  const rows = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Bare edit-role form for the js-edit-modal fetch. */
adminRoutes.get("/roles/:id/edit", requirePermission("roles.manage"), async (c) => {
  const lang = c.get("lang");
  const role = await loadRoleOrRedirect(getDb(c.env), c.req.param("id"));
  if (!role) return c.redirect("/admin/roles?err=err-notfound", 302);
  const all = await loadRoles(getDb(c.env));
  const info = all.find((r) => r.id === role.id);
  return c.html(
    <RoleFormFragment lang={lang} edit existing={info as AdminRoleRow} errors={[]} />,
  );
});

adminRoutes.post("/roles/:id", requirePermission("roles.manage"), async (c) => {
  const db = getDb(c.env);
  const t = getDict(c.get("lang"));
  const role = await loadRoleOrRedirect(db, c.req.param("id"));
  if (!role) return c.redirect(errRedirect("/admin/roles", t("adm.errNoRole")), 302);
  const body = await c.req.parseBody({ all: true });
  const perms = validPerms(multi(body.permissions));
  const fromModal = c.req.header("X-Requested-With") === "modal";
  if (fromModal && !perms.length) {
    const all = await loadRoles(db);
    const info = all.find((r) => r.id === role.id) as AdminRoleRow;
    return c.html(
      <RoleFormFragment lang={c.get("lang")} edit existing={info} errors={[t("adm.errRoleBad")]} />,
      400,
    );
  }
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
  for (const p of perms) await db.insert(rolePermissions).values({ roleId: role.id, permission: p });
  return c.redirect("/admin/roles?ok=role-updated", 302);
});

adminRoutes.post("/roles/:id/delete", requirePermission("roles.manage"), async (c) => {
  const db = getDb(c.env);
  const role = await loadRoleOrRedirect(db, c.req.param("id"));
  if (!role) return c.redirect(errRedirect("/admin/roles", getDict(c.get("lang"))("adm.errNoRole")), 302);
  if (role.isSystem === 1) return c.redirect(errRedirect("/admin/roles", "err-systemrole"), 302);
  await db.delete(roles).where(eq(roles.id, role.id));
  return c.redirect("/admin/roles?ok=role-deleted", 302);
});

// ---------- Lookup options ----------

/** ""/absent -> 0 (all states); a region id -> itself; anything else -> false (invalid). */
async function parseRegionId(db: DB, raw: unknown): Promise<number | false> {
  const v = s(raw);
  if (v === "") return 0;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return false;
  const rows = await db.select({ id: regions.id }).from(regions).where(eq(regions.id, n)).limit(1);
  return rows[0] ? n : false;
}

/** ""/absent -> null (no parent); a valid option id of the expected parent type -> itself; else false.
 * Types without a parent chain (group, ethnicity, ...) always have no parent. */
async function parseParentId(db: DB, raw: unknown, parentType: string | undefined): Promise<number | null | false> {
  if (!parentType) return null;
  const v = s(raw);
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return false;
  const rows = await db.select({ id: lookupOptions.id }).from(lookupOptions)
    .where(and(eq(lookupOptions.id, n), eq(lookupOptions.type, parentType))).limit(1);
  return rows[0] ? n : false;
}

async function optionsPage(c: any, type: string, opts: {
  addErrors?: string[];
  editError?: string | null;
  /** Bare add form (no layout) for the js-add-modal fetch. */
  modal?: boolean;
  /** Inline add card on the full page (no-JS fallback for the + Add button). */
  showAddForm?: boolean;
} = {}, scope: OptionScope = { scopeAll: true, stateIds: [] }) {
  const db = getDb(c.env);
  const lang: "mm" | "en" = c.get("lang");
  const t = getDict(lang);
  if (!isOptionType(type)) type = OPTION_TYPES[0]!;
  const admin = isOptionsAdmin(scope);
  const stateListAll = await loadRegionsLite(db, lang);
  // State managers pick only among their own states; no "all states" choice.
  const stateList = admin ? stateListAll : stateListAll.filter((r) => scope.stateIds.includes(r.id));
  if (opts.modal) {
    const all = await loadAllOptions(db);
    const parentType = PARENT_TYPE[type];
    return c.html(
      <AddOptionForm type={type} lang={lang} regions={stateList} modal lockRegion={!admin && stateList.length === 1}
        parentOptions={parentType ? all.filter((o) => o.type === parentType && o.active === 1 && canManageOption(scope, o.regionId === 0 ? 0 : o.regionId)) : []} />,
    );
  }
  const all = await loadAllOptions(db);
  const byId = new Map(all.map((o) => [o.id, o] as const));
  const list = all
    .filter((o) => o.type === type)
    // State managers see only options anchored inside their states (all-states
    // options belong to the global admin and are hidden from them).
    .filter((o) => admin || canManageOption(scope, effectiveRegion(o, byId)));
  const column = OPTION_RAW_COLUMN[type as OptionType];
  // 'township' stores its label in members.township (no id), so usage is counted by label.
  const usageRows: { oid: string | number; n: number }[] = type === "township"
    ? await db.all<{ oid: string; n: number }>(
        sql`SELECT township AS oid, COUNT(*) AS n FROM members WHERE township IS NOT NULL AND township <> '' GROUP BY township`,
      )
    : await db.all<{ oid: number; n: number }>(
        sql.raw(`SELECT ${column} AS oid, COUNT(*) AS n FROM members WHERE ${column} IS NOT NULL GROUP BY ${column}`),
      );
  const usage = new Map(usageRows.map((u) => [u.oid, u.n]));
  const stateNames = stateListAll;
  const stateName = (id: number | null) =>
    id == null ? null : stateNames.find((r) => r.id === id)?.name ?? null;
  const labelById = new Map(all.map((o) => [o.id, o.label] as const));
  const options: OptionUsage[] = list.map((o) => ({
    id: o.id, label: o.label, active: o.active,
    used: usage.get(type === "township" ? o.label : o.id) ?? 0,
    state: stateName(o.regionId ?? null),
    parent: o.parentId ? labelById.get(o.parentId) ?? null : null,
  }));
  const regionCount = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM regions`);
  const types = admin
    ? optionTabs(all, { region: Number(regionCount[0]?.n ?? 0), ageGroup: await ageGroupCount(db) }, t("adm.ageTab"))
    : OPTION_TYPES.filter((k) => isRegionScopedType(k)).map((k) => {
        const entry = all.filter((o) => o.type === k && canManageOption(scope, effectiveRegion(o, byId)));
        return { key: k, label: OPTION_TYPE_LABELS[k], active: entry.some((o) => o.active === 1), count: entry.length };
      });
  return c.html(
    <AdminOptionsPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))}
      type={type} typeLabel={(lang === "en" ? OPTION_TYPE_LABELS_EN : OPTION_TYPE_LABELS)[type as OptionType]} types={types}
      options={options} regions={stateList}
      lockRegion={!admin && stateList.length === 1}
      parentOptions={PARENT_TYPE[type]
        ? all.filter((o) => o.type === PARENT_TYPE[type] && o.active === 1 && canManageOption(scope, o.regionId))
        : []}
      addErrors={opts.addErrors ?? []} editError={opts.editError ?? null}
      showAddForm={opts.showAddForm} lang={c.get("lang")}
    />,
  );
}

type Tab = { key: string; label: string; active: boolean; count?: number | null };

/** Option page tabs — State/Region, Age Groups, then lookup option types.
 * count = items per tab, shown as a small badge (wayfinding). */
function optionTabs(
  all: OptionRow[],
  counts: { region: number | null; ageGroup: number | null },
  ageTabLabel: string,
): Tab[] {
  return [
    { key: "region", label: "", active: true, count: counts.region },
    { key: "age_group", label: ageTabLabel, active: true, count: counts.ageGroup },
    ...OPTION_TYPES.map((k) => {
      const entry = all.filter((o) => o.type === k);
      return { key: k, label: OPTION_TYPE_LABELS[k], active: entry.some((o) => o.active === 1), count: entry.length };
    }),
  ];
}

async function ageGroupCount(db: DB): Promise<number> {
  const rows = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM age_groups`);
  return Number(rows[0]?.n ?? 0);
}

adminRoutes.get("/options", requirePermission("options.manage"), async (c) => {
  const scope = optionScopeOf(c);
  const opts = { modal: c.req.query("modal") === "1", showAddForm: c.req.query("add") === "1" };
  // Default tab differs by scope: admins start on the first lookup type, state
  // managers start on Township (their first manageable type) instead of
  // bouncing off ethnicity with a confusing 403.
  const rawType = c.req.query("type") ?? (isOptionsAdmin(scope) ? OPTION_TYPES[0]! : "township");
  const type = rawType;
  // State managers only get the four region-scoped types, in their own states.
  if (!isOptionsAdmin(scope)) {
    if (!isRegionScopedType(type)) return forbidden(c);
    return optionsPage(c, type, opts, scope);
  }
  if (type === "region") return regionOptionsPage(c, opts);
  if (type === "age_group") return ageGroupsPage(c, opts);
  return optionsPage(c, type, opts, scope);
});

// ---------- Age groups (dashboard breakdown, admin-adjustable) ----------

type AgeGroupRow = { id: number; name: string; min_age: number; max_age: number };

async function loadAgeGroups(db: DB): Promise<AgeGroupRow[]> {
  return await db.all<AgeGroupRow>(
    sql`SELECT id, name, min_age, max_age FROM age_groups ORDER BY sort_order, min_age`,
  );
}

async function ageGroupsPage(c: any, opts: { modal?: boolean; showAddForm?: boolean } = {}) {
  const db = getDb(c.env);
  const lang: "mm" | "en" = c.get("lang");
  if (opts.modal) return c.html(<AddAgeGroupForm lang={lang} modal />);
  const t = getDict(lang);
  const rows = await loadAgeGroups(db);
  const all = await loadAllOptions(db);
  const regionCount = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM regions`);
  return c.html(
    <AdminOptionsPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), lang)}
      type="age_group" typeLabel={t("adm.ageTab")}
      types={optionTabs(all, { region: Number(regionCount[0]?.n ?? 0), ageGroup: rows.length }, t("adm.ageTab"))}
      ageGroupRows={rows}
      addErrors={[]} editError={null} showAddForm={opts.showAddForm}
      lang={lang}
    />,
  );
}

adminRoutes.post("/options", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const t = getDict(c.get("lang"));
  const scope = optionScopeOf(c);
  const fromModal = c.req.header("X-Requested-With") === "modal";
  const body = await c.req.parseBody();
  const type = s(body.type);
  const label = s(body.label);
  const back = `/admin/options${type ? `?type=${encodeURIComponent(type)}` : ""}`;
  const allRegions = await loadRegionsLite(db, c.get("lang"));
  // State managers pick only among their own states.
  const stateList = isOptionsAdmin(scope) ? allRegions : allRegions.filter((r) => scope.stateIds.includes(r.id));
  const fail = (msg: string) =>
    fromModal
      ? c.html(
          <AddOptionForm type={type} lang={c.get("lang")} errors={[msg]} value={label}
            regions={stateList} regionId={s(body.region_id)} parentId={s(body.parent_id)}
            lockRegion={!isOptionsAdmin(scope) && stateList.length === 1} modal />,
          400,
        )
      : c.redirect(errRedirect(back, msg), 302);
  if (!canManageType(scope, type)) return forbidden(c);
  if (!isOptionType(type)) return fail(t("adm.errOptionType"));
  if (label.length < 1 || label.length > 120) return fail(t("adm.errLabelRequired"));
  const regionId = await parseRegionId(db, body.region_id);
  if (regionId === false) return fail(t("adm.errStateBad"));
  const parentType = PARENT_TYPE[type];
  const parentId = await parseParentId(db, body.parent_id, parentType);
  if (parentId === false) return fail(t("adm.errParentBad"));
  const all = await loadAllOptions(db);
  // Same label may exist per state (or once as an all-states option), so the
  // duplicate check is scoped to this region.
  if (findOption(all, type, label, regionId)) return fail(t("adm.errLabelDup"));
  // A parented option inherits its parent's state; an all-states parent means
  // the child is all-states too unless a state was picked explicitly.
  let anchorRegion = regionId;
  if (parentId != null) {
    const parent = all.find((o) => o.id === parentId);
    if (parent && parent.regionId !== 0) anchorRegion = parent.regionId;
  }
  // State managers may only anchor options inside their own states. When a
  // parent is chosen its state wins — verify that state, not the picked one.
  if (!canManageOption(scope, anchorRegion)) return fail(t("adm.errStateBad"));
  await db.insert(lookupOptions).values({ type, label, regionId: anchorRegion, parentId });
  return c.redirect(`${back}${back.includes("?") ? "&" : "?"}ok=option-added`, 302);
});

adminRoutes.get("/options/:id/edit", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const lang = c.get("lang");
  const scope = optionScopeOf(c);
  const admin = isOptionsAdmin(scope);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/options?err=err-notfound", 302);
  const rows = await db.select().from(lookupOptions).where(eq(lookupOptions.id, id)).limit(1);
  const current = rows[0];
  if (!current) return c.redirect("/admin/options?err=err-notfound", 302);
  if (!canManageType(scope, current.type)) return forbidden(c);
  const allOpts = await loadAllOptions(db);
  const byId = new Map(allOpts.map((o) => [o.id, o] as const));
  if (!canManageOption(scope, effectiveRegion(current, byId))) return forbidden(c);
  const allRegions = await loadRegionsLite(db, lang);
  const stateList = admin ? allRegions : allRegions.filter((r) => scope.stateIds.includes(r.id));
  const parentType = PARENT_TYPE[current.type];
  const formProps = {
    id, label: current.label, lang,
    type: current.type, regions: stateList,
    lockRegion: !admin && stateList.length === 1,
    regionId: current.regionId === 0 ? "" : String(current.regionId),
    parentId: current.parentId == null ? "" : String(current.parentId),
    parentOptions: parentType
      ? allOpts.filter((o) => o.type === parentType && o.active === 1 && canManageOption(scope, o.regionId))
      : [],
  };
  if (c.req.query("modal") === "1") return c.html(<EditOptionForm {...formProps} modal />);
  const t = getDict(lang);
  return c.html(
    <Layout title={t("adm.optionsTitle")} lang={lang} user={c.get("user")} perms={c.get("perms")} active="/admin/options" flash={null}>
      <div class="page-head">
        <h1>{t("adm.optionsTitle")}: {current.label}</h1>
        <a class="btn secondary" href={`/admin/options?type=${encodeURIComponent(current.type)}`}>{t("members.toList")}</a>
      </div>
      <div class="card">
        <EditOptionForm {...formProps} />
      </div>
    </Layout>,
  );
});

adminRoutes.post("/options/:id", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = optionScopeOf(c);
  const admin = isOptionsAdmin(scope);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/options?err=err-notfound", 302);
  const rows = await db.select().from(lookupOptions).where(eq(lookupOptions.id, id)).limit(1);
  const current = rows[0];
  if (!current) return c.redirect("/admin/options?err=err-notfound", 302);
  if (!canManageType(scope, current.type)) return forbidden(c);
  const allOpts0 = await loadAllOptions(db);
  const byId = new Map(allOpts0.map((o) => [o.id, o] as const));
  if (!canManageOption(scope, effectiveRegion(current, byId))) return forbidden(c);
  const back = `/admin/options?type=${encodeURIComponent(current.type)}`;
  const body = await c.req.parseBody();

  if (s(body.toggle) === "1") {
    await db.update(lookupOptions).set({ active: current.active === 1 ? 0 : 1 }).where(eq(lookupOptions.id, id));
    return c.redirect(`${back}&ok=option-updated`, 302);
  }

  const t = getDict(c.get("lang"));
  const label = s(body.label);
  const regionId = await parseRegionId(db, body.region_id);
  const parentType = PARENT_TYPE[current.type];
  const parentId = await parseParentId(db, body.parent_id, parentType);
  const fromModal = c.req.header("X-Requested-With") === "modal";
  const allRegions = await loadRegionsLite(db, c.get("lang"));
  const stateList = admin ? allRegions : allRegions.filter((r) => scope.stateIds.includes(r.id));
  const allOpts = allOpts0;
  const parentOptions = parentType
    ? allOpts.filter((o) => o.type === parentType && o.active === 1 && canManageOption(scope, o.regionId))
    : [];
  const fail = (msg: string) => {
    const fp = {
      id, label, lang: c.get("lang"), type: current.type, regions: stateList, parentOptions,
      lockRegion: !admin && stateList.length === 1,
      regionId: regionId === false ? s(body.region_id) : regionId === 0 ? "" : String(regionId),
      parentId: parentId === false ? s(body.parent_id) : parentId == null ? "" : String(parentId),
    };
    return fromModal
      ? c.html(<EditOptionForm {...fp} errors={[msg]} modal />, 400)
      : c.redirect(errRedirect(back, msg), 302);
  };
  if (label.length < 1 || label.length > 120) return fail(t("adm.errLabelRequired"));
  if (regionId === false) return fail(t("adm.errStateBad"));
  if (parentId === false) return fail(t("adm.errParentBad"));
  const clash = findOption(allOpts, current.type, label, regionId);
  if (clash && clash.id !== id) return fail(t("adm.errLabelDup"));
  let anchorRegion = regionId;
  if (parentId != null) {
    const parent = allOpts.find((o) => o.id === parentId);
    if (parent && parent.regionId !== 0) anchorRegion = parent.regionId;
  }
  // State managers cannot move an option out of their own states (or onto an
  // all-states parent) — re-verify the target anchor before saving.
  if (!canManageOption(scope, anchorRegion)) return fail(t("adm.errStateBad"));
  await db.update(lookupOptions).set({ label, regionId: anchorRegion, parentId }).where(eq(lookupOptions.id, id));
  return c.redirect(`${back}&ok=option-updated`, 302);
});

adminRoutes.post("/options/:id/delete", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = optionScopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/options?err=err-notfound", 302);
  const rows = await db.select().from(lookupOptions).where(eq(lookupOptions.id, id)).limit(1);
  const current = rows[0];
  if (!current) return c.redirect("/admin/options?err=err-notfound", 302);
  if (!canManageType(scope, current.type)) return forbidden(c);
  const allOpts = await loadAllOptions(db);
  const byId = new Map(allOpts.map((o) => [o.id, o] as const));
  if (!canManageOption(scope, effectiveRegion(current, byId))) return forbidden(c);
  const back = `/admin/options?type=${encodeURIComponent(current.type)}`;

  const column = OPTION_RAW_COLUMN[current.type as OptionType];
  // 'township' lives on members as a text label, not an id — count by label.
  const used = current.type === "township"
    ? await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM members WHERE township = ${current.label}`)
    : column
      ? await db.all<{ n: number }>(sql.raw(`SELECT COUNT(*) AS n FROM members WHERE ${column} = ${id}`))
      : [{ n: 0 }];
  if ((used[0]?.n ?? 0) > 0) {
    await db.update(lookupOptions).set({ active: 0 }).where(eq(lookupOptions.id, id));
    return c.redirect(`${back}&err=${encodeURIComponent("err-used")}`, 302);
  }
  await db.delete(lookupOptions).where(eq(lookupOptions.id, id));
  return c.redirect(`${back}&ok=option-deleted`, 302);
});

// ---------- Age groups (dashboard breakdown, admin-adjustable) ----------

function parseAgeRange(minRaw: string, maxRaw: string): { min: number; max: number } | null {
  const min = Number(minRaw);
  const max = Number(maxRaw);
  if (!Number.isInteger(min) || !Number.isInteger(max)) return null;
  if (min < 0 || max > 150 || min > max) return null;
  return { min, max };
}

async function ageRangeClash(db: DB, min: number, max: number, excludeId?: number): Promise<boolean> {
  const rows = await db.select({ id: ageGroups.id, minAge: ageGroups.minAge, maxAge: ageGroups.maxAge }).from(ageGroups);
  return rows.some((g) => g.id !== excludeId && min <= g.maxAge && g.minAge <= max);
}

adminRoutes.post("/age-groups", requirePermission("options.manage"), async (c) => {
  if (!optionScopeOf(c).scopeAll) return forbidden(c);
  const db = getDb(c.env);
  const t = getDict(c.get("lang"));
  const fromModal = c.req.header("X-Requested-With") === "modal";
  const body = await c.req.parseBody();
  const name = s(body.name);
  const minRaw = s(body.min_age);
  const maxRaw = s(body.max_age);
  const back = "/admin/options?type=age_group";
  const fail = (msg: string) =>
    fromModal
      ? c.html(<AddAgeGroupForm lang={c.get("lang")} errors={[msg]} values={{ name, min_age: minRaw, max_age: maxRaw }} modal />, 400)
      : c.redirect(errRedirect(back, msg), 302);
  if (name.length < 1 || name.length > 60) return fail(t("adm.errAgeName"));
  const range = parseAgeRange(minRaw, maxRaw);
  if (!range) return fail(t("adm.errAgeRange"));
  const dup = await db.select({ id: ageGroups.id }).from(ageGroups).where(eq(ageGroups.name, name)).limit(1);
  if (dup[0]) return fail(t("adm.errAgeNameDup"));
  if (await ageRangeClash(db, range.min, range.max)) return fail(t("adm.errAgeOverlap"));
  await db.insert(ageGroups).values({ name, minAge: range.min, maxAge: range.max, sortOrder: range.min });
  return c.redirect(`${back}&ok=age-group-added`, 302);
});

adminRoutes.get("/age-groups/:id/edit", requirePermission("options.manage"), async (c) => {
  if (!optionScopeOf(c).scopeAll) return forbidden(c);
  const db = getDb(c.env);
  const lang = c.get("lang");
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/options?type=age_group&err=err-notfound", 302);
  const rows = await db.select().from(ageGroups).where(eq(ageGroups.id, id)).limit(1);
  const current = rows[0];
  if (!current) return c.redirect("/admin/options?type=age_group&err=err-notfound", 302);
  const values = { name: current.name, min_age: String(current.minAge), max_age: String(current.maxAge) };
  if (c.req.query("modal") === "1") return c.html(<EditAgeGroupForm id={id} values={values} lang={lang} modal />);
  const t = getDict(lang);
  return c.html(
    <Layout title={t("adm.ageTab")} lang={lang} user={c.get("user")} perms={c.get("perms")} active="/admin/options" flash={null}>
      <div class="page-head">
        <h1>{t("adm.ageTab")}: {current.name}</h1>
        <a class="btn secondary" href="/admin/options?type=age_group">{t("members.toList")}</a>
      </div>
      <div class="card">
        <EditAgeGroupForm id={id} values={values} lang={lang} />
      </div>
    </Layout>,
  );
});

adminRoutes.post("/age-groups/:id", requirePermission("options.manage"), async (c) => {
  if (!optionScopeOf(c).scopeAll) return forbidden(c);
  const db = getDb(c.env);
  const t = getDict(c.get("lang"));
  const fromModal = c.req.header("X-Requested-With") === "modal";
  const back = "/admin/options?type=age_group";
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect(`${back}&err=err-notfound`, 302);
  const rows = await db.select().from(ageGroups).where(eq(ageGroups.id, id)).limit(1);
  if (!rows[0]) return c.redirect(`${back}&err=err-notfound`, 302);
  const body = await c.req.parseBody();
  const name = s(body.name);
  const minRaw = s(body.min_age);
  const maxRaw = s(body.max_age);
  const fail = (msg: string) =>
    fromModal
      ? c.html(<EditAgeGroupForm id={id} lang={c.get("lang")} errors={[msg]} values={{ name, min_age: minRaw, max_age: maxRaw }} modal />, 400)
      : c.redirect(errRedirect(back, msg), 302);
  if (name.length < 1 || name.length > 60) return fail(t("adm.errAgeName"));
  const range = parseAgeRange(minRaw, maxRaw);
  if (!range) return fail(t("adm.errAgeRange"));
  const dup = await db.select({ id: ageGroups.id }).from(ageGroups).where(eq(ageGroups.name, name)).limit(1);
  if (dup[0] && dup[0].id !== id) return fail(t("adm.errAgeNameDup"));
  if (await ageRangeClash(db, range.min, range.max, id)) return fail(t("adm.errAgeOverlap"));
  await db.update(ageGroups)
    .set({ name, minAge: range.min, maxAge: range.max, sortOrder: range.min })
    .where(eq(ageGroups.id, id));
  return c.redirect(`${back}&ok=age-group-updated`, 302);
});

adminRoutes.post("/age-groups/:id/delete", requirePermission("options.manage"), async (c) => {
  if (!optionScopeOf(c).scopeAll) return forbidden(c);
  const db = getDb(c.env);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/options?type=age_group&err=err-notfound", 302);
  const rows = await db.select().from(ageGroups).where(eq(ageGroups.id, id)).limit(1);
  if (!rows[0]) return c.redirect("/admin/options?type=age_group&err=err-notfound", 302);
  await db.delete(ageGroups).where(eq(ageGroups.id, id));
  return c.redirect("/admin/options?type=age_group&ok=age-group-deleted", 302);
});

// ---------- State/Region management (Options > State/Region tab) ----------

type RegionRow = { id: number; name: string; name_en: string; used: number };

async function loadRegionRows(db: DB): Promise<RegionRow[]> {
  const rows = await db.all<{ id: number; name: string; name_en: string | null; used: number }>(sql`
    SELECT r.id, r.name, r.name_en,
      (SELECT COUNT(*) FROM members m WHERE m.region_id = r.id)
      + (SELECT COUNT(*) FROM user_state_assignments sa WHERE sa.region_id = r.id) AS used
    FROM regions r ORDER BY r.id`);
  return rows.map((r) => ({ id: r.id, name: r.name, name_en: r.name_en ?? "", used: Number(r.used) }));
}

function regionBack(): string {
  return "/admin/options?type=region";
}

function slugify(v: string): string {
  const base = v.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  return base || "region";
}

async function uniqueRegionSlug(db: DB, base: string): Promise<string> {
  const rows = await db.select({ slug: regions.slug }).from(regions);
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

async function regionOptionsPage(c: any, opts: { modal?: boolean; showAddForm?: boolean } = {}) {
  const db = getDb(c.env);
  const lang: "mm" | "en" = c.get("lang");
  const t = getDict(lang);
  if (opts.modal) return c.html(<AddRegionForm lang={lang} modal />);
  const all = await loadAllOptions(db);
  const regionRows = await loadRegionRows(db);
  return c.html(
    <AdminOptionsPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), lang)}
      type="region" typeLabel={getDict(lang)("adm.regionTab")}
      types={optionTabs(all, { region: regionRows.length, ageGroup: await ageGroupCount(db) }, t("adm.ageTab"))}
      regionRows={regionRows}
      addErrors={[]} editError={null} showAddForm={opts.showAddForm}
      lang={lang}
    />,
  );
}

adminRoutes.post("/regions", requirePermission("options.manage"), async (c) => {
  if (!optionScopeOf(c).scopeAll) return forbidden(c);
  const db = getDb(c.env);
  const t = getDict(c.get("lang"));
  const fromModal = c.req.header("X-Requested-With") === "modal";
  const fail = (msg: string) =>
    fromModal
      ? c.html(<AddRegionForm lang={c.get("lang")} errors={[msg]} values={{ name, name_en: nameEn }} modal />, 400)
      : c.redirect(errRedirect(regionBack(), msg), 302);
  const body = await c.req.parseBody();
  const name = s(body.name);
  const nameEn = s(body.name_en);
  if (name.length < 1 || name.length > 120) return fail(t("adm.errRegionName"));
  const dup = await db.select({ id: regions.id }).from(regions).where(eq(regions.name, name)).limit(1);
  if (dup[0]) return fail(t("adm.errRegionDup"));
  const slug = await uniqueRegionSlug(db, slugify(nameEn || name));
  await db.insert(regions).values({ name, nameEn: nameEn || name, slug });
  return c.redirect(`${regionBack()}&ok=region-added`, 302);
});

adminRoutes.get("/regions/:id/edit", requirePermission("options.manage"), async (c) => {
  if (!optionScopeOf(c).scopeAll) return forbidden(c);
  const db = getDb(c.env);
  const lang = c.get("lang");
  const back = regionBack();
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect(`${back}&err=err-notfound`, 302);
  const rows = await db.select().from(regions).where(eq(regions.id, id)).limit(1);
  const current = rows[0];
  if (!current) return c.redirect(`${back}&err=err-notfound`, 302);
  const values = { name: current.name, name_en: current.nameEn ?? "" };
  if (c.req.query("modal") === "1") return c.html(<EditRegionForm id={id} values={values} lang={lang} modal />);
  const t = getDict(lang);
  return c.html(
    <Layout title={t("adm.optionsTitle")} lang={lang} user={c.get("user")} perms={c.get("perms")} active="/admin/options" flash={null}>
      <div class="page-head">
        <h1>{t("adm.optionsTitle")}: {current.name}</h1>
        <a class="btn secondary" href={back}>{t("members.toList")}</a>
      </div>
      <div class="card">
        <EditRegionForm id={id} values={values} lang={lang} />
      </div>
    </Layout>,
  );
});

adminRoutes.post("/regions/:id", requirePermission("options.manage"), async (c) => {
  if (!optionScopeOf(c).scopeAll) return forbidden(c);
  const db = getDb(c.env);
  const t = getDict(c.get("lang"));
  const back = regionBack();
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect(`${back}&err=err-notfound`, 302);
  const rows = await db.select().from(regions).where(eq(regions.id, id)).limit(1);
  if (!rows[0]) return c.redirect(`${back}&err=err-notfound`, 302);
  const body = await c.req.parseBody();
  const name = s(body.name);
  const nameEn = s(body.name_en);
  const fromModal = c.req.header("X-Requested-With") === "modal";
  const fail = (msg: string) =>
    fromModal
      ? c.html(<EditRegionForm id={id} lang={c.get("lang")} values={{ name, name_en: nameEn }} errors={[msg]} modal />, 400)
      : c.redirect(errRedirect(back, msg), 302);
  if (name.length < 1 || name.length > 120) return fail(t("adm.errRegionName"));
  const dup = await db.select({ id: regions.id }).from(regions).where(eq(regions.name, name)).limit(1);
  if (dup[0] && dup[0].id !== id) return fail(t("adm.errRegionDup"));
  await db.update(regions).set({ name, nameEn: nameEn || name }).where(eq(regions.id, id));
  return c.redirect(`${back}&ok=region-updated`, 302);
});

adminRoutes.post("/regions/:id/delete", requirePermission("options.manage"), async (c) => {
  if (!optionScopeOf(c).scopeAll) return forbidden(c);
  const db = getDb(c.env);
  const back = regionBack();
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect(`${back}&err=err-notfound`, 302);
  const rows = await db.select().from(regions).where(eq(regions.id, id)).limit(1);
  if (!rows[0]) return c.redirect(`${back}&err=err-notfound`, 302);
  const usedMembers = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM members WHERE region_id = ${id}`);
  const usedUsers = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM user_state_assignments WHERE region_id = ${id}`);
  if ((usedMembers[0]?.n ?? 0) + (usedUsers[0]?.n ?? 0) > 0) {
    return c.redirect(`${back}&err=err-region-used`, 302);
  }
  await db.delete(regions).where(eq(regions.id, id));
  return c.redirect(`${back}&ok=region-deleted`, 302);
});
