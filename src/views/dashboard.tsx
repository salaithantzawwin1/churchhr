import { Layout } from "./layout";
import type { Flash } from "./layout";
import type { SessionUser } from "../session";
import type { DashboardData } from "../dashboard";
import { getDict, type Lang } from "../i18n";
import { qs } from "../util";

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
  return (
    <Layout title="Dashboard" lang={lang} user={user} perms={perms} active="/" flash={flash ?? null}>
      <div class="page-head">
        <h1>Dashboard</h1>
        {perms.has("members.view") && <a class="btn" href="/members">{t("dash.membersLink")}</a>}
      </div>

      <div class="stat-grid">
        <div class="stat"><div class="n">{data.total}</div><div class="t">{t("dash.total")}</div></div>
        <div class="stat"><div class="n">{data.byStatus.active ?? 0}</div><div class="t">{t("dash.active")}</div></div>
        <div class="stat"><div class="n">{data.byStatus.moved ?? 0}</div><div class="t">{t("dash.moved")}</div></div>
        <div class="stat"><div class="n">{data.byStatus.inactive ?? 0}</div><div class="t">{t("dash.inactive")}</div></div>
        <div class="stat"><div class="n">{data.male} / {data.female}</div><div class="t">{t("dash.gender")}</div></div>
        <div class="stat">
          <div class="n">{data.scopeAll ? t("dash.allStates") : data.stateCount}</div>
          <div class="t">{t("dash.stateScope")}</div>
        </div>
      </div>

      <h2 style="font-size:16px;margin:20px 0 10px">{t("dash.ageGroups")}</h2>
      <div class="stat-grid">
        {data.ageGroups.map((g) => (
          <div class="stat">
            <div class="n">{g.male} / {g.female}</div>
            <div class="t">
              {g.name} <span class="muted small">({g.min_age}–{g.max_age})</span>
            </div>
          </div>
        ))}
        <div class="stat">
          <div class="n">{data.familyGroup.members}</div>
          <div class="t">{t("form.familyGroup")}</div>
          <div class="t muted small">{data.familyGroup.groups} {t("dash.groupUnit")}</div>
        </div>
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
          <thead><tr><th>{t("dash.state")}</th><th>{t("dash.count")}</th></tr></thead>
          <tbody>
            {data.byState.length === 0 && <tr><td colSpan={2} class="muted">{t("dash.none")}</td></tr>}
            {data.byState.map((r) => (
              <tr>
                <td>{perms.has("members.view") ? <a href={`/members${qs({ state: r.id })}`}>{stateName(r)}</a> : stateName(r)}</td>
                <td>{r.n}</td>
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
