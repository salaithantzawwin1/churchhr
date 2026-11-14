import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { countLabel, getDict, pluralLabel, type Lang } from "../i18n";
import { defsForScope, positionDefLabel, positionLabelsForCsv, type PositionDefRow } from "../position-catalog";
import { departmentName, type DepartmentRow } from "../departments";
import { CardViewToggle } from "./view-toggle";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

export type AdminDepartmentRow = DepartmentRow & {
  role_count: number;
  member_count: number;
  church_name: string | null;
  church_name_en: string | null;
};

/** One active holder of a department role, listed on the department card. */
export type DepartmentLeaderRow = {
  departmentId: number;
  position: string;
  memberId: number | null;
  memberName: string | null;
};

type DepartmentFormValues = {
  name: string;
  nameEn: string;
  sortOrder: number;
  active: boolean;
  regionalChurchId: number | "";
};

function DepartmentFields(props: {
  department?: AdminDepartmentRow;
  values?: DepartmentFormValues;
  churches: { id: number; name: string }[];
  lang: Lang;
}) {
  const { department, values, churches, lang } = props;
  const t = getDict(lang);
  const name = values?.name ?? department?.name ?? "";
  const nameEn = values?.nameEn ?? department?.nameEn ?? "";
  const churchId = values?.regionalChurchId ?? department?.regionalChurchId ?? "";
  return (
    <>
      <label class="field">
        <span class="lbl">{t("dept.name")}</span>
        <input type="text" name="name" value={name} maxlength={80} required autofocus />
      </label>
      <label class="field">
        <span class="lbl">{t("dept.nameEn")}</span>
        <input type="text" name="name_en" value={nameEn} maxlength={120} />
      </label>
      <label class="field">
        <span class="lbl">{t("dept.church")}</span>
        <select name="regional_church_id">
          <option value="" selected={churchId === ""}>{t("org.positionChurchAll")}</option>
          {churches.map((church) => (
            <option value={String(church.id)} selected={churchId === church.id}>{church.name}</option>
          ))}
        </select>
        <span class="field-hint">{t("dept.churchHint")}</span>
      </label>
    </>
  );
}

/** Order and visibility sit in their own row so the name fields keep the full
 *  width and the status reads as a deliberate setting, not a stray checkbox. */
function DepartmentMeta(props: {
  department?: AdminDepartmentRow;
  values?: DepartmentFormValues;
  lang: Lang;
}) {
  const { department, values, lang } = props;
  const t = getDict(lang);
  const sortOrder = values?.sortOrder ?? department?.sortOrder ?? 0;
  const active = values?.active ?? department?.active === 1;
  return (
    <div class="dept-meta">
      <label class="field">
        <span class="lbl">{t("dept.sortOrder")}</span>
        <input name="sort_order" type="number" min="0" max="9999" value={String(sortOrder)} />
      </label>
      {department && (
        <label class="dept-toggle">
          <input type="checkbox" name="active" value="1" checked={active} />
          <span class="dept-toggle-text">{t("dept.active")}</span>
        </label>
      )}
    </div>
  );
}

function DepartmentGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="7" r="2.6" />
      <circle cx="5.5" cy="17" r="2.2" />
      <circle cx="18.5" cy="17" r="2.2" />
      <path d="M12 9.6v2.2M5.5 14.8v-1.1a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1.1M7.7 17h8.6" />
    </svg>
  );
}

export function DepartmentModal(props: {
  department?: AdminDepartmentRow;
  values?: DepartmentFormValues;
  churches: { id: number; name: string }[];
  error?: string | null;
  lang?: Lang;
}) {
  const { department, values, churches, error, lang } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  return (
    <>
      {error && <div class="modal-error" role="alert">{error}</div>}
      <form method="post" class="dept-form"
        action={department ? `/organization/departments/${department.id}` : "/organization/departments"}
        data-modal-ajax>
        <div class="form-grid dept-fields">
          <DepartmentFields department={department} values={values} churches={churches} lang={L} />
        </div>
        <DepartmentMeta department={department} values={values} lang={L} />
        {!department && <p class="muted small dept-form-note">{t("dept.addHint")}</p>}
        <div class="actions">
          <button class="btn secondary" type="button" data-close="1">{t("form.cancel")}</button>
          <button class="btn" type="submit">{department ? t("dept.save") : t("dept.add")}</button>
        </div>
      </form>
    </>
  );
}

export type DepartmentDetailLeader = {
  position: string;
  member_id: number | null;
  member_name: string | null;
  has_photo: number | boolean;
  updated_at: number;
};

export type DepartmentDetailData = {
  id: number;
  name: string;
  name_en: string | null;
  member_count: number;
  regional_church_id?: number | null;
  church_name?: string | null;
  church_name_en?: string | null;
};

/** An active member of the department, with the church their Home Cell belongs
 *  to and the department positions they hold. */
export type DepartmentMemberRow = {
  id: number;
  name_myanmar: string | null;
  name_english: string | null;
  gender: string;
  state_name: string;
  state_name_en: string | null;
  church_name: string | null;
  church_name_en: string | null;
  positions: string | null;
};

export type DepartmentMemberFilters = {
  q: string;
  gender: string;
  state: number | null;
  position: string;
};

export function DepartmentDetailPage(props: Common & {
  department: DepartmentDetailData;
  leaders: DepartmentDetailLeader[];
  /** Department roles come from the editable catalogue, not a fixed list. */
  positionDefs: PositionDefRow[];
  members: DepartmentMemberRow[];
  filters: DepartmentMemberFilters;
  /** States the signed-in manager may filter by. */
  regions: { id: number; name: string }[];
  /** Current filter query (with the leading ?), so an assignment can return here. */
  filterQuery: string;
  canManage: boolean;
  canAssign: boolean;
}) {
  const { user, perms, flash, lang, department, leaders, positionDefs, members, filters, regions, filterQuery, canManage, canAssign } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const leaderFor = (position: string) => leaders.find((l) => l.position === position) ?? null;
  const initial = (name: string | null | undefined) => Array.from((name ?? "").trim())[0] ?? "?";
  const deptDefs = defsForScope(positionDefs, "department");
  const filtered = Boolean(filters.q || filters.gender || filters.state != null || filters.position);
  const clearHref = `/organization/departments/${department.id}`;

  return (
    <Layout title={departmentName(department, L)} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head">
        <h1>
          {departmentName(department, L)}
          <span class="count-pill">{countLabel(t, "org.membersShort", department.member_count)}</span>
          {department.church_name && (
            <span class="role-chip church">
              {L !== "mm" && department.church_name_en ? department.church_name_en : department.church_name}
            </span>
          )}
        </h1>
        <div class="actions" style="margin:0">
          <a class="btn secondary" href="/organization">{t("dept.back")}</a>
          {canManage && <a class="btn secondary" href="/organization/departments">{t("org.manageDepartments")}</a>}
        </div>
      </div>
      <p class="muted small">{t("dept.detailIntro")}</p>

      <section class="card dept-detail-leaders">
        <div class="org-section-head">
          <div>
            <h2>{t("dept.leaders")}</h2>
            <p class="muted small">{t("dept.leadersHint")}</p>
          </div>
        </div>
        <div class="org-lead-grid">
          {deptDefs.map((def) => {
            const leader = leaderFor(def.code);
            return (
              <div class={`org-lead dept-leader${leader ? "" : " org-vacant"}`}>
                <span class="org-avatar md" aria-hidden="true">
                  {leader?.has_photo
                    ? (leader.member_id ? <img src={`/members/${leader.member_id}/photo?v=${leader.updated_at}`} alt="" loading="lazy" /> : initial(leader.member_name))
                    : initial(leader?.member_name)}
                </span>
                <span class="org-lead-role">{positionDefLabel(def, L)}</span>
                {leader
                  ? (leader.member_id ? <a href={`/members/${leader.member_id}`}>{leader.member_name || "—"}</a> : <span>{leader.member_name || "—"}</span>)
                  : <span class="muted">{t("org.vacant")}</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section class="card dept-members-card">
        <div class="dept-members-head">
          <div>
            <h2>{t("dept.membersTitle")}</h2>
            <p class="muted small">{t("dept.membersHint")}</p>
          </div>
          <div class="dept-members-count">
            <strong>{members.length}</strong>
            <span>
              {filtered ? `/ ${pluralLabel(t, "org.membersShort", department.member_count)}` : t("org.membersShort")}
            </span>
          </div>
        </div>
        <form class="filters dept-member-filters" method="get"
          action={`/organization/departments/${department.id}`} data-auto-submit="1">
          <input type="search" name="q" value={filters.q}
            placeholder={t("members.search")} aria-label={t("members.search")} enterkeyhint="search" />
          <select name="gender" aria-label={t("form.gender")}>
            <option value="" selected={!filters.gender}>{t("members.all")}</option>
            <option value="male" selected={filters.gender === "male"}>{t("org.male")}</option>
            <option value="female" selected={filters.gender === "female"}>{t("org.female")}</option>
          </select>
          <select name="state" aria-label={t("detail.state")}>
            <option value="" selected={filters.state == null}>{t("org.allStates")}</option>
            {regions.map((r) => (
              <option value={String(r.id)} selected={filters.state === r.id}>{r.name}</option>
            ))}
          </select>
          <select name="position" aria-label={t("org.position")}>
            <option value="" selected={!filters.position}>{t("dept.filterAllPositions")}</option>
            <option value="__none" selected={filters.position === "__none"}>{t("org.noPosition")}</option>
            {deptDefs.map((def) => (
              <option value={def.code} selected={filters.position === def.code}>
                {positionDefLabel(def, L)}
              </option>
            ))}
          </select>
          {filtered && <a class="dept-filter-clear" href={clearHref}>{t("members.clearFilters")}</a>}
        </form>
        <div class="tbl-wrap">
          <table class="dept-members-tbl">
            <thead>
              <tr>
                <th>{t("members.thName")}</th>
                <th>{t("form.gender")}</th>
                <th>{t("detail.state")}</th>
                <th>{t("org.church")}</th>
                <th>{t("org.position")}</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td class="empty-state" colspan={5}>
                    {filtered ? t("org.filterEmpty") : t("dept.noMembers")}
                  </td>
                </tr>
              ) : members.map((m) => {
                const name = L !== "mm" && m.name_english ? m.name_english : (m.name_myanmar || m.name_english || "—");
                const state = L !== "mm" && m.state_name_en ? m.state_name_en : m.state_name;
                const church = L !== "mm" && m.church_name_en ? m.church_name_en : m.church_name;
                const positions = positionLabelsForCsv(positionDefs, m.positions, L);
                const currentPosition = (m.positions ?? "").split(",")[0]?.trim() ?? "";
                return (
                  <tr>
                    <td><a href={`/members/${m.id}`}>{name}</a></td>
                    <td data-label={t("form.gender")}>{m.gender === "male" ? t("org.male") : m.gender === "female" ? t("org.female") : "—"}</td>
                    <td data-label={t("detail.state")}>{state || "—"}</td>
                    <td data-label={t("org.church")}>{church || <span class="muted">—</span>}</td>
                    <td data-label={t("org.position")}>
                      {canAssign && deptDefs.length > 0 ? (
                        <form class="dept-pos-form" method="post"
                          action={`/organization/departments/${department.id}/members/${m.id}/position`}>
                          <input type="hidden" name="return_query" value={filterQuery} />
                          <select name="position" aria-label={t("org.position")}>
                            <option value="" selected={!currentPosition}>{t("org.noPosition")}</option>
                            {deptDefs.map((def) => (
                              <option value={def.code} selected={currentPosition === def.code}>
                                {positionDefLabel(def, L)}
                              </option>
                            ))}
                          </select>
                          <button class="btn sm secondary" type="submit">{t("org.assign")}</button>
                        </form>
                      ) : positions.length > 0 ? positions.join(" · ") : <span class="muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p class="dept-members-foot">
          <a href={`/members?department=${department.id}`}>{t("dept.viewMembers")} →</a>
        </p>
      </section>
    </Layout>
  );
}

export function DepartmentsPage(props: Common & {
  departments: AdminDepartmentRow[];
  positionDefs: PositionDefRow[];
  leaders: DepartmentLeaderRow[];
  /** Departments are church-wide, so only all-state managers may add or edit. */
  canManage: boolean;
}) {
  const { user, perms, flash, lang, departments, positionDefs, leaders, canManage } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  // Roles and their holders come from the editable catalogue so a role added on
  // the Positions screen shows up here too.
  const roleDefs = defsForScope(positionDefs, "department");
  const departmentLeader = (departmentId: number, code: string) =>
    leaders.find((l) => l.departmentId === departmentId && l.position === code) ?? null;
  const filledRoles = (departmentId: number) =>
    roleDefs.filter((def) => departmentLeader(departmentId, def.code)).length;

  return (
    <Layout title={t("dept.title")} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("dept.title")}<span class="count-pill">{departments.length}</span></h1>
          <p class="page-sub">{t("dept.intro")}</p>
        </div>
        <div class="page-head-actions">
          <CardViewToggle lang={lang} viewKey="departments" />
          {canManage && (
            <a class="btn js-add-modal" href="/organization/departments/new"
              data-modal-title={t("dept.addTitle")}>+ {t("dept.add")}</a>
          )}
          <a class="btn secondary" href="/organization">{t("dept.back")}</a>
        </div>
      </div>

      {departments.length === 0 ? (
        <div class="card org-empty">
          <h2>{t("dept.emptyTitle")}</h2>
          <p class="muted">{t("dept.emptyBody")}</p>
          {canManage && (
            <a class="btn js-add-modal" href="/organization/departments/new"
              data-modal-title={t("dept.addTitle")}>+ {t("dept.add")}</a>
          )}
        </div>
      ) : (
        <div class="hh-grid" data-view-grid>
          {departments.map((d) => (
            <article class={`hh-card dept-card-v2${d.active ? "" : " is-inactive"}`}>
              <div class="hh-card-head">
                <span class="hh-avatar" aria-hidden="true"><DepartmentGlyph /></span>
                <div class="hh-card-title">
                  <span class="hh-card-name" title={L !== "mm" && d.nameEn ? d.nameEn : d.name}>
                    {L !== "mm" && d.nameEn ? d.nameEn : d.name}
                  </span>
                  <span class="hh-card-meta">
                    <span class="hh-count"><b>{d.member_count}</b> {pluralLabel(t, "org.membersShort", d.member_count)}</span>
                    <span class="muted small">{filledRoles(d.id)} / {roleDefs.length} {t("dept.rolesFilled")}</span>
                    {d.church_name && (
                      <span class="dept-card-church">
                        {L !== "mm" && d.church_name_en ? d.church_name_en : d.church_name}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div class="hh-facts">
                <div class="hh-fact">
                  <span class="hh-fact-label">{t("members.status")}</span>
                  <span class="hh-fact-value">
                    <span class={`badge ${d.active ? "active" : "inactive"}`}>
                      {d.active ? t("dept.active") : t("dept.inactive")}
                    </span>
                  </span>
                </div>
                <div class="hh-fact">
                  <span class="hh-fact-label">{t("dept.sortOrder")}</span>
                  <span class="hh-fact-value">{d.sortOrder}</span>
                </div>
              </div>

              <dl class="dept-roles">
                {roleDefs.map((def) => (
                  <div>
                    <dt>{positionDefLabel(def, L)}</dt>
                    <dd>{departmentLeader(d.id, def.code)?.memberName || t("dept.vacant")}</dd>
                  </div>
                ))}
              </dl>

              <div class="hh-card-actions">
                <a class="btn sm secondary" href={`/organization/departments/${d.id}`}>{t("org.viewDepartment")}</a>
                {canManage && (
                  <a class="btn sm secondary js-edit-modal" href={`/organization/departments/${d.id}/edit`}
                    data-modal-title={t("dept.editTitle")}>{t("members.edit")}</a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </Layout>
  );
}
