import { sql } from "drizzle-orm";
import type { DB } from "./db/client";
import { HOPE_SCHOOL, currentAcademicYear, loadChildReport } from "./pastor-children";

/** One school year of a member's education. The child's identity lives on the
 *  member row (relationship = son/daughter); this table only records where they
 *  studied that year, so a grade change never rewrites history. */
export type EnrolmentRow = {
  id: number;
  memberId: number;
  academicYear: string;
  grade: string | null;
  schoolKind: "hope" | "other";
  schoolName: string | null;
  status: string;
  notes: string | null;
};

export type EnrolmentValues = {
  academicYear: string;
  grade: string;
  schoolKind: string;
  schoolName: string;
  status: string;
  notes: string;
};

export const SCHOOL_KINDS = ["hope", "other"] as const;
export const ENROLMENT_STATUSES = ["active", "graduated", "left"] as const;

const SELECT_ENROLMENT = sql`
  SELECT e.id, e.member_id AS memberId, e.academic_year AS academicYear, e.grade,
         e.school_kind AS schoolKind, e.school_name AS schoolName, e.status, e.notes
  FROM student_enrolments e`;

/** Newest school year first, so the current class is the first row. */
export async function loadMemberEnrolments(db: DB, memberId: number): Promise<EnrolmentRow[]> {
  return db.all<EnrolmentRow>(sql`
    ${SELECT_ENROLMENT}
    WHERE e.member_id = ${memberId}
    ORDER BY e.academic_year DESC, e.id DESC`);
}

export async function loadEnrolment(
  db: DB,
  memberId: number,
  id: number,
): Promise<EnrolmentRow | null> {
  const rows = await db.all<EnrolmentRow>(sql`
    ${SELECT_ENROLMENT}
    WHERE e.member_id = ${memberId} AND e.id = ${id}`);
  return rows[0] ?? null;
}

/** The row the household list and the member list show: this school year when
 *  it exists, otherwise the newest year on file. */
export type EnrolmentSummary = {
  memberId: number;
  academicYear: string;
  grade: string | null;
  schoolKind: string;
  schoolName: string | null;
  status: string;
};

export async function loadEnrolmentSummaries(
  db: DB,
  memberIds: number[],
): Promise<EnrolmentSummary[]> {
  if (memberIds.length === 0) return [];
  const ids = sql.join(memberIds.map((id) => sql`${id}`), sql`, `);
  const rows = await db.all<EnrolmentSummary>(sql`
    SELECT e.member_id AS memberId, e.academic_year AS academicYear, e.grade,
           e.school_kind AS schoolKind, e.school_name AS schoolName, e.status
    FROM student_enrolments e
    WHERE e.member_id IN (${ids})
    ORDER BY e.member_id, e.academic_year DESC, e.id DESC`);
  const year = currentAcademicYear();
  const picked = new Map<number, EnrolmentSummary>();
  const fallback = new Map<number, EnrolmentSummary>();
  for (const row of rows) {
    if (!fallback.has(row.memberId)) fallback.set(row.memberId, row);
    if (row.academicYear === year && !picked.has(row.memberId)) picked.set(row.memberId, row);
  }
  return memberIds
    .map((id) => picked.get(id) ?? fallback.get(id))
    .filter((row): row is EnrolmentSummary => Boolean(row));
}

export function enrolmentValues(row?: EnrolmentRow): EnrolmentValues {
  return {
    academicYear: row?.academicYear ?? currentAcademicYear(),
    grade: row?.grade ?? "",
    schoolKind: row?.schoolKind ?? "hope",
    schoolName: row?.schoolName ?? "",
    status: row?.status ?? "active",
    notes: row?.notes ?? "",
  };
}

export type EnrolmentFormResult = {
  values: EnrolmentValues;
  errors: string[];
  data: {
    academicYear: string;
    grade: string | null;
    schoolKind: string;
    schoolName: string | null;
    status: string;
    notes: string | null;
  } | null;
};

export function readEnrolmentForm(
  body: Record<string, unknown>,
  t: (key: string) => string,
): EnrolmentFormResult {
  const pick = (key: string) => String(body[key] ?? "").trim();
  const values: EnrolmentValues = {
    academicYear: pick("academic_year").slice(0, 20),
    grade: pick("grade").slice(0, 40),
    schoolKind: pick("school_kind"),
    schoolName: pick("school_name").slice(0, 120),
    status: pick("status") || "active",
    notes: pick("notes").slice(0, 500),
  };
  const errors: string[] = [];

  if (!/^\d{4}(-\d{4})?$/.test(values.academicYear)) errors.push(t("edu.errYear"));
  if (!(SCHOOL_KINDS as readonly string[]).includes(values.schoolKind)) errors.push(t("edu.errKind"));
  if (!(ENROLMENT_STATUSES as readonly string[]).includes(values.status)) errors.push(t("edu.errStatus"));
  if (values.schoolKind === "other" && !values.schoolName) errors.push(t("edu.errSchoolName"));

  if (errors.length > 0) return { values, errors, data: null };
  // Hope School keeps the canonical name so the counts and the list agree.
  const schoolName = values.schoolKind === "hope" ? HOPE_SCHOOL : values.schoolName;
  return {
    values,
    errors,
    data: {
      academicYear: values.academicYear,
      grade: values.grade || null,
      schoolKind: values.schoolKind,
      schoolName,
      status: values.status,
      notes: values.notes || null,
    },
  };
}

/** One line of the combined Hope School report: a pastor's child or a member's
 *  child, flattened to the same shape so the page and the CSV never branch. */
export type StudentReportRow = {
  key: string;
  personType: "pastor" | "member";
  studentId: number;
  name: string;
  nameEn: string | null;
  gender: string;
  dateOfBirth: string | null;
  grade: string | null;
  academicYear: string | null;
  schoolKind: "hope" | "other";
  schoolName: string | null;
  status: string;
  parentId: number | null;
  parentName: string;
  parentNameEn: string | null;
  stateName: string;
  stateNameEn: string | null;
  notes: string | null;
};

type MemberStudentRow = {
  studentId: number;
  name: string | null;
  nameEn: string | null;
  gender: string;
  dateOfBirth: string | null;
  grade: string | null;
  academicYear: string;
  schoolKind: string;
  schoolName: string | null;
  status: string;
  notes: string | null;
  fatherName: string | null;
  motherName: string | null;
  parentId: number | null;
  parentName: string | null;
  parentNameEn: string | null;
  stateName: string;
  stateNameEn: string | null;
};

/** Every child in scope: members with an enrolment plus pastors' children. The
 *  two lists are merged here so the report, the CSV and the counts share one
 *  source of truth. */
export async function loadStudentReport(
  db: DB,
  scope: { scopeAll: boolean; stateIds: number[] },
): Promise<StudentReportRow[]> {
  const conditions = [sql`m.status != 'deleted'`];
  if (!scope.scopeAll) {
    if (scope.stateIds.length === 0) return [];
    conditions.push(sql`m.region_id IN (${sql.join(scope.stateIds.map((id) => sql`${id}`), sql`, `)})`);
  }
  const [memberRows, pastorRows] = await Promise.all([
    db.all<MemberStudentRow>(sql`
      SELECT e.member_id AS studentId, m.name_myanmar AS name, m.name_english AS nameEn,
             m.gender, m.date_of_birth AS dateOfBirth, e.grade,
             e.academic_year AS academicYear, e.school_kind AS schoolKind,
             e.school_name AS schoolName, e.status, e.notes,
             m.father_name AS fatherName, m.mother_name AS motherName,
             head.id AS parentId,
             COALESCE(NULLIF(head.name_myanmar, ''), head.name_english,
                      m.father_name, m.mother_name) AS parentName,
             head.name_english AS parentNameEn,
             r.name AS stateName, r.name_en AS stateNameEn
      FROM student_enrolments e
      JOIN members m ON m.id = e.member_id
      JOIN regions r ON r.id = m.region_id
      LEFT JOIN families f ON f.id = m.family_id
      LEFT JOIN members head ON head.id = f.head_member_id
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY e.academic_year DESC, m.date_of_birth DESC, e.id`),
    loadChildReport(db, scope),
  ]);

  const students: StudentReportRow[] = memberRows.map((row) => ({
    key: `m${row.studentId}-${row.academicYear}`,
    personType: "member",
    studentId: row.studentId,
    name: row.name ?? "",
    nameEn: row.nameEn,
    gender: row.gender,
    dateOfBirth: row.dateOfBirth,
    grade: row.grade,
    academicYear: row.academicYear,
    schoolKind: row.schoolKind === "other" ? "other" : "hope",
    schoolName: row.schoolName,
    status: row.status,
    parentId: row.parentId,
    parentName: row.parentName ?? row.fatherName ?? row.motherName ?? "",
    parentNameEn: row.parentNameEn,
    stateName: row.stateName,
    stateNameEn: row.stateNameEn,
    notes: row.notes,
  }));

  for (const row of pastorRows) {
    students.push({
      key: `p${row.id}-${row.academicYear ?? ""}`,
      personType: "pastor",
      studentId: row.id,
      name: row.name,
      nameEn: row.nameEn,
      gender: row.gender,
      dateOfBirth: row.dateOfBirth,
      grade: row.grade,
      academicYear: row.academicYear,
      schoolKind: row.atHopeSchool === 1 ? "hope" : "other",
      schoolName: row.school,
      status: row.active === 1 ? "active" : "left",
      parentId: row.pastorId,
      parentName: row.pastorName,
      parentNameEn: row.pastorNameEn,
      stateName: row.stateName,
      stateNameEn: row.stateNameEn,
      notes: row.notes,
    });
  }
  return students;
}
