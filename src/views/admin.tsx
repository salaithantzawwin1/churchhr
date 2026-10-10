import { Layout } from "./layout";
import type { Flash } from "./layout";
import type { SessionUser } from "../session";
import { PERMISSIONS, PERMISSION_LABELS, PERMISSION_LABELS_EN } from "../rbac";
import { getDict, type Lang } from "../i18n";
import { OPTION_TYPE_LABELS, OPTION_TYPE_LABELS_EN, isRegionScopedType, type OptionType } from "../db/schema";
import { PARENT_TYPE } from "../lookup";
import { qs } from "../util";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

// ---------- Users ----------

export type AdminUserRow = {
  id: number;
  username: string;
  active: number;
  must_change_password: number;
  created_at: number;
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
          <input type="text" name={v.id === undefined ? "password" : "new_password"}
            placeholder={v.id === undefined ? t("adm.min8") : t("adm.leaveBlank")} />
        </label>
      </div>
      <div style="margin-top:12px">
        <strong class="small">Roles:</strong>
        <div class="form-grid" style="margin-top:6px">
          {props.roles.map((r) => (
            <label class="field" style="font-size:14px">
              <input type="checkbox" name="roles" value={String(r.id)}
                checked={v.selectedRoles.includes(r.id)} /> {r.name}
            </label>
          ))}
        </div>
      </div>
      <div style="margin-top:12px">
        <strong class="small">{t("adm.stateScope")}:</strong>
        <label class="field" style="font-size:14px;margin-top:4px">
          <input type="checkbox" name="all_states" value="1" checked={v.allStates} /> {t("adm.allStates")}
        </label>
        <div class="form-grid" style="margin-top:4px">
          {props.regions.map((r) => (
            <label class="field" style="font-size:14px">
              <input type="checkbox" name="states" value={String(r.id)}
                checked={v.selectedStates.includes(r.id)} /> {r.name}
            </label>
          ))}
        </div>
      </div>
      <div class="actions">
        <label class="field" style="font-size:14px">
          <input type="checkbox" name="active" value="1" checked={v.active === 1} /> {t("adm.active")}
        </label>
        <label class="field" style="font-size:14px">
          <input type="checkbox" name="must_change" value="1" checked={v.mustChange === 1} /> {t("adm.mustChange")}
        </label>
      </div>
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
  const t = getDict(props.lang ?? "mm");
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
  const t = getDict(lang ?? "mm");
  return (
    <Layout title={t("adm.usersTitle")} lang={lang} user={user} perms={perms} active="/admin/users" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("adm.usersTitle")}</h1>
        <div class="page-actions">
          <a class="btn secondary" href="/">← Dashboard</a>
          <a class="btn js-add-modal" href="/admin/users/new"
             data-modal-title={t("adm.createHeading")} data-modal-size="md">+ {t("adm.createHeading")}</a>
        </div>
      </div>

      <div class="tbl-wrap">
        <table>
          <thead>
            <tr><th>ID</th><th>Username</th><th>Roles</th><th>State Scope</th><th>{t("members.status")}</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr>
                <td class="muted">{u.id}</td>
                <td>
                  {u.username}
                  {u.id === user.id && <span class="badge" style="margin-left:6px">{t("adm.you")}</span>}
                </td>
                <td>{u.role_names || "—"}</td>
                <td class="small">{stateSummary(u, regions, t("adm.allStates"))}</td>
                <td>
                  {u.active === 1
                    ? <span class="badge active">active</span>
                    : <span class="badge inactive">{t("adm.off")}</span>}
                  {u.must_change_password === 1 && <span class="badge moved" style="margin-left:4px">{t("adm.pwChange")}</span>}
                </td>
                <td style="white-space:nowrap">
                  {u.id !== user.id
                    ? <a class="btn sm secondary js-edit-modal" href={`/admin/users/${u.id}/edit`}
                         data-modal-title={`${t("adm.editHeading")}: ${u.username}`} data-modal-size="md">{t("members.edit")}</a>
                    : <span class="muted small">{t("adm.selfEdit")}</span>}
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

      <div class="card" style="margin-top:18px">
        <h2>{t("adm.createHeading")}</h2>
        {createErrors.length > 0 && (
          <div class="flash err"><ul class="err-list">{createErrors.map((e) => <li>{e}</li>)}</ul></div>
        )}
        {userForm({ username: "", allStates: false, selectedRoles: [], selectedStates: [], active: 1, mustChange: 1 }, { roles, regions }, t)}
      </div>
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
  const t = getDict(lang ?? "mm");
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
  const t = getDict(props.lang ?? "mm");
  const PL = (props.lang ?? "mm") === "en" ? PERMISSION_LABELS_EN : PERMISSION_LABELS;
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
        <strong class="small">Permissions:</strong>
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

export function AdminRolesPage(props: RolesProps) {
  const { user, perms, flash, roles, createErrors, saveErrors, lang } = props;
  const t = getDict(lang ?? "mm");
  const PL = (lang ?? "mm") === "en" ? PERMISSION_LABELS_EN : PERMISSION_LABELS;
  return (
    <Layout title="Roles" lang={lang} user={user} perms={perms} active="/admin/roles" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("adm.rolesHeading")}</h1>
        <div class="page-actions">
          <a class="btn secondary" href="/">← Dashboard</a>
          <a class="btn js-add-modal" href="/admin/roles/new?add=1" data-modal-title={t("adm.newRole")} data-modal-size="sm">
            + {t("adm.newRole")}
          </a>
        </div>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr><th>ID</th><th>{t("adm.roleName")}</th><th>{t("adm.desc")}</th><th>{t("adm.permissions")}</th><th>{t("members.status")}</th><th></th></tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr>
                <td class="muted">{r.id}</td>
                <td>
                  {r.name}
                  {r.is_system === 1 && <span class="badge" style="margin-left:6px">system</span>}
                </td>
                <td class="small muted">{r.description || "—"}</td>
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
                <td style="white-space:nowrap">
                  <a class="btn sm secondary js-edit-modal" href={`/admin/roles/${r.id}/edit`}
                     data-modal-title={`${t("adm.rolesHeading")}: ${r.name}`} data-modal-size="md">{t("members.edit")}</a>{" "}
                  {r.is_system !== 1 && (
                    <form method="post" action={`/admin/roles/${r.id}/delete`} data-confirm={t("adm.confirmRole")} style="display:inline">
                      <button class="btn sm danger" type="submit">{t("members.delete")}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class="card" style="margin-top:18px">
        <h2>{t("adm.newRole")}</h2>
        {createErrors.length > 0 && (
          <div class="flash err"><ul class="err-list">{createErrors.map((e) => <li>{e}</li>)}</ul></div>
        )}
        <RoleFormFragment lang={lang} errors={[]} />
      </div>
      {saveErrors.length > 0 && (
        <div class="flash err" style="margin-top:18px"><ul class="err-list">{saveErrors.map((e) => <li>{e}</li>)}</ul></div>
      )}
    </Layout>
  );
}

// ---------- Lookup options ----------

export type OptionUsage = {
  id: number;
  label: string;
  active: number;
  used: number;
  /** State/Region name for region-scoped options; null/undefined = all states. */
  state?: string | null;
  /** Parent option label (Home Cell -> Township, Family Group -> Home Cell). */
  parent?: string | null;
};

type OptionsProps = Common & {
  type: string;
  typeLabel: string;
  types: { key: string; label: string; active: boolean; count?: number | null }[];
  options?: OptionUsage[];
  regionRows?: { id: number; name: string; name_en: string; used: number }[];
  ageGroupRows?: { id: number; name: string; min_age: number; max_age: number }[];
  /** States for the State/Region picker on region-scoped option types. */
  regions?: { id: number; name: string }[];
  /** Pin the State/Region picker to the single allowed state (state managers). */
  lockRegion?: boolean;
  /** Parent options for chained types (Home Cell -> Township, Family Group -> Home Cell). */
  parentOptions?: { id: number; label: string; regionId: number }[];
  addErrors: string[];
  editError: string | null;
  showAddForm?: boolean;
};

/** State/Region picker for region-scoped option types (blank = every state).
 * lockRegion pins the select to a single state (state managers with one state). */
function optionStateField(
  regions: { id: number; name: string }[] | undefined,
  type: string,
  selected: string,
  t: (k: string) => string,
  lockRegion = false,
) {
  if (!isRegionScopedType(type) || !regions || regions.length === 0) return null;
  return (
    <label class="field">
      <span class="lbl">{t("adm.optionState")}</span>
      <select name="region_id" disabled={lockRegion ? true : undefined}>
        {!lockRegion && <option value="">{t("adm.allStates")}</option>}
        {regions.map((r) => (
          <option value={String(r.id)} selected={lockRegion || selected === String(r.id)}>{r.name}</option>
        ))}
      </select>
      <span class="field-hint">{t("adm.optionStateHint")}</span>
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

/** Add form for a lookup option — bare fragment for the modal (and the no-JS ?add=1 fallback). */
export function AddOptionForm(props: {
  type: string; lang?: Lang; errors?: string[]; modal?: boolean; value?: string;
  regions?: { id: number; name: string }[]; regionId?: string; lockRegion?: boolean;
  parentOptions?: { id: number; label: string; regionId: number }[]; parentId?: string;
}) {
  const t = getDict(props.lang ?? "mm");
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
      <label class="field">
        <span class="lbl">{t("adm.optionLabel")}</span>
        <input type="text" name="label" value={props.value ?? ""} required maxLength={120} />
        <span class="field-hint">{t("adm.labelHint")}</span>
      </label>
      {optionStateField(props.regions, props.type, props.regionId ?? "", t, props.lockRegion)}
      {optionParentField(props.parentOptions, props.type, props.parentId ?? "", t)}
      <div class="actions">
        <button class="btn" type="submit">{t("form.add")}</button>
        {props.modal && <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>}
      </div>
    </form>
  );
}

/** Add form for State/Region rows — bare fragment for the modal (and the no-JS ?add=1 fallback). */
export function AddRegionForm(props: { lang?: Lang; errors?: string[]; modal?: boolean; values?: { name?: string; name_en?: string } }) {
  const t = getDict(props.lang ?? "mm");
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
  const t = getDict(props.lang ?? "mm");
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
  const t = getDict(props.lang ?? "mm");
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
  parentOptions?: { id: number; label: string; regionId: number }[]; parentId?: string;
}) {
  const t = getDict(props.lang ?? "mm");
  const errors = props.errors ?? [];
  return (
    <form method="post" action={`/admin/options/${props.id}`} data-flash-ok="option-updated">
      {errors.length > 0 && (
        <div class="flash err">
          <strong>{t("form.invalid")}</strong>
          <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul>
        </div>
      )}
      <label class="field">
        <span class="lbl">{t("adm.optionLabel")}</span>
        <input type="text" name="label" value={props.label ?? ""} required maxLength={120} />
        <span class="field-hint">{t("adm.labelHint")}</span>
      </label>
      {optionStateField(props.regions, props.type ?? "", props.regionId ?? "", t, props.lockRegion)}
      {optionParentField(props.parentOptions, props.type ?? "", props.parentId ?? "", t)}
      <div class="actions">
        <button class="btn" type="submit">{t("form.save")}</button>
        {props.modal && <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>}
      </div>
    </form>
  );
}

/** Edit form for one State/Region row — bare fragment for the modal (and full-page no-JS fallback). */
export function EditRegionForm(props: { id: number; lang?: Lang; errors?: string[]; modal?: boolean; values?: { name?: string; name_en?: string } }) {
  const t = getDict(props.lang ?? "mm");
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
  const { user, perms, flash, type, typeLabel, types, options = [], regionRows = [], ageGroupRows = [], regions, parentOptions, addErrors, editError, lang, showAddForm, lockRegion } = props;
  const t = getDict(lang ?? "mm");
  const TL = (lang ?? "mm") === "en" ? OPTION_TYPE_LABELS_EN : OPTION_TYPE_LABELS;
  const isRegion = type === "region";
  const scoped = isRegionScopedType(type);
  const addTitle = `${isRegion ? t("adm.regionTab") : typeLabel} — ${t("adm.addOption")}`;
  return (
    <Layout title={t("adm.optionsTitle")} lang={lang} user={user} perms={perms} active="/admin/options" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("adm.optionsHeading")}</h1>
        <div class="page-actions">
          <a class="btn secondary" href="/">← Dashboard</a>
          <a class="btn js-add-modal" href={`/admin/options${qs({ type, add: "1" })}`} data-modal-title={addTitle} data-modal-size="sm">
            + {t("adm.addOption")}
          </a>
        </div>
      </div>

      <div class="page-toolbar">
        <div class="tabs">
          {types.map((t2) => (
            <a class={`btn sm ${t2.key === type ? "" : "secondary"}`} href={`/admin/options${qs({ type: t2.key })}`}>
              {t2.key === "region" ? t("adm.regionTab") : (TL[t2.key as OptionType] ?? t2.label)}
              {t2.active ? "" : <span class="dim"> ({t("adm.offShort")})</span>}
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
          {isRegion ? <AddRegionForm lang={lang} /> : <AddOptionForm type={type} lang={lang} regions={regions} lockRegion={lockRegion} parentOptions={parentOptions} />}
        </div>
      )}

      {type === "age_group" ? (
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>ID</th><th>{t("adm.ageNameCol")}</th><th class="num">{t("adm.ageRange")}</th><th></th></tr></thead>
            <tbody>
              {ageGroupRows.length === 0 ? emptyStateRow(4, t) : ageGroupRows.map((g) => (
                <tr>
                  <td class="muted">{g.id}</td>
                  <td>{g.name}</td>
                  <td class="num">{g.min_age} – {g.max_age}</td>
                  <td style="white-space:nowrap">
                    <a class="btn sm secondary js-edit-modal" href={`/admin/age-groups/${g.id}/edit`}
                       data-modal-title={`${t("adm.ageTab")}: ${g.name}`} data-modal-size="sm">{t("members.edit")}</a>{" "}
                    <form method="post" action={`/admin/age-groups/${g.id}/delete`} data-confirm={t("detail.confirmDelete")} style="display:inline">
                      <button class="btn sm danger" type="submit">{t("members.delete")}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : type === "region" ? (
        <>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr><th>ID</th><th>{t("adm.regionNameMm")}</th><th>{t("adm.regionNameEn")}</th><th class="num">{t("adm.usage")}</th><th></th></tr>
              </thead>
              <tbody>
                {regionRows.length === 0 ? emptyStateRow(5, t) : regionRows.map((r) => (
                  <tr>
                    <td class="muted">{r.id}</td>
                    <td>{r.name}</td>
                    <td>{r.name_en || "—"}</td>
                    <td class={`num${r.used === 0 ? " muted" : ""}`}>{r.used} {t("members.count")}</td>
                    <td style="white-space:nowrap">
                      <a class="btn sm secondary js-edit-modal" href={`/admin/regions/${r.id}/edit`}
                         data-modal-title={`${t("adm.regionTab")}: ${r.name}`} data-modal-size="sm">{t("members.edit")}</a>{" "}
                      <form method="post" action={`/admin/regions/${r.id}/delete`} data-confirm={t("detail.confirmDelete")} style="display:inline">
                        <button class="btn sm danger" type="submit" disabled={r.used > 0}
                         title={r.used > 0 ? t("flash.errRegionUsed") : undefined}>{t("members.delete")}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>ID</th><th>{t("adm.labelCol")}</th>{scoped && <th>{t("adm.stateCol")}</th>}{type === "home_cell" && <th>{t("form.township")}</th>}{type === "family_group" && <th>{t("form.homeCell")}</th>}<th class="num">{t("adm.usage")}</th><th>{t("members.status")}</th><th></th></tr></thead>
          <tbody>
            {options.length === 0 ? emptyStateRow(5 + (scoped ? 1 : 0) + (type === "home_cell" || type === "family_group" ? 1 : 0), t) : options.map((o) => (
              <tr>
                <td class="muted">{o.id}</td>
                <td>{o.label}</td>
                {scoped && <td>{o.state || <span class="muted small">{t("adm.allStates")}</span>}</td>}
                {(type === "home_cell" || type === "family_group") && <td>{o.parent || <span class="muted">—</span>}</td>}
                <td class={`num${o.used === 0 ? " muted" : ""}`}>{o.used} {t("members.count")}</td>
                <td>
                  {o.active === 1
                    ? <span class="badge active">active</span>
                    : <span class="badge inactive">{t("adm.off")}</span>}
                </td>
                <td style="white-space:nowrap">
                  <a class="btn sm secondary js-edit-modal" href={`/admin/options/${o.id}/edit`}
                     data-modal-title={`${typeLabel}: ${o.label}`} data-modal-size="sm">{t("members.edit")}</a>{" "}
                  <form method="post" action={`/admin/options/${o.id}`} style="display:inline">
                    <input type="hidden" name="toggle" value="1" />
                    <input type="hidden" name="label" value={o.label} />
                    <button class="btn sm secondary" type="submit">{o.active === 1 ? t("adm.offShort") : t("adm.onShort")}</button>
                  </form>{" "}
                  <form method="post" action={`/admin/options/${o.id}/delete`} data-confirm={t("detail.confirmDelete")} style="display:inline"
                   >
                    <button class="btn sm danger" type="submit">{t("members.delete")}</button>
                  </form>
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
