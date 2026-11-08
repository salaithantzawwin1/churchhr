import { Layout } from "./layout";
import type { Flash } from "./layout";
import type { SessionUser } from "../session";
import type { DashboardData } from "../dashboard";
import { getDict, type Lang } from "../i18n";
import { qs } from "../util";

/** Full state/region breakdown: every region in scope, including empty ones. */
export function RegionsPage(props: {
  user: SessionUser;
  perms: Set<string>;
  flash?: Flash;
  data: DashboardData;
  lang?: Lang;
}) {
  const { user, perms, flash, data, lang } = props;
  const t = getDict(lang ?? "en");
  const isEn = (lang ?? "en") === "en";
  const nameOf = (r: { name: string; name_en?: string | null }) =>
    isEn && r.name_en ? r.name_en : r.name;
  const rows = [...data.byState].sort(
    (a, b) => b.n - a.n || nameOf(a).localeCompare(nameOf(b)),
  );
  const covered = rows.filter((r) => r.n > 0).length;
  const coveragePct = rows.length > 0 ? Math.round((covered / rows.length) * 100) : 0;
  const pct = (n: number) => (data.total > 0 ? Math.round((n / data.total) * 1000) / 10 : 0);

  return (
    <Layout title={t("regions.title")} lang={lang} user={user} perms={perms} active="/" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("regions.title")}</h1>
          <p class="page-sub">{t("regions.sub")}</p>
        </div>
      </div>

      <section class="card region-panel">
        <div class="region-panel-head">
          <div class="region-total">
            <b>{data.total}</b> <span>{t("dash.count")}</span>
          </div>
          <div class="region-cov">
            <span>{t("dash.coverage")} <b>{covered} / {rows.length}</b></span>
            <span class="dc-cov-track" aria-hidden="true">
              <span style={`width:${coveragePct}%`} />
            </span>
          </div>
        </div>

        {rows.length === 0 ? (
          <p class="muted small">{t("dash.none")}</p>
        ) : (
          <div class="region-grid">
            {rows.map((r) => (
              <a class={"region-tile" + (r.n === 0 ? " is-empty" : "")} href={`/members${qs({ state: r.id })}`}>
                <span class="rt-top">
                  <span class="rt-name" title={nameOf(r)}>{nameOf(r)}</span>
                  <span class="rt-n">{r.n}</span>
                </span>
                <span class="rt-bar" aria-hidden="true">
                  <span style={`width:${pct(r.n)}%`} />
                </span>
                <span class="rt-pct">{pct(r.n)}%</span>
              </a>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
