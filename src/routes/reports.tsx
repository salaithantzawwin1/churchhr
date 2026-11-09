import { Hono } from "hono";
import { and, eq, ne, sql } from "drizzle-orm";
import type { AppEnv } from "../env";
import { getDb, type DB } from "../db/client";
import { activityReports, regions } from "../db/schema";
import { requirePermission } from "../middleware";
import { flashFromQuery } from "../flash";
import { addDays, parseDateFlexible, s, todayInYangon } from "../util";
import { getDict, type Lang } from "../i18n";
import { ForbiddenPage } from "../views/errors";
import {
  ReportDetailPage, ReportFormPage, ReportsListPage,
  type ReportDetail, type ReportFormValues, type ReportListRow,
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

/** Validate the submitted report; values are kept exactly as typed for the
 * re-rendered form, data stays null when any field fails. */
function readForm(
  body: Record<string, unknown>,
  allowedRegions: { id: number; name: string }[],
  lang: Lang,
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

  const title = (values.title ?? "").trim();
  if (!title || title.length > MAX_TITLE) errors.push(t("rep.errTitle"));

  const text = (values.body ?? "").trim();
  if (!text || text.length > MAX_BODY) errors.push(t("rep.errBody"));

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
  const where = team ? scopeCond(scope) : sql`ar.author_id = ${user.id}`;

  const countRows = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n
    FROM activity_reports ar
    WHERE ar.report_date >= ${range.from} AND ar.report_date <= ${range.to}
      AND ${where}`);
  const total = countRows[0]?.n ?? 0;

  const rows = await db.all<ReportListRow>(sql`
    SELECT ar.id, ar.report_date, ar.title, ar.status, ar.township,
           ar.author_id, ar.region_id, ar.attendance, ar.new_contacts, ar.follow_ups,
           r.name AS state_name, r.name_en AS state_name_en,
           u.username AS author_name
    FROM activity_reports ar
    JOIN regions r ON r.id = ar.region_id
    JOIN users u ON u.id = ar.author_id
    WHERE ar.report_date >= ${range.from} AND ar.report_date <= ${range.to}
      AND ${where}
    ORDER BY ar.report_date DESC, ar.id DESC
    LIMIT ${LIST_LIMIT}`);

  return c.html(
    <ReportsListPage
      user={user} perms={perms} flash={flashFromQuery(c.req.query(), lang)} lang={lang}
      rows={rows} total={total} range={range} team={team}
      canCreate={perms.has("reports.create")} canReview={canReview}
    />,
  );
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
  const regionList = await scopedRegions(db, scope, lang);
  const { values, errors, data } = readForm(body as Record<string, unknown>, regionList, lang);

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
        status: "submitted",
      })
      .returning({ id: activityReports.id });
    return c.redirect(`/reports/${inserted[0]!.id}?ok=report-created`, 302);
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

reportsRoutes.get("/:id/edit", requirePermission("reports.create"), async (c) => {
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

reportsRoutes.post("/:id/edit", requirePermission("reports.create"), async (c) => {
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
  const regionList = await scopedRegions(db, scope, lang);
  const { values, errors, data } = readForm(body as Record<string, unknown>, regionList, lang);
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
        status: "submitted",
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
    return c.redirect(`/reports/${id}?ok=report-updated`, 302);
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

  const report = await loadReport(db, id);
  if (!report) return c.redirect(back, 302);

  const own = report.author_id === user.id;
  const inScope = scope.scopeAll || scope.stateIds.includes(report.region_id);
  if (!own && !(perms.has("reports.review") && inScope)) {
    return c.html(<ForbiddenPage path={new URL(c.req.url).pathname} lang={lang} />, 403);
  }

  return c.html(
    <ReportDetailPage
      user={user} perms={perms} flash={flashFromQuery(c.req.query(), lang)} lang={lang}
      report={report} canCreate={perms.has("reports.create")}
      canEdit={own && perms.has("reports.create") && report.status !== "reviewed"}
      canReview={perms.has("reports.review") && inScope}
    />,
  );
});
