import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import { Pager } from "./pager";

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

/** One audit row as a detail page shows it (household, member …). */
export type ActivityRow = {
  at: number; username: string | null; action: string; summary: string | null;
};

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
  // Only session.logout is written under this prefix: the session's own name is
  // the sign-out, not the sign-in that login.* rows describe.
  session: "audit.e.signOut",
  // Sign-ins are written as login.* but stored under the session entity; the
  // action prefix is what the row shows, so it needs a name of its own.
  login: "audit.g.signins",
  account: "audit.e.account",
  trash: "audit.e.trash",
};

/** Action prefixes that are not record types: sign-ins are written under
 *  login.* and sign-outs under session.*, so each gets its own filter name
 *  instead of both reading as the session entity. */
const ACTION_GROUP_LABELS: Record<string, string> = {
  login: "audit.g.signins",
  session: "audit.g.signouts",
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
  password: "audit.v.password",
  failed: "audit.v.failed",
  locked: "audit.v.locked",
  success: "audit.v.success",
};

export function auditActionLabel(t: (key: string) => string, action: string): string {
  // The verb would only repeat the label ("Sign-out · signed out"), so a sign-out
  // reads as its own action.
  if (action === "session.logout") return t("audit.e.signOut");
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

/** Detail page for a trail entry, when the record has one. Reports and pastors
 *  are included because their pages already read better than the raw id. */
function entityHref(entity: string | null, entityId: string | null): string | null {
  if (!entity || !entityId || !/^\d+$/.test(entityId)) return null;
  switch (entity) {
    case "household": return `/admin/households/${entityId}`;
    case "member": return `/members/${entityId}`;
    case "report": return `/reports/${entityId}`;
    case "pastor": return `/organization/pastors/${entityId}`;
    default: return null;
  }
}

const YANGON_OFFSET_SECONDS = 6.5 * 3600;

/** "2026-11-12 18:04" in Myanmar time, with seconds when the day is not shown. */
export function stamp(unix: number): string {
  return new Date((unix + YANGON_OFFSET_SECONDS) * 1000).toISOString().slice(0, 16).replace("T", " ");
}

export function AuditLogPage(props: Common & {
  rows: AuditRow[];
  total: number;
  page: number;
  pages: number;
  users: string[];
  actionGroups: string[];
  entities: string[];
  filters: {
    q: string; user: string; action: string; entity: string; entityId: string;
    from: string; to: string;
  };
}) {
  const { user, perms, flash, lang, rows, total, page, pages, users, actionGroups, entities, filters } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const link = (nextPage: number) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.user) params.set("user", filters.user);
    if (filters.action) params.set("action", filters.action);
    if (filters.entity) params.set("entity", filters.entity);
    if (filters.entityId) params.set("entity_id", filters.entityId);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/admin/audit?${qs}` : "/admin/audit";
  };
  // Active filters as one-tap chips: each drops a single condition while the
  // rest (including the date window) stay in place.
  const without = (drop: string) => {
    const params = new URLSearchParams();
    const all: Record<string, string> = {
      q: filters.q, user: filters.user, action: filters.action,
      entity: filters.entity, entity_id: filters.entityId,
      from: filters.from, to: filters.to,
    };
    for (const [key, value] of Object.entries(all)) {
      if (value && key !== drop) params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `/admin/audit?${qs}` : "/admin/audit";
  };
  // A filter name in words: the record type's dictionary label, or its token
  // spaced out (regional_church → Regional church) when it has none.
  const humanize = (key: string) => key.replace(/[_-]+/g, " ").replace(/^./, (ch) => ch.toUpperCase());
  const entityLabel = (key: string) => (ENTITY_KEYS[key] ? t(ENTITY_KEYS[key]!) : humanize(key));
  const actionGroupLabel = (key: string) =>
    ACTION_GROUP_LABELS[key] ? t(ACTION_GROUP_LABELS[key]!) : entityLabel(key);

  // Offer only action groups that name a record type. "admin" and
  // "organization" are left over from routes the classifier never matched; their
  // rows stay reachable through the entity filter. A group that is already
  // filtering stays in the list so the select agrees with the URL.
  const actionOptions = actionGroups.filter((group) => ACTION_GROUP_LABELS[group] || ENTITY_KEYS[group]);
  if (filters.action && !actionOptions.includes(filters.action)) actionOptions.push(filters.action);

  // Prefix each chip with its own filter name: a household filter and a
  // household action group would otherwise read as two identical chips.
  const chips: { label: string; href: string }[] = [];
  if (filters.entity) {
    chips.push({ label: `${t("audit.entity")} · ${entityLabel(filters.entity)}`, href: without("entity") });
  }
  if (filters.action) {
    chips.push({ label: `${t("audit.what")} · ${actionGroupLabel(filters.action)}`, href: without("action") });
  }
  if (filters.entityId) chips.push({ label: `#${filters.entityId}`, href: without("entity_id") });

  return (
    <Layout title={t("audit.title")} lang={lang} user={user} perms={perms} active="/admin/audit" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("audit.title")}<span class="count-pill">{total}</span></h1>
          <p class="page-sub">{t("audit.intro")}</p>
        </div>
      </div>

      <details class={chips.length > 0 ? "filter-box filter-toolbar-box has-filters" : "filter-box filter-toolbar-box"} open>
      <summary>
        <span>{t("audit.filters")}{chips.length > 0 && <span class="filter-count">{chips.length}</span>}</span>
        {chips.length > 0 && (
          <span class="filter-peek" title={chips.map((c) => c.label).join(" · ")}>
            {chips.map((c) => c.label).join(" · ")}
          </span>
        )}
        <span class="chev" aria-hidden="true">▾</span>
      </summary>
      <form class="filter-toolbar audit-filter" method="get" action="/admin/audit" data-auto-submit="1">
        <label class="field audit-q">
          <span class="lbl">{t("audit.search")}</span>
          <input type="search" name="q" value={filters.q} placeholder={t("audit.searchPlaceholder")}
            enterkeyhint="search" />
        </label>
        <label class="field">
          <span class="lbl">{t("audit.who")}</span>
          <select name="user">
            <option value="">{t("audit.allUsers")}</option>
            {users.map((name) => <option value={name} selected={filters.user === name}>{name}</option>)}
          </select>
        </label>
        <label class="field">
          <span class="lbl">{t("audit.what")}</span>
          <select name="action">
            <option value="">{t("audit.allActions")}</option>
            {actionOptions.map((group) => (
              <option value={group} selected={filters.action === group}>
                {actionGroupLabel(group)}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          <span class="lbl">{t("audit.entity")}</span>
          <select name="entity">
            <option value="">{t("audit.allEntities")}</option>
            {entities.map((name) => (
              <option value={name} selected={filters.entity === name}>
                {entityLabel(name)}
              </option>
            ))}
          </select>
        </label>
        <label class="field audit-id-filter">
          <span class="lbl">{t("audit.entityId")}</span>
          <input type="search" name="entity_id" value={filters.entityId}
            placeholder={t("audit.entityIdPlaceholder")} inputmode="numeric" autocomplete="off" />
        </label>
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
        <div class="actions audit-actions">
          <button class="btn sm secondary" type="submit">{t("audit.apply")}</button>
          <a class="filter-clear" href="/admin/audit">{t("audit.clear")}</a>
        </div>
        </form>
      </details>

      {chips.length > 0 && (
        <div class="filter-chips" aria-label={t("dash.activeFilters")}>
          {chips.map((c) => (
            <a class="filter-chip" href={c.href} aria-label={`${t("dash.removeFilter")}: ${c.label}`}>
              {c.label}<span class="chip-x" aria-hidden="true">×</span>
            </a>
          ))}
          <a class="filter-clear-all" href="/admin/audit">{t("dash.clearAll")}</a>
        </div>
      )}

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
              {rows.map((r) => {
                const href = entityHref(r.entity, r.entity_id);
                return (
                <tr>
                  <td class="audit-when" data-label={t("audit.when")}>{stamp(r.at)}</td>
                  <td data-label={t("audit.who")}>
                    {r.username ? <span class="audit-user">{r.username}</span> : <span class="muted">—</span>}
                  </td>
                  <td class="audit-action-cell" data-label={t("audit.what")}>
                    <span class={`audit-action${r.action.includes("delete") || r.action.includes("failed") || r.action.includes("locked") ? " is-warn" : ""}`}>
                      {auditActionLabel(t, r.action)}
                    </span>
                    {r.entity_id && (href
                      ? <a class="audit-entity is-link" href={href}>#{r.entity_id}</a>
                      : <span class="audit-entity">#{r.entity_id}</span>)}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} pages={pages} lang={lang} href={link}
        labels={{ prev: t("audit.prev"), next: t("audit.next"), page: t("audit.page") }} />
    </Layout>
  );
}
