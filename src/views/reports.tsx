import { Layout, type Flash } from "./layout";
import type { SessionUser } from "../session";
import { getDict, type Lang } from "../i18n";
import { qs } from "../util";

type Common = { user: SessionUser; perms: Set<string>; flash?: Flash; lang?: Lang };

export type ReportListRow = {
  id: number;
  report_date: string;
  title: string;
  status: string;
  state_name: string;
  state_name_en: string | null;
  township: string | null;
  author_id: number;
  region_id: number;
  author_name: string;
  attendance: number | null;
  new_contacts: number | null;
  follow_ups: number | null;
};

export type ReportFormValues = Record<string, string>;

export type ReportDetail = ReportListRow & {
  body: string;
  challenges: string | null;
  prayer_requests: string | null;
  next_steps: string | null;
  review_note: string | null;
  reviewer_name: string | null;
  created_at: number;
  updated_at: number;
  reviewed_at: number | null;
};

/** State label in the UI language (English falls back to the Myanmar name). */
function stateName(r: { state_name: string; state_name_en: string | null }, lang: Lang) {
  return lang !== "mm" && r.state_name_en ? r.state_name_en : r.state_name;
}

/** D1 stores unix seconds; show "YYYY-MM-DD HH:MM" like the member detail page. */
function stamp(unix: number | null | undefined) {
  if (!unix) return "";
  return new Date(unix * 1000).toISOString().slice(0, 16).replace("T", " ");
}

function statusLabel(t: (key: string) => string, status: string) {
  if (status === "reviewed") return t("rep.statusReviewed");
  if (status === "draft") return t("rep.statusDraft");
  return t("rep.statusSubmitted");
}

export function ReportsListPage(props: Common & {
  rows: ReportListRow[];
  total: number;
  range: { from: string; to: string };
  team: boolean;
  canCreate: boolean;
  canReview: boolean;
}) {
  const { user, perms, flash, lang, rows, total, range, team, canCreate, canReview } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const columns = 6 + (team ? 1 : 0);
  return (
    <Layout title={t("rep.title")} lang={lang} user={user} perms={perms} active="/reports" flash={flash ?? null}>
      <div class="page-head">
        <h1>
          {t("rep.title")}
          <span class="count-pill">{total} {t("rep.count")}</span>
        </h1>
        {canCreate && <a class="btn" href="/reports/new">{t("rep.new")}</a>}
      </div>

      {canReview && (
        <div class="page-toolbar">
          <div class="tabs">
            <a class={`btn sm ${team ? "secondary" : ""}`} href={`/reports${qs({ from: range.from, to: range.to })}`}>
              {t("rep.mine")}
            </a>
            <a class={`btn sm ${team ? "" : "secondary"}`} href={`/reports${qs({ from: range.from, to: range.to, scope: "team" })}`}>
              {t("rep.team")}
            </a>
          </div>
        </div>
      )}

      <form method="get" action="/reports" class="filters">
        {team && <input type="hidden" name="scope" value="team" />}
        <label class="field">
          <span class="lbl">{t("rep.from")}</span>
          <input type="date" name="from" value={range.from} />
        </label>
        <label class="field">
          <span class="lbl">{t("rep.to")}</span>
          <input type="date" name="to" value={range.to} />
        </label>
        <div class="actions">
          <button class="btn secondary" type="submit">{t("rep.filter")}</button>
        </div>
      </form>

      <p class="muted small">{t("rep.hint")}</p>

      <div class="tbl-wrap">
        <table class="list-tbl">
          <thead>
            <tr>
              <th>{t("rep.date")}</th>
              <th>{t("rep.titleField")}</th>
              <th>{t("rep.state")}</th>
              <th>{t("rep.township")}</th>
              {team && <th>{t("rep.author")}</th>}
              <th>{t("rep.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns} class="empty-state">
                  <strong>{t("rep.empty")}</strong>
                  {canCreate && <div class="small">{t("rep.emptyHint")}</div>}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr>
                  <td>{r.report_date}</td>
                  <td class="cell-wrap"><a href={`/reports/${r.id}`}>{r.title}</a></td>
                  <td>{stateName(r, L)}</td>
                  <td>{r.township ?? ""}</td>
                  {team && <td>{r.author_name}</td>}
                  <td>
                    <span class={`badge${r.status === "reviewed" ? " active" : ""}`}>{statusLabel(t, r.status)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

export function ReportFormPage(props: Common & {
  values: ReportFormValues;
  errors: string[];
  regions: { id: number; name: string }[];
  maxDate: string;
}) {
  const { user, perms, flash, lang, values: v, errors, regions, maxDate } = props;
  const t = getDict(lang ?? "en");
  const num = (key: string) => v[key] ?? "";
  return (
    <Layout title={t("rep.newTitle")} lang={lang} user={user} perms={perms} active="/reports" flash={flash ?? null}>
      <div class="page-head">
        <h1>{t("rep.newTitle")}</h1>
        <a class="btn secondary" href="/reports">{t("rep.backToList")}</a>
      </div>

      {errors.length > 0 && (
        <div class="flash err">
          <strong>{t("form.invalid")}</strong>
          <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul>
        </div>
      )}

      <form method="post" action="/reports">
        <div class="card">
          <h2>{t("rep.details")}</h2>
          <div class="form-grid">
            <label class="field">
              <span class="lbl">{t("rep.date")}</span>
              <input type="date" name="report_date" required max={maxDate} value={v.report_date ?? ""} />
            </label>
            <label class="field">
              <span class="lbl">{t("rep.state")}</span>
              <select name="region_id" required>
                <option value="">{t("form.choose")}</option>
                {regions.map((r) => (
                  <option value={String(r.id)} selected={v.region_id === String(r.id)}>{r.name}</option>
                ))}
              </select>
            </label>
            <label class="field">
              <span class="lbl">{t("rep.township")}</span>
              <input type="text" name="township" maxLength={80} value={v.township ?? ""} />
            </label>
            <label class="field span-2">
              <span class="lbl">{t("rep.titleField")}</span>
              <input type="text" name="title" required maxLength={120} value={v.title ?? ""} />
            </label>
          </div>
        </div>

        <div class="card">
          <h2>{t("rep.numbers")}</h2>
          <div class="form-grid">
            <label class="field">
              <span class="lbl">{t("rep.attendance")}</span>
              <input type="number" name="attendance" min="0" max="100000" step="1" value={num("attendance")} />
            </label>
            <label class="field">
              <span class="lbl">{t("rep.newContacts")}</span>
              <input type="number" name="new_contacts" min="0" max="100000" step="1" value={num("new_contacts")} />
            </label>
            <label class="field">
              <span class="lbl">{t("rep.followUps")}</span>
              <input type="number" name="follow_ups" min="0" max="100000" step="1" value={num("follow_ups")} />
            </label>
          </div>
        </div>

        <div class="card">
          <h2>{t("rep.notes")}</h2>
          <div class="form-grid">
            <label class="field span-2">
              <span class="lbl">{t("rep.body")}</span>
              <textarea name="body" required maxLength={3000} style="min-height:180px">{v.body ?? ""}</textarea>
            </label>
            <label class="field span-2">
              <span class="lbl">{t("rep.challenges")}</span>
              <textarea name="challenges" maxLength={1000}>{v.challenges ?? ""}</textarea>
            </label>
            <label class="field span-2">
              <span class="lbl">{t("rep.prayer")}</span>
              <textarea name="prayer_requests" maxLength={1000}>{v.prayer_requests ?? ""}</textarea>
            </label>
            <label class="field span-2">
              <span class="lbl">{t("rep.nextSteps")}</span>
              <textarea name="next_steps" maxLength={1000}>{v.next_steps ?? ""}</textarea>
            </label>
          </div>
        </div>

        <div class="actions">
          <button class="btn" type="submit">{t("rep.submit")}</button>
          <a class="btn secondary" href="/reports">{t("rep.cancel")}</a>
        </div>
      </form>
    </Layout>
  );
}

export function ReportDetailPage(props: Common & { report: ReportDetail; canCreate: boolean; canReview: boolean }) {
  const { user, perms, flash, lang, report: r, canCreate, canReview } = props;
  const L = lang ?? "en";
  const t = getDict(L);
  const facts: [string, string][] = [
    [t("rep.date"), r.report_date],
    [t("rep.state"), stateName(r, L)],
    [t("rep.township"), r.township ?? ""],
    [t("rep.author"), r.author_name],
    [t("rep.createdAt"), stamp(r.created_at)],
    [t("rep.status"), statusLabel(t, r.status)],
  ];
  if (r.reviewer_name) facts.push([t("rep.reviewer"), r.reviewer_name]);
  if (r.reviewed_at) facts.push([t("rep.reviewedAt"), stamp(r.reviewed_at)]);
  const counts: [string, string][] = [
    [t("rep.attendance"), r.attendance == null ? "" : String(r.attendance)],
    [t("rep.newContacts"), r.new_contacts == null ? "" : String(r.new_contacts)],
    [t("rep.followUps"), r.follow_ups == null ? "" : String(r.follow_ups)],
  ];
  const hasCounts = counts.some(([, value]) => value !== "");
  return (
    <Layout title={r.title} lang={lang} user={user} perms={perms} active="/reports" flash={flash ?? null}>
      <div class="page-head">
        <h1>
          {r.title}
          <span class="count-pill">{r.report_date}</span>
        </h1>
        <div class="actions" style="margin:0">
          <a class="btn secondary" href="/reports">{t("rep.backToList")}</a>
          {canCreate && <a class="btn" href="/reports/new">{t("rep.new")}</a>}
        </div>
      </div>

      <div class="card detail-card">
        <h2>{t("rep.details")}</h2>
        <div class="detail-grid">
          {facts.map(([label, value]) => (
            <div class="detail-item">
              <span class="k">{label}</span>
              <span class={`v${value ? "" : " empty"}`}>{value || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      <div class="card detail-card">
        <h2>{t("rep.body")}</h2>
        <div class="report-body">{r.body}</div>
      </div>

      {hasCounts && (
        <div class="card detail-card">
          <h2>{t("rep.numbers")}</h2>
          <div class="detail-grid">
            {counts.map(([label, value]) => (
              <div class="detail-item">
                <span class="k">{label}</span>
                <span class={`v${value ? "" : " empty"}`}>{value || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {r.challenges && (
        <div class="card detail-card">
          <h2>{t("rep.challenges")}</h2>
          <div class="report-body">{r.challenges}</div>
        </div>
      )}

      {r.prayer_requests && (
        <div class="card detail-card">
          <h2>{t("rep.prayer")}</h2>
          <div class="report-body">{r.prayer_requests}</div>
        </div>
      )}

      {r.next_steps && (
        <div class="card detail-card">
          <h2>{t("rep.nextSteps")}</h2>
          <div class="report-body">{r.next_steps}</div>
        </div>
      )}

      {canReview ? (
        <div class="card detail-card">
          <h2>{t("rep.review")}</h2>
          <p class="muted small">{t("rep.reviewHint")}</p>
          <form method="post" action={`/reports/${r.id}/review`}>
            <label class="field">
              <span class="lbl">{t("rep.reviewNote")}</span>
              <textarea name="review_note" maxLength={1000} style="min-height:100px">{r.review_note ?? ""}</textarea>
            </label>
            <div class="actions">
              <button class="btn" type="submit">
                {r.status === "reviewed" ? t("rep.reviewUpdate") : t("rep.reviewAction")}
              </button>
            </div>
          </form>
        </div>
      ) : r.review_note ? (
        <div class="card detail-card">
          <h2>{t("rep.reviewNote")}</h2>
          <div class="report-body">{r.review_note}</div>
        </div>
      ) : null}

      <p class="muted small">{t("rep.updatedAt")}: {stamp(r.updated_at)}</p>
    </Layout>
  );
}
