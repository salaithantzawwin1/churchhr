import { Layout } from "./layout";
import type { Flash } from "./layout";
import type { SessionUser } from "../session";
import type { DashboardData } from "../dashboard";
import { getDict, type Lang } from "../i18n";
import { GENDERS, GENDERS_EN, GENDERS_KR } from "../enums";
import { qs } from "../util";

/** Inline stroke icons (lucide-style, 24×24 viewBox) for the dashboard cards. */
const ICONS: Record<string, any> = {
  users: [
    <circle cx="9" cy="8" r="3.5" />,
    <path d="M2.5 19.5a6.5 6.5 0 0 1 13 0" />,
    <path d="M16 5.3a3.5 3.5 0 0 1 0 5.4" />,
    <path d="M17.8 13.9a6.5 6.5 0 0 1 3.7 5.6" />,
  ],
  check: [<circle cx="12" cy="12" r="9" />, <path d="m8.3 12.4 2.5 2.5 4.9-5.4" />],
  out: [<circle cx="12" cy="12" r="9" />, <path d="M7.5 12h8.5" />, <path d="m12.8 8.7 3.3 3.3-3.3 3.3" />],
  pause: [<circle cx="12" cy="12" r="9" />, <path d="M8.7 12h6.6" />],

};

function Ico(props: { name: string; tone?: string }) {
  return (
    <span class={"ico" + (props.tone ? ` ${props.tone}` : "")} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">{ICONS[props.name]}</svg>
    </span>
  );
}

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 1000) / 10 : 0);

export function DashboardPage(props: {
  user: SessionUser;
  perms: Set<string>;
  flash?: Flash;
  data: DashboardData;
  lang?: Lang;
}) {
  const { user, perms, flash, data, lang } = props;
  const t = getDict(lang ?? "en");
  const isEn = (lang ?? "en") === "en";
  const stateName = (r: { name: string; name_en?: string | null }) =>
    isEn && r.name_en ? r.name_en : r.name;
  /** Only regions that actually have members, busiest first. */
  const byState = data.byState
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n || stateName(a).localeCompare(stateName(b)));
  /** Widest state count drives the ranked bars. */
  const maxState = Math.max(1, ...byState.map((r) => r.n));
  /** The card shows the five busiest regions; /regions has the full breakdown. */
  const topStates = byState.slice(0, 5);
  /** Share of the registry's regions that currently hold members. */
  const coveragePct = data.byState.length > 0 ? Math.round((byState.length / data.byState.length) * 100) : 0;
  const genderTotal = data.male + data.female;
  const malePct = pct(data.male, genderTotal);
  const femalePct = genderTotal > 0 ? Math.round((100 - malePct) * 10) / 10 : 0;
  const maxAge = Math.max(1, ...data.ageGroups.map((g) => g.male + g.female));
  const active = data.byStatus.active ?? 0;
  const moved = data.byStatus.moved ?? 0;
  const inactive = data.byStatus.inactive ?? 0;
  const canView = perms.has("members.view");
  const scopeLabel = data.scopeAll ? t("dash.allStates") : `${data.stateCount} ${t("dash.stateScope")}`;
  const genderLabels: Record<string, string> =
    (lang ?? "en") === "mm" ? GENDERS : (lang ?? "en") === "kr" ? GENDERS_KR : GENDERS_EN;
  /** Current query params, used to build "remove this filter" links. */
  const activeParams = {
    state: data.filters.state,
    gender: data.filters.gender,
    home_cell: data.filters.homeCell,
    township: data.filters.township,
  };
  const withoutFilter = (key: keyof typeof activeParams) => `/${qs({ ...activeParams, [key]: null })}`;
  const chips: { key: string; label: string; href: string }[] = [];
  if (data.filters.state) {
    const region = data.filterRegions.find((r) => r.id === data.filters.state);
    if (region) chips.push({ key: "state", label: stateName(region), href: withoutFilter("state") });
  }
  if (data.filters.gender && genderLabels[data.filters.gender]) {
    chips.push({ key: "gender", label: genderLabels[data.filters.gender]!, href: withoutFilter("gender") });
  }
  if (data.filters.homeCell) {
    const cell = data.homeCells.find((o) => o.id === data.filters.homeCell);
    if (cell) chips.push({ key: "home_cell", label: cell.label, href: withoutFilter("home_cell") });
  }
  if (data.filters.township) {
    chips.push({ key: "township", label: data.filters.township, href: withoutFilter("township") });
  }

  return (
    <Layout title={t("dash.title")} lang={lang} user={user} perms={perms} active="/" flash={flash ?? null}>
      <div class="page-head dash-head">
        <div class="dash-head-title">
          <h1>{t("dash.title")}</h1>
          <p class="page-sub">{t("dash.overview")}{data.scopeAll ? "" : ` · ${scopeLabel}`}</p>
        </div>

        <details class="filter-box filter-toolbar-box" open>
          <summary>
            <span>{t("members.filters")}{chips.length > 0 && <span class="filter-count">{chips.length}</span>}</span>
            <span class="chev" aria-hidden="true">▾</span>
          </summary>
          <form class="filter-toolbar" method="get" action="/" data-auto-submit="1">
            <select name="state" data-region-select="1" aria-label={t("members.state")}>
              <option value="">{t("dash.allStatesOpt")}</option>
              {data.filterRegions.map((r) => (
                <option value={String(r.id)} selected={data.filters.state === r.id}>{stateName(r)}</option>
              ))}
            </select>
            <select name="gender" aria-label={t("members.gender")}>
              <option value="">{t("dash.allGenders")}</option>
              {Object.entries(genderLabels).map(([k, v]) => (
                <option value={k} selected={data.filters.gender === k}>{v}</option>
              ))}
            </select>
            <select name="home_cell" data-region-filter="1" aria-label={t("members.thHomeCell")}>
              <option value="">{t("dash.allCells")}</option>
              {data.homeCells.map((o) => (
                <option value={String(o.id)} selected={data.filters.homeCell === o.id}
                  data-region={o.region_id === 0 ? "" : String(o.region_id)}>{o.label}</option>
              ))}
            </select>
            <select name="township" data-region-filter="1" aria-label={t("members.township")}>
              <option value="">{t("dash.allTownships")}</option>
              {data.townships.map((o) => (
                <option value={o.label} selected={data.filters.township === o.label}
                  data-region={o.region_id === 0 ? "" : String(o.region_id)}>{o.label}</option>
              ))}
            </select>
            {chips.length > 0 && <a class="filter-clear" href="/">{t("members.clear")}</a>}
          </form>
        </details>
      </div>

      {chips.length > 0 && (
        <div class="filter-chips" aria-label={t("dash.activeFilters")}>
          {chips.map((c) => (
            <a class="filter-chip" href={c.href} aria-label={`${t("dash.removeFilter")}: ${c.label}`}>
              {c.label}<span class="chip-x" aria-hidden="true">×</span>
            </a>
          ))}
          <a class="filter-clear-all" href="/">{t("dash.clearAll")}</a>
        </div>
      )}

      <div class="dash-kpis">
        <div class="kpi hero">
          <div class="k-top">
            <Ico name="users" />
            <span class="k-pct" title={scopeLabel}>{scopeLabel}</span>
          </div>
          <div class="k-num">{data.total}</div>
          <div class="k-lbl">{t("dash.total")}</div>
        </div>
        <div class="kpi ok">
          <div class="k-top">
            <Ico name="check" />
            <span class="k-pct">{pct(active, data.total)}%</span>
          </div>
          <div class="k-num">{active}</div>
          <div class="k-lbl">{t("dash.active")}</div>
          <div class="k-bar"><span style={`width:${pct(active, data.total)}%`} /></div>
        </div>
        <div class="kpi warn">
          <div class="k-top">
            <Ico name="out" />
            <span class="k-pct">{pct(moved, data.total)}%</span>
          </div>
          <div class="k-num">{moved}</div>
          <div class="k-lbl">{t("dash.moved")}</div>
          <div class="k-bar"><span style={`width:${pct(moved, data.total)}%`} /></div>
        </div>
        <div class="kpi err">
          <div class="k-top">
            <Ico name="pause" />
            <span class="k-pct">{pct(inactive, data.total)}%</span>
          </div>
          <div class="k-num">{inactive}</div>
          <div class="k-lbl">{t("dash.inactive")}</div>
          <div class="k-bar"><span style={`width:${pct(inactive, data.total)}%`} /></div>
        </div>
      </div>

      <div class="dash-cols">
        <section class="card dash-card">
          <div class="dc-head">
            <h2>{t("dash.state")}</h2>
            {canView && <a href="/regions">{t("dash.viewAll")} →</a>}
          </div>
          {byState.length === 0 ? (
            <p class="muted small">{t("dash.none")}</p>
          ) : (
            <ol class="rank-list" tabindex={0} aria-label={t("dash.state")}>
              {topStates.map((r, i) => (
                <li class="rank-row">
                  <span class="rk">{i + 1}</span>
                  <div class="rn">
                    <div class="vals">
                      <b title={stateName(r)}>
                        {canView
                          ? <a href={`/members${qs({ state: r.id })}`}>{stateName(r)}</a>
                          : stateName(r)}
                      </b>
                      <span class="rv">
                        {r.n}<span class="rp"> · {pct(r.n, data.total)}%</span>
                      </span>
                    </div>
                    <div class="rk-bar" role="presentation">
                      <span style={`width:${Math.round((r.n / maxState) * 1000) / 10}%`} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div class="dc-foot">
            <span><b>{data.total}</b> {t("dash.count")}</span>
            {byState.length > 0 && byState.length < data.byState.length ? (
              <span
                class="dc-cov"
                title={t("dash.coverageNote")}
                aria-label={`${t("dash.coverage")} ${byState.length} / ${data.byState.length}. ${t("dash.coverageNote")}`}
              >
                <span class="dc-cov-track" aria-hidden="true">
                  <span style={`width:${coveragePct}%`} />
                </span>
                <span>{t("dash.coverage")} <b>{byState.length} / {data.byState.length}</b></span>
              </span>
            ) : (
              <span>{byState.length} {t(byState.length === 1 ? "dash.regionOne" : "dash.regionsWithMembers")}</span>
            )}
          </div>
        </section>

        <section class="card dash-card">
          <div class="dc-head"><h2>{t("dash.gender")}</h2></div>
          <div class="donut-wrap">
            <div
              class="donut"
              role="img"
              aria-label={`${t("dash.maleShort")} ${data.male} · ${t("dash.femaleShort")} ${data.female}`}
              style={genderTotal > 0
                ? `background: conic-gradient(var(--male) 0 ${malePct}%, var(--female) ${malePct}% 100%)`
                : "background: var(--track)"}
            >
              <div class="d-center">
                <b>{genderTotal}</b>
                <span>{t("dash.totalShort")}</span>
              </div>
            </div>
            <div class="legend">
              <div class="lg">
                <span class="dot m" aria-hidden="true" />
                <span>{t("dash.maleShort")}</span>
                <b>{data.male}</b>
                <span class="lg-pct">{pct(data.male, genderTotal)}%</span>
              </div>
              <div class="lg">
                <span class="dot f" aria-hidden="true" />
                <span>{t("dash.femaleShort")}</span>
                <b>{data.female}</b>
                <span class="lg-pct">{femalePct}%</span>
              </div>
            </div>
          </div>
          <div class="dash-note">
            <Ico name="users" tone="purple" />
            <div>
              <b>{data.familyGroup.members}</b> <span>{t("dash.assigned")}</span>
              <div class="small muted">{data.familyGroup.groups} {t("dash.groupUnit")}</div>
            </div>
          </div>
        </section>
      </div>

      <div class="dash-cols">
        <section class="card dash-card">
          <div class="dc-head">
            <h2>{t("dash.ageGroups")}</h2>
            {perms.has("options.manage") && <a href="/admin/options?type=age_group">{t("members.edit")}</a>}
          </div>
          {data.ageGroups.length === 0 ? (
            <p class="muted small">
              {perms.has("options.manage")
                ? <a href="/admin/options?type=age_group">{t("dash.ageEmpty")}</a>
                : t("dash.ageEmpty")}
            </p>
          ) : (
            <div class="age-list">
              {data.ageGroups.map((g) => {
                const tot = g.male + g.female;
                return (
                  <div class="age-row">
                    <div class="a-top">
                      <span class="a-name">
                        {g.name} <span class="a-rng">({g.min_age}–{g.max_age})</span>
                      </span>
                      <span class="a-val">{tot}</span>
                    </div>
                    <div class="a-bar" role="presentation" style={`width:${Math.round((tot / maxAge) * 100)}%`}>
                      {tot > 0 && <span class="m" style={`width:${Math.round((g.male / tot) * 100)}%`} />}
                      {tot > 0 && <span class="f" style={`width:${Math.round((g.female / tot) * 100)}%`} />}
                    </div>
                    <div class="a-sub">
                      <span class="gm">{t("dash.maleShort")} {g.male}</span>
                      <span class="gf">{t("dash.femaleShort")} {g.female}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section class="card dash-card">
          <div class="dc-head">
            <h2>{t("dash.recent")}</h2>
            {canView && <a href="/members">{t("dash.viewAll")} →</a>}
          </div>
          {data.recent.length === 0 ? (
            <p class="muted small">{t("dash.recentEmpty")}</p>
          ) : (
            <ul class="recent-list">
              {data.recent.map((m) => (
                <li>
                  <span class="avatar" aria-hidden="true">{Array.from(m.name.trim())[0] ?? "?"}</span>
                  <div class="rn">
                    {canView
                      ? <a href={`/members/${m.id}`}>{m.name}</a>
                      : <span>{m.name}</span>}
                    <span class="small muted">{isEn && m.state_name_en ? m.state_name_en : m.state_name}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  );
}
