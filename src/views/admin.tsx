import { Layout } from "./layout";
import type { Flash } from "./layout";
import type { SessionUser } from "../session";
import { PERMISSIONS, PERMISSION_LABELS, PERMISSION_LABELS_EN, PERMISSION_LABELS_KR } from "../rbac";
import { getDict, type Lang } from "../i18n";
import { OPTION_TYPE_LABELS, OPTION_TYPE_LABELS_EN, OPTION_TYPE_LABELS_KR, isRegionScopedType, type OptionType } from "../db/schema";
import { PARENT_TYPE } from "../lookup";
import { qs } from "../util";
import { EditIcon, TrashIcon } from "./action-icons";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

/** Seeded system role names, mapped to their dictionary keys so aggregated
 * names in the users table follow the Korean UI as well. */
const SYSTEM_ROLE_NAME_KEY: Record<string, string> = {
  "Super Admin": "adm.roleSuperAdminName",
  "State Manager": "adm.roleStateManagerName",
  "Data Entry": "adm.roleDataEntryName",
  "Viewer": "adm.roleViewerName",
};

function localizedRoleNames(names: string, lang?: Lang): string {
  if ((lang ?? "en") !== "kr" || !names) return names;
  const t = getDict("kr");
  return names
    .split(", ")
    .map((name) => (SYSTEM_ROLE_NAME_KEY[name] ? t(SYSTEM_ROLE_NAME_KEY[name]) : name))
    .join(", ");
}

// ---------- Users ----------

export type AdminUserRow = {
  id: number;
  username: string;
  active: number;
  must_change_password: number;
  created_at: number;
  /** Saved account UI language (mm | en | kr), or null when never chosen. */
  language: string | null;
  role_names: string;
  state_ids: number[];
};

type UsersProps = Common & {
  users: (AdminUserRow & { state_names?: string })[];
  roles: { id: number; name: string; description: string | null }[];
  regions: { id: number; name: string }[];
  editUser: (AdminUserRow & { allStates: boolean; selectedRoles: number[]; selectedStates: number[] }) | null;
  createErrors: string[];
  editErrors: string[];
};

function stateSummary(u: AdminUserRow & { state_names?: string }, regions: { id: number; name: string }[], allLabel: string): string {
  if (u.state_ids.includes(0)) return allLabel;
  if (u.state_names) return u.state_names;
  const names = u.state_ids.map((id) => regions.find((r) => r.id === id)?.name ?? `#${id}`);
  return names.join(", ") || "—";
}

function userForm(v: {
  id?: number;
  username: string;
  allStates: boolean;
  selectedRoles: number[];
  selectedStates: number[];
  active: number;
  mustChange: number;
}, props: { roles: { id: number; name: string }[]; regions: { id: number; name: string }[] }, t: (k: string) => string) {
  const action = v.id ? `/admin/users/${v.id}` : "/admin/users";
  return (
    <form method="post" action={action} data-flash-ok={v.id ? "user-updated" : "user-created"}>
      <div class="form-grid">
        <label class="field">
          <span class="lbl">Username {v.id === undefined && "*"}</span>
          <input type="text" name="username" value={v.username} required={v.id === undefined}
            pattern="[A-Za-z0-9_.\-]{3,32}" title="အက္ခရာ/ဂဏန်း 3-32" />
        </label>
        <label class="field">
          <span class="lbl">{v.id === undefined ? t("adm.initialPw") : t("adm.newPw")}</span>
          <input type="password" name={v.id === undefined ? "password" : "new_password"}
            placeholder={v.id === undefined ? t("adm.min8") : t("adm.leaveBlank")}
            autocomplete="new-password"
            data-strength="1"
            data-labels={[t("pw.0"), t("pw.1"), t("pw.2"), t("pw.3"), t("pw.4")]} /> 
        </label>
      </div>
      <fieldset class="form-section">
        <legend>{t("nav.roles")}</legend>
        <div class="check-grid">
          {props.roles.map((r) => (
            <label class="check-chip">
              <input type="checkbox" name="roles" value={String(r.id)}
                checked={v.selectedRoles.includes(r.id)} /> <span>{r.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset class="form-section">
        <legend>{t("adm.stateScope")}</legend>
        <label class="check-chip check-chip-all">
          <input type="checkbox" name="all_states" value="1" checked={v.allStates} /> <span>{t("adm.allStates")}</span>
        </label>
        <div class="check-grid">
          {props.regions.map((r) => (
            <label class="check-chip">
              <input type="checkbox" name="states" value={String(r.id)}
                checked={v.selectedStates.includes(r.id)} /> <span>{r.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset class="form-section">
        <legend>{t("members.status")}</legend>
        <div class="check-grid">
          <label class="check-chip">
            <input type="checkbox" name="active" value="1" checked={v.active === 1} /> <span>{t("adm.active")}</span>
          </label>
          <label class="check-chip">
            <input type="checkbox" name="must_change" value="1" checked={v.mustChange === 1} /> <span>{t("adm.mustChange")}</span>
          </label>
        </div>
      </fieldset>
      <div class="actions">
        <button class="btn" type="submit">{v.id ? t("form.save") : t("adm.create")}</button>
      </div>
    </form>
  );
}

/** Bare user form (no Layout) — served for the add/edit modal?modal=1 fetch and
 * reused by error responses inside the same modal. */
export function UserFormFragment(props: {
  lang?: Lang; errors: string[]; modal?: boolean;
  values: { id?: number; username: string; allStates: boolean; selectedRoles: number[]; selectedStates: number[]; active: number; mustChange: number };
  roles: { id: number; name: string }[]; regions: { id: number; name: string }[];
}) {
  const t = getDict(props.lang ?? "en");
  return (
    <>
      {props.errors.length > 0 && (
        <div class="flash err">
          <strong>{t("form.invalid")}</strong>
          <ul class="err-list">{props.errors.map((e) => <li>{e}</li>)}</ul>
        </div>
      )}
      {userForm(props.values, { roles: props.roles, regions: props.regions }, t)}
    </>
  );
}

export function AdminUsersPage(props: UsersProps) {
  const { user, perms, flash, users, roles, regions, editUser, createErrors, editErrors, lang } = props;
  const t = getDict(lang ?? "en");
  return (
    <Layout title={t("adm.usersTitle")} lang={lang} user={user} perms={perms} active="/admin/users" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("adm.usersTitle")}</h1>
        <div class="page-actions">
          <a class="btn secondary" href="/">← {t("nav.dashboard")}</a>
          <a class="btn js-add-modal" href="/admin/users/new"
             data-modal-title={t("adm.createHeading")} data-modal-size="md">+ {t("adm.createHeading")}</a>
        </div>
      </div>

      <p class="scroll-hint" aria-hidden="true"><span>↔</span> {t("members.scrollHint")}</p>
      <div class="tbl-wrap">
        <table class="admin-tbl">
          <thead>
            <tr><th>ID</th><th>{t("profile.username")}</th><th>{t("nav.roles")}</th><th>{t("nav.language")}</th><th>{t("adm.stateScope")}</th><th>{t("members.status")}</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr>
                <td class="muted">{u.id}</td>
                <td>
                  {u.username}
                  {u.id === user.id && (
                    <span class="badge" style="margin-left:6px" title={t("adm.selfEdit")}>{t("adm.you")}</span>
                  )}
                </td>
                <td>{localizedRoleNames(u.role_names, lang) || "—"}</td>
                <td>
                  {u.language
                    ? <span class="badge">{u.language.toUpperCase()}</span>
                    : <span class="muted">—</span>}
                </td>
                <td class="small">{stateSummary(u, regions, t("adm.allStates"))}</td>
                <td>
                  {u.active === 1
                    ? <span class="badge active">{t("adm.active")}</span>
                    : <span class="badge inactive">{t("adm.off")}</span>}
                  {u.must_change_password === 1 && <span class="badge moved" style="margin-left:4px">{t("adm.pwChange")}</span>}
                </td>
                <td class="row-actions-cell">
                  <div class="row-icon-actions">
                    {u.id !== user.id
                      ? <a class="btn sm secondary icon-btn js-edit-modal" href={`/admin/users/${u.id}/edit`}
                           data-modal-title={`${t("adm.editHeading")}: ${u.username}`} data-modal-size="md"
                           title={t("members.edit")} aria-label={t("members.edit")}><EditIcon /></a>
                      : <span class="muted" title={t("adm.selfEdit")}>—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editUser && (
        <div class="card" style="margin-top:18px">
          <h2>{t("adm.editHeading")}: {editUser.username}</h2>
          {editErrors.length > 0 && (
            <div class="flash err"><ul class="err-list">{editErrors.map((e) => <li>{e}</li>)}</ul></div>
          )}
          {userForm({ id: editUser.id, username: editUser.username, allStates: editUser.allStates, selectedRoles: editUser.selectedRoles, selectedStates: editUser.selectedStates, active: editUser.active, mustChange: editUser.must_change_password }, { roles, regions }, t)}
        </div>
      )}

    </Layout>
  );
}

export function AdminUserEditPage(props: Common & {
  editUser: AdminUserRow & { allStates: boolean; selectedRoles: number[]; selectedStates: number[] };
  roles: { id: number; name: string; description: string | null }[];
  regions: { id: number; name: string }[];
  editErrors: string[];
  modal?: boolean;
}) {
  const { user, perms, flash, editUser: u, roles, regions, editErrors, lang, modal } = props;
  const t = getDict(lang ?? "en");
  if (modal) {
    return (
      <UserFormFragment lang={lang} errors={editErrors}
        values={{ id: u.id, username: u.username, allStates: u.allStates, selectedRoles: u.selectedRoles, selectedStates: u.selectedStates, active: u.active, mustChange: u.must_change_password }}
        roles={roles} regions={regions} />
    );
  }
  return (
    <Layout title={`${t("members.edit")}: ${u.username}`} lang={lang} user={user} perms={perms} active="/admin/users" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("adm.editHeading")}: {u.username}</h1>
        <a class="btn secondary" href="/admin/users">{t("members.toList")}</a>
      </div>
      <div class="card">
        {editErrors.length > 0 && (
          <div class="flash err"><ul class="err-list">{editErrors.map((e) => <li>{e}</li>)}</ul></div>
        )}
        <UserFormFragment lang={lang} errors={editErrors}
          values={{ id: u.id, username: u.username, allStates: u.allStates, selectedRoles: u.selectedRoles, selectedStates: u.selectedStates, active: u.active, mustChange: u.must_change_password }}
          roles={roles} regions={regions} />
      </div>
    </Layout>
  );
}

// ---------- Roles ----------

export type AdminRoleRow = {
  id: number;
  name: string;
  description: string | null;
  is_system: number;
  permissions: string[];
};

type RolesProps = Common & {
  roles: AdminRoleRow[];
  createErrors: string[];
  saveErrors: string[];
};

function permCheckboxes(role: { id: number; permissions: string[] } | null, labels: Record<string, string>) {
  return (
    <div class="form-grid" style="margin-top:8px">
      {PERMISSIONS.map((p) => (
        <label class="field" style="font-size:14px">
          <input type="checkbox" name="permissions" value={p}
            checked={role !== null && role.permissions.includes(p)} /> {labels[p]}
          <span class="hint"> ({p})</span>
        </label>
      ))}
    </div>
  );
}

/** Bare role form — create or edit one role's name/description/permissions.
 * Served in the add/edit modal (no Layout) and as the no-JS fallback. */
export function RoleFormFragment(props: {
  id?: number; lang?: Lang; errors: string[];
  values?: { name?: string; description?: string; permissions?: string[] };
  edit?: boolean; existing?: AdminRoleRow;
}) {
  const t = getDict(props.lang ?? "en");
  const PL = (props.lang ?? "en") === "mm" ? PERMISSION_LABELS
    : (props.lang ?? "en") === "kr" ? PERMISSION_LABELS_KR : PERMISSION_LABELS_EN;
  const isNew = !props.edit;
  const v = props.values ?? {};
  const role = isNew ? null : (props.existing ?? null);
  const perms = role ? role.permissions : (v.permissions ?? []);
  const action = isNew ? "/admin/roles" : `/admin/roles/${role!.id}`;
  return (
    <form method="post" action={action} data-flash-ok={isNew ? "role-created" : "role-updated"}>
      {props.errors.length > 0 && (
        <div class="flash err">
          <strong>{t("form.invalid")}</strong>
          <ul class="err-list">{props.errors.map((e) => <li>{e}</li>)}</ul>
        </div>
      )}
      {role && <input type="hidden" name="name" value={role.name} />}
      <div class="form-grid">
        <label class="field">
          <span class="lbl">{t("adm.roleName")} {isNew && "*"}</span>
          <input type="text" name={isNew ? "name" : "description"} value={isNew ? v.name ?? "" : role?.description ?? ""}
            required={isNew} {...isNew ? { maxLength: 60 } : {}} />
          {isNew && <span class="field-hint">{t("adm.roleNameHint")}</span>}
        </label>
      </div>
      <div style="margin-top:10px">
        <strong class="small">{t("adm.permissions")}:</strong>
        <div class="form-grid" style="margin-top:8px">
          {PERMISSIONS.map((p) => (
            <label class="field" style="font-size:14px">
              <input type="checkbox" name="permissions" value={p}
                checked={perms.includes(p)} /> {PL[p]}
              <span class="hint"> ({p})</span>
            </label>
          ))}
        </div>
      </div>
      <div class="actions">
        <button class="btn" type="submit">{isNew ? t("adm.createRole") : t("adm.savePerms")}</button>
        <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>
      </div>
    </form>
  );
}

/** Seeded system roles: show their name and description in the current UI
 * language instead of the stored text (descriptions are seeded in Myanmar). */
const SYSTEM_ROLE_NAME: Record<number, string> = {
  1: "adm.roleSuperAdminName",
  2: "adm.roleStateManagerName",
  3: "adm.roleDataEntryName",
  4: "adm.roleViewerName",
};

function roleName(r: AdminRoleRow, t: (key: string) => string): string {
  const key = r.is_system === 1 ? SYSTEM_ROLE_NAME[r.id] : undefined;
  return key ? t(key) : r.name;
}

const SYSTEM_ROLE_DESC: Record<number, string> = {
  1: "adm.roleSuperAdminDesc",
  2: "adm.roleStateManagerDesc",
  3: "adm.roleDataEntryDesc",
  4: "adm.roleViewerDesc",
};

function roleDescription(r: AdminRoleRow, t: (key: string) => string): string {
  const key = r.is_system === 1 ? SYSTEM_ROLE_DESC[r.id] : undefined;
  return (key ? t(key) : r.description) || "—";
}

export function AdminRolesPage(props: RolesProps) {
  const { user, perms, flash, roles, createErrors, saveErrors, lang } = props;
  const t = getDict(lang ?? "en");
  const PL = (lang ?? "en") === "mm" ? PERMISSION_LABELS
    : (lang ?? "en") === "kr" ? PERMISSION_LABELS_KR : PERMISSION_LABELS_EN;
  return (
    <Layout title={t("adm.rolesHeading")} lang={lang} user={user} perms={perms} active="/admin/roles" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("adm.rolesHeading")}</h1>
        <div class="page-actions">
          <a class="btn secondary" href="/">← {t("nav.dashboard")}</a>
          <a class="btn js-add-modal" href="/admin/roles/new?add=1" data-modal-title={t("adm.newRole")} data-modal-size="sm">
            + {t("adm.newRole")}
          </a>
        </div>
      </div>
      <p class="scroll-hint" aria-hidden="true"><span>↔</span> {t("members.scrollHint")}</p>
      <div class="tbl-wrap">
        <table class="admin-tbl">
          <thead>
            <tr><th>ID</th><th>{t("adm.roleName")}</th><th>{t("adm.desc")}</th><th>{t("adm.permissions")}</th><th>{t("members.status")}</th><th></th></tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr>
                <td class="muted">{r.id}</td>
                <td>
                  {roleName(r, t)}
                  {r.is_system === 1 && <span class="badge" style="margin-left:6px">system</span>}
                </td>
                <td class="small muted">{roleDescription(r, t)}</td>
                <td class="small">
                  {r.permissions.length === 0
                    ? <span class="muted">—</span>
                    : r.permissions.map((p) => <span class="badge" style="margin-right:4px">{PL[p as keyof typeof PL] ?? p}</span>)}
                </td>
                <td>
                  {r.is_system === 1
                    ? <span class="badge active">system</span>
                    : <span class="badge inactive">—</span>}
                </td>
                <td class="row-actions-cell">
                  <div class="row-icon-actions">
                    <a class="btn sm secondary icon-btn js-edit-modal" href={`/admin/roles/${r.id}/edit`}
                       data-modal-title={`${t("adm.rolesHeading")}: ${roleName(r, t)}`} data-modal-size="md"
                       title={t("members.edit")} aria-label={t("members.edit")}><EditIcon /></a>
                    {r.is_system !== 1 && (
                      <form method="post" action={`/admin/roles/${r.id}/delete`} data-confirm={t("adm.confirmRole")}>
                        <button class="btn sm danger icon-btn" type="submit" title={t("members.delete")} aria-label={t("members.delete")}><TrashIcon /></button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

// ---------- Lookup options ----------

export type OptionUsage = {
  id: number;
  label: string;
  active: number;
  used: number;
  /** Short code (TWP-001…); null for legacy/non-scoped rows. */
  code?: string | null;
  /** State/Region name for region-scoped options; null/undefined = all states. */
  state?: string | null;
  /** Parent option label (Home Cell -> Township, Family Group -> Home Cell). */
  parent?: string | null;
  /** Church a Home Cell is bound to. */
  church?: string | null;
};

type OptionsProps = Common & {
  type: string;
  typeLabel: string;
  types: { key: string; label: string; active: boolean; count?: number | null }[];
  options?: OptionUsage[];
  regionRows?: { id: number; name: string; name_en: string; code: string | null; used: number }[];
  ageGroupRows?: { id: number; name: string; min_age: number; max_age: number }[];
  /** States for the State/Region picker on region-scoped option types. */
  regions?: { id: number; name: string }[];
  /** Pin the State/Region picker to the single allowed state (state managers). */
  lockRegion?: boolean;
  /** Global admins may create all-states options; state managers may not. */
  allowAllStates?: boolean;
  /** Parent options for chained types (Home Cell -> Township, Family Group -> Home Cell). */
  parentOptions?: { id: number; label: string; regionId: number }[];
  /** Regional Churches a Home Cell can be bound to. */
  churches?: { id: number; name: string; regionId: number }[];
  addErrors: string[];
  editError: string | null;
  showAddForm?: boolean;
};

/** State/Region picker for region-scoped option types (blank = every state).
 * lockRegion pins the select to a single state (state managers with one state).
 * A locked select is disabled for display only, so the hidden input carries its
 * value — disabled controls are not submitted with the form. allowAllStates is
 * false for state managers, who may never create an all-states option. */
function optionStateField(
  regions: { id: number; name: string }[] | undefined,
  type: string,
  selected: string,
  t: (k: string) => string,
  lockRegion = false,
  allowAllStates = true,
) {
  if (!isRegionScopedType(type) || !regions || regions.length === 0) return null;
  return (
    <label class="field">
      <span class="lbl">{t("adm.optionState")}</span>
      {lockRegion && <input type="hidden" name="region_id" value={selected || String(regions[0]!.id)} />}
      <select name="region_id" data-region-select disabled={lockRegion ? true : undefined}>
        {!lockRegion && allowAllStates && <option value="">{t("adm.allStates")}</option>}
        {regions.map((r) => (
          <option value={String(r.id)} selected={lockRegion || selected === String(r.id)}>{r.name}</option>
        ))}
      </select>
      {allowAllStates && <span class="field-hint">{t("adm.optionStateHint")}</span>}
    </label>
  );
}

/** Parent picker for chained types: Home Cell -> Township, Family Group -> Home Cell. */
function optionParentField(
  parentOptions: { id: number; label: string; regionId: number }[] | undefined,
  type: string,
  selected: string,
  t: (k: string) => string,
) {
  const parentType = PARENT_TYPE[type];
  if (!parentType || !parentOptions) return null;
  const lbl = parentType === "township" ? t("form.township") : parentType === "home_cell" ? t("form.homeCell") : parentType;
  return (
    <label class="field">
      <span class="lbl">{lbl}</span>
      <select name="parent_id">
        <option value="">{t("adm.parentNone")}</option>
        {parentOptions.map((p) => (
          <option value={String(p.id)} selected={selected === String(p.id)} data-region={p.regionId === 0 ? "" : String(p.regionId)}>{p.label}</option>
        ))}
      </select>
      <span class="field-hint">{t("adm.parentHint")}</span>
    </label>
  );
}

/** Church picker for Home Cells — the missing link between the Home Cell list
 * and the Regional Church it belongs to (e.g. Yangon Church (Main)). */
function optionChurchField(
  churches: { id: number; name: string; regionId: number }[] | undefined,
  type: string,
  selected: string,
  t: (k: string) => string,
) {
  if (type !== "home_cell") return null;
  return (
    <label class="field span-2">
      <span class="lbl">{t("form.church")}</span>
      <select name="regional_church_id" data-region-filter="1">
        <option value="" data-region="">{t("adm.churchNone")}</option>
        {(churches ?? []).map((c) => (
          <option value={String(c.id)} selected={selected === String(c.id)}
            data-region={String(c.regionId)}>{c.name}</option>
        ))}
      </select>
      <span class="field-hint">{t("adm.churchHint")}</span>
    </label>
  );
}

/** Township short-code input: the prefix of its Family Group codes (INS_FG001…). */
function optionShortCodeField(type: string, value: string | undefined, t: (k: string) => string) {
  if (type !== "township") return null;
  return (
    <label class="field">
      <span class="lbl">{t("adm.shortCode")}</span>
      <input type="text" name="short_code" value={value ?? ""} maxLength={8}
        pattern="[A-Za-z0-9]{0,8}" title={t("adm.shortCodeHint")} />
      <span class="field-hint">{t("adm.shortCodeHint")}</span>
    </label>
  );
}

/** Add form for a lookup option — bare fragment for the modal (and the no-JS ?add=1 fallback). */
export function AddOptionForm(props: {
  type: string; lang?: Lang; errors?: string[]; modal?: boolean; value?: string;
  regions?: { id: number; name: string }[]; regionId?: string; lockRegion?: boolean;
  allowAllStates?: boolean;
  parentOptions?: { id: number; label: string; regionId: number }[]; parentId?: string;
  churches?: { id: number; name: string; regionId: number }[]; churchId?: string;
  shortCode?: string;
}) {
  const t = getDict(props.lang ?? "en");
  const errors = props.errors ?? [];
  return (
    <form method="post" action="/admin/options" data-flash-ok="option-added">
      {errors.length > 0 && (
        <div class="flash err">
          <strong>{t("form.invalid")}</strong>
          <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul>
        </div>
      )}
      <input type="hidden" name="type" value={props.type} />
      <label class="field span-2">
        <span class="lbl">{t("adm.optionLabel")}</span>
        <input type="text" name="label" value={props.value ?? ""} required maxLength={120} />
        <span class="field-hint">{t("adm.labelHint")}</span>
      </label>
      <div class="form-grid">
        {optionStateField(props.regions, props.type, props.regionId ?? "", t, props.lockRegion, props.allowAllStates ?? true)}
        {optionParentField(props.parentOptions, props.type, props.parentId ?? "", t)}
        {optionChurchField(props.churches, props.type, props.churchId ?? "", t)}
        {optionShortCodeField(props.type, props.shortCode, t)}
      </div>
      <div class="actions">
        <button class="btn" type="submit">{t("form.add")}</button>
        {props.modal && <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>}
      </div>
    </form>
  );
}

/** Add form for State/Region rows — bare fragment for the modal (and the no-JS ?add=1 fallback).
 * Code is auto-assigned (REG-001…) on create; no field in the add form. */
export function AddRegionForm(props: { lang?: Lang; errors?: string[]; modal?: boolean; values?: { name?: string; name_en?: string; code?: string } }) {
  const t = getDict(props.lang ?? "en");
  const errors = props.errors ?? [];
  const v = props.values ?? {};
  return (
    <form method="post" action="/admin/regions" data-flash-ok="region-added">
      {errors.length > 0 && (
        <div class="flash err">
          <strong>{t("form.invalid")}</strong>
          <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul>
        </div>
      )}
      <div class="form-grid">
        <label class="field">
          <span class="lbl">{t("adm.regionNameMm")} *</span>
          <input type="text" name="name" value={v.name ?? ""} required maxLength={120} />
        </label>
        <label class="field">
          <span class="lbl">{t("adm.regionNameEn")}</span>
          <input type="text" name="name_en" value={v.name_en ?? ""} maxLength={120} />
        </label>
      </div>
      <div class="actions">
        <button class="btn" type="submit">{t("form.add")}</button>
        {props.modal && <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>}
      </div>
    </form>
  );
}

/** Add form for an age group — bare fragment for the modal (and the no-JS ?add=1 fallback). */
export function AddAgeGroupForm(props: { lang?: Lang; errors?: string[]; modal?: boolean; values?: { name?: string; min_age?: string; max_age?: string } }) {
  const t = getDict(props.lang ?? "en");
  const errors = props.errors ?? [];
  const v = props.values ?? {};
  return (
    <form method="post" action="/admin/age-groups" data-flash-ok="age-group-added">
      {errors.length > 0 && (
        <div class="flash err">
          <strong>{t("form.invalid")}</strong>
          <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul>
        </div>
      )}
      <label class="field">
        <span class="lbl">{t("adm.ageName")}</span>
        <input type="text" name="name" value={v.name ?? ""} required maxLength={60} />
      </label>
      <div class="form-grid">
        <label class="field">
          <span class="lbl">{t("adm.ageMin")}</span>
          <input type="number" name="min_age" value={v.min_age ?? ""} min={0} max={150} required />
        </label>
        <label class="field">
          <span class="lbl">{t("adm.ageMax")}</span>
          <input type="number" name="max_age" value={v.max_age ?? ""} min={0} max={150} required />
        </label>
      </div>
      <div class="actions">
        <button class="btn" type="submit">{t("form.add")}</button>
        {props.modal && <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>}
      </div>
    </form>
  );
}

/** Edit form for one age group — bare fragment for the modal (and full-page no-JS fallback). */
export function EditAgeGroupForm(props: {
  id: number; lang?: Lang; errors?: string[]; modal?: boolean;
  values?: { name?: string; min_age?: string; max_age?: string };
}) {
  const t = getDict(props.lang ?? "en");
  const errors = props.errors ?? [];
  const v = props.values ?? {};
  return (
    <form method="post" action={`/admin/age-groups/${props.id}`} data-flash-ok="age-group-updated">
      {errors.length > 0 && (
        <div class="flash err">
          <strong>{t("form.invalid")}</strong>
          <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul>
        </div>
      )}
      <label class="field">
        <span class="lbl">{t("adm.ageName")}</span>
        <input type="text" name="name" value={v.name ?? ""} required maxLength={60} />
      </label>
      <div class="form-grid">
        <label class="field">
          <span class="lbl">{t("adm.ageMin")}</span>
          <input type="number" name="min_age" value={v.min_age ?? ""} min={0} max={150} required />
        </label>
        <label class="field">
          <span class="lbl">{t("adm.ageMax")}</span>
          <input type="number" name="max_age" value={v.max_age ?? ""} min={0} max={150} required />
        </label>
      </div>
      <div class="actions">
        <button class="btn" type="submit">{t("form.save")}</button>
        {props.modal && <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>}
      </div>
    </form>
  );
}

/** Edit form for one lookup option — bare fragment for the modal (and full-page no-JS fallback). */
export function EditOptionForm(props: {
  id: number; lang?: Lang; errors?: string[]; modal?: boolean; label?: string;
  type?: string; regions?: { id: number; name: string }[]; regionId?: string; lockRegion?: boolean;
  allowAllStates?: boolean;
  parentOptions?: { id: number; label: string; regionId: number }[]; parentId?: string;
  churches?: { id: number; name: string; regionId: number }[]; churchId?: string;
  code?: string; shortCode?: string;
}) {
  const t = getDict(props.lang ?? "en");
  const errors = props.errors ?? [];
  return (
    <form method="post" action={`/admin/options/${props.id}`} data-flash-ok="option-updated">
      {errors.length > 0 && (
        <div class="flash err">
          <strong>{t("form.invalid")}</strong>
          <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul>
        </div>
      )}
      <div class="form-grid">
        <label class="field">
          <span class="lbl">{t("adm.optionLabel")}</span>
          <input type="text" name="label" value={props.label ?? ""} required maxLength={120} />
          <span class="field-hint">{t("adm.labelHint")}</span>
        </label>
        <label class="field">
          <span class="lbl">{t("adm.codeCol")}</span>
          <input type="text" name="code" value={props.code ?? ""} maxLength={16}
            pattern="[A-Za-z0-9._-]{0,16}" title="3-16 အက္ခရာ/ဂဏန်း/underscore/dash (အလွတ် = code မရှိ)" />
          <span class="field-hint">{t("adm.codeHint")}</span>
        </label>
        {optionStateField(props.regions, props.type ?? "", props.regionId ?? "", t, props.lockRegion, props.allowAllStates ?? true)}
        {optionParentField(props.parentOptions, props.type ?? "", props.parentId ?? "", t)}
        {optionChurchField(props.churches, props.type ?? "", props.churchId ?? "", t)}
        {optionShortCodeField(props.type ?? "", props.shortCode, t)}
      </div>
      <div class="actions">
        <button class="btn" type="submit">{t("form.save")}</button>
        {props.modal && <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>}
      </div>
    </form>
  );
}

/** Edit form for one State/Region row — bare fragment for the modal (and full-page no-JS fallback). */
export function EditRegionForm(props: { id: number; lang?: Lang; errors?: string[]; modal?: boolean; values?: { name?: string; name_en?: string; code?: string } }) {
  const t = getDict(props.lang ?? "en");
  const errors = props.errors ?? [];
  const v = props.values ?? {};
  return (
    <form method="post" action={`/admin/regions/${props.id}`} data-flash-ok="region-updated">
      {errors.length > 0 && (
        <div class="flash err">
          <strong>{t("form.invalid")}</strong>
          <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul>
        </div>
      )}
      <div class="form-grid">
        <label class="field">
          <span class="lbl">{t("adm.regionNameMm")} *</span>
          <input type="text" name="name" value={v.name ?? ""} required maxLength={120} />
        </label>
        <label class="field">
          <span class="lbl">{t("adm.regionNameEn")}</span>
          <input type="text" name="name_en" value={v.name_en ?? ""} maxLength={120} />
        </label>
        <label class="field">
          <span class="lbl">{t("adm.codeCol")}</span>
          <input type="text" name="code" value={v.code ?? ""} maxLength={16}
            pattern="[A-Za-z0-9._-]{0,16}" title="A-Z, 0-9, dash/underscore (အလွတ် = code မရှိ)" />
          <span class="field-hint">{t("adm.codeHint")}</span>
        </label>
      </div>
      <div class="actions">
        <button class="btn" type="submit">{t("form.save")}</button>
        {props.modal && <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>}
      </div>
    </form>
  );
}

function emptyStateRow(cols: number, t: (k: string) => string) {
  return (
    <tr>
      <td colSpan={cols} class="empty-state">
        <strong>{t("dash.none")}</strong>
        <div class="small">{t("adm.addHint")}</div>
      </td>
    </tr>
  );
}

export function AdminOptionsPage(props: OptionsProps) {
  const { user, perms, flash, type, typeLabel, types, options = [], regionRows = [], ageGroupRows = [], regions, parentOptions, churches, addErrors, editError, lang, showAddForm, lockRegion, allowAllStates } = props;
  const t = getDict(lang ?? "en");
  const TL = (lang ?? "en") === "mm" ? OPTION_TYPE_LABELS
    : (lang ?? "en") === "kr" ? OPTION_TYPE_LABELS_KR : OPTION_TYPE_LABELS_EN;
  const isRegion = type === "region";
  const scoped = isRegionScopedType(type);
  const addTitle = `${isRegion ? t("adm.regionTab") : typeLabel} — ${t("adm.addOption")}`;
  // Actions sit in the last column, which is off-screen on phones until the
  // table is swiped; the hint matches the member list's scroll affordance.
  const scrollHint = (
    <p class="scroll-hint" aria-hidden="true"><span>↔</span> {t("members.scrollHint")}</p>
  );
  return (
    <Layout title={t("adm.optionsTitle")} lang={lang} user={user} perms={perms} active="/admin/options" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("adm.optionsHeading")}</h1>
        <div class="page-actions">
          <a class="btn secondary" href="/">← {t("nav.dashboard")}</a>
          {type === "township" && (
            <a class="btn secondary" href="/admin/options/township-codes">{t("adm.shortCodesButton")}</a>
          )}
          <a class="btn js-add-modal" href={`/admin/options${qs({ type, add: "1" })}`} data-modal-title={addTitle} data-modal-size="md">
            + {t("adm.addOption")}
          </a>
        </div>
      </div>

      <div class="page-toolbar">
        <div class="tabs">
          {types.map((t2) => (
            <a class={`btn sm ${t2.key === type ? "" : "secondary"}`} href={`/admin/options${qs({ type: t2.key })}`}
               aria-current={t2.key === type ? "page" : undefined}>
              {t2.key === "region" ? t("adm.regionTab") : (TL[t2.key as OptionType] ?? t2.label)}
              {t2.active ? "" : <span class="dim tab-off"> ({t("adm.offShort")})</span>}
              {t2.count != null && <span class="count">{t2.count}</span>}
            </a>
          ))}
        </div>
      </div>

      {editError && <div class="flash err">{editError}</div>}

      {showAddForm && (
        <div class="card">
          <h2>{addTitle}</h2>
          {addErrors.length > 0 && (
            <div class="flash err"><ul class="err-list">{addErrors.map((e) => <li>{e}</li>)}</ul></div>
          )}
          {isRegion
            ? <AddRegionForm lang={lang} />
            : type === "age_group"
              ? <AddAgeGroupForm lang={lang} />
              : <AddOptionForm type={type} lang={lang} regions={regions} lockRegion={lockRegion} allowAllStates={allowAllStates} parentOptions={parentOptions} churches={churches} />}
        </div>
      )}

      {type === "age_group" ? (
        <>
        {scrollHint}
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>ID</th><th>{t("adm.ageNameCol")}</th><th class="num">{t("adm.ageRange")}</th><th></th></tr></thead>
            <tbody>
              {ageGroupRows.length === 0 ? emptyStateRow(4, t) : ageGroupRows.map((g) => (
                <tr>
                  <td class="muted">{g.id}</td>
                  <td>{g.name}</td>
                  <td class="num">{g.min_age} – {g.max_age}</td>
                  <td class="row-actions-cell">
                    <div class="row-icon-actions">
                      <a class="btn sm secondary icon-btn js-edit-modal" href={`/admin/age-groups/${g.id}/edit`}
                         data-modal-title={`${t("adm.ageTab")}: ${g.name}`} data-modal-size="sm"
                         title={t("members.edit")} aria-label={t("members.edit")}><EditIcon /></a>
                      <form method="post" action={`/admin/age-groups/${g.id}/delete`} data-confirm={t("detail.confirmDelete")}>
                        <button class="btn sm danger icon-btn" type="submit" title={t("members.delete")} aria-label={t("members.delete")}><TrashIcon /></button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : type === "region" ? (
        <>
          {scrollHint}
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr><th>ID</th><th>{t("adm.codeCol")}</th><th>{t("adm.regionNameMm")}</th><th>{t("adm.regionNameEn")}</th><th class="num">{t("adm.usage")}</th><th></th></tr>
              </thead>
              <tbody>
                {regionRows.length === 0 ? emptyStateRow(6, t) : regionRows.map((r) => (
                  <tr>
                    <td class="muted">{r.id}</td>
                    <td><code>{r.code || "—"}</code></td>
                    <td>{r.name}</td>
                    <td>{r.name_en || "—"}</td>
                    <td class={`num${r.used === 0 ? " muted" : ""}`}>{r.used} {t("members.count")}</td>
                    <td class="row-actions-cell">
                      <div class="row-icon-actions">
                        <a class="btn sm secondary icon-btn js-edit-modal" href={`/admin/regions/${r.id}/edit`}
                           data-modal-title={`${t("adm.regionTab")}: ${r.name}`} data-modal-size="sm"
                           title={t("members.edit")} aria-label={t("members.edit")}><EditIcon /></a>
                        <form method="post" action={`/admin/regions/${r.id}/delete`} data-confirm={t("detail.confirmDelete")}>
                          <button class="btn sm danger icon-btn" type="submit" disabled={r.used > 0}
                           title={r.used > 0 ? t("flash.errRegionUsed") : t("members.delete")}
                           aria-label={t("members.delete")}><TrashIcon /></button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
      {scrollHint}
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>ID</th><th>{t("adm.codeCol")}</th><th>{t("adm.labelCol")}</th>{scoped && <th>{t("adm.stateCol")}</th>}{type === "home_cell" && <th>{t("form.church")}</th>}{type === "home_cell" && <th>{t("form.township")}</th>}{type === "family_group" && <th>{t("form.homeCell")}</th>}<th class="num">{t("adm.usage")}</th><th>{t("members.status")}</th><th></th></tr></thead>
          <tbody>
            {options.length === 0 ? emptyStateRow(5 + (scoped ? 1 : 0) + (type === "home_cell" ? 2 : type === "family_group" ? 1 : 0) + 1, t) : options.map((o) => (
              <tr>
                <td class="muted">{o.id}</td>
                <td><code>{o.code || "—"}</code></td>
                <td>{o.label}</td>
                {scoped && <td>{o.state || <span class="muted small">{t("adm.allStates")}</span>}</td>}
                {type === "home_cell" && <td>{o.church || <span class="muted small">{t("adm.churchNone")}</span>}</td>}
                {(type === "home_cell" || type === "family_group") && <td>{o.parent || <span class="muted">—</span>}</td>}
                <td class={`num${o.used === 0 ? " muted" : ""}`}>{o.used} {t("members.count")}</td>
                <td>
                  {o.active === 1
                    ? <span class="badge active">{t("adm.active")}</span>
                    : <span class="badge inactive">{t("adm.off")}</span>}
                </td>
                <td class="row-actions-cell">
                  <div class="row-icon-actions">
                    <a class="btn sm secondary icon-btn js-edit-modal" href={`/admin/options/${o.id}/edit`}
                       data-modal-title={`${typeLabel}: ${o.label}`} data-modal-size="md"
                       title={t("members.edit")} aria-label={t("members.edit")}><EditIcon /></a>
                    <form method="post" action={`/admin/options/${o.id}`}>
                      <input type="hidden" name="toggle" value="1" />
                      <input type="hidden" name="label" value={o.label} />
                      <button class="btn sm secondary" type="submit">{o.active === 1 ? t("adm.disable") : t("adm.enable")}</button>
                    </form>
                    <form method="post" action={`/admin/options/${o.id}/delete`} data-confirm={t("detail.confirmDelete")}>
                      <button class="btn sm danger icon-btn" type="submit" title={t("members.delete")} aria-label={t("members.delete")}><TrashIcon /></button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}
    </Layout>
  );
}
