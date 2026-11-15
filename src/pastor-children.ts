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
  };
}

const SELECT_CHILD = sql`
  SELECT c.id, c.pastor_id AS pastorId, c.name, c.name_en AS nameEn, c.gender,
         c.date_of_birth AS dateOfBirth, c.grade, c.academic_year AS academicYear,
         c.at_hope_school AS atHopeSchool, c.school, c.notes, c.active
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
