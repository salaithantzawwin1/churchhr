import { Hono } from "hono";
import { and, eq, ne, sql } from "drizzle-orm";
import type { AppEnv } from "../env";
import { getDb, type DB } from "../db/client";
import {
  ageGroups, isRegionScopedType, lookupOptions, OPTION_TYPE_LABELS, OPTION_TYPE_LABELS_EN, OPTION_TYPE_LABELS_KR, OPTION_TYPES, regions,
  rolePermissions, roles, userHomeCellAssignments, userRoles, userStateAssignments, users, type OptionType,
} from "../db/schema";
import { clearAccessCache, requireAnyPermission, requirePermission } from "../middleware";
import { ForbiddenPage } from "../views/errors";
import { flashFromQuery } from "../flash";
import { hashPassword, parseIterations } from "../auth";
import { destroyOtherSessions } from "../session";
import { checkPasswordPolicy } from "../password";
import { abbrevFromLabel, findOption, loadAllOptions, nextCodeCandidate, nextFamilyGroupCode, PARENT_TYPE, OPTION_RAW_COLUMN, isOptionType, isLabelOptionType, townshipOf, type OptionRow } from "../lookup";
import { PERMISSIONS, type Permission } from "../rbac";
import { getDict, type Lang } from "../i18n";
import { addDays, parseDateFlexible, s, todayInYangon } from "../util";
import { Layout } from "../views/layout";
import {
  AddAgeGroupForm, AddOptionForm, AddRegionForm, AdminOptionsPage, AdminRolesPage, AdminUserEditPage, AdminUsersPage,
  EditAgeGroupForm, EditOptionForm, EditRegionForm, RoleFormFragment, UserFormFragment,
  type AdminRoleRow, type AdminUserRow, type OptionUsage,
} from "../views/admin";
import { TownshipCodesPage, type TownshipCodeRow } from "../views/township-codes";
import { AuditLogPage, type AuditRow } from "../views/audit";
import { loadRegionalChurches, regionalChurchName } from "../org-units";
import { loadBranding } from "../branding";
import { BrandingPage } from "../views/branding";

export const adminRoutes = new Hono<AppEnv>();

/** Brand photos use the same browser resizer/cap as member photos. */
const MAX_BRAND_PHOTO_BYTES = 400 * 1024;

function parseBrandPhoto(body: Record<string, unknown>): { bytes: ArrayBuffer | null; touched: boolean; error: string | null } {
  if (s(body.photo_remove) === "1") return { bytes: null, touched: true, error: null };
  const raw = s(body.photo_data);
  if (!raw) return { bytes: null, touched: false, error: null };
  const match = /^data:image\/webp;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw);
  if (!match) return { bytes: null, touched: true, error: "photo-bad" };
  let bytes: Uint8Array;
  try {
    const bin = atob(match[1]!.replace(/\s+/g, ""));
    bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  } catch {
    return { bytes: null, touched: true, error: "photo-bad" };
  }
  if (bytes.length > MAX_BRAND_PHOTO_BYTES) return { bytes: null, touched: true, error: "photo-large" };
  const webp = bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (!webp) return { bytes: null, touched: true, error: "photo-bad" };
  return { bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, touched: true, error: null };
}

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

/** Granular structure rights. Home Cells, Family Groups, Townships, Clusters
 * and Regional Churches can be managed with structures.* alone, so a State
 * Manager can build cells in their own states without the admin bundle —
 * including create+update without delete. options.manage still implies all. */
type StructureAction = "view" | "create" | "update" | "delete";

function canStructure(c: any, action: StructureAction): boolean {
  const perms = c.get("perms") as Set<string> | undefined;
  if (!perms) return false;
  return perms.has("options.manage") || perms.has(`structures.${action}`);
}

/** 403 for state managers touching admin-only option areas. */
function forbidden(c: any) {
  return c.html(<ForbiddenPage path={new URL(c.req.url).pathname} lang={c.get("lang")} />, 403);
}

type RoleInfo = {
  id: number; name: string; description: string | null; is_system: number; permissions: string[];
  /** Accounts currently holding the role: a role in use cannot be deleted. */
  user_count: number;
};

async function loadRoles(db: DB): Promise<RoleInfo[]> {
  const [roleRows, permRows, countRows] = await Promise.all([
    db.select({ id: roles.id, name: roles.name, description: roles.description, isSystem: roles.isSystem })
      .from(roles)
      .orderBy(roles.id),
    db.select({ roleId: rolePermissions.roleId, permission: rolePermissions.permission })
      .from(rolePermissions),
    db.select({ roleId: userRoles.roleId, n: sql<number>`COUNT(*)` })
      .from(userRoles)
      .groupBy(userRoles.roleId),
  ]);
  return roleRows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    is_system: r.isSystem,
    permissions: permRows.filter((p) => p.roleId === r.id).map((p) => p.permission),
    user_count: Number(countRows.find((c) => c.roleId === r.id)?.n ?? 0),
  }));
}

/** Option-type label in the active UI language. */
function typeLabel(lang: Lang, type: OptionType): string {
  const labels = lang === "mm" ? OPTION_TYPE_LABELS : lang === "kr" ? OPTION_TYPE_LABELS_KR : OPTION_TYPE_LABELS_EN;
  return labels[type];
}

let warnedMissingUserLanguage = false;

async function loadAdminUsers(db: DB, lang: Lang): Promise<AdminUserRow[]> {
  const stateCol = lang !== "mm" ? "COALESCE(r3.name_en, r3.name)" : "r3.name";
  const query = (languageCol: string) => db.all<AdminUserRow & { state_ids: string | null }>(
    sql.raw(`
    SELECT u.id, u.username, u.active, u.must_change_password, ${languageCol}u.created_at,
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
  let rows: (AdminUserRow & { state_ids: string | null })[];
  try {
    rows = await query("u.language, ");
  } catch (err) {
    // Deploy-before-migration safety: the users page still loads without 0013.
    if (!warnedMissingUserLanguage) {
      console.warn("account language unavailable on users page (run D1 migrations):", err);
      warnedMissingUserLanguage = true;
    }
    rows = await query("");
  }
  return rows.map((r: any) => ({
    ...r,
    language: r.language ?? null,
    state_names: r.state_names_raw || "",
    state_ids: r.state_ids ? String(r.state_ids).split(",").map((x) => Number(x)) : [],
  }));
}

async function userAssignments(db: DB, userId: number) {
  const roleRows = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId));
  const stateRows = await db.select({ regionId: userStateAssignments.regionId })
    .from(userStateAssignments).where(eq(userStateAssignments.userId, userId));
  const homeCellRows = await db.select({ homeCellId: userHomeCellAssignments.homeCellId })
    .from(userHomeCellAssignments).where(eq(userHomeCellAssignments.userId, userId));
  return {
    selectedRoles: roleRows.map((r) => r.roleId),
    selectedStates: stateRows.filter((r) => r.regionId !== 0).map((r) => r.regionId),
    selectedHomeCells: homeCellRows.map((r) => r.homeCellId),
    allStates: stateRows.some((r) => r.regionId === 0),
  };
}

/** Home Cells offered as an optional member-list limit, grouped by state. The
 *  state id travels along so the form can hide cells outside the ticked states. */
async function homeCellOptions(db: DB, lang: Lang = "en"): Promise<{ id: number; name: string; regionId: number }[]> {
  const rows = await db.all<{ id: number; label: string; regionId: number | null; state_name: string | null; state_name_en: string | null }>(sql`
    SELECT o.id, o.label, o.region_id AS regionId, r.name AS state_name, r.name_en AS state_name_en
    FROM lookup_options o
    LEFT JOIN regions r ON r.id = o.region_id
    WHERE o.type = 'home_cell' AND o.active = 1
    ORDER BY o.region_id, o.label`);
  return rows.map((r) => {
    const state = lang !== "mm" && r.state_name_en ? r.state_name_en : r.state_name;
    return { id: r.id, name: state ? `${state} · ${r.label}` : r.label, regionId: r.regionId ?? 0 };
  });
}

// ---------- Users ----------

// ---------- Login branding ----------

adminRoutes.get("/branding", requirePermission("users.manage"), async (c) => {
  const db = getDb(c.env);
  return c.html(
    <BrandingPage
      user={c.get("user")} perms={c.get("perms")}
      flash={flashFromQuery(c.req.query(), c.get("lang"))}
      lang={c.get("lang")} branding={await loadBranding(db)} />,
  );
});

adminRoutes.post("/branding", requirePermission("users.manage"), async (c) => {
  const db = getDb(c.env);
  const body = await c.req.parseBody();
  const name = s(body.church_name);
  if (name.length > 80) return c.redirect("/admin/branding?err=brand-name-long", 303);
  const photo = parseBrandPhoto(body);
  if (photo.error) return c.redirect(`/admin/branding?err=brand-${photo.error}`, 303);
  await db.run(sql`INSERT OR IGNORE INTO app_branding (id, updated_at) VALUES (1, unixepoch())`);
  await db.run(sql`
    UPDATE app_branding SET church_name = ${name || null}, updated_at = unixepoch() WHERE id = 1`);
  if (photo.touched) {
    await db.run(sql`
      UPDATE app_branding
         SET photo = ${photo.bytes}, photo_type = ${photo.bytes ? "image/webp" : null},
             updated_at = unixepoch()
       WHERE id = 1`);
  }
  return c.redirect("/admin/branding?ok=branding-saved", 303);
});

adminRoutes.get("/users", requirePermission("users.manage"), async (c) => {
  const db = getDb(c.env);
  // Independent reads issued together: one wait instead of four round-trips.
  const [usersList, roleList, regionsList, homeCells] = await Promise.all([
    loadAdminUsers(db, c.get("lang")),
    loadRoles(db),
    loadRegionsLite(db, c.get("lang")),
    homeCellOptions(db, c.get("lang")),
  ]);
  return c.html(
    <AdminUsersPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))}
      users={usersList} roles={roleList} regions={regionsList}
      homeCells={homeCells}
      editUser={null} createErrors={[]} editErrors={[]}
      lang={c.get("lang")}
    />,
  );
});

async function loadRegionsLite(db: DB, lang: Lang = "en"): Promise<{ id: number; name: string }[]> {
  const rows = await db.all<{ id: number; name: string; name_en: string }>(sql`SELECT id, name, name_en FROM regions ORDER BY id`);
  return rows.map((r) => ({ id: r.id, name: lang !== "mm" && r.name_en ? r.name_en : r.name }));
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
      roles={await loadRoles(db)} regions={await loadRegionsLite(db, c.get("lang"))}
      homeCells={await homeCellOptions(db, c.get("lang"))} editErrors={[]}
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
      values={{ username: "", allStates: false, selectedRoles: [], selectedStates: [], homeCellIds: [], active: 1, mustChange: 1 }}
      roles={(await loadRoles(db)) as any} regions={await loadRegionsLite(db, c.get("lang"))}
      homeCells={await homeCellOptions(db, c.get("lang"))}
    />,
  );
});

function parseUserBody(body: Record<string, unknown>, t: (k: string) => string) {
  const username = s(body.username);
  const password = s(body.password);
  const newPassword = s(body.new_password);
  const roleIds = ints(multi(body.roles));
  const statesRaw = ints(multi(body.states));
  const homeCellsRaw = ints(multi(body.home_cells));
  const allStates = s(body.all_states) === "1";
  const active = s(body.active) === "1" ? 1 : 0;
  const mustChange = s(body.must_change) === "1" ? 1 : 0;
  const errors: string[] = [];
  if (!/^[A-Za-z0-9_.\-]{3,32}$/.test(username)) errors.push(t("adm.errUsername"));
  return { id: undefined as number | undefined, username, password, newPassword, roleIds, statesRaw, homeCellsRaw, allStates, active, mustChange, errors };
}

async function validateAssignments(
  db: DB, roleIds: number[], statesRaw: number[], homeCellsRaw: number[], allStates: boolean,
  errors: string[], _t: (k: string) => string,
) {
  const roleList = await loadRoles(db);
  if (roleIds.length === 0) errors.push("adm.errRoleRequired");
  if (roleIds.some((id) => !roleList.some((r) => r.id === id))) errors.push("adm.errRoleBad");
  if (!allStates && statesRaw.length === 0) errors.push("adm.errStateRequired");
  if (statesRaw.length > 0) {
    const regionIds = new Set((await loadRegionsLite(db)).map((r) => r.id));
    if (statesRaw.some((id) => !regionIds.has(id))) errors.push("adm.errStateBad");
  }
  if (homeCellsRaw.length > 0) {
    const cells = new Map((await homeCellOptions(db)).map((c) => [c.id, c.regionId] as const));
    if (homeCellsRaw.some((id) => !cells.has(id))) errors.push("adm.errHomeCellBad");
    // A member-list limit may only narrow what the State scope already allows:
    // a cell counts as in scope when it has no state or its state was ticked.
    else if (!allStates && homeCellsRaw.some((id) => {
      const regionId = cells.get(id) ?? 0;
      return regionId !== 0 && !statesRaw.includes(regionId);
    })) errors.push("adm.errHomeCellState");
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
  p: { username: string; allStates: boolean; roleIds: number[]; statesRaw: number[]; homeCellsRaw: number[]; active: number; mustChange: number; errors: string[]; id: number | undefined },
  roleList: { id: number; name: string }[],
  regionList: { id: number; name: string }[],
  homeCellList: { id: number; name: string }[],
) {
  const t = getDict(c.get("lang"));
  const errors = p.errors.map((e) => (e.startsWith("adm.") ? t(e) : e));
  if (c.req.header("X-Requested-With") !== "modal") {
    return c.redirect(errRedirect("/admin/users", errors.map(renderKey(t)).join(" ")), 302);
  }
  return c.html(
    <UserFormFragment
      lang={c.get("lang")} errors={errors}
      values={{ id: p.id, username: p.username, allStates: p.allStates, selectedRoles: p.roleIds, selectedStates: p.statesRaw, homeCellIds: p.homeCellsRaw, active: p.active, mustChange: p.mustChange }}
      roles={roleList} regions={regionList} homeCells={homeCellList}
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
  else {
    const pwFail = checkPasswordPolicy(p.password);
    if (pwFail) p.errors.push(t(pwFail));
  }
  const dup = await db.select({ id: users.id }).from(users).where(eq(users.username, p.username)).limit(1);
  if (dup.length > 0) p.errors.push(t("adm.errDupUser"));
  const homeCellList = await homeCellOptions(db, c.get("lang"));
  if (!(await validateAssignments(db, p.roleIds, p.statesRaw, p.homeCellsRaw, p.allStates, p.errors, t)) || p.errors.length > 0) {
    return userFail(c, p, roleList, allRegions, homeCellList);
  }

  const passwordHash = await hashPassword(p.password, parseIterations(c.env.PBKDF2_ITERATIONS));
  const created = await db.insert(users)
    .values({ username: p.username, passwordHash, active: p.active, mustChangePassword: p.mustChange })
    .returning({ id: users.id });
  const newId = created[0]!.id;
  for (const roleId of p.roleIds) await db.insert(userRoles).values({ userId: newId, roleId });
  const stateIds = p.allStates ? [0] : p.statesRaw;
  for (const regionId of stateIds) await db.insert(userStateAssignments).values({ userId: newId, regionId });
  for (const homeCellId of p.homeCellsRaw) {
    await db.insert(userHomeCellAssignments).values({ userId: newId, homeCellId });
  }
  clearAccessCache();
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
  if (p.newPassword) {
    if (p.newPassword.length < 8) p.errors.push(t("adm.errPw8New"));
    else {
      const pwFailNew = checkPasswordPolicy(p.newPassword);
      if (pwFailNew) p.errors.push(t(pwFailNew));
    }
  }
  const homeCellList = await homeCellOptions(db, c.get("lang"));
  if (!(await validateAssignments(db, p.roleIds, p.statesRaw, p.homeCellsRaw, p.allStates, p.errors, t)) || p.errors.length > 0) {
    return userFail(c, p, roleList, allRegions, homeCellList);
  }

  const updates: Record<string, string | number> = {
    username: p.username, active: p.active, mustChangePassword: p.mustChange,
  };
  if (p.newPassword) {
    updates.passwordHash = await hashPassword(p.newPassword, parseIterations(c.env.PBKDF2_ITERATIONS));
    updates.mustChangePassword = 1;
  }
  await db.update(users).set(updates).where(eq(users.id, id));
  // A reset password or a deactivated account must not keep its live sessions.
  if (p.newPassword || p.active !== 1) await destroyOtherSessions(db, id, null);

  await db.delete(userRoles).where(eq(userRoles.userId, id));
  for (const roleId of p.roleIds) await db.insert(userRoles).values({ userId: id, roleId });
  await db.delete(userStateAssignments).where(eq(userStateAssignments.userId, id));
  for (const regionId of p.allStates ? [0] : p.statesRaw) {
    await db.insert(userStateAssignments).values({ userId: id, regionId });
  }
  await db.delete(userHomeCellAssignments).where(eq(userHomeCellAssignments.userId, id));
  for (const homeCellId of p.homeCellsRaw) {
    await db.insert(userHomeCellAssignments).values({ userId: id, homeCellId });
  }
  clearAccessCache();
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
  clearAccessCache();
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
  // Seeded system roles keep their fixed names (the UI translates them by id).
  const name = role.isSystem === 1 ? role.name : (s(body.name) || role.name).trim();
  const description = s(body.description).trim();
  const fromModal = c.req.header("X-Requested-With") === "modal";
  const fail = (msg: string) => {
    const info: AdminRoleRow = {
      id: role.id, name, description: description || role.description,
      is_system: role.isSystem, permissions: perms, user_count: 0,
    };
    return fromModal
      ? c.html(<RoleFormFragment lang={c.get("lang")} edit existing={info} errors={[msg]} />, 400)
      : c.redirect(errRedirect("/admin/roles", msg), 302);
  };
  if (name.length < 2 || name.length > 60) return fail(t("adm.errRoleName"));
  if (description.length > 160) return fail(t("adm.errRoleDesc"));
  const dup = await db.select({ id: roles.id }).from(roles)
    .where(and(eq(roles.name, name), ne(roles.id, role.id))).limit(1);
  if (dup[0]) return fail(t("adm.errRoleDup"));
  if (name !== role.name || (description || null) !== role.description) {
    await db.update(roles).set({ name, description: description || null }).where(eq(roles.id, role.id));
  }
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
  for (const p of perms) await db.insert(rolePermissions).values({ roleId: role.id, permission: p });
  clearAccessCache();
  return c.redirect("/admin/roles?ok=role-updated", 302);
});

adminRoutes.post("/roles/:id/delete", requirePermission("roles.manage"), async (c) => {
  const db = getDb(c.env);
  const role = await loadRoleOrRedirect(db, c.req.param("id"));
  if (!role) return c.redirect(errRedirect("/admin/roles", getDict(c.get("lang"))("adm.errNoRole")), 302);
  if (role.isSystem === 1) return c.redirect(errRedirect("/admin/roles", "err-systemrole"), 302);
  // A role that still grants rights to an account may not disappear: deleting it
  // would silently strip those users of every permission (and lock them out).
  const inUse = await db.all<{ n: number }>(
    sql`SELECT COUNT(*) AS n FROM user_roles WHERE role_id = ${role.id}`,
  );
  if (Number(inUse[0]?.n ?? 0) > 0) return c.redirect(errRedirect("/admin/roles", "role-in-use"), 302);
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
  await db.delete(roles).where(eq(roles.id, role.id));
  clearAccessCache();
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
  const lang: Lang = c.get("lang");
  const t = getDict(lang);
  if (!isOptionType(type)) type = OPTION_TYPES[0]!;
  const admin = isOptionsAdmin(scope);
  const column = OPTION_RAW_COLUMN[type as OptionType];
  // Township and blood type store the option label in the member row (no id),
  // so their usage is counted by label.
  const labelStored = isLabelOptionType(type);
  // Everything this tab needs, in one wait: regions, churches, the option list
  // and both usage counts (members, plus leadership slots for Home Cells).
  const [stateListAll, churchRows, all, usageRows, positionRows, regionCount, ageGroups] = await Promise.all([
    loadRegionsLite(db, lang),
    loadRegionalChurches(db, { activeOnly: true, scopeAll: admin, stateIds: scope.stateIds }),
    loadAllOptions(db),
    labelStored
      ? db.all<{ oid: string; n: number }>(
          sql`SELECT ${sql.raw(column)} AS oid, COUNT(*) AS n FROM members WHERE ${sql.raw(column)} IS NOT NULL AND ${sql.raw(column)} <> '' GROUP BY ${sql.raw(column)}`,
        )
      : db.all<{ oid: string | number; n: number }>(
          sql.raw(`SELECT ${column} AS oid, COUNT(*) AS n FROM members WHERE ${column} IS NOT NULL GROUP BY ${column}`),
        ),
    type === "home_cell"
      ? db.all<{ oid: number; n: number }>(sql`
          SELECT scope_id AS oid, COUNT(*) AS n FROM member_positions
          WHERE scope_type = 'home_cell' AND scope_id IS NOT NULL GROUP BY scope_id`)
      : Promise.resolve([] as { oid: number; n: number }[]),
    // Tab counts ride along instead of costing two more waits.
    db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM regions`),
    db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM age_groups`),
  ]);
  // State managers pick only among their own states; no "all states" choice.
  const stateList = admin ? stateListAll : stateListAll.filter((r) => scope.stateIds.includes(r.id));
  // Home Cells may be bound to a Regional Church in the same State/Region.
  const churches = churchRows.map((church) => ({ id: church.id, name: regionalChurchName(church, lang), regionId: church.regionId }));
  if (opts.showAddForm && !canStructure(c, "create")) opts.showAddForm = false;
  if (opts.modal) {
    if (!canStructure(c, "create")) return forbidden(c);
    const parentType = PARENT_TYPE[type];
    return c.html(
      <AddOptionForm type={type} lang={lang} regions={stateList} modal lockRegion={!admin && stateList.length === 1}
        allowAllStates={admin} churches={churches}
        parentOptions={parentType ? all.filter((o) => o.type === parentType && o.active === 1 && canManageOption(scope, o.regionId === 0 ? 0 : o.regionId)) : []} />,
    );
  }
  const byId = new Map(all.map((o) => [o.id, o] as const));
  const list = all
    .filter((o) => o.type === type)
    // State managers see only options anchored inside their states (all-states
    // options belong to the global admin and are hidden from them).
    .filter((o) => admin || canManageOption(scope, effectiveRegion(o, byId)));
  const usage = new Map(usageRows.map((u) => [u.oid, u.n]));
  const positionUsage = new Map<number, number>();
  for (const row of positionRows) positionUsage.set(row.oid, row.n);
  const stateNames = stateListAll;
  const stateName = (id: number | null) =>
    id == null ? null : stateNames.find((r) => r.id === id)?.name ?? null;
  const labelById = new Map(all.map((o) => [o.id, o.label] as const));
  const churchById = new Map(churches.map((church) => [church.id, church] as const));
  const options: OptionUsage[] = list.map((o) => ({
    id: o.id, label: o.label, active: o.active,
    code: o.code ?? null,
    used: Math.max(
      usage.get(labelStored ? o.label : o.id) ?? 0,
      positionUsage.get(o.id) ?? 0,
    ),
    state: stateName(o.regionId ?? null),
    parent: o.parentId ? labelById.get(o.parentId) ?? null : null,
    church: o.regionalChurchId ? churchById.get(o.regionalChurchId)?.name ?? null : null,
  }));
  const types = admin
    ? optionTabs(all, { region: Number(regionCount[0]?.n ?? 0), ageGroup: Number(ageGroups[0]?.n ?? 0) }, t("adm.ageTab"), lang)
    : OPTION_TYPES.filter((k) => isRegionScopedType(k)).map((k) => {
        const entry = all.filter((o) => o.type === k && canManageOption(scope, effectiveRegion(o, byId)));
        return { key: k, label: typeLabel(lang, k), active: entry.some((o) => o.active === 1), count: entry.length };
      });
  return c.html(
    <AdminOptionsPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))}
      type={type} typeLabel={typeLabel(lang, type as OptionType)} types={types}
      options={options} regions={stateList} churches={churches}
      lockRegion={!admin && stateList.length === 1}
      allowAllStates={admin}
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
  lang: Lang,
): Tab[] {
  return [
    { key: "region", label: "", active: true, count: counts.region },
    { key: "age_group", label: ageTabLabel, active: true, count: counts.ageGroup },
    ...OPTION_TYPES.map((k) => {
      const entry = all.filter((o) => o.type === k);
      return { key: k, label: typeLabel(lang, k), active: entry.some((o) => o.active === 1), count: entry.length };
    }),
  ];
}

async function ageGroupCount(db: DB): Promise<number> {
  const rows = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM age_groups`);
  return Number(rows[0]?.n ?? 0);
}

/** First tab to open: global admins start on State/Region, state managers on
 * Township, and a structure-only grant on Home Cells (the tab it can edit). */
function defaultOptionsType(scope: OptionScope, canAdminOptions: boolean): string {
  if (isOptionsAdmin(scope) && canAdminOptions) return "region";
  return canAdminOptions ? "township" : "home_cell";
}

adminRoutes.get("/options", requireAnyPermission("options.manage", "structures.view"), async (c) => {
  const scope = optionScopeOf(c);
  const opts = { modal: c.req.query("modal") === "1", showAddForm: c.req.query("add") === "1" };
  // Default tab differs by scope: admins start on State/Region (the first tab,
  // always populated) rather than an empty lookup list, and state managers
  // start on Township (their first manageable type) instead of bouncing off
  // ethnicity with a confusing 403.
  const rawType = c.req.query("type") ?? defaultOptionsType(scope, c.get("perms").has("options.manage"));
  const type = rawType;
  // State managers only get the four region-scoped types, in their own states;
  // holders of a structure grant see the same tabs without the admin bundle.
  if (!isOptionsAdmin(scope) || !c.get("perms").has("options.manage")) {
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
  const lang: Lang = c.get("lang");
  if (opts.modal) return c.html(<AddAgeGroupForm lang={lang} modal />);
  const t = getDict(lang);
  const rows = await loadAgeGroups(db);
  const all = await loadAllOptions(db);
  const regionCount = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM regions`);
  return c.html(
    <AdminOptionsPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), lang)}
      type="age_group" typeLabel={t("adm.ageTab")}
      types={optionTabs(all, { region: Number(regionCount[0]?.n ?? 0), ageGroup: rows.length }, t("adm.ageTab"), lang)}
      ageGroupRows={rows}
      addErrors={[]} editError={null} showAddForm={opts.showAddForm}
      lang={lang}
    />,
  );
}

/** Next free code for a type: PREFIX-001, skipping codes already taken
 * (unique per type+region, but numbering is global per type for readability). */
async function nextOptionCode(db: DB, type: string): Promise<string | null> {
  const rows = await db.all<{ code: string }>(
    sql`SELECT code FROM lookup_options WHERE type = ${type} AND code IS NOT NULL`,
  );
  return nextCodeCandidate(rows.map((r) => r.code), type);
}

adminRoutes.post("/options", requireAnyPermission("options.manage", "structures.create"), async (c) => {
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
  const churches = (await loadRegionalChurches(db, {
    activeOnly: true, scopeAll: isOptionsAdmin(scope), stateIds: scope.stateIds,
  })).map((church) => ({ id: church.id, name: regionalChurchName(church, c.get("lang")), regionId: church.regionId }));
  const fail = (msg: string) =>
    fromModal
      ? c.html(
          <AddOptionForm type={type} lang={c.get("lang")} errors={[msg]} value={label}
            regions={stateList} regionId={s(body.region_id)} parentId={s(body.parent_id)}
            churches={churches} churchId={s(body.regional_church_id)}
            shortCode={s(body.short_code)}
            lockRegion={!isOptionsAdmin(scope) && stateList.length === 1} allowAllStates={isOptionsAdmin(scope)} modal />,
          400,
        )
      : c.redirect(errRedirect(back, msg), 302);
  if (!canStructure(c, "create")) return forbidden(c);
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
  // Township short code = prefix of its Family Group codes (INS -> INS_FG001).
  const rawShort = s(body.short_code);
  if (type === "township" && rawShort && !/^[A-Za-z0-9]{2,8}$/.test(rawShort)) return fail(t("adm.errShortCode"));
  let code = await nextOptionCode(db, type);
  const shortCode = type === "township" ? (rawShort.toUpperCase() || abbrevFromLabel(label) || null) : null;
  let familyTownship: OptionRow | null = null;
  if (type === "family_group") {
    // Family Groups are numbered per Township (Family Group -> Home Cell -> Township).
    const byId = new Map(all.map((o) => [o.id, o] as const));
    const parent = parentId != null ? all.find((o) => o.id === parentId) ?? null : null;
    familyTownship = parent ? (parent.type === "township" ? parent : townshipOf(parent, byId)) : null;
    const fgCodes = all.filter((o) => o.type === "family_group").map((o) => o.code ?? "");
    code = nextFamilyGroupCode(fgCodes, familyTownship);
  }
  if (type === "township" && shortCode) {
    const clashShort = await db.all<{ id: number }>(
      sql`SELECT id FROM lookup_options WHERE type = 'township' AND region_id = ${anchorRegion} AND short_code = ${shortCode} LIMIT 1`,
    );
    if (clashShort[0]) return fail(t("adm.errShortCodeDup"));
  }
  let regionalChurchId: number | null = null;
  if (type === "home_cell") {
    const rawChurch = s(body.regional_church_id);
    if (rawChurch) {
      const n = Number(rawChurch);
      if (!Number.isInteger(n) || n < 1 ||
          !churches.some((church) => church.id === n && church.regionId === anchorRegion)) {
        return fail(t("adm.errChurchBad"));
      }
      regionalChurchId = n;
    }
  }
  await db.insert(lookupOptions).values({ type, label, regionId: anchorRegion, parentId, code, shortCode, regionalChurchId });
  return c.redirect(`${back}${back.includes("?") ? "&" : "?"}ok=option-added`, 302);
});

/** Township rows for the bulk short-code editor (state managers: own states only). */
async function townshipCodeRows(db: DB, scope: OptionScope, lang: Lang): Promise<TownshipCodeRow[]> {
  const all = await loadAllOptions(db);
  const byId = new Map(all.map((o) => [o.id, o] as const));
  const regionList = await loadRegionsLite(db, lang);
  const groupCount = new Map<number, number>();
  for (const fg of all.filter((o) => o.type === "family_group")) {
    const township = townshipOf(fg, byId);
    if (township) groupCount.set(township.id, (groupCount.get(township.id) ?? 0) + 1);
  }
  return all
    .filter((o) => o.type === "township" && canManageOption(scope, o.regionId))
    .map((o) => ({
      id: o.id, label: o.label, code: o.code, shortCode: o.shortCode, regionId: o.regionId,
      state: o.regionId === 0 ? "" : regionList.find((r) => r.id === o.regionId)?.name ?? "",
      groups: groupCount.get(o.id) ?? 0,
    }))
    .sort((a, b) => a.state.localeCompare(b.state) || a.label.localeCompare(b.label));
}

adminRoutes.get("/options/township-codes", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = optionScopeOf(c);
  const rows = await townshipCodeRows(db, scope, c.get("lang"));
  return c.html(
    <TownshipCodesPage
      user={c.get("user")} perms={c.get("perms")}
      flash={flashFromQuery(c.req.query(), c.get("lang"))}
      rows={rows} lang={c.get("lang")}
    />,
  );
});

adminRoutes.post("/options/township-codes", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = optionScopeOf(c);
  const lang: Lang = c.get("lang");
  const t = getDict(lang);
  const body = await c.req.parseBody();
  const rows = await townshipCodeRows(db, scope, lang);
  const values: Record<number, string> = {};
  const errors: string[] = [];
  const taken = new Map<string, string>();
  for (const row of rows) {
    const raw = s(body[`short_${row.id}`]).toUpperCase().replace(/[^A-Z0-9]/g, "");
    values[row.id] = raw;
    if (raw && !/^[A-Z0-9]{2,8}$/.test(raw)) {
      errors.push(`${row.label}: ${t("adm.errShortCode")}`);
      continue;
    }
    if (!raw) continue;
    const key = `${row.regionId}|${raw}`;
    const other = taken.get(key);
    if (other !== undefined && other !== row.label) errors.push(`${row.label}: ${t("adm.errShortCodeDup")}`);
    taken.set(key, row.label);
  }
  if (errors.length > 0) {
    return c.html(
      <TownshipCodesPage
        user={c.get("user")} perms={c.get("perms")} flash={null}
        rows={rows} values={values} errors={errors} lang={lang}
      />,
      400,
    );
  }

  const all = await loadAllOptions(db);
  const byId = new Map(all.map((o) => [o.id, o] as const));
  for (const row of rows) {
    const nextShort = values[row.id] || null;
    if (nextShort === (row.shortCode ?? null)) continue;
    await db.update(lookupOptions).set({ shortCode: nextShort }).where(eq(lookupOptions.id, row.id));
    if (!nextShort) continue;
    // Renumber this township's Family Groups to match the new prefix.
    const groups = all
      .filter((o) => o.type === "family_group" && townshipOf(o, byId)?.id === row.id)
      .sort((a, b) => a.id - b.id);
    for (let n = 0; n < groups.length; n++) {
      const nextCode = `${nextShort}_FG${String(n + 1).padStart(3, "0")}`;
      if (groups[n]!.code !== nextCode) {
        await db.update(lookupOptions).set({ code: nextCode }).where(eq(lookupOptions.id, groups[n]!.id));
      }
    }
  }
  return c.redirect("/admin/options/township-codes?ok=option-updated", 302);
});

adminRoutes.get("/options/:id/edit", requireAnyPermission("options.manage", "structures.update"), async (c) => {
  const db = getDb(c.env);
  const lang = c.get("lang");
  const scope = optionScopeOf(c);
  const admin = isOptionsAdmin(scope);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/options?err=err-notfound", 302);
  const rows = await db.select().from(lookupOptions).where(eq(lookupOptions.id, id)).limit(1);
  const current = rows[0];
  if (!current) return c.redirect("/admin/options?err=err-notfound", 302);
  if (!canStructure(c, "update")) return forbidden(c);
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
    allowAllStates: admin,
    code: current.code ?? "",
    shortCode: current.shortCode ?? "",
    regionId: current.regionId === 0 ? "" : String(current.regionId),
    parentId: current.parentId == null ? "" : String(current.parentId),
    churches: (await loadRegionalChurches(db, {
      activeOnly: true, scopeAll: admin, stateIds: scope.stateIds,
    })).map((church) => ({ id: church.id, name: regionalChurchName(church, lang), regionId: church.regionId })),
    churchId: current.regionalChurchId == null ? "" : String(current.regionalChurchId),
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

adminRoutes.post("/options/:id", requireAnyPermission("options.manage", "structures.update"), async (c) => {
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
  const churches = (await loadRegionalChurches(db, {
    activeOnly: true, scopeAll: admin, stateIds: scope.stateIds,
  })).map((church) => ({ id: church.id, name: regionalChurchName(church, c.get("lang")), regionId: church.regionId }));
  const fail = (msg: string) => {
    const fp = {
      id, label, lang: c.get("lang"), type: current.type, regions: stateList, parentOptions, churches,
      lockRegion: !admin && stateList.length === 1,
      allowAllStates: admin,
      code: s(body.code),
      shortCode: s(body.short_code),
      regionId: regionId === false ? s(body.region_id) : regionId === 0 ? "" : String(regionId),
      parentId: parentId === false ? s(body.parent_id) : parentId == null ? "" : String(parentId),
      churchId: s(body.regional_church_id),
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
  // Editable short code: normalize to UPPER, empty = clear. Uniqueness per
  // (type, region) is enforced by the partial unique index (0010)
  // surfaced here as a friendly duplicate error.
  const rawCode = s(body.code).toUpperCase().replace(/\s+/g, "");
  if (rawCode && !/^[A-Z0-9._-]{2,16}$/.test(rawCode)) return fail(t("adm.errCodeBad"));
  if (rawCode) {
    const clashCode = await db.all<{ id: number }>(
      sql`SELECT id FROM lookup_options WHERE type = ${current.type} AND region_id = ${anchorRegion} AND code = ${rawCode} AND id <> ${id} LIMIT 1`,
    );
    if (clashCode[0]) return fail(t("adm.errCodeDup"));
  }
  const rawShort = s(body.short_code);
  if (current.type === "township" && rawShort && !/^[A-Za-z0-9]{2,8}$/.test(rawShort)) return fail(t("adm.errShortCode"));
  const shortCode = current.type === "township" ? (rawShort.toUpperCase() || null) : current.shortCode;
  if (current.type === "township" && shortCode) {
    const clashShort = await db.all<{ id: number }>(
      sql`SELECT id FROM lookup_options WHERE type = 'township' AND region_id = ${anchorRegion} AND short_code = ${shortCode} AND id <> ${id} LIMIT 1`,
    );
    if (clashShort[0]) return fail(t("adm.errShortCodeDup"));
  }
  let regionalChurchId: number | null = current.regionalChurchId ?? null;
  if (current.type === "home_cell") {
    regionalChurchId = null;
    const rawChurch = s(body.regional_church_id);
    if (rawChurch) {
      const n = Number(rawChurch);
      if (!Number.isInteger(n) || n < 1 ||
          !churches.some((church) => church.id === n && church.regionId === anchorRegion)) {
        return fail(t("adm.errChurchBad"));
      }
      regionalChurchId = n;
    }
  }
  await db.update(lookupOptions)
    .set({ label, regionId: anchorRegion, parentId, code: rawCode || null, shortCode, regionalChurchId })
    .where(eq(lookupOptions.id, id));
  // Township and blood type are stored on members (and a household's township)
  // as text, so a rename has to follow through or those rows keep pointing at a
  // label that no longer exists. Township labels are per state, so only rows in
  // the option's own state are rewritten (an all-states township touches all).
  if (current.type === "township" && label !== current.label) {
    const regional = anchorRegion !== 0;
    for (const table of ["members", "families"] as const) {
      await db.run(sql`
        UPDATE ${sql.raw(table)} SET township = ${label}
        WHERE lower(trim(township)) = lower(trim(${current.label}))
        ${regional ? sql`AND region_id = ${anchorRegion}` : sql``}`);
    }
    await db.run(sql`
      UPDATE members SET updated_at = unixepoch()
      WHERE lower(trim(township)) = lower(trim(${label}))
      ${regional ? sql`AND region_id = ${anchorRegion}` : sql``}`);
  }
  if (current.type === "blood_type" && label !== current.label) {
    await db.run(sql`
      UPDATE members SET blood_type = ${label}, updated_at = unixepoch()
      WHERE lower(trim(blood_type)) = lower(trim(${current.label}))`);
  }
  // Changing a township's short code renumbers the Family Groups under it so the
  // INS_FG001 sequence stays correct (only when the prefix actually changed).
  if (current.type === "township" && shortCode && shortCode !== (current.shortCode ?? "")) {
    const byId = new Map(allOpts.map((o) => [o.id, o] as const));
    const groups = allOpts
      .filter((o) => o.type === "family_group" && townshipOf(o, byId)?.id === id)
      .sort((a, b) => a.id - b.id);
    for (let n = 0; n < groups.length; n++) {
      const nextCode = `${shortCode}_FG${String(n + 1).padStart(3, "0")}`;
      if (groups[n]!.code !== nextCode) {
        await db.update(lookupOptions).set({ code: nextCode }).where(eq(lookupOptions.id, groups[n]!.id));
      }
    }
  }
  return c.redirect(`${back}&ok=option-updated`, 302);
});

adminRoutes.post("/options/:id/delete", requireAnyPermission("options.manage", "structures.delete"), async (c) => {
  const db = getDb(c.env);
  const scope = optionScopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/admin/options?err=err-notfound", 302);
  const rows = await db.select().from(lookupOptions).where(eq(lookupOptions.id, id)).limit(1);
  const current = rows[0];
  if (!current) return c.redirect("/admin/options?err=err-notfound", 302);
  if (!canStructure(c, "delete")) return forbidden(c);
  if (!canManageType(scope, current.type)) return forbidden(c);
  const allOpts = await loadAllOptions(db);
  const byId = new Map(allOpts.map((o) => [o.id, o] as const));
  if (!canManageOption(scope, effectiveRegion(current, byId))) return forbidden(c);
  const back = `/admin/options?type=${encodeURIComponent(current.type)}`;

  const column = OPTION_RAW_COLUMN[current.type as OptionType];
  // Township and blood type live on members as a text label, not an id —
  // count by label so deleting a used option is still guarded.
  const used = isLabelOptionType(current.type)
    ? await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM members WHERE ${sql.raw(column)} = ${current.label}`)
    : column
      ? await db.all<{ n: number }>(sql.raw(`SELECT COUNT(*) AS n FROM members WHERE ${column} = ${id}`))
      : [{ n: 0 }];
  // Positions can be scoped to a Home Cell or a Township (scope_id), so any
  // reference — not just the home-cell one — must keep the row alive.
  const positionUsed = await db.all<{ n: number }>(
    sql`SELECT COUNT(*) AS n FROM member_positions WHERE scope_id = ${id}`,
  );
  // Households point at their Home Cell, Group and Family Group by id; deleting
  // one underneath them would fail the foreign key or orphan the household.
  const householdUsed = await db.all<{ n: number }>(
    sql`SELECT COUNT(*) AS n FROM families
        WHERE home_cell_id = ${id} OR group_id = ${id} OR family_group_id = ${id}`,
  );
  // Anything else that still points at this option: child options (a township's
  // home cells, a home cell's family groups), a manager's home-cell scope and
  // reports filed against it. Deleting the row underneath them would leave those
  // records pointing at an id that no longer exists.
  const childUsed = await db.all<{ n: number }>(
    sql`SELECT COUNT(*) AS n FROM lookup_options WHERE parent_id = ${id}`,
  );
  const userCellUsed = current.type === "home_cell"
    ? await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM user_home_cell_assignments WHERE home_cell_id = ${id}`)
    : [{ n: 0 }];
  const reportUsed = current.type === "home_cell"
    ? await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM activity_reports WHERE home_cell_id = ${id}`)
    : current.type === "group"
      ? await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM activity_reports WHERE group_id = ${id}`)
      : [{ n: 0 }];
  if ((used[0]?.n ?? 0) > 0 || (positionUsed[0]?.n ?? 0) > 0 ||
      (householdUsed[0]?.n ?? 0) > 0 ||
      (childUsed[0]?.n ?? 0) > 0 || (userCellUsed[0]?.n ?? 0) > 0 || (reportUsed[0]?.n ?? 0) > 0) {
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

type RegionRow = { id: number; name: string; name_en: string; code: string | null; used: number };

async function loadRegionRows(db: DB): Promise<RegionRow[]> {
  const rows = await db.all<{ id: number; name: string; name_en: string | null; code: string | null; used: number }>(sql`
    SELECT r.id, r.name, r.name_en, r.code,
      (SELECT COUNT(*) FROM members m WHERE m.region_id = r.id)
      + (SELECT COUNT(*) FROM user_state_assignments sa WHERE sa.region_id = r.id)
      + (SELECT COUNT(*) FROM regional_churches rc WHERE rc.region_id = r.id)
      + (SELECT COUNT(*) FROM lookup_options lo WHERE lo.region_id = r.id)
      + (SELECT COUNT(*) FROM pastors p WHERE p.region_id = r.id)
      + (SELECT COUNT(*) FROM families f WHERE f.region_id = r.id)
      + (SELECT COUNT(*) FROM activity_reports ar WHERE ar.region_id = r.id) AS used
    FROM regions r ORDER BY r.id`);
  return rows.map((r) => ({ id: r.id, name: r.name, name_en: r.name_en ?? "", code: r.code ?? null, used: Number(r.used) }));
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
  const lang: Lang = c.get("lang");
  const t = getDict(lang);
  if (opts.modal) return c.html(<AddRegionForm lang={lang} modal />);
  const all = await loadAllOptions(db);
  const regionRows = await loadRegionRows(db);
  return c.html(
    <AdminOptionsPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), lang)}
      type="region" typeLabel={getDict(lang)("adm.regionTab")}
      types={optionTabs(all, { region: regionRows.length, ageGroup: await ageGroupCount(db) }, t("adm.ageTab"), lang)}
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
  const code = await nextRegionCode(db);
  await db.insert(regions).values({ name, nameEn: nameEn || name, slug, code });
  return c.redirect(`${regionBack()}&ok=region-added`, 302);
});

/** Next free region code: REG-001… (global numbering, matching 0010 backfill). */
async function nextRegionCode(db: DB): Promise<string> {
  const rows = await db.all<{ code: string }>(sql`SELECT code FROM regions WHERE code IS NOT NULL`);
  let n = rows.length + 1;
  const codes = new Set(rows.map((r) => r.code));
  for (;; n++) {
    const code = `REG-${String(n).padStart(3, "0")}`;
    if (!codes.has(code)) return code;
  }
}

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
  const values = { name: current.name, name_en: current.nameEn ?? "", code: current.code ?? "" };
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
  const rawCode = s(body.code).toUpperCase().replace(/\s+/g, "");
  const failWith = (v: { name: string; name_en: string; code: string }, msg: string) =>
    fromModal
      ? c.html(<EditRegionForm id={id} lang={c.get("lang")} values={v} errors={[msg]} modal />, 400)
      : c.redirect(errRedirect(back, msg), 302);
  if (rawCode && !/^[A-Z0-9._-]{2,16}$/.test(rawCode)) return failWith({ name, name_en: nameEn, code: s(body.code) }, t("adm.errCodeBad"));
  const fail = (msg: string) => failWith({ name, name_en: nameEn, code: rawCode }, msg);
  if (name.length < 1 || name.length > 120) return fail(t("adm.errRegionName"));
  const dup = await db.select({ id: regions.id }).from(regions).where(eq(regions.name, name)).limit(1);
  if (dup[0] && dup[0].id !== id) return fail(t("adm.errRegionDup"));
  if (rawCode) {
    const clashCode = await db.all<{ id: number }>(
      sql`SELECT id FROM regions WHERE code = ${rawCode} AND id <> ${id} LIMIT 1`,
    );
    if (clashCode[0]) return fail(t("adm.errCodeDup"));
  }
  await db.update(regions).set({ name, nameEn: nameEn || name, code: rawCode || null }).where(eq(regions.id, id));
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
  // A state owns members, manager assignments, churches, region-scoped options,
  // pastors and reports; deleting it while any of those exist would orphan them.
  const usedRows = await db.all<{ n: number }>(sql`
    SELECT (SELECT COUNT(*) FROM members WHERE region_id = ${id})
         + (SELECT COUNT(*) FROM user_state_assignments WHERE region_id = ${id})
         + (SELECT COUNT(*) FROM regional_churches WHERE region_id = ${id})
         + (SELECT COUNT(*) FROM lookup_options WHERE region_id = ${id})
         + (SELECT COUNT(*) FROM pastors WHERE region_id = ${id})
         + (SELECT COUNT(*) FROM activity_reports WHERE region_id = ${id})
         + (SELECT COUNT(*) FROM families WHERE region_id = ${id}) AS n`);
  if ((usedRows[0]?.n ?? 0) > 0) {
    return c.redirect(`${back}&err=err-region-used`, 302);
  }
  await db.delete(regions).where(eq(regions.id, id));
  return c.redirect(`${back}&ok=region-deleted`, 302);
});

// ---------- GET /admin/audit: the audit trail ----------
// Written by the request middleware (src/audit.ts). This page is a read-only
// view with filters, so "who changed what, when, and from which device" can be
// answered months later without database access.

adminRoutes.get("/audit", requirePermission("audit.view"), async (c) => {
  const db = getDb(c.env);
  const lang = c.get("lang");
  const q = c.req.query();
  const perPage = 40;

  const search = (q.q ?? "").trim().slice(0, 80);
  const who = (q.user ?? "").trim().slice(0, 60);
  const group = /^[a-z_]{1,30}$/.test(q.action ?? "") ? q.action! : "";
  // Default to the last 30 days: an unfiltered log is both slow to scan and
  // leaves the date fields empty on first visit.
  const today = todayInYangon();
  const from = parseDateFlexible(q.from ?? "") ?? addDays(today, -29);
  const to = parseDateFlexible(q.to ?? "") ?? today;
  // Day boundaries in Myanmar time (UTC+6:30), matching what the page displays.
  const fromTs = from ? Math.floor(Date.parse(`${from}T00:00:00+06:30`) / 1000) : 0;
  const toTs = to ? Math.floor(Date.parse(`${to}T23:59:59+06:30`) / 1000) : 0;

  const where = [sql`1=1`];
  if (who) where.push(sql`username = ${who}`);
  if (group) where.push(sql`action LIKE ${group + ".%"}`);
  if (search) {
    const like = `%${search}%`;
    where.push(sql`(username LIKE ${like} OR action LIKE ${like} OR path LIKE ${like}
      OR summary LIKE ${like} OR entity_id LIKE ${like} OR device LIKE ${like} OR ip LIKE ${like})`);
  }
  if (fromTs) where.push(sql`at >= ${fromTs}`);
  if (toTs) where.push(sql`at <= ${toTs}`);
  const cond = sql.join(where, sql` AND `);

  const countRows = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM audit_log WHERE ${cond}`);
  const total = countRows[0]?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, Number(q.page) || 1), pages);

  const rows = await db.all<AuditRow>(sql`
    SELECT id, at, user_id, username, action, entity, entity_id, summary,
           ip, user_agent, device, method, path, status
    FROM audit_log
    WHERE ${cond}
    ORDER BY at DESC, id DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`);

  const userRows = await db.all<{ username: string }>(sql`
    SELECT DISTINCT username FROM audit_log
    WHERE username IS NOT NULL ORDER BY username LIMIT 200`);
  const groupRows = await db.all<{ g: string }>(sql`
    SELECT DISTINCT substr(action, 1, instr(action, '.') - 1) AS g
    FROM audit_log WHERE instr(action, '.') > 0 ORDER BY g`);

  return c.html(
    <AuditLogPage
      user={c.get("user")} perms={c.get("perms")} lang={lang} flash={null}
      rows={rows} total={total} page={page} pages={pages}
      users={userRows.map((r) => r.username)}
      actionGroups={groupRows.map((r) => r.g).filter(Boolean)}
      filters={{ q: search, user: who, action: group, from, to }}
    />,
  );
});
