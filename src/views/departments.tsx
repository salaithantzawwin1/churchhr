import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import { DEPARTMENT_POSITIONS, positionLabel } from "../positions";
import { departmentName, type DepartmentRow } from "../departments";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

export type AdminDepartmentRow = DepartmentRow & {
  role_count: number;
  member_count: number;
  head_name: string | null;
  assistant_name: string | null;
  secretary_name: string | null;
  treasurer_name: string | null;
};

type DepartmentFormValues = { name: string; nameEn: string; sortOrder: number; active: boolean };

function DepartmentFields(props: {
  department?: AdminDepartmentRow;
  values?: DepartmentFormValues;
  lang: Lang;
}) {
  const { department, values, lang } = props;
  const t = getDict(lang);
  const name = values?.name ?? department?.name ?? "";
  const nameEn = values?.nameEn ?? department?.nameEn ?? "";
  const sortOrder = values?.sortOrder ?? department?.sortOrder ?? 0;
  const active = values?.active ?? department?.active === 1;
  return (
    <>
      <label class="field">
        <span class="lbl">{t("dept.name")}</span>
        <input name="name" value={name} maxlength={80} required autofocus />
      </label>
      <label class="field">
        <span class="lbl">{t("dept.nameEn")}</span>
        <input name="name_en" value={nameEn} maxlength={120} />
      </label>
      <label class="field">
        <span class="lbl">{t("dept.sortOrder")}</span>
        <input name="sort_order" type="number" min="0" max="9999" value={String(sortOrder)} />
      </label>
      {department && (
        <label class="dept-active">
          <input type="checkbox" name="active" value="1" checked={active} />
          <span>{t("dept.active")}</span>
        </label>
      )}
    </>
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
  error?: string | null;
  lang?: Lang;
}) {
  const { department, values, error, lang } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  return (
    <>
      {error && <div class="modal-error" role="alert">{error}</div>}
      <form method="post" action={department ? `/organization/departments/${department.id}` : "/organization/departments"}
        data-modal-ajax>
        <div class="form-grid dept-fields">
          <DepartmentFields department={department} values={values} lang={L} />
        </div>
        <div class="actions">
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
};

export function DepartmentDetailPage(props: Common & {
  department: DepartmentDetailData;
  leaders: DepartmentDetailLeader[];
  canManage: boolean;
}) {
  const { user, perms, flash, lang, department, leaders, canManage } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const leaderFor = (position: string) => leaders.find((l) => l.position === position) ?? null;
  const initial = (name: string | null | undefined) => Array.from((name ?? "").trim())[0] ?? "?";

  return (
    <Layout title={departmentName(department, L)} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head">
        <h1>
          {departmentName(department, L)}
          <span class="count-pill">{department.member_count} {t("org.membersShort")}</span>
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
          {DEPARTMENT_POSITIONS.map((p) => {
            const leader = leaderFor(p.value);
            return (
              <div class={`org-lead dept-leader${leader ? "" : " org-vacant"}`}>
                <span class="org-avatar md" aria-hidden="true">
                  {leader?.has_photo
                    ? (leader.member_id ? <img src={`/members/${leader.member_id}/photo?v=${leader.updated_at}`} alt="" loading="lazy" /> : initial(leader.member_name))
                    : initial(leader?.member_name)}
                </span>
                <span class="org-lead-role">{positionLabel(p.value, L)}</span>
                {leader
                  ? (leader.member_id ? <a href={`/members/${leader.member_id}`}>{leader.member_name || "—"}</a> : <span>{leader.member_name || "—"}</span>)
                  : <span class="muted">{t("org.vacant")}</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section class="card dept-members-card">
        <div>
          <h2>{t("dept.membersTitle")}</h2>
          <p class="muted small">{t("dept.membersHint")}</p>
        </div>
        <div class="dept-members-count">
          <strong>{department.member_count}</strong>
          <span>{t("org.membersShort")}</span>
        </div>
        <a class="btn" href={`/members?department=${department.id}`}>{t("dept.viewMembers")}</a>
      </section>
    </Layout>
  );
}

export function DepartmentsPage(props: Common & {
  departments: AdminDepartmentRow[];
}) {
  const { user, perms, flash, lang, departments } = props;
  const L = lang ?? "en";
  const t = getDict(L);

  return (
    <Layout title={t("dept.title")} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("dept.title")}<span class="count-pill">{departments.length}</span></h1>
          <p class="page-sub">{t("dept.intro")}</p>
        </div>
        <div class="page-head-actions">
          <a class="btn js-add-modal" href="/organization/departments/new"
            data-modal-title={t("dept.addTitle")}>+ {t("dept.add")}</a>
          <a class="btn secondary" href="/organization">{t("dept.back")}</a>
        </div>
      </div>

      {departments.length === 0 ? (
        <div class="card org-empty">
          <h2>{t("dept.emptyTitle")}</h2>
          <p class="muted">{t("dept.emptyBody")}</p>
          <a class="btn js-add-modal" href="/organization/departments/new"
            data-modal-title={t("dept.addTitle")}>+ {t("dept.add")}</a>
        </div>
      ) : (
        <div class="hh-grid">
          {departments.map((d) => (
            <article class={`hh-card dept-card-v2${d.active ? "" : " is-inactive"}`}>
              <div class="hh-card-head">
                <span class="hh-avatar" aria-hidden="true"><DepartmentGlyph /></span>
                <div class="hh-card-title">
                  <span class="hh-card-name" title={L !== "mm" && d.nameEn ? d.nameEn : d.name}>
                    {L !== "mm" && d.nameEn ? d.nameEn : d.name}
                  </span>
                  <span class="hh-card-meta">
                    <span class="hh-count"><b>{d.member_count}</b> {t("org.membersShort")}</span>
                    <span class="muted small">{d.role_count} / {DEPARTMENT_POSITIONS.length} {t("dept.rolesFilled")}</span>
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
                {DEPARTMENT_POSITIONS.map((p) => (
                  <div>
                    <dt>{positionLabel(p.value, L)}</dt>
                    <dd>
                      {(p.value === "department_head" && d.head_name) ? d.head_name
                        : (p.value === "department_assistant" && d.assistant_name) ? d.assistant_name
                        : (p.value === "department_secretary" && d.secretary_name) ? d.secretary_name
                        : (p.value === "department_treasurer" && d.treasurer_name) ? d.treasurer_name
                        : t("dept.vacant")}
                    </dd>
                  </div>
                ))}
              </dl>

              <div class="hh-card-actions">
                <a class="btn sm secondary" href={`/organization/departments/${d.id}`}>{t("org.viewDepartment")}</a>
                <a class="btn sm secondary js-edit-modal" href={`/organization/departments/${d.id}/edit`}
                  data-modal-title={t("dept.editTitle")}>{t("members.edit")}</a>
              </div>
            </article>
          ))}
        </div>
      )}
    </Layout>
  );
}
