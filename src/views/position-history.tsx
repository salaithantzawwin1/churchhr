import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import { parseChanges, type PositionHistoryRow } from "../position-history";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

const SCOPE_KEYS: Record<string, string> = {
  church: "org.scopeChurch",
  regional_church: "org.scopeRegional",
  home_cell: "org.scopeHomeCell",
  township: "org.scopeSupervision",
  department: "org.scopeDepartment",
};

const EVENT_KEYS: Record<string, string> = {
  created: "history.eventCreated",
  updated: "history.eventUpdated",
  deleted: "history.eventDeleted",
  assigned: "history.eventAssigned",
};

const FIELD_KEYS: Record<string, string> = {
  name_myanmar: "history.fieldNameMm",
  name_english: "history.fieldNameEn",
  name_korean: "history.fieldNameKr",
  active: "history.fieldActive",
  sort_order: "history.fieldSort",
  code: "history.fieldCode",
};

function stamp(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 16).replace("T", " ");
}

function eventTone(action: string): string {
  if (action === "deleted") return "inactive";
  if (action === "created" || action === "assigned") return "active";
  return "warn";
}

export function PositionHistoryPage(props: Common & {
  rows: PositionHistoryRow[];
  filter: "all" | "def" | "assignment";
}) {
  const { user, perms, flash, lang, rows, filter } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const tabs: { key: "all" | "def" | "assignment"; label: string; href: string }[] = [
    { key: "all", label: t("history.all"), href: "/organization/positions/history" },
    { key: "def", label: t("history.defs"), href: "/organization/positions/history?type=def" },
    { key: "assignment", label: t("history.assignments"), href: "/organization/positions/history?type=assignment" },
  ];

  return (
    <Layout title={t("history.title")} lang={lang} user={user} perms={perms} active="/organization" flash={flash ?? null}>
      <div class="page-head">
        <div>
          <h1>{t("history.title")}<span class="count-pill">{rows.length}</span></h1>
          <p class="page-sub">{t("history.intro")}</p>
        </div>
        <a class="btn secondary" href="/organization/positions">← {t("org.positionsTitle")}</a>
      </div>

      <div class="page-toolbar">
        <div class="tabs">
          {tabs.map((tab) => (
            <a class={`btn sm ${filter === tab.key ? "" : "secondary"}`} href={tab.href}
              aria-current={filter === tab.key ? "page" : undefined}>{tab.label}</a>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div class="card org-empty org-empty-small">
          <p class="muted">{t("history.empty")}</p>
        </div>
      ) : (
        <div class="history-list">
          {rows.map((row) => {
            const changes = parseChanges(row);
            return (
              <article class="card history-item">
                <div class="history-meta">
                  <time dateTime={new Date(row.createdAt * 1000).toISOString()}>{stamp(row.createdAt)}</time>
                  <span aria-hidden="true">·</span>
                  <span>{row.actorName}</span>
                  {row.entity === "assignment" ? (
                    <span class="badge">{t("history.assignments")}</span>
                  ) : (
                    <span class={`badge ${eventTone(row.action)}`}>{t(EVENT_KEYS[row.action] ?? "history.eventUpdated")}</span>
                  )}
                  {row.scopeType && (
                    <span class="badge">{t(SCOPE_KEYS[row.scopeType] ?? row.scopeType)}</span>
                  )}
                </div>

                <div class="history-main">
                  <strong>{row.summary || row.code || `#${row.id}`}</strong>
                  {row.code && <code>{row.code}</code>}
                </div>

                {row.entity === "assignment" && row.memberId && (
                  <p class="history-detail">
                    <a href={`/members/${row.memberId}`}>{row.memberName || `#${row.memberId}`}</a>
                    {row.summary ? "" : ` · ${t("history.noRoles")}`}
                  </p>
                )}

                {row.entity === "def" && changes.length > 0 && (
                  <ul class="history-changes">
                    {changes.map((change, index) => (
                      <li key={index}>
                        <span class="org-role-label">{t(FIELD_KEYS[change.field] ?? change.field)}</span>
                        {change.field === "active"
                          ? <span>{t(change.from === "1" ? "history.wasActive" : "history.wasInactive")} → {t(change.to === "1" ? "dept.active" : "dept.inactive")}</span>
                          : <span><span class="history-old">{change.from || "—"}</span> → {change.to || "—"}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
