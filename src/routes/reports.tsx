import { Hono } from "hono";
import { and, eq, ne, sql } from "drizzle-orm";
import type { AppEnv } from "../env";
import { getDb, type DB } from "../db/client";
import { activityReports, regions, reportEdits } from "../db/schema";
import { requireAnyPermission, requirePermission } from "../middleware";
import { flashFromQuery } from "../flash";
import { buildCsv } from "../csv";
import { addDays, intParam, parseDateFlexible, s, todayInYangon } from "../util";
import { getDict, type Lang } from "../i18n";
import { ForbiddenPage } from "../views/errors";
import {
  ReportDetailPage, ReportFormPage, ReportsListPage,
  type ReportDetail, type ReportEdit, type ReportFormValues, type ReportListRow,
} from "../views/reports";

export const reportsRoutes = new Hono<AppEnv>();

const MAX_TITLE = 120;
const MAX_BODY = 3000;
const MAX_TEXT = 1000;
const MAX_TOWNSHIP = 80;
const MAX_COUNT = 100000;
const EARLIEST = "2000-01-01";
const LIST_LIMIT = 200;

type Scope = { scopeAll: boolean; stateIds: number[] };

function scopeOf(c: { get: (k: "scopeAll" | "stateIds") => any }): Scope {
  return { scopeAll: c.get("scopeAll"), stateIds: c.get("stateIds") };
}

/** Region rows for the report form, limited to the user's assigned states. */
async function scopedRegions(db: DB, scope: Scope, lang: Lang): Promise<{ id: number; name: string }[]> {
  const rows = await db
    .select({ id: regions.id, name: regions.name, nameEn: regions.nameEn })
    .from(regions)
    .orderBy(regions.id);
  return rows
    .filter((r) => scope.scopeAll || scope.stateIds.includes(r.id))
    .map((r) => ({ id: r.id, name: lang !== "mm" && r.nameEn ? r.nameEn : r.name }));
}

function rangeFromQuery(q: Record<string, string | undefined>): { from: string; to: string } {
  const today = todayInYangon();
  const from = parseDateFlexible(q.from ?? "") ?? addDays(today, -6);
  const to = parseDateFlexible(q.to ?? "") ?? today;
  return from <= to ? { from, to } : { from: to, to: from };
}

const REPORT_STATUSES = ["submitted", "reviewed", "draft"] as const;

function statusFromQuery(q: Record<string, string | undefined>): string {
  return (REPORT_STATUSES as readonly string[]).includes(q.status ?? "") ? q.status! : "";
}

/** Quick date ranges shown above the report list. Keeping them server-rendered
 * means the current status filter and team/my scope survive a single tap. */
function quickRanges(today: string, t: (key: string) => string) {
  return [
    { key: "7d", label: t("rep.last7"), from: addDays(today, -6), to: today },
    { key: "30d", label: t("rep.last30"), from: addDays(today, -29), to: today },
    { key: "month", label: t("rep.thisMonth"), from: `${today.slice(0, 8)}01`, to: today },
    { key: "all", label: t("rep.allTime"), from: EARLIEST, to: today },
  ];
}

/** SQL fragment: restrict rows to the assigned states (all-state users see all). */
function scopeCond(scope: Scope) {
  if (scope.scopeAll) return sql`1=1`;
  if (scope.stateIds.length === 0) return sql`1=0`;
  return sql`ar.region_id IN (${sql.join(scope.stateIds.map((id) => sql`${id}`), sql`, `)})`;
}

/** Detail row shared by the detail page, the review page and the edit form. */
async function loadReport(db: DB, id: number): Promise<ReportDetail | undefined> {
  const rows = await db.all<ReportDetail>(sql`
    SELECT ar.id, ar.report_date, ar.title, ar.body, ar.status, ar.township,
           ar.author_id, ar.region_id, ar.attendance, ar.new_contacts, ar.follow_ups,
           ar.challenges, ar.prayer_requests, ar.next_steps, ar.review_note,
           ar.created_at, ar.updated_at, ar.reviewed_at,
           r.name AS state_name, r.name_en AS state_name_en,
           u.username AS author_name, rv.username AS reviewer_name
    FROM activity_reports ar
    JOIN regions r ON r.id = ar.region_id
    JOIN users u ON u.id = ar.author_id
    LEFT JOIN users rv ON rv.id = ar.reviewer_id
    WHERE ar.id = ${id}`);
  return rows[0];
}

function parseCount(raw: string): { ok: boolean; value: number | null } {
  const value = raw.trim();
  if (!value) return { ok: true, value: null };
  if (!/^\d{1,6}$/.test(value)) return { ok: false, value: null };
  const n = Number(value);
  return n >= 0 && n <= MAX_COUNT ? { ok: true, value: n } : { ok: false, value: null };
}

type ReportData = {
  report_date: string;
  region_id: number;
  township: string | null;
  title: string;
  body: string;
  attendance: number | null;
  new_contacts: number | null;
  follow_ups: number | null;
  challenges: string | null;
  prayer_requests: string | null;
  next_steps: string | null;
};

type ReportEditChange = { field: string; from: string | null; to: string | null };

/** Changed fields between the stored report and the submitted form values. */
function diffReport(before: ReportDetail, after: ReportData): ReportEditChange[] {
  const asText = (value: number | null) => (value == null ? null : String(value));
  const pairs: [string, string | null, string | null][] = [
    ["report_date", before.report_date, after.report_date],
    ["region_id", String(before.region_id), String(after.region_id)],
    ["township", before.township, after.township],
    ["title", before.title, after.title],
    ["body", before.body, after.body],
    ["attendance", asText(before.attendance), asText(after.attendance)],
    ["new_contacts", asText(before.new_contacts), asText(after.new_contacts)],
    ["follow_ups", asText(before.follow_ups), asText(after.follow_ups)],
    ["challenges", before.challenges, after.challenges],
    ["prayer_requests", before.prayer_requests, after.prayer_requests],
    ["next_steps", before.next_steps, after.next_steps],
  ];
  return pairs
    .filter(([, from, to]) => from !== to)
    .map(([field, from, to]) => ({ field, from, to }));
}

/** Validate the submitted report; values are kept exactly as typed for the
 * re-rendered form, data stays null when any field fails. */
function readForm(
  body: Record<string, unknown>,
  allowedRegions: { id: number; name: string }[],
  lang: Lang,
  opts: { draft?: boolean } = {},
): { values: ReportFormValues; errors: string[]; data: ReportData | null } {
  const values: ReportFormValues = {
    report_date: s(body.report_date),
    region_id: s(body.region_id),
    township: s(body.township),
    title: s(body.title),
    body: s(body.body),
    attendance: s(body.attendance),
    new_contacts: s(body.new_contacts),
    follow_ups: s(body.follow_ups),
    challenges: s(body.challenges),
    prayer_requests: s(body.prayer_requests),
    next_steps: s(body.next_steps),
  };
  const t = getDict(lang);
  const errors: string[] = [];
  const today = todayInYangon();

  const date = parseDateFlexible(values.report_date ?? "");
  if (!date || date < EARLIEST) errors.push(t("rep.errDate"));
  else if (date > today) errors.push(t("rep.errFuture"));

  const regionId = Number(values.region_id);
  if (!Number.isInteger(regionId) || !allowedRegions.some((r) => r.id === regionId)) {
    errors.push(t("rep.errState"));
  }

  // A draft only needs the date and the state: the narrative can be written
  // across several sessions on a phone, then submitted when it is complete.
  const title = (values.title ?? "").trim();
  if ((!title && !opts.draft) || title.length > MAX_TITLE) errors.push(t("rep.errTitle"));

  const text = (values.body ?? "").trim();
  if ((!text && !opts.draft) || text.length > MAX_BODY) errors.push(t("rep.errBody"));

  if ((values.township ?? "").trim().length > MAX_TOWNSHIP) errors.push(t("rep.errTownship"));

  const attendance = parseCount(values.attendance ?? "");
  const newContacts = parseCount(values.new_contacts ?? "");
  const followUps = parseCount(values.follow_ups ?? "");
  if (!attendance.ok || !newContacts.ok || !followUps.ok) errors.push(t("rep.errNumbers"));

  const optional = [values.challenges, values.prayer_requests, values.next_steps].map((v) => (v ?? "").trim());
  if (optional.some((v) => v.length > MAX_TEXT)) errors.push(t("rep.errText"));

  if (errors.length > 0) return { values, errors, data: null };
  return {
    values,
    errors,
    data: {
      report_date: date!,
      region_id: regionId,
      township: (values.township ?? "").trim() || null,
      title,
      body: text,
      attendance: attendance.value,
      new_contacts: newContacts.value,
      follow_ups: followUps.value,
      challenges: optional[0] || null,
      prayer_requests: optional[1] || null,
      next_steps: optional[2] || null,
    },
  };
}

// ---------- GET /reports (my reports, or the state-scoped team view) ----------

reportsRoutes.get("/", requirePermission("reports.view"), async (c) => {
  const db = getDb(c.env);
  const user = c.get("user");
  const perms = c.get("perms");
  const scope = scopeOf(c);
  const lang = c.get("lang");
  const q = c.req.query();
  const range = rangeFromQuery(q);
  const canReview = perms.has("reports.review");
  const team = canReview && q.scope === "team";
  const status = statusFromQuery(q);
  const where = team ? scopeCond(scope) : sql`ar.author_id = ${user.id}`;
  const statusCond = status ? sql`ar.status = ${status}` : sql`1=1`;
  // Reviewers can narrow the team view to one author.
  const authorId = team ? intParam(q.author) : null;
  const authorCond = authorId ? sql`ar.author_id = ${authorId}` : sql`1=1`;
  const cond = sql`ar.report_date >= ${range.from} AND ar.report_date <= ${range.to}
      AND ${where} AND ${statusCond} AND ${authorCond}`;


  const rowsP = db.all<ReportListRow>(sql`
    SELECT ar.id, ar.report_date, ar.title, ar.status, ar.township,
           ar.author_id, ar.region_id, ar.attendance, ar.new_contacts, ar.follow_ups,
           r.name AS state_name, r.name_en AS state_name_en,
           u.username AS author_name
    FROM activity_reports ar
    JOIN regions r ON r.id = ar.region_id
    JOIN users u ON u.id = ar.author_id
    WHERE ${cond}
    ORDER BY ar.report_date DESC, ar.id DESC
    LIMIT ${LIST_LIMIT}`);

  // The pile a leader actually acts on: submitted reports nobody has reviewed
  // yet, regardless of the status filter currently applied.
  const awaitingRowsP = canReview
    ? db.all<{ n: number }>(sql`
        SELECT COUNT(*) AS n FROM activity_reports ar
        WHERE ar.report_date >= ${range.from} AND ar.report_date <= ${range.to}
          AND ${where} AND ${authorCond} AND ar.status = 'submitted'`)
    : [];
  const authorRowsP = team
    ? db.all<{ id: number; username: string }>(sql`
        SELECT DISTINCT u.id, u.username
        FROM activity_reports ar JOIN users u ON u.id = ar.author_id
        WHERE ${scopeCond(scope)}
        ORDER BY u.username`)
    : [];

  // Count, page rows, the review backlog and the author filter are independent:
  // one wait instead of four round-trips.
  const [countRows, rows, awaitingRows, authorRows] = await Promise.all([
    db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM activity_reports ar WHERE ${cond}`),
    rowsP,
    awaitingRowsP,
    authorRowsP,
  ]);
  const total = countRows[0]?.n ?? 0;
  const awaiting = awaitingRows[0]?.n ?? 0;

  return c.html(
    <ReportsListPage
      user={user} perms={perms} flash={flashFromQuery(c.req.query(), lang)} lang={lang}
      rows={rows} total={total} range={range} team={team} status={status}
      quickRanges={quickRanges(todayInYangon(), getDict(lang))}
      canCreate={perms.has("reports.create")} canReview={canReview}
      awaiting={awaiting} authors={authorRows} authorId={authorId}
    />,
  );
});

// ---------- GET /reports/export: the same list as CSV ----------
// Registered before "/:id" so "export" is not read as a report id.

reportsRoutes.get("/export", requirePermission("reports.view"), async (c) => {
  const db = getDb(c.env);
  const user = c.get("user");
  const perms = c.get("perms");
  const scope = scopeOf(c);
  const lang = c.get("lang");
  const q = c.req.query();
  const range = rangeFromQuery(q);
  const team = perms.has("reports.review") && q.scope === "team";
  const status = statusFromQuery(q);
  const authorId = team ? intParam(q.author) : null;
  const where = team ? scopeCond(scope) : sql`ar.author_id = ${user.id}`;
  const statusCond = status ? sql`ar.status = ${status}` : sql`1=1`;
  const authorCond = authorId ? sql`ar.author_id = ${authorId}` : sql`1=1`;

  const rows = await db.all<ReportListRow>(sql`
    SELECT ar.id, ar.report_date, ar.title, ar.status, ar.township,
           ar.author_id, ar.region_id, ar.attendance, ar.new_contacts, ar.follow_ups,
           r.name AS state_name, r.name_en AS state_name_en,
           u.username AS author_name
    FROM activity_reports ar
    JOIN regions r ON r.id = ar.region_id
    JOIN users u ON u.id = ar.author_id
    WHERE ar.report_date >= ${range.from} AND ar.report_date <= ${range.to}
      AND ${where} AND ${statusCond} AND ${authorCond}
    ORDER BY ar.report_date DESC, ar.id DESC
    LIMIT 5000`);

  const t = getDict(lang);
  const label = (value: string) => {
    if (value === "reviewed") return t("rep.statusReviewed");
    if (value === "draft") return t("rep.statusDraft");
    return t("rep.statusSubmitted");
  };
  const csv = "\uFEFF" + buildCsv([
    ["Date", "Title", "State", "Township", "Author", "Status", "Attendance", "New contacts", "Follow-ups"],
    ...rows.map((r) => [
      r.report_date,
      r.title,
      lang !== "mm" && r.state_name_en ? r.state_name_en : r.state_name,
      r.township ?? "",
      r.author_name,
      label(r.status),
      r.attendance,
      r.new_contacts,
      r.follow_ups,
    ]),
  ]);
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="reports-${range.from}_${range.to}.csv"`,
    "Cache-Control": "no-store",
  });
});

// ---------- POST /reports/:id/submit: send a draft for review ----------

reportsRoutes.post("/:id/submit", requirePermission("reports.create"), async (c) => {
  const db = getDb(c.env);
  const user = c.get("user");
  const lang = c.get("lang");
  const t = getDict(lang);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) {
    return c.redirect(`/reports?err=${encodeURIComponent(t("rep.errNotFound"))}`, 302);
  }
  const report = await loadReport(db, id);
  if (!report) return c.redirect(`/reports?err=${encodeURIComponent(t("rep.errNotFound"))}`, 302);
  if (report.author_id !== user.id) {
    return c.html(<ForbiddenPage path={new URL(c.req.url).pathname} lang={lang} />, 403);
  }
  if (report.status === "reviewed") {
    return c.redirect(`/reports/${id}?err=${encodeURIComponent(t("rep.errEditReviewed"))}`, 302);
  }
  if (!report.title.trim() || !report.body.trim()) {
    return c.redirect(`/reports/${id}/edit?err=${encodeURIComponent(t("rep.errBody"))}`, 302);
  }
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(activityReports)
    .set({ status: "submitted", reviewerId: null, reviewNote: null, reviewedAt: null, updatedAt: now })
    .where(and(eq(activityReports.id, id), eq(activityReports.authorId, user.id)));
  return c.redirect(`/reports/${id}?ok=report-submitted`, 302);
});

// ---------- GET /reports/new ----------

reportsRoutes.get("/new", requirePermission("reports.create"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const lang = c.get("lang");
  const regionList = await scopedRegions(db, scope, lang);
  const today = todayInYangon();
  const values: ReportFormValues = {
    report_date: today,
    // A single assigned state can be prefilled; multi-state users choose.
    region_id: regionList.length === 1 ? String(regionList[0]!.id) : "",
  };
  return c.html(
    <ReportFormPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), lang)} lang={lang}
      values={values} errors={regionList.length === 0 ? [getDict(lang)("rep.noStates")] : []}
      regions={regionList} maxDate={today}
    />,
  );
});

// ---------- POST /reports ----------

reportsRoutes.post("/", requirePermission("reports.create"), async (c) => {
  const db = getDb(c.env);
  const user = c.get("user");
  const scope = scopeOf(c);
  const lang = c.get("lang");
  const t = getDict(lang);
  const body = await c.req.parseBody();
  const draft = s(body.intent) === "draft";
  const regionList = await scopedRegions(db, scope, lang);
  const { values, errors, data } = readForm(body as Record<string, unknown>, regionList, lang, { draft });

  const rerender = (list: string[]) =>
    c.html(
      <ReportFormPage
        user={user} perms={c.get("perms")} flash={null} lang={lang}
        values={values} errors={list} regions={regionList} maxDate={todayInYangon()}
      />,
      400,
    );

  if (!data) return rerender(errors.length ? errors : [t("rep.noStates")]);

  const existing = await db
    .select({ id: activityReports.id })
    .from(activityReports)
    .where(and(eq(activityReports.authorId, user.id), eq(activityReports.reportDate, data.report_date)))
    .limit(1);
  if (existing[0]) {
    return c.redirect(`/reports/${existing[0].id}?err=${encodeURIComponent(t("rep.dup"))}`, 302);
  }

  try {
    const inserted = await db
      .insert(activityReports)
      .values({
        reportDate: data.report_date,
        authorId: user.id,
        regionId: data.region_id,
        township: data.township,
        title: data.title,
        body: data.body,
        attendance: data.attendance,
        newContacts: data.new_contacts,
        followUps: data.follow_ups,
        challenges: data.challenges,
        prayerRequests: data.prayer_requests,
        nextSteps: data.next_steps,
        status: draft ? "draft" : "submitted",
      })
      .returning({ id: activityReports.id });
    return c.redirect(`/reports/${inserted[0]!.id}?ok=${draft ? "report-draft" : "report-created"}`, 302);
  } catch (err) {
    // The unique (author, date) index catches a double submit racing the check above.
    const again = await db
      .select({ id: activityReports.id })
      .from(activityReports)
      .where(and(eq(activityReports.authorId, user.id), eq(activityReports.reportDate, data.report_date)))
      .limit(1);
    if (again[0]) return c.redirect(`/reports/${again[0].id}?err=${encodeURIComponent(t("rep.dup"))}`, 302);
    throw err;
  }
});

// ---------- POST /reports/:id/review ----------

reportsRoutes.post("/:id/review", requirePermission("reports.review"), async (c) => {
  const db = getDb(c.env);
  const user = c.get("user");
  const scope = scopeOf(c);
  const lang = c.get("lang");
  const t = getDict(lang);
  const id = Number(c.req.param("id"));
  const listBack = `/reports?err=${encodeURIComponent(t("rep.errNotFound"))}`;
  if (!Number.isInteger(id) || id < 1) return c.redirect(listBack, 302);

  const rows = await db
    .select({ regionId: activityReports.regionId })
    .from(activityReports)
    .where(eq(activityReports.id, id))
    .limit(1);
  const current = rows[0];
  if (!current) return c.redirect(listBack, 302);
  // Reviewers can only act on reports in their own state scope.
  if (!(scope.scopeAll || scope.stateIds.includes(current.regionId))) {
    return c.html(<ForbiddenPage path={new URL(c.req.url).pathname} lang={lang} />, 403);
  }

  const body = await c.req.parseBody();
  const note = s(body.review_note);
  if (note.length > MAX_TEXT) {
    return c.redirect(`/reports/${id}?err=${encodeURIComponent(t("rep.errNote"))}`, 302);
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .update(activityReports)
    .set({
      status: "reviewed",
      reviewerId: user.id,
      reviewNote: note || null,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(activityReports.id, id));
  return c.redirect(`/reports/${id}?ok=report-reviewed`, 302);
});

// ---------- GET /reports/:id/edit ----------

reportsRoutes.get("/:id/edit", requireAnyPermission("reports.update", "reports.create"), async (c) => {
  const db = getDb(c.env);
  const user = c.get("user");
  const scope = scopeOf(c);
  const lang = c.get("lang");
  const t = getDict(lang);
  const id = Number(c.req.param("id"));
  const back = `/reports?err=${encodeURIComponent(t("rep.errNotFound"))}`;
  if (!Number.isInteger(id) || id < 1) return c.redirect(back, 302);

  const report = await loadReport(db, id);
  if (!report) return c.redirect(back, 302);
  if (report.author_id !== user.id) {
    return c.html(<ForbiddenPage path={new URL(c.req.url).pathname} lang={lang} />, 403);
  }
  if (report.status === "reviewed") {
    return c.redirect(`/reports/${id}?err=${encodeURIComponent(t("rep.errEditReviewed"))}`, 302);
  }

  const regionList = await scopedRegions(db, scope, lang);
  const values: ReportFormValues = {
    report_date: report.report_date,
    region_id: String(report.region_id),
    township: report.township ?? "",
    title: report.title,
    body: report.body,
    attendance: report.attendance == null ? "" : String(report.attendance),
    new_contacts: report.new_contacts == null ? "" : String(report.new_contacts),
    follow_ups: report.follow_ups == null ? "" : String(report.follow_ups),
    challenges: report.challenges ?? "",
    prayer_requests: report.prayer_requests ?? "",
    next_steps: report.next_steps ?? "",
  };
  return c.html(
    <ReportFormPage
      user={user} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), lang)} lang={lang}
      values={values} errors={regionList.length === 0 ? [t("rep.noStates")] : []}
      regions={regionList} maxDate={todayInYangon()} mode="edit" reportId={id}
    />,
  );
});

// ---------- POST /reports/:id/edit ----------

reportsRoutes.post("/:id/edit", requireAnyPermission("reports.update", "reports.create"), async (c) => {
  const db = getDb(c.env);
  const user = c.get("user");
  const scope = scopeOf(c);
  const lang = c.get("lang");
  const t = getDict(lang);
  const id = Number(c.req.param("id"));
  const back = `/reports?err=${encodeURIComponent(t("rep.errNotFound"))}`;
  if (!Number.isInteger(id) || id < 1) return c.redirect(back, 302);

  const report = await loadReport(db, id);
  if (!report) return c.redirect(back, 302);
  if (report.author_id !== user.id) {
    return c.html(<ForbiddenPage path={new URL(c.req.url).pathname} lang={lang} />, 403);
  }
  if (report.status === "reviewed") {
    return c.redirect(`/reports/${id}?err=${encodeURIComponent(t("rep.errEditReviewed"))}`, 302);
  }

  const body = await c.req.parseBody();
  const draft = s(body.intent) === "draft";
  const regionList = await scopedRegions(db, scope, lang);
  const { values, errors, data } = readForm(body as Record<string, unknown>, regionList, lang, { draft });
  const rerender = (list: string[]) =>
    c.html(
      <ReportFormPage
        user={user} perms={c.get("perms")} flash={null} lang={lang}
        values={values} errors={list} regions={regionList} maxDate={todayInYangon()}
        mode="edit" reportId={id}
      />,
      400,
    );

  if (!data) return rerender(errors.length ? errors : [t("rep.noStates")]);

  const existing = await db
    .select({ id: activityReports.id })
    .from(activityReports)
    .where(and(
      eq(activityReports.authorId, user.id),
      eq(activityReports.reportDate, data.report_date),
      ne(activityReports.id, id),
    ))
    .limit(1);
  if (existing[0]) return rerender([t("rep.dup")]);

  const changes = diffReport(report, data);
  if (changes.length === 0) {
    return c.redirect(`/reports/${id}?ok=report-unchanged`, 302);
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const updated = await db
      .update(activityReports)
      .set({
        reportDate: data.report_date,
        regionId: data.region_id,
        township: data.township,
        title: data.title,
        body: data.body,
        attendance: data.attendance,
        newContacts: data.new_contacts,
        followUps: data.follow_ups,
        challenges: data.challenges,
        prayerRequests: data.prayer_requests,
        nextSteps: data.next_steps,
        status: draft ? "draft" : "submitted",
        updatedAt: now,
      })
      .where(and(
        eq(activityReports.id, id),
        eq(activityReports.authorId, user.id),
        ne(activityReports.status, "reviewed"),
      ))
      .returning({ id: activityReports.id });
    if (!updated[0]) {
      return c.redirect(`/reports/${id}?err=${encodeURIComponent(t("rep.errEditReviewed"))}`, 302);
    }
    await db.insert(reportEdits).values({
      reportId: id,
      editorId: user.id,
      editedAt: now,
      changes: JSON.stringify(changes),
    });
    return c.redirect(`/reports/${id}?ok=${draft ? "report-draft" : "report-updated"}`, 302);
  } catch (err) {
    // The unique (author, date) index catches a date change racing the check above.
    const again = await db
      .select({ id: activityReports.id })
      .from(activityReports)
      .where(and(
        eq(activityReports.authorId, user.id),
        eq(activityReports.reportDate, data.report_date),
        ne(activityReports.id, id),
      ))
      .limit(1);
    if (again[0]) return rerender([t("rep.dup")]);
    throw err;
  }
});

// ---------- POST /reports/:id/delete: remove a report ----------
// An author may remove their own report while it is still editable; a holder of
// reports.delete may remove any report inside their state scope.

reportsRoutes.post("/:id/delete", requireAnyPermission("reports.delete", "reports.create", "reports.update"), async (c) => {
  const db = getDb(c.env);
  const user = c.get("user");
  const scope = scopeOf(c);
  const lang = c.get("lang");
  const t = getDict(lang);
  const id = Number(c.req.param("id"));
  const back = `/reports?err=${encodeURIComponent(t("rep.errNotFound"))}`;
  if (!Number.isInteger(id) || id < 1) return c.redirect(back, 302);
  const report = await loadReport(db, id);
  if (!report) return c.redirect(back, 302);
  const perms = c.get("perms");
  const own = report.author_id === user.id;
  const inScope = scope.scopeAll || scope.stateIds.includes(report.region_id);
  // Two separate rights, deliberately:
  //  • author cleanup — you may delete a report you wrote while it is still
  //    yours to edit (reports.create or reports.update, and not yet reviewed,
  //    exactly like the edit screen);
  //  • manager delete — reports.delete removes any report inside the states
  //    you manage, reviewed or not.
  const authorMayDelete =
    own && report.status !== "reviewed" && (perms.has("reports.create") || perms.has("reports.update"));
  const managerMayDelete = perms.has("reports.delete") && inScope;
  if (!authorMayDelete && !managerMayDelete) {
    return c.html(<ForbiddenPage path={new URL(c.req.url).pathname} lang={lang} />, 403);
  }
  // report_edits has no cascade, so the history goes first.
  await db.delete(reportEdits).where(eq(reportEdits.reportId, id));
  await db.delete(activityReports).where(eq(activityReports.id, id));
  return c.redirect("/reports?ok=report-deleted", 302);
});

// ---------- GET /reports/:id ----------

reportsRoutes.get("/:id", requirePermission("reports.view"), async (c) => {
  const db = getDb(c.env);
  const user = c.get("user");
  const perms = c.get("perms");
  const scope = scopeOf(c);
  const lang = c.get("lang");
  const t = getDict(lang);
  const id = Number(c.req.param("id"));
  const back = `/reports?err=${encodeURIComponent(t("rep.errNotFound"))}`;
  if (!Number.isInteger(id) || id < 1) return c.redirect(back, 302);

  // The report, its edit trail and the region labels are independent reads:
  // one query window instead of three.
  const [report, editRows, regionRows] = await Promise.all([
    loadReport(db, id),
    db.all<ReportEdit>(sql`
      SELECT e.id, e.edited_at, e.changes, u.username AS editor_name
      FROM report_edits e JOIN users u ON u.id = e.editor_id
      WHERE e.report_id = ${id}
      ORDER BY e.edited_at DESC, e.id DESC
      LIMIT 100`),
    db.select({ id: regions.id, name: regions.name, nameEn: regions.nameEn }).from(regions),
  ]);
  if (!report) return c.redirect(back, 302);

  const own = report.author_id === user.id;
  const inScope = scope.scopeAll || scope.stateIds.includes(report.region_id);
  if (!own && !(perms.has("reports.review") && inScope)) {
    return c.html(<ForbiddenPage path={new URL(c.req.url).pathname} lang={lang} />, 403);
  }
  const regionNames: Record<number, string> = {};
  for (const row of regionRows) {
    regionNames[row.id] = lang !== "mm" && row.nameEn ? row.nameEn : row.name;
  }

  return c.html(
    <ReportDetailPage
      user={user} perms={perms} flash={flashFromQuery(c.req.query(), lang)} lang={lang}
      report={report} canCreate={perms.has("reports.create")}
      canEdit={own && (perms.has("reports.update") || perms.has("reports.create")) && report.status !== "reviewed"}
      // Mirror of the delete route: author while editable, or a scoped manager.
      canDelete={
        (own && report.status !== "reviewed" && (perms.has("reports.create") || perms.has("reports.update"))) ||
        (perms.has("reports.delete") && inScope)
      }
      canReview={perms.has("reports.review") && inScope}
      edits={editRows} regionNames={regionNames}
    />,
  );
});
