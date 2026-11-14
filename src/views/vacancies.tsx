import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { countLabel, getDict, type Lang } from "../i18n";
import { VACANCY_SCOPES, type VacancyReport, type VacancyScope, type VacancyStructure } from "../vacancies";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

const SCOPE_KEYS: Record<VacancyScope, string> = {
  church: "org.scopeChurch",
  region: "org.scopeRegional",
  cluster: "org.scopeCluster",
  home_cell: "org.scopeHomeCell",
  township: "org.scopeSupervision",
  department: "org.scopeDepartment",
};

const SCOPE_SHORT: Record<VacancyScope, string> = {
  church: "vacancy.scopeChurch",
  region: "vacancy.scopeRegional",
  cluster: "vacancy.scopeCluster",
  home_cell: "vacancy.scopeHomeCell",
  township: "vacancy.scopeSupervision",
  department: "vacancy.scopeDepartment",
};

function locationOf(row: VacancyStructure): string {
  const parts = [row.stateName, row.townshipName].filter(Boolean);
  return parts.join(" · ");
}

export function VacancyReportPage(props: Common & {
  report: VacancyReport;
  scope: VacancyScope | null;
}) {
  const { user, perms, flash, lang, report, scope } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const tabs = [
    { key: "", label: t("vacancy.all"), href: "/organization/vacancies" },
    ...VACANCY_SCOPES.map((s) => ({
      key: s,
      label: t(SCOPE_SHORT[s]),
      href: `/organization/vacancies?scope=${s}`,
    })),
  ];
  const csvHref = `/organization/vacancies.csv${scope ? `?scope=${scope}` : ""}`;
  const groups = VACANCY_SCOPES
    .map((s) => ({ scope: s, rows: report.structures.filter((r) => r.scope === s) }))
    .filter((g) => g.rows.length > 0);
  const fillRate = report.totals.slots > 0
    ? Math.round((report.totals.filled / report.totals.slots) * 100)
    : 0;

  return (
    <Layout title={t("vacancy.title")} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("vacancy.title")}<span class="count-pill">{report.totals.vacant}</span></h1>
          <p class="page-sub">{t("vacancy.intro")}</p>
        </div>
        <div class="page-head-actions">
          <a class="btn" href={csvHref} download>{t("vacancy.export")}</a>
          <a class="btn secondary" href="/organization">{t("dept.back")}</a>
        </div>
      </div>

      <div class="page-toolbar">
        <div class="tabs tabs-wrap">
          {tabs.map((tab) => {
            const active = (scope ?? "") === tab.key;
            return (
              <a class={`btn sm ${active ? "" : "secondary"}`} href={tab.href}
                aria-current={active ? "page" : undefined}>{tab.label}</a>
            );
          })}
        </div>
      </div>

      <div class="stat-grid org-stats">
        <div class="stat"><div class="n">{report.totals.structures}</div><div class="t">{t("vacancy.structuresWithGaps")}</div></div>
        <div class="stat"><div class="n">{report.totals.slots}</div><div class="t">{t("vacancy.slots")}</div></div>
        <div class="stat"><div class="n">{report.totals.filled}</div><div class="t">{t("vacancy.filled")}</div></div>
        <div class="stat"><div class="n">{report.totals.vacant}</div><div class="t">{t("vacancy.vacant")}</div></div>
      </div>

      <section class="card vacancy-progress">
        <div class="vacancy-progress-head">
          <strong>{t("vacancy.fillRate")}</strong>
          <span class="muted small">{fillRate}%</span>
        </div>
        <div class="vacancy-bar" role="img" aria-label={`${fillRate}%`}>
          <span style={`width:${fillRate}%`} />
        </div>
      </section>

      {groups.length === 0 ? (
        <div class="card org-empty org-empty-small">
          <h2>{t("vacancy.emptyTitle")}</h2>
          <p class="muted">{t("vacancy.emptyBody")}</p>
        </div>
      ) : (
        groups.map((group) => (
          <section class="card vacancy-group">
            <div class="org-section-head">
              <div>
                <h2>{t(SCOPE_SHORT[group.scope])}</h2>
                <p class="muted small">
                  {countLabel(t, "vacancy.structures", group.rows.length)} ·{" "}
                  {group.rows.reduce((n, r) => n + r.vacancies.length, 0)} {t("vacancy.vacant")}
                </p>
              </div>
            </div>
            <div class="vacancy-rows">
              {group.rows.map((row) => (
                <article class="vacancy-row">
                  <div class="vacancy-row-head">
                    <div>
                      <h3>
                        {row.scope === "home_cell"
                          ? <a href={`/members?home_cell=${row.id}`}>{row.name}</a>
                          : row.scope === "department"
                            ? <a href={`/organization/departments/${row.id}`}>{row.name}</a>
                            : row.scope === "cluster"
                              ? <a href="/organization/clusters">{row.name}</a>
                              : row.name}
                      </h3>
                      <p class="muted small">
                        {[locationOf(row), row.regionalChurchName].filter(Boolean).join(" · ") || t("vacancy.noLocation")}
                      </p>
                    </div>
                    <span class="badge warn">
                      {row.vacancies.length}/{row.slots} {t("vacancy.vacantShort")}
                    </span>
                  </div>
                  <div class="vacancy-chips">
                    {row.vacancies.map((item) => (
                      <span class="vacancy-chip" title={item.code}>{item.name}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}

      <p class="muted small vacancy-foot">
        {t("vacancy.generatedAt")} {new Date(report.generatedAt * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC
        {scope ? ` · ${t("vacancy.filtered")}` : ""}
      </p>
    </Layout>
  );
}
