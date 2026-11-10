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

function DepartmentFields(props: { department?: AdminDepartmentRow; lang: Lang }) {
  const { department, lang } = props;
  const t = getDict(lang);
  return (
    <>
      <label class="field">
        <span class="lbl">{t("dept.name")}</span>
        <input name="name" value={department?.name ?? ""} maxlength={80} required />
      </label>
      <label class="field">
        <span class="lbl">{t("dept.nameEn")}</span>
        <input name="name_en" value={department?.nameEn ?? ""} maxlength={120} />
      </label>
      <label class="field">
        <span class="lbl">{t("dept.sortOrder")}</span>
        <input name="sort_order" type="number" min="0" max="9999" value={String(department?.sortOrder ?? 0)} />
      </label>
      {department && (
        <label class="dept-active">
          <input type="checkbox" name="active" value="1" checked={department.active === 1} />
          <span>{t("dept.active")}</span>
        </label>
      )}
    </>
  );
}

export type DepartmentDetailLeader = {
  position: string;
  member_id: number;
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
                    ? <img src={`/members/${leader.member_id}/photo?v=${leader.updated_at}`} alt="" loading="lazy" />
                    : initial(leader?.member_name)}
                </span>
                <span class="org-lead-role">{positionLabel(p.value, L)}</span>
                {leader
                  ? <a href={`/members/${leader.member_id}`}>{leader.member_name || "—"}</a>
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
        <h1>{t("dept.title")}<span class="count-pill">{departments.length}</span></h1>
        <a class="btn secondary" href="/organization">{t("dept.back")}</a>
      </div>
      <p class="muted small">{t("dept.intro")}</p>

      <section class="card dept-add">
        <div class="org-section-head">
          <div>
            <h2>{t("dept.addTitle")}</h2>
            <p class="muted small">{t("dept.addHint")}</p>
          </div>
        </div>
        <form method="post" action="/organization/departments">
          <div class="form-grid dept-fields">
            <DepartmentFields lang={L} />
          </div>
          <div class="actions">
            <button class="btn" type="submit">{t("dept.add")}</button>
          </div>
        </form>
      </section>

      {departments.length === 0 ? (
        <div class="card org-empty">
          <h2>{t("dept.emptyTitle")}</h2>
          <p class="muted">{t("dept.emptyBody")}</p>
        </div>
      ) : (
        <div class="dept-list">
          {departments.map((d) => (
            <form class={`card dept-row${d.active ? "" : " dept-inactive"}`} method="post"
              action={`/organization/departments/${d.id}`}>
              <div class="dept-row-head">
                <div>
                  <h3>{L !== "mm" && d.nameEn ? d.nameEn : d.name}</h3>
                  <p class="muted small">
                    {d.member_count} {t("org.membersShort")} · {d.role_count} / {DEPARTMENT_POSITIONS.length} {t("dept.rolesFilled")}
                  </p>
                </div>
                <span class={`badge ${d.active ? "active" : "inactive"}`}>
                  {d.active ? t("dept.active") : t("dept.inactive")}
                </span>
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
              <div class="form-grid dept-fields">
                <DepartmentFields department={d} lang={L} />
              </div>
              <div class="actions">
                <button class="btn sm" type="submit">{t("dept.save")}</button>
              </div>
            </form>
          ))}
        </div>
      )}
    </Layout>
  );
}
