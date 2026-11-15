import { sql } from "drizzle-orm";
import type { DB } from "./db/client";
import { isFutureDate, parseDateFlexible, todayInYangon } from "./util";

/** One child of a pastor. Age is derived from dateOfBirth, never stored, so it
 *  cannot go stale; grade + academicYear are the yearly-adjustable education
 *  snapshot (e.g. "G5" · "2026-2027"). */
export type PastorChildRow = {
  id: number;
  pastorId: number;
  name: string;
  nameEn: string | null;
  gender: string;
  dateOfBirth: string | null;
  grade: string | null;
  academicYear: string | null;
  atHopeSchool: number;
  school: string | null;
  notes: string | null;
  active: number;
  /** Set when the child is also a member; the report then counts them once. */
  memberId: number | null;
};

export type PastorChildValues = {
  name: string;
  nameEn: string;
  gender: string;
  dateOfBirth: string;
  grade: string;
  academicYear: string;
  atHopeSchool: boolean;
  school: string;
  notes: string;
  active: boolean;
  memberId: string;
};

/** The school year a new record starts in: Sep–Aug, written 2026-2027. */
export function currentAcademicYear(today = todayInYangon()): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const start = month >= 9 ? year : year - 1;
  return `${start}-${start + 1}`;
}

export function childValues(row?: PastorChildRow): PastorChildValues {
  return {
    name: row?.name ?? "",
    nameEn: row?.nameEn ?? "",
    gender: row?.gender ?? "",
    dateOfBirth: row?.dateOfBirth ?? "",
    grade: row?.grade ?? "",
    academicYear: row?.academicYear ?? (row ? "" : currentAcademicYear()),
    atHopeSchool: row ? row.atHopeSchool === 1 : false,
    school: row?.school ?? "",
    notes: row?.notes ?? "",
    active: row ? row.active === 1 : true,
    memberId: row?.memberId != null ? String(row.memberId) : "",
  };
}

const SELECT_CHILD = sql`
  SELECT c.id, c.pastor_id AS pastorId, c.name, c.name_en AS nameEn, c.gender,
         c.date_of_birth AS dateOfBirth, c.grade, c.academic_year AS academicYear,
         c.at_hope_school AS atHopeSchool, c.school, c.notes, c.active,
         c.member_id AS memberId
  FROM pastor_children c`;

/** Newest school year first, then youngest child first. */
export async function loadPastorChildren(db: DB, pastorId: number): Promise<PastorChildRow[]> {
  const rows = await db.all<PastorChildRow>(sql`
    ${SELECT_CHILD}
    WHERE c.pastor_id = ${pastorId}
    ORDER BY c.active DESC, COALESCE(c.academic_year, '') DESC, c.date_of_birth DESC, c.id`);
  return rows;
}

export async function loadPastorChild(
  db: DB,
  pastorId: number,
  id: number,
): Promise<PastorChildRow | null> {
  const rows = await db.all<PastorChildRow>(sql`
    ${SELECT_CHILD}
    WHERE c.pastor_id = ${pastorId} AND c.id = ${id}`);
  return rows[0] ?? null;
}

export type PastorChildCount = { pastorId: number; children: number; hopeSchool: number };

/** Children per pastor for the directory cards and the summary stats, limited
 *  to the pastor rows the signed-in account may see. */
export async function loadPastorChildCounts(
  db: DB,
  scope: { scopeAll: boolean; stateIds: number[] },
): Promise<PastorChildCount[]> {
  const conditions = [sql`c.active = 1`];
  if (!scope.scopeAll) {
    if (scope.stateIds.length === 0) return [];
    conditions.push(sql`p.region_id IN (${sql.join(scope.stateIds.map((id) => sql`${id}`), sql`, `)})`);
  }
  return db.all<PastorChildCount>(sql`
    SELECT c.pastor_id AS pastorId,
           COUNT(*) AS children,
           SUM(CASE WHEN c.at_hope_school = 1 THEN 1 ELSE 0 END) AS hopeSchool
    FROM pastor_children c
    JOIN pastors p ON p.id = c.pastor_id
    WHERE ${sql.join(conditions, sql` AND `)}
    GROUP BY c.pastor_id`);
}

/** One line of the Hope School report: the child plus the parent details the
 *  page and the CSV both print, so no second query is needed per row. */
export type ChildReportRow = PastorChildRow & {
  pastorName: string;
  pastorNameEn: string | null;
  pastorTitle: string | null;
  spouseName: string | null;
  spouseNameEn: string | null;
  stateName: string;
  stateNameEn: string | null;
};

/** Every active child of the active pastors inside the user's states. The report
 *  is small enough to filter and group in memory, so the page and the CSV share
 *  this one query. */
export async function loadChildReport(
  db: DB,
  scope: { scopeAll: boolean; stateIds: number[] },
): Promise<ChildReportRow[]> {
  const conditions = [sql`c.active = 1`, sql`p.active = 1`];
  if (!scope.scopeAll) {
    if (scope.stateIds.length === 0) return [];
    conditions.push(sql`p.region_id IN (${sql.join(scope.stateIds.map((id) => sql`${id}`), sql`, `)})`);
  }
  return db.all<ChildReportRow>(sql`
    SELECT c.id, c.pastor_id AS pastorId, c.name, c.name_en AS nameEn, c.gender,
           c.date_of_birth AS dateOfBirth, c.grade, c.academic_year AS academicYear,
           c.at_hope_school AS atHopeSchool, c.school, c.notes, c.active,
           c.member_id AS memberId,
           p.name AS pastorName, p.name_en AS pastorNameEn, p.title AS pastorTitle,
           sp.name AS spouseName, sp.name_en AS spouseNameEn,
           r.name AS stateName, r.name_en AS stateNameEn
    FROM pastor_children c
    JOIN pastors p ON p.id = c.pastor_id
    LEFT JOIN pastors sp ON sp.id = p.spouse_pastor_id
    JOIN regions r ON r.id = p.region_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY COALESCE(c.academic_year, '') DESC, c.date_of_birth DESC, c.id`);
}

/** School years that appear in the report, newest first. */
type YearRow = { academicYear: string | null };
type GradeRow = { grade: string | null };

export function reportYears(rows: YearRow[]): string[] {
  return Array.from(new Set(rows.map((r) => r.academicYear).filter((y): y is string => Boolean(y))))
    .sort((a, b) => b.localeCompare(a));
}

/** School order of a grade label: KG first, then 1, 2, …, then anything else
 *  (e.g. "Year 11") by its number, so a grade list reads like a school. */
function gradeOrder(label: string): number {
  const text = label.trim().toUpperCase();
  if (/^(KG|K\.?G\.?|KINDERGARTEN|PRE)/.test(text)) return 0;
  const digits = /(\d{1,2})\s*$/.exec(text);
  if (digits) return Number(digits[1]);
  return 100;
}

export function compareGrades(a: string, b: string): number {
  const diff = gradeOrder(a) - gradeOrder(b);
  return diff !== 0 ? diff : a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

/** Grades that appear in the report, in school order (KG before numbers). */
export function reportGrades(rows: GradeRow[]): string[] {
  return Array.from(new Set(rows.map((r) => r.grade).filter((g): g is string => Boolean(g))))
    .sort(compareGrades);
}

/** A pastor child and a member row that look like the same person, so a clerk
 *  can link them without retyping anything. */
export type ChildLinkSuggestion = {
  childId: number;
  memberId: number;
  memberName: string;
  memberNameEn: string | null;
  memberDob: string | null;
  /** "name+dob" when the birth dates agree, "name" when only the name does. */
  reason: "name+dob" | "name";
};

/** Names are compared without spaces, dots or separators, and across the
 *  Myanmar and English spellings, so "မာရီ ဂရေ့စ်" meets "Grace". */
function nameKey(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[\s.,\-·'’]/g, "");
}

type MemberCandidate = {
  id: number;
  name: string | null;
  nameEn: string | null;
  dob: string | null;
  gender: string;
};

/** One best member match per unlinked pastor child, limited to the signed-in
 *  user's states. A different birth date or gender always disqualifies a pair,
 *  so a suggested link is never a guess about identity. */
export async function loadChildLinkSuggestions(
  db: DB,
  scope: { scopeAll: boolean; stateIds: number[] },
): Promise<Map<number, ChildLinkSuggestion>> {
  const conditions = [sql`p.active = 1`, sql`c.active = 1`, sql`c.member_id IS NULL`];
  if (!scope.scopeAll) {
    if (scope.stateIds.length === 0) return new Map();
    conditions.push(sql`p.region_id IN (${sql.join(scope.stateIds.map((id) => sql`${id}`), sql`, `)})`);
  }
  const [children, members] = await Promise.all([
    db.all<{ id: number; name: string; nameEn: string | null; dob: string | null; gender: string }>(sql`
      SELECT c.id, c.name, c.name_en AS nameEn, c.date_of_birth AS dob, c.gender
      FROM pastor_children c
      JOIN pastors p ON p.id = c.pastor_id
      WHERE ${sql.join(conditions, sql` AND `)}`),
    db.all<MemberCandidate>(sql`
      SELECT m.id, m.name_myanmar AS name, m.name_english AS nameEn,
             m.date_of_birth AS dob, m.gender
      FROM members m
      WHERE m.status != 'deleted' AND m.relationship IN ('son', 'daughter')
      ORDER BY m.id`),
  ]);
  if (children.length === 0 || members.length === 0) return new Map();

  // A member may only be suggested once, so two children cannot claim one row.
  const taken = new Set<number>();
  const suggestions = new Map<number, ChildLinkSuggestion>();
  for (const child of children) {
    const childKeys = [nameKey(child.name), nameKey(child.nameEn)].filter(Boolean);
    let best: { candidate: MemberCandidate; withDob: boolean } | null = null;
    for (const member of members) {
      if (taken.has(member.id)) continue;
      const memberKeys = [nameKey(member.name), nameKey(member.nameEn)].filter(Boolean);
      if (!memberKeys.some((key) => childKeys.includes(key))) continue;
      if (child.dob && member.dob && child.dob !== member.dob) continue;
      if (child.gender && member.gender && child.gender !== member.gender) continue;
      const withDob = Boolean(child.dob && member.dob && child.dob === member.dob);
      if (!best || (!best.withDob && withDob)) best = { candidate: member, withDob };
      if (withDob) break;
    }
    if (!best) continue;
    taken.add(best.candidate.id);
    suggestions.set(child.id, {
      childId: child.id,
      memberId: best.candidate.id,
      memberName: best.candidate.name ?? best.candidate.nameEn ?? "",
      memberNameEn: best.candidate.nameEn,
      memberDob: best.candidate.dob,
      reason: best.withDob ? "name+dob" : "name",
    });
  }
  return suggestions;
}

export type ChildFormResult = {
  values: PastorChildValues;
  errors: string[];
  data: {
    name: string;
    nameEn: string | null;
    gender: string;
    dateOfBirth: string | null;
    grade: string | null;
    academicYear: string | null;
    atHopeSchool: number;
    school: string | null;
    notes: string | null;
    active: number;
    memberId: number | null;
  } | null;
};

export function readChildForm(
  body: Record<string, unknown>,
  t: (key: string) => string,
  opts: { editing: boolean },
): ChildFormResult {
  const pick = (key: string) => String(body[key] ?? "").trim();
  const values: PastorChildValues = {
    name: pick("name").slice(0, 100),
    nameEn: pick("name_en").slice(0, 100),
    gender: pick("gender"),
    dateOfBirth: pick("date_of_birth"),
    grade: pick("grade").slice(0, 40),
    academicYear: pick("academic_year").slice(0, 20),
    atHopeSchool: pick("at_hope_school") === "1",
    school: pick("school").slice(0, 120),
    notes: pick("notes").slice(0, 500),
    active: opts.editing ? pick("active") === "1" : true,
    memberId: /^\d{1,9}$/.test(pick("member_id")) ? pick("member_id") : "",
  };
  const errors: string[] = [];

  if (!values.name) errors.push(t("org.childErrName"));

  let dob: string | null = null;
  if (values.dateOfBirth) {
    dob = parseDateFlexible(values.dateOfBirth);
    if (!dob) errors.push(t("org.childErrDob"));
    else if (isFutureDate(dob)) errors.push(t("org.childErrDobFuture"));
  }
  if (values.gender && values.gender !== "male" && values.gender !== "female") {
    errors.push(t("org.childErrGender"));
  }
  if (values.academicYear && !/^\d{4}(-\d{4})?$/.test(values.academicYear)) {
    errors.push(t("org.childErrYear"));
  }

  if (errors.length > 0) return { values, errors, data: null };
  // Hope School children keep the canonical school name so the count and the
  // list never disagree about where the child goes.
  const school = values.atHopeSchool ? HOPE_SCHOOL : values.school || null;
  return {
    values,
    errors,
    data: {
      name: values.name,
      nameEn: values.nameEn || null,
      gender: values.gender,
      dateOfBirth: dob,
      grade: values.grade || null,
      academicYear: values.academicYear || null,
      atHopeSchool: values.atHopeSchool ? 1 : 0,
      school,
      notes: values.notes || null,
      active: values.active ? 1 : 0,
      memberId: values.memberId ? Number(values.memberId) : null,
    },
  };
}

/** The church's own school; stored as the school name when the box is ticked. */
export const HOPE_SCHOOL = "Private Hope School";

/** "12 years 3 months" parts of a ministry that began on `start`. Null when the
 *  date is missing or unreadable. */
export function ministryTenure(
  start: string | null | undefined,
  today = todayInYangon(),
): { years: number; months: number } | null {
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  const from = start.split("-").map(Number);
  const to = today.split("-").map(Number);
  if (from.length !== 3 || to.length !== 3) return null;
  let months = (to[0]! - from[0]!) * 12 + (to[1]! - from[1]!);
  if (to[2]! < from[2]!) months -= 1;
  if (months < 0) return null;
  return { years: Math.floor(months / 12), months: months % 12 };
}
