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
