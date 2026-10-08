import { Layout } from "./layout";
import type { Flash } from "./layout";
import type { SessionUser } from "../session";
import type { DashboardData } from "../dashboard";
import { getDict, type Lang } from "../i18n";
import { GENDERS, GENDERS_EN } from "../enums";
import { qs } from "../util";

/** Inline stroke icons (lucide-style, 24×24 viewBox) for the stat cards. */
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
  gender: [<circle cx="9.2" cy="9.2" r="5.4" />, <circle cx="14.8" cy="14.8" r="5.4" />],
  pin: [
    <path d="M19.5 10.2c0 5.4-7.5 10.8-7.5 10.8S4.5 15.6 4.5 10.2a7.5 7.5 0 0 1 15 0Z" />,
    <circle cx="12" cy="10.2" r="2.7" />,
  ],
};

function Ico(props: { name: string; tone?: string }) {
  return (
    <span class={"ico" + (props.tone ? ` ${props.tone}` : "")} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">{ICONS[props.name]}</svg>
    </span>
  );
}

/** KPI card: optional tinted icon, headline number, label, optional male/female
 *  sub-line + proportion bar. The number comes first so a wrapped label can
 *  never push numbers out of alignment across a grid row. */
function Stat(props: {
  label: any;
  icon?: string;
  tone?: string;
  n: any;
  sub?: any;
  split?: { male: number; female: number };
}) {
  const { label, icon, tone, n, sub, split } = props;
  const tot = split ? split.male + split.female : 0;
  const pct = (v: number) => (tot > 0 ? Math.round((v / tot) * 1000) / 10 : 0);
  return (
    <div class="stat">
      {icon && <Ico name={icon} tone={tone} />}
      <div class="n">{n}</div>
      <div class="t">{label}</div>
      {sub && <div class="sub">{sub}</div>}
      {split && (
        <div class="splitbar" role="img" aria-label={`${split.male} / ${split.female}`}>
          {tot > 0 && <span class="m" style={`width:${pct(split.male)}%`} />}
          {tot > 0 && <span class="f" style={`width:${pct(split.female)}%`} />}
        </div>
      )}
    </div>
  );
}

export function DashboardPage(props: {
  user: SessionUser;
  perms: Set<string>;
  flash?: Flash;
  data: DashboardData;
  lang?: Lang;
}) {
  const { user, perms, flash, data, lang } = props;
  const t = getDict(lang ?? "mm");
  const isEn = (lang ?? "mm") === "en";
  const stateName = (r: { name: string; name_en?: string | null }) =>
    isEn && r.name_en ? r.name_en : r.name;
  /** Widest state count drives the horizontal bars in the by-state table. */
  const maxState = Math.max(1, ...data.byState.map((r) => r.n));
  return (
    <Layout title="Dashboard" lang={lang} user={user} perms={perms} active="/" flash={flash ?? null}>
      <div class="page-head">
        <h1>Dashboard</h1>
        {perms.has("members.view") && <a class="btn" href="/members">{t("dash.membersLink")}</a>}
      </div>

      <form class="card filters" method="get" action="/">
        <label class="field">
          <span class="lbl">{t("members.state")}</span>
          <select name="state" data-region-select="1">
            <option value="">{t("members.all")}</option>
            {data.filterRegions.map((r) => (
              <option value={String(r.id)} selected={data.filters.state === r.id}>
                {isEn && r.name_en ? r.name_en : r.name}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          <span class="lbl">{t("members.gender")}</span>
          <select name="gender">
            <option value="">{t("members.all")}</option>
            {Object.entries(isEn ? GENDERS_EN : GENDERS).map(([k, v]) => (
              <option value={k} selected={data.filters.gender === k}>{v}</option>
            ))}
          </select>
        </label>
        <label class="field">
          <span class="lbl">{t("members.thHomeCell")}</span>
          <select name="home_cell" data-region-filter="1">
            <option value="">{t("members.all")}</option>
            {data.homeCells.map((o) => (
              <option value={String(o.id)} selected={data.filters.homeCell === o.id}
                data-region={o.region_id === 0 ? "" : String(o.region_id)}>{o.label}</option>
            ))}
          </select>
        </label>
        <label class="field">
          <span class="lbl">{t("members.township")}</span>
          <select name="township" data-region-filter="1">
            <option value="">{t("members.all")}</option>
            {data.townships.map((o) => (
              <option value={o.label} selected={data.filters.township === o.label}
                data-region={o.region_id === 0 ? "" : String(o.region_id)}>{o.label}</option>
            ))}
          </select>
        </label>
        <div class="actions" style="margin:0">
          <button class="btn" type="submit">{t("dash.filterBtn")}</button>
          <a class="btn secondary" href="/">{t("members.clear")}</a>
        </div>
      </form>

      <div class="stat-grid">
        <Stat icon="users" tone="brand" label={t("dash.total")} n={data.total} />
        <Stat icon="check" tone="ok" label={t("dash.active")} n={data.byStatus.active ?? 0} />
        <Stat icon="out" tone="warn" label={t("dash.moved")} n={data.byStatus.moved ?? 0} />
        <Stat icon="pause" tone="err" label={t("dash.inactive")} n={data.byStatus.inactive ?? 0} />
        <Stat
          icon="gender" tone="purple" label={t("dash.gender")}
          n={[
            <span class="gm">{data.male}</span>,
            <span class="sep">/</span>,
            <span class="gf">{data.female}</span>,
          ]}
          split={{ male: data.male, female: data.female }}
        />
        <Stat
          icon="pin" label={t("dash.stateScope")}
          n={data.scopeAll ? t("dash.allStates") : data.stateCount}
        />
      </div>

      <h2 style="font-size:16px;margin:20px 0 10px">{t("dash.ageGroups")}</h2>
      <div class="stat-grid">
        {data.ageGroups.map((g) => (
          <Stat
            label={[g.name, <span class="rng"> ({g.min_age}–{g.max_age})</span>]}
            n={g.male + g.female}
            sub={[
              <span class="gm">{t("dash.maleShort")} {g.male}</span>,
              <span>·</span>,
              <span class="gf">{t("dash.femaleShort")} {g.female}</span>,
            ]}
            split={{ male: g.male, female: g.female }}
          />
        ))}
        <Stat
          label={t("form.familyGroup")}
          n={data.familyGroup.members}
          sub={<span>{data.familyGroup.groups} {t("dash.groupUnit")}</span>}
        />
      </div>
      {data.ageGroups.length === 0 && (
        <p class="muted small" style="margin-top:6px">
          {perms.has("options.manage")
            ? <a href="/admin/options?type=age_group">{t("dash.ageEmpty")}</a>
            : t("dash.ageEmpty")}
        </p>
      )}

      <div class="tbl-wrap" style="margin-top:18px">
        <table>
          <thead><tr><th>{t("dash.state")}</th><th class="bar-col"></th><th class="num">{t("dash.count")}</th></tr></thead>
          <tbody>
            {data.byState.length === 0 && <tr><td colSpan={3} class="muted">{t("dash.none")}</td></tr>}
            {data.byState.map((r) => (
              <tr>
                <td>{perms.has("members.view") ? <a href={`/members${qs({ state: r.id })}`}>{stateName(r)}</a> : stateName(r)}</td>
                <td class="bar-cell">
                  <div class="hbar-track">
                    <div class="hbar" style={`width:${Math.round((r.n / maxState) * 1000) / 10}%`} />
                  </div>
                </td>
                <td class="num">{r.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class="card" style="margin-top:18px">
        <h2>{t("dash.recent")}</h2>
        {data.recent.length === 0 && <p class="muted small">{t("dash.recentEmpty")}</p>}
        <ul class="small">
          {data.recent.map((m) => (
            <li>
              {perms.has("members.view")
                ? <a href={`/members/${m.id}`}>{m.name}</a>
                : m.name}
              <span class="muted"> — {isEn && m.state_name_en ? m.state_name_en : m.state_name}</span>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
