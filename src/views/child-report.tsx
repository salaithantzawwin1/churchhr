import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import { ageFromDate } from "../util";
import { HOPE_SCHOOL, compareGrades } from "../pastor-children";
import type { StudentReportRow } from "../student-enrolments";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

export type ChildReportFilters = {
  year: string;
  grade: string;
  school: string;
  /** "" = every child, "pastor" | "member" = one kind of parent. */
  parent: string;
};

/** Filter the report's rows with the pickers. Kept here so the page and the CSV
 *  route apply exactly the same rule. */
export function applyChildReportFilters(rows: StudentReportRow[], f: ChildReportFilters): StudentReportRow[] {
  return rows.filter((r) =>
    (f.year === "" || r.academicYear === f.year) &&
    (f.grade === "" || r.grade === f.grade) &&
    (f.school === "" || r.schoolKind === f.school) &&
    (f.parent === "" || r.personType === f.parent));
}

function schoolText(row: StudentReportRow): string {
  return row.schoolKind === "hope" ? HOPE_SCHOOL : row.schoolName ?? "";
}

function parentText(row: StudentReportRow, L: Lang): string {
  return L !== "mm" && row.parentNameEn ? row.parentNameEn : row.parentName;
}

/** Group rows by grade, keeping the grades in school order (KG, 1, 2, …). */
function groupByGrade(rows: StudentReportRow[]): { grade: string; rows: StudentReportRow[] }[] {
  const groups = new Map<string, StudentReportRow[]>();
  for (const row of rows) {
    const key = row.grade ?? "";
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : compareGrades(a, b)))
    .map(([grade, list]) => ({ grade, rows: list }));
}

/** Hope School report across pastors' and members' children: grouped by grade
 *  for the chosen school year, with the Hope / outside split the school needs. */
export function ChildReportPage(props: Common & {
  rows: StudentReportRow[];
  years: string[];
  grades: string[];
  filters: ChildReportFilters;
  csvHref: string;
}) {
  const { user, perms, flash, lang, rows, years, grades, filters, csvHref } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const hope = rows.filter((r) => r.schoolKind === "hope").length;
  const outside = rows.length - hope;
  const pastorRows = rows.filter((r) => r.personType === "pastor");
  const memberRows = rows.filter((r) => r.personType === "member");
  const groups = groupByGrade(rows);
  const yearText = filters.year || t("org.childReportAllYears");
  const gradeText = filters.grade || t("org.childReportAllGrades");
  const schoolTextLabel = filters.school === "hope" ? t("org.childReportHopeOnly")
    : filters.school === "other" ? t("org.childReportOthers")
      : t("org.childReportAllSchools");
  const matrix = [
    { type: "pastor", label: t("org.childReportPastors"), rows: pastorRows },
    { type: "member", label: t("org.childReportMembers"), rows: memberRows },
  ].map((group) => ({
    ...group,
    hope: group.rows.filter((r) => r.schoolKind === "hope").length,
    outside: group.rows.filter((r) => r.schoolKind !== "hope").length,
  }));

  return (
    <Layout title={t("org.childReport")} lang={lang} user={user} perms={perms}
      active="/organization/pastors" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("org.childReport")}<span class="count-pill">{rows.length}</span></h1>
          <p class="page-sub">{t("org.childReportIntro")}</p>
        </div>
        <div class="page-head-actions print-hide">
          <a class="btn secondary" href={csvHref}>{t("org.childReportCsv")}</a>
          <button class="btn secondary" type="button" data-print>{t("org.childReportPrint")}</button>
          <a class="btn secondary" href="/organization/pastors">{t("dept.back")}</a>
        </div>
      </div>

      <div class="stat-grid org-stats">
        <div class="stat"><div class="n">{rows.length}</div><div class="t">{t("org.childrenTotal")}</div></div>
        <div class="stat"><div class="n">{hope}</div><div class="t">{t("org.hopeSchoolChildren")}</div></div>
        <div class="stat"><div class="n">{outside}</div><div class="t">{t("org.childReportOutside")}</div></div>
        <div class="stat"><div class="n">{pastorRows.length}</div><div class="t">{t("org.childReportPastors")}</div></div>
        <div class="stat"><div class="n">{memberRows.length}</div><div class="t">{t("org.childReportMembers")}</div></div>
      </div>

      <section class="card report-matrix-card">
        <h2>{t("org.childReportMatrix")}</h2>
        <div class="tbl-wrap">
          <table class="report-table report-matrix">
            <thead>
              <tr>
                <th>{t("org.childReportParentType")}</th>
                <th class="num">{HOPE_SCHOOL}</th>
                <th class="num">{t("org.childReportOutside")}</th>
                <th class="num">{t("org.childReportTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((group) => (
                <tr>
                  <td>{group.label}</td>
                  <td class="num">{group.hope}</td>
                  <td class="num">{group.outside}</td>
                  <td class="num"><strong>{group.rows.length}</strong></td>
                </tr>
              ))}
              <tr class="report-total-row">
                <td>{t("org.childReportTotal")}</td>
                <td class="num"><strong>{hope}</strong></td>
                <td class="num"><strong>{outside}</strong></td>
                <td class="num"><strong>{rows.length}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <form class="filters settings-filters print-hide" method="get" action="/organization/hope-school"
        data-auto-submit="1">
        <select name="year" aria-label={t("org.childAcademicYear")}>
          <option value="" selected={filters.year === ""}>{t("org.childReportAllYears")}</option>
          {years.map((year) => (
            <option value={year} selected={filters.year === year}>{year}</option>
          ))}
        </select>
        <select name="grade" aria-label={t("org.childGrade")}>
          <option value="" selected={filters.grade === ""}>{t("org.childReportAllGrades")}</option>
          {grades.map((grade) => (
            <option value={grade} selected={filters.grade === grade}>{grade}</option>
          ))}
        </select>
        <select name="parent" aria-label={t("org.childReportParentType")}>
          <option value="" selected={filters.parent === ""}>{t("org.childReportAllParents")}</option>
          <option value="pastor" selected={filters.parent === "pastor"}>{t("org.childReportPastors")}</option>
          <option value="member" selected={filters.parent === "member"}>{t("org.childReportMembers")}</option>
        </select>
        <select name="school" aria-label={t("org.childSchool")}>
          <option value="" selected={filters.school === ""}>{t("org.childReportAllSchools")}</option>
          <option value="hope" selected={filters.school === "hope"}>{t("org.childReportHopeOnly")}</option>
          <option value="other" selected={filters.school === "other"}>{t("org.childReportOthers")}</option>
        </select>
        <div class="actions"><button class="btn sm secondary" type="submit">{t("members.search")}</button></div>
      </form>

      <p class="print-only print-meta">
        {t("org.childAcademicYear")}: {yearText} · {t("org.childGrade")}: {gradeText} ·{" "}
        {t("org.childSchool")}: {schoolTextLabel} · {t("org.childReportParentType")}:{" "}
        {filters.parent === "pastor" ? t("org.childReportPastors")
          : filters.parent === "member" ? t("org.childReportMembers") : t("org.childReportAllParents")}
      </p>

      {rows.length === 0 ? (
        <div class="card org-empty org-empty-small">
          <p class="muted">{t("org.childReportEmpty")}</p>
        </div>
      ) : (
        <div class="report-groups">
          {groups.map((group) => {
            const groupHope = group.rows.filter((r) => r.schoolKind === "hope").length;
            return (
              <section class="card report-group">
                <div class="report-group-head">
                  <h2>{group.grade || "—"}</h2>
                  <div class="report-group-tags">
                    <span class="pastor-tag">
                      {t("org.childReportPeople")}: <strong>{group.rows.length}</strong>
                    </span>
                    {groupHope > 0 && (
                      <span class="pastor-tag is-accent">
                        {t("org.hopeShort")}: <strong>{groupHope}</strong>
                      </span>
                    )}
                  </div>
                </div>
                <div class="tbl-wrap">
                  <table class="report-table">
                    <thead>
                      <tr>
                        <th class="num">{t("org.childReportNo")}</th>
                        <th>{t("org.childName")}</th>
                        <th>{t("org.childGender")} · {t("org.childAge")}</th>
                        <th>{t("org.childDob")}</th>
                        <th>{t("org.childAcademicYear")}</th>
                        <th>{t("org.childReportParents")}</th>
                        <th>{t("org.childSchool")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row, index) => {
                        const age = ageFromDate(row.dateOfBirth);
                        const gender = row.gender === "male" ? t("org.male")
                          : row.gender === "female" ? t("org.female") : "";
                        const parents = parentText(row, L);
                        return (
                          <tr>
                            <td class="num">{index + 1}</td>
                            <td>
                              <strong>{row.name || "—"}</strong>
                              {row.nameEn && row.nameEn !== row.name ? (
                                <span class="muted small"> {row.nameEn}</span>
                              ) : null}
                              {row.status !== "active" && (
                                <div class="muted small">
                                  {row.status === "graduated" ? t("edu.statusGraduated") : t("edu.statusLeft")}
                                </div>
                              )}
                            </td>
                            <td>{[gender, age == null ? "" : String(age)].filter(Boolean).join(" · ") || "—"}</td>
                            <td class="nowrap">{row.dateOfBirth || "—"}</td>
                            <td class="nowrap">{row.academicYear || "—"}</td>
                            <td class="report-parents">
                              {row.parentId != null ? (
                                <a href={row.personType === "pastor"
                                  ? `/organization/pastors/${row.parentId}`
                                  : `/members/${row.parentId}`}>{parents || "—"}</a>
                              ) : (
                                <span>{parents || "—"}</span>
                              )}
                              <span class="muted small">
                                {row.personType === "pastor" ? t("org.childReportPastors") : t("org.childReportMembers")}
                                {row.stateName ? ` · ${L !== "mm" && row.stateNameEn ? row.stateNameEn : row.stateName}` : ""}
                              </span>
                            </td>
                            <td>
                              {row.schoolKind === "hope" ? (
                                <span class="badge active">{HOPE_SCHOOL}</span>
                              ) : (schoolText(row) || "—")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
      <p class="scroll-hint print-hide" aria-hidden="true"><span>↔</span> {t("members.scrollHint")}</p>
    </Layout>
  );
}
