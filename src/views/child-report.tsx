import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import { ageFromDate } from "../util";
import { HOPE_SCHOOL, compareGrades, type ChildReportRow } from "../pastor-children";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

export type ChildReportFilters = { year: string; grade: string; school: string };

/** Filter a report's rows by the three pickers. Kept here so the page and the
 *  CSV route apply exactly the same rule. */
export function applyChildReportFilters(rows: ChildReportRow[], f: ChildReportFilters): ChildReportRow[] {
  return rows.filter((r) =>
    (f.year === "" || r.academicYear === f.year) &&
    (f.grade === "" || r.grade === f.grade) &&
    (f.school === "" || (f.school === "hope" ? r.atHopeSchool === 1 : r.atHopeSchool !== 1)));
}

function schoolLabel(row: ChildReportRow): string {
  return row.atHopeSchool === 1 ? HOPE_SCHOOL : row.school ?? "";
}

function parentText(row: ChildReportRow, L: Lang): string {
  const pastor = L !== "mm" && row.pastorNameEn ? row.pastorNameEn : row.pastorName;
  const spouse = L !== "mm" && row.spouseNameEn ? row.spouseNameEn : row.spouseName;
  return [pastor, spouse].filter(Boolean).join(" · ");
}

/** Group rows by grade, keeping the grades in school order (KG, 1, 2, …). */
function groupByGrade(rows: ChildReportRow[]): { grade: string; rows: ChildReportRow[] }[] {
  const groups = new Map<string, ChildReportRow[]>();
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

/** Hope School children report: every pastor child in scope, grouped by grade
 *  for the chosen school year, with the totals the school needs each year. */
export function ChildReportPage(props: Common & {
  rows: ChildReportRow[];
  years: string[];
  grades: string[];
  filters: ChildReportFilters;
  csvHref: string;
}) {
  const { user, perms, flash, lang, rows, years, grades, filters, csvHref } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const hope = rows.filter((r) => r.atHopeSchool === 1).length;
  const boys = rows.filter((r) => r.gender === "male").length;
  const girls = rows.filter((r) => r.gender === "female").length;
  const groups = groupByGrade(rows);
  const yearText = filters.year || t("org.childReportAllYears");
  const gradeText = filters.grade || t("org.childReportAllGrades");
  const schoolText = filters.school === "hope" ? t("org.childReportHopeOnly")
    : filters.school === "other" ? t("org.childReportOthers")
      : t("org.childReportAllSchools");

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
        <div class="stat"><div class="n">{boys}</div><div class="t">{t("org.childReportBoys")}</div></div>
        <div class="stat"><div class="n">{girls}</div><div class="t">{t("org.childReportGirls")}</div></div>
      </div>

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
        <select name="school" aria-label={t("org.childSchool")}>
          <option value="" selected={filters.school === ""}>{t("org.childReportAllSchools")}</option>
          <option value="hope" selected={filters.school === "hope"}>{t("org.childReportHopeOnly")}</option>
          <option value="other" selected={filters.school === "other"}>{t("org.childReportOthers")}</option>
        </select>
        <div class="actions"><button class="btn sm secondary" type="submit">{t("members.search")}</button></div>
      </form>

      <p class="print-only print-meta">
        {t("org.childAcademicYear")}: {yearText} · {t("org.childGrade")}: {gradeText} · {t("org.childSchool")}: {schoolText}
      </p>

      {rows.length === 0 ? (
        <div class="card org-empty org-empty-small">
          <p class="muted">{t("org.childReportEmpty")}</p>
        </div>
      ) : (
        <div class="report-groups">
          {groups.map((group) => {
            const groupHope = group.rows.filter((r) => r.atHopeSchool === 1).length;
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
                        return (
                          <tr>
                            <td class="num">{index + 1}</td>
                            <td>
                              <strong>{row.name}</strong>
                              {row.nameEn && row.nameEn !== row.name ? (
                                <span class="muted small"> {row.nameEn}</span>
                              ) : null}
                            </td>
                            <td>{[gender, age == null ? "" : String(age)].filter(Boolean).join(" · ") || "—"}</td>
                            <td class="nowrap">{row.dateOfBirth || "—"}</td>
                            <td class="nowrap">{row.academicYear || "—"}</td>
                            <td class="report-parents">
                              <a href={`/organization/pastors/${row.pastorId}`}>{parentText(row, L)}</a>
                              <span class="muted small">{L !== "mm" && row.stateNameEn ? row.stateNameEn : row.stateName}</span>
                            </td>
                            <td>
                              {row.atHopeSchool === 1 ? (
                                <span class="badge active">{HOPE_SCHOOL}</span>
                              ) : (schoolLabel(row) || "—")}
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
