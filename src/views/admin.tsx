import { Layout } from "./layout";
import type { Flash } from "./layout";
import type { SessionUser } from "../session";
import { PERMISSIONS, PERMISSION_LABELS, PERMISSION_LABELS_EN } from "../rbac";
import { getDict, type Lang } from "../i18n";
import { OPTION_TYPE_LABELS, OPTION_TYPE_LABELS_EN, type OptionType } from "../db/schema";
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
    <form method="post" action={action}>
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

export function AdminUsersPage(props: UsersProps) {
  const { user, perms, flash, users, roles, regions, editUser, createErrors, editErrors, lang } = props;
  const t = getDict(lang ?? "mm");
  return (
    <Layout title={t("adm.usersTitle")} lang={lang} user={user} perms={perms} active="/admin/users" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("adm.usersTitle")}</h1>
        <a class="btn secondary" href="/">← Dashboard</a>
      </div>

      <div class="tbl-wrap">
        <table>
          <thead>
            <tr><th>ID</th><th>Username</th><th>Roles</th><th>State Scope</th><th>{t("members.status")}</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr>
                <td>{u.id}</td>
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
                <td>
                  {u.id !== user.id
                    ? <a class="btn sm secondary" href={`/admin/users/${u.id}/edit`}>{t("members.edit")}</a>
                    : <span class="muted small">{t("adm.selfEdit")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!editUser && (
        <div class="card" style="margin-top:18px">
          <h2>{t("adm.createHeading")}</h2>
          {createErrors.length > 0 && (
            <div class="flash err"><ul class="err-list">{createErrors.map((e) => <li>{e}</li>)}</ul></div>
          )}
          {userForm({ username: "", allStates: false, selectedRoles: [], selectedStates: [], active: 1, mustChange: 1 }, { roles, regions }, t)}
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
}) {
  const { user, perms, flash, editUser: u, roles, regions, editErrors, lang } = props;
  const t = getDict(lang ?? "mm");
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
        {userForm({ id: u.id, username: u.username, allStates: u.allStates, selectedRoles: u.selectedRoles, selectedStates: u.selectedStates, active: u.active, mustChange: u.must_change_password }, { roles, regions }, t)}
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

export function AdminRolesPage(props: RolesProps) {
  const { user, perms, flash, roles, createErrors, saveErrors, lang } = props;
  const t = getDict(lang ?? "mm");
  const PL = (lang ?? "mm") === "en" ? PERMISSION_LABELS_EN : PERMISSION_LABELS;
  return (
    <Layout title="Roles" lang={lang} user={user} perms={perms} active="/admin/roles" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("adm.rolesHeading")}</h1>
        <a class="btn secondary" href="/">← Dashboard</a>
      </div>
      {saveErrors.length > 0 && (
        <div class="flash err"><ul class="err-list">{saveErrors.map((e) => <li>{e}</li>)}</ul></div>
      )}

      {roles.map((r) => (
        <div class="card">
          <div class="page-head" style="margin-bottom:4px">
            <h2 style="margin:0">
              {r.name}
              {r.is_system === 1 && <span class="badge" style="margin-left:8px">system</span>}
            </h2>
            {r.is_system !== 1 && (
              <form method="post" action={`/admin/roles/${r.id}/delete`} data-confirm={t("adm.confirmRole")}
               >
                <button class="btn sm danger" type="submit">{t("members.delete")}</button>
              </form>
            )}
          </div>
          {r.description && <p class="muted small">{r.description}</p>}
          {r.is_system === 1 ? (
            <div class="form-grid" style="margin-top:8px">
              {PERMISSIONS.map((p) => (
                <span class="small" style={r.permissions.includes(p) ? "" : "opacity:.35;text-decoration:line-through"}>
                  {r.permissions.includes(p) ? "✓" : "✗"} {PL[p]}
                </span>
              ))}
            </div>
          ) : (
            <form method="post" action={`/admin/roles/${r.id}`}>
              <input type="hidden" name="name" value={r.name} />
              <input type="hidden" name="description" value={r.description ?? ""} />
              {permCheckboxes(r, PL)}
              <div class="actions">
                <button class="btn" type="submit">{t("adm.savePerms")}</button>
              </div>
            </form>
          )}
        </div>
      ))}

      <div class="card">
        <h2>{t("adm.newRole")}</h2>
        {createErrors.length > 0 && (
          <div class="flash err"><ul class="err-list">{createErrors.map((e) => <li>{e}</li>)}</ul></div>
        )}

        <form method="post" action="/admin/roles">
          <div class="form-grid">
            <label class="field">
              <span class="lbl">Role name *</span>
              <input type="text" name="name" required />
            </label>
            <label class="field">
              <span class="lbl">{t("adm.desc")}</span>
              <input type="text" name="description" />
            </label>
          </div>
          {permCheckboxes(null, PL)}
          <div class="actions">
            <button class="btn" type="submit">{t("adm.createRole")}</button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

// ---------- Lookup options ----------

export type OptionUsage = { id: number; label: string; active: number; used: number };

type OptionsProps = Common & {
  type: string;
  typeLabel: string;
  types: { key: string; label: string; active: boolean; count?: number | null }[];
  options?: OptionUsage[];
  regionRows?: { id: number; name: string; name_en: string; used: number }[];
  ageGroupRows?: { id: number; name: string; min_age: number; max_age: number }[];
  addErrors: string[];
  editError: string | null;
  showAddForm?: boolean;
};

/** Add form for a lookup option — bare fragment for the modal (and the no-JS ?add=1 fallback). */
export function AddOptionForm(props: { type: string; lang?: Lang; errors?: string[]; modal?: boolean; value?: string }) {
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
export function EditOptionForm(props: { id: number; lang?: Lang; errors?: string[]; modal?: boolean; label?: string }) {
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
  const { user, perms, flash, type, typeLabel, types, options = [], regionRows = [], ageGroupRows = [], addErrors, editError, lang, showAddForm } = props;
  const t = getDict(lang ?? "mm");
  const TL = (lang ?? "mm") === "en" ? OPTION_TYPE_LABELS_EN : OPTION_TYPE_LABELS;
  const isRegion = type === "region";
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
          {isRegion ? <AddRegionForm lang={lang} /> : <AddOptionForm type={type} lang={lang} />}
        </div>
      )}

      {type === "age_group" ? (
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>ID</th><th>{t("adm.ageName")}</th><th class="num">{t("adm.ageRange")}</th><th></th></tr></thead>
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
          <thead><tr><th>ID</th><th>{t("adm.labelCol")}</th><th class="num">{t("adm.usage")}</th><th>{t("members.status")}</th><th></th></tr></thead>
          <tbody>
            {options.length === 0 ? emptyStateRow(5, t) : options.map((o) => (
              <tr>
                <td class="muted">{o.id}</td>
                <td>{o.label}</td>
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
