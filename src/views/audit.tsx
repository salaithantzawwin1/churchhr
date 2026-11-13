import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";

export type AuditRow = {
  id: number;
  at: number;
  user_id: number | null;
  username: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  summary: string | null;
  ip: string | null;
  user_agent: string | null;
  device: string | null;
  method: string | null;
  path: string | null;
  status: number | null;
};

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

/** Action keys are "entity.verb" (member.update, login.failed …). The page shows
 * "<entity> · <verb>" so one dictionary entry covers every route in a family;
 * an unknown key is shown raw instead of being hidden. */
const ENTITY_KEYS: Record<string, string> = {
  member: "audit.e.member",
  report: "audit.e.report",
  pastor: "audit.e.pastor",
  user: "audit.e.user",
  role: "audit.e.role",
  option: "audit.e.option",
  settings: "audit.e.settings",
  household: "audit.e.household",
  region: "audit.e.region",
  regional_church: "audit.e.regionalChurch",
  cluster: "audit.e.cluster",
  department: "audit.e.department",
  position: "audit.e.position",
  home_cell: "audit.e.homeCell",
  age_group: "audit.e.ageGroup",
  fellowship: "audit.e.fellowship",
  group: "audit.e.group",
  session: "audit.e.session",
  account: "audit.e.account",
  trash: "audit.e.trash",
};

const VERB_KEYS: Record<string, string> = {
  create: "audit.v.create",
  update: "audit.v.update",
  delete: "audit.v.delete",
  bulk: "audit.v.bulk",
  import: "audit.v.import",
  photo: "audit.v.photo",
  position: "audit.v.position",
  review: "audit.v.review",
  submit: "audit.v.submit",
  login: "audit.v.login",
  logout: "audit.v.logout",
  password: "audit.v.password",
  failed: "audit.v.failed",
  locked: "audit.v.locked",
  success: "audit.v.success",
};

export function auditActionLabel(t: (key: string) => string, action: string): string {
  const [entity, ...rest] = action.split(".");
  const verb = rest.join(".");
  const entityLabel = ENTITY_KEYS[entity] ? t(ENTITY_KEYS[entity]!) : "";
  if (verb === "history.create" || verb === "history.update" || verb === "history.delete") {
    const base = t("audit.v.history");
    const tail = rest[1] === "create" ? t("audit.v.create") : rest[1] === "delete" ? t("audit.v.delete") : t("audit.v.update");
    return `${entityLabel || entity} · ${base} ${tail}`;
  }
  const verbLabel = VERB_KEYS[verb] ? t(VERB_KEYS[verb]!) : "";
  if (entityLabel && verbLabel) return `${entityLabel} · ${verbLabel}`;
  return action;
}

const YANGON_OFFSET_SECONDS = 6.5 * 3600;

/** "2026-11-12 18:04" in Myanmar time, with seconds when the day is not shown. */
function stamp(unix: number): string {
  return new Date((unix + YANGON_OFFSET_SECONDS) * 1000).toISOString().slice(0, 16).replace("T", " ");
}

export function AuditLogPage(props: Common & {
  rows: AuditRow[];
  total: number;
  page: number;
  pages: number;
  users: string[];
  actionGroups: string[];
  filters: { q: string; user: string; action: string; from: string; to: string };
}) {
  const { user, perms, flash, lang, rows, total, page, pages, users, actionGroups, filters } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const link = (nextPage: number) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.user) params.set("user", filters.user);
    if (filters.action) params.set("action", filters.action);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/admin/audit?${qs}` : "/admin/audit";
  };

  return (
    <Layout title={t("audit.title")} lang={lang} user={user} perms={perms} active="/admin/audit" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("audit.title")}<span class="count-pill">{total}</span></h1>
          <p class="page-sub">{t("audit.intro")}</p>
        </div>
      </div>

      <form class="filters settings-filters" method="get" action="/admin/audit" data-auto-submit="1">
        <input type="search" name="q" value={filters.q} placeholder={t("audit.searchPlaceholder")}
          aria-label={t("audit.searchPlaceholder")} enterkeyhint="search" />
        <select name="user" aria-label={t("audit.who")}>
          <option value="">{t("audit.allUsers")}</option>
          {users.map((name) => <option value={name} selected={filters.user === name}>{name}</option>)}
        </select>
        <select name="action" aria-label={t("audit.what")}>
          <option value="">{t("audit.allActions")}</option>
          {actionGroups.map((group) => (
            <option value={group} selected={filters.action === group}>
              {auditActionLabel(t, `${group}.create`).split(" · ")[0] || group}
            </option>
          ))}
        </select>
        <label class="field">
          <span class="lbl">{t("audit.from")}</span>
          <input type="text" name="from" value={filters.from}
            placeholder="YYYY-MM-DD" inputmode="numeric" autocomplete="off" data-datepicker="1" />
        </label>
        <label class="field">
          <span class="lbl">{t("audit.to")}</span>
          <input type="text" name="to" value={filters.to}
            placeholder="YYYY-MM-DD" inputmode="numeric" autocomplete="off" data-datepicker="1" />
        </label>
        <div class="actions">
          <button class="btn sm secondary" type="submit">{t("audit.apply")}</button>
          <a class="filter-clear" href="/admin/audit">{t("audit.clear")}</a>
        </div>
      </form>

      {rows.length === 0 ? (
        <div class="card org-empty">
          <p class="muted">{t("audit.empty")}</p>
        </div>
      ) : (
        <div class="tbl-wrap audit-wrap">
          <table class="list-tbl audit-tbl">
            <thead>
              <tr>
                <th>{t("audit.when")}</th>
                <th>{t("audit.who")}</th>
                <th>{t("audit.what")}</th>
                <th>{t("audit.device")}</th>
                <th>{t("audit.detail")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr>
                  <td class="audit-when" data-label={t("audit.when")}>{stamp(r.at)}</td>
                  <td data-label={t("audit.who")}>
                    {r.username ? <span class="audit-user">{r.username}</span> : <span class="muted">—</span>}
                  </td>
                  <td class="audit-action-cell" data-label={t("audit.what")}>
                    <span class={`audit-action${r.action.includes("delete") || r.action.includes("failed") || r.action.includes("locked") ? " is-warn" : ""}`}>
                      {auditActionLabel(t, r.action)}
                    </span>
                    {r.entity_id && <span class="audit-entity">#{r.entity_id}</span>}
                    {r.summary && <span class="muted small audit-summary">{r.summary}</span>}
                  </td>
                  <td data-label={t("audit.device")} class="audit-device">
                    {r.device || "—"}
                    {r.ip && <span class="audit-ip">{r.ip}</span>}
                  </td>
                  <td data-label={t("audit.detail")} class="audit-detail">
                    <details>
                      <summary>{r.method ?? ""} {r.path ?? ""}</summary>
                      <div class="audit-ua">
                        <div><strong>{t("audit.path")}:</strong> {r.path ?? "—"} ({r.status ?? "—"})</div>
                        <div><strong>{t("audit.userAgent")}:</strong> {r.user_agent || "—"}</div>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div class="actions" style="justify-content:center">
          {page > 1 && <a class="btn secondary" href={link(page - 1)}>{t("audit.prev")}</a>}
          <span class="muted">{t("audit.page")} {page} / {pages}</span>
          {page < pages && <a class="btn secondary" href={link(page + 1)}>{t("audit.next")}</a>}
        </div>
      )}
    </Layout>
  );
}
