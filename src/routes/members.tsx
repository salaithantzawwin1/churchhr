import { Hono } from "hono";
import { and, eq, inArray, sql } from "drizzle-orm";
import { families, memberHistory } from "../db/schema";
import type { AppEnv } from "../env";
import { getDb, type DB } from "../db/client";
import { lookupOptions, members, regions } from "../db/schema";
import { requirePermission } from "../middleware";
import { flashFromQuery } from "../flash";
import { abbrevFromLabel, findOption, loadAllOptions, nextCodeCandidate, nextFamilyGroupCode, optionsOfType, type OptionRow } from "../lookup";
import { buildCsv, headerIndex, parseCsv } from "../csv";
import {
  getMemberPositions, isPositionForScope, positionLabel, positionTaken, setHomeCellPosition, setMemberPositions,
  type PositionAssignment,
} from "../positions";
import { isDefinedForScope, isPastorPositionCode, loadPositionDefs, positionDefLabel, type PositionDefRow } from "../position-catalog";
import { recordPositionHistory } from "../position-history";
import { loadRegionalChurches, loadSupervisionClusters } from "../org-units";
import { loadDepartments } from "../departments";

/** from admin.tsx: multi/ints duplicated here to avoid cross-route imports. */
function multi(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return typeof v === "string" ? [v] : [];
}
function ints(vals: string[]): number[] {
  return vals.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
}
import {
  asInt, ageFromDate, b64decode, b64encode, intParam, normKey,
  isFutureDate, parseDateFlexible, s,
} from "../util";
import { BLOOD_TYPES, GENDERS, MARITAL_STATUSES, STATUSES, normEnum } from "../enums";
import { getDict, type Lang } from "../i18n";
import {
  ImportPage, MemberDetailPage, MemberFormFragment, MemberFormPage, MemberPositionForm, MemberPositionPage, MembersListPage,
  type Filters, type FormValues, type ImportReport, type MemberDetail,
} from "../views/members";

export const membersRoutes = new Hono<AppEnv>();

const PER_PAGE = 20;

/** Validation/import error -> i18n key (translated at render time). */
const validMsgKeys: Record<string, string> = {
  "val.name": "val.name",
  "val.state": "val.state",
  "val.scope": "val.scope",
  "val.gender": "val.gender",
  "val.marital": "val.marital",
  "val.blood": "val.blood",
  "val.dob": "val.dob",
  "val.salvation": "val.salvation",
  "photo.badType": "photo.badType",
  "photo.tooLarge": "photo.tooLarge",
  "val.income": "val.income",
  "val.option": "val.option",
  "val.department": "val.department",
  "imp.noDataRow": "imp.noDataRow",
  "imp.noNameColumn": "imp.noNameColumn",
  "imp.noName": "imp.noName",
  "imp.noState": "imp.noState",
  "imp.stateNotFound": "imp.stateNotFound",
  "imp.outOfScope": "imp.outOfScope",
  "imp.badGender": "imp.badGender",
  "imp.badMarital": "imp.badMarital",
  "imp.badBlood": "imp.badBlood",
  "imp.badStatus": "imp.badStatus",
  "imp.badDob": "imp.badDob",
  "imp.badSalvation": "imp.badSalvation",
  "imp.badIncome": "imp.badIncome",
  "imp.noFile": "imp.noFile",
  "imp.noCsvData": "imp.noCsvData",
  "imp.fileTooBig": "imp.fileTooBig",
  "imp.tooLarge": "imp.tooLarge",
  "imp.failed": "imp.failed",
  "imp.cannotAddOption": "imp.cannotAddOption",
  "imp.badRelationship": "imp.badRelationship",
  "imp.badHousehold": "imp.badHousehold",
  "imp.badHouseholdAddress": "imp.badHouseholdAddress",
  "imp.badHouseholdTownship": "imp.badHouseholdTownship",
  "imp.badHouseholdPhone": "imp.badHouseholdPhone",
  "imp.householdNoName": "imp.householdNoName",
};

/** Marks a message as a translate-at-render key (called from sync validators). */
function msg(key: string): string {
  return validMsgKeys[key] ? `@${key}` : key;
}

/** Renders a message produced by validators/import: @key -> dictionary, else literal.
 * Handles the "@key: detail" form used by row errors (e.g. bad blood type value). */
function renderMsg(raw: string, lang: Lang): string {
  if (!raw.startsWith("@")) return raw;
  const t = getDict(lang);
  const body = raw.slice(1);
  const sep = body.indexOf(":");
  const keyPart = (sep === -1 ? body : body.slice(0, sep)).trim();
  const rest = sep === -1 ? "" : body.slice(sep);
  const key = validMsgKeys[keyPart];
  return key ? `${t(key)}${rest}` : body;
}

type Scope = { scopeAll: boolean; stateIds: number[]; homeCellIds: number[] };
type Region = { id: number; name: string; nameEn: string; slug: string; code: string | null };

function scopeOf(c: { get: (k: "scopeAll" | "stateIds" | "homeCellIds") => any }): Scope {
  return {
    scopeAll: c.get("scopeAll"),
    stateIds: c.get("stateIds"),
    homeCellIds: (c.get("homeCellIds") ?? []) as number[],
  };
}

/** SQL fragment: assigned states (all-state users see everything), then the
 * account's optional Home Cell limit. */
function scopeCond(scope: Scope) {
  let cond: any;
  if (scope.scopeAll) cond = sql`1=1`;
  else if (scope.stateIds.length === 0) cond = sql`1=0`;
  // Qualified: /members joins regions + lookup tables, so a bare region_id
  // would be ambiguous (members and regions both have that column).
  else cond = sql`m.region_id IN (${sql.join(scope.stateIds.map((id) => sql`${id}`), sql`, `)})`;
  if (scope.homeCellIds.length > 0) {
    cond = sql`${cond} AND m.home_cell_id IN (${sql.join(scope.homeCellIds.map((id) => sql`${id}`), sql`, `)})`;
  }
  return cond;
}

/** Details the dashboard's data-gap card can drill into. */
const MISSING_FIELDS = ["family_group", "home_cell", "phone", "dob"] as const;
type MissingField = (typeof MISSING_FIELDS)[number];

function parseFilters(q: Record<string, string | undefined>): Filters {
  return {
    q: (q.q ?? "").trim().slice(0, 100),
    state: intParam(q.state),
    gender: q.gender && q.gender in GENDERS ? q.gender : "",
    status: q.status && q.status in STATUSES ? q.status : "",
    homeCell: intParam(q.home_cell),
    department: intParam(q.department),
    group: intParam(q.group),
    fellowship: intParam(q.fellowship),
    ageGroup: intParam(q.age_group),
    familyGroup: q.family_group === "any" ? "any" : intParam(q.family_group),
    missing: (MISSING_FIELDS as readonly string[]).includes(q.missing ?? "")
      ? (q.missing as MissingField) : "",
  };
}

/** Age Group behind a dashboard drill-down, with the range used for filtering. */
async function loadAgeGroup(db: DB, id: number) {
  const rows = await db.all<{ name: string; min_age: number; max_age: number }>(
    sql`SELECT name, min_age, max_age FROM age_groups WHERE id = ${id} LIMIT 1`,
  );
  return rows[0] ?? null;
}

function listCond(scope: Scope, f: Filters, age?: { min_age: number; max_age: number } | null) {
  let cond = scopeCond(scope);
  if (f.state) cond = sql`${cond} AND m.region_id = ${f.state}`;
  if (f.q) {
    const like = `%${f.q}%`;
    cond = sql`${cond} AND (m.name_myanmar LIKE ${like} OR m.name_english LIKE ${like} OR m.phone LIKE ${like} OR m.nrc_number LIKE ${like} OR m.member_code LIKE ${like} OR CAST(m.id AS TEXT) LIKE ${like})`;
  }
  if (f.gender) cond = sql`${cond} AND m.gender = ${f.gender}`;
  if (f.status) cond = sql`${cond} AND m.status = ${f.status}`;
  if (f.homeCell) cond = sql`${cond} AND m.home_cell_id = ${f.homeCell}`;
  if (f.department) cond = sql`${cond} AND m.department_id = ${f.department}`;
  if (f.group) cond = sql`${cond} AND m.group_id = ${f.group}`;
  if (f.familyGroup === "any") cond = sql`${cond} AND m.family_group_id IS NOT NULL`;
  else if (f.familyGroup) cond = sql`${cond} AND m.family_group_id = ${f.familyGroup}`;
  if (f.missing === "family_group") cond = sql`${cond} AND m.family_group_id IS NULL`;
  else if (f.missing === "home_cell") cond = sql`${cond} AND m.home_cell_id IS NULL`;
  else if (f.missing === "phone") cond = sql`${cond} AND (m.phone IS NULL OR m.phone = '')`;
  else if (f.missing === "dob") cond = sql`${cond} AND (m.date_of_birth IS NULL OR m.date_of_birth = '')`;
  if (f.fellowship) cond = sql`${cond} AND m.fellowship_category_id = ${f.fellowship}`;
  // Same age bucket and population the dashboard card counts (active members
  // with a birth date), so the drilled-down total matches the number clicked.
  if (age) {
    cond = sql`${cond} AND m.status = 'active' AND m.gender IN ('male', 'female')
      AND m.date_of_birth IS NOT NULL AND m.date_of_birth <> ''
      AND CAST((julianday('now') - julianday(m.date_of_birth)) / 365.25 AS INTEGER)
        BETWEEN ${age.min_age} AND ${age.max_age}`;
  }
  return cond;
}

async function loadRegions(db: DB): Promise<Region[]> {
  return (await db
    .select({ id: regions.id, name: regions.name, nameEn: regions.nameEn, slug: regions.slug, code: regions.code })
    .from(regions)
    .orderBy(regions.id)) as Region[];
}

function scopedRegions(all: Region[], scope: Scope, lang: Lang): { id: number; name: string; code: string | null }[] {
  return all
    .filter((r) => scope.scopeAll || scope.stateIds.includes(r.id))
    .map((r) => ({ id: r.id, name: lang !== "mm" && r.nameEn ? r.nameEn : r.name, code: r.code ?? null }));
}

// ---------- GET /members (list + search + filter + sort + pagination) ----------

/** Whitelisted ORDER BY expressions per sortable column key. Fixed strings
 *  only — the key comes from the query string but the SQL never does. */
const SORT_EXPR: Record<string, string> = {
  id: "m.id",
  name: "COALESCE(NULLIF(m.name_myanmar, ''), m.name_english, '')",
  gender: "m.gender",
  age: "m.date_of_birth",
  phone: "m.phone",
  state: "r.name",
  township: "m.township",
  marital: "m.marital_status",
  homeCell: "hc.label",
  role: "(SELECT MIN(position) FROM member_positions WHERE member_id = m.id)",
  group: "gr.label",
  familyGroup: "fg.label",
  fellowship: "fc.label",
  sector: "sec.label",
  status: "m.status",
};

/** Resolve the query-string sort into an ORDER BY fragment (default: newest first). */
function orderByFrom(q: Record<string, string | undefined>): string {
  const key = q.sort && SORT_EXPR[q.sort] ? q.sort : "";
  const dir = q.dir === "desc" ? "DESC" : "ASC";
  if (!key) return "m.id DESC";
  // Empty values sort last regardless of direction, then a stable id tiebreak.
  return `(COALESCE(${SORT_EXPR[key]}, '') = '') ASC, ${SORT_EXPR[key]} ${dir}, m.id DESC`;
}

membersRoutes.get("/", requirePermission("members.view"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const f = parseFilters(c.req.query());
  const ageGroup = f.ageGroup ? await loadAgeGroup(db, f.ageGroup) : null;
  if (!ageGroup) f.ageGroup = null;
  const page = Math.max(1, intParam(c.req.query("page")) ?? 1);
  const cond = listCond(scope, f, ageGroup);

  const countRows = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM members m WHERE ${cond}`);
  const total = countRows[0]?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const currentPage = Math.min(page, pages);
  const offset = (currentPage - 1) * PER_PAGE;

  const rows = await db.all(sql`
    SELECT m.id, m.member_code, m.name_myanmar, m.name_english, m.gender, m.phone, m.status,
           m.date_of_birth, m.marital_status, m.township, m.updated_at,
           (m.photo IS NOT NULL) AS has_photo,
           r.name AS state_name, r.name_en AS state_name_en,
           m.home_cell_id, hc.label AS home_cell, gr.label AS group_label,
           fg.label AS family_group, fg.code AS family_group_code,
           fc.label AS fellowship, sec.label AS sector,
           (SELECT GROUP_CONCAT(position, ',') FROM member_positions WHERE member_id = m.id) AS positions
    FROM members m
    JOIN regions r ON r.id = m.region_id
    LEFT JOIN lookup_options hc ON hc.id = m.home_cell_id
    LEFT JOIN lookup_options gr ON gr.id = m.group_id
    LEFT JOIN lookup_options fg ON fg.id = m.family_group_id
    LEFT JOIN lookup_options fc ON fc.id = m.fellowship_category_id
    LEFT JOIN lookup_options sec ON sec.id = m.sector_id
    WHERE ${cond}
    ORDER BY ${sql.raw(orderByFrom(c.req.query()))}
    LIMIT ${PER_PAGE} OFFSET ${offset}`);

  const allRegions = await loadRegions(db);
  const allOptions = await loadAllOptions(db);
  const departments = await loadDepartments(db, true);
  const positionDefs = await loadPositionDefs(db);
  // Every active age group, so the filter can be picked or switched here too.
  const ageGroups = await db.all<{ id: number; name: string; min_age: number; max_age: number }>(
    sql`SELECT id, name, min_age, max_age FROM age_groups ORDER BY sort_order, min_age`,
  );
  return c.html(
    <MembersListPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))}
      rows={rows as any} total={total} page={currentPage} pages={pages} filters={f} ageGroup={ageGroup}
      sort={SORT_EXPR[c.req.query("sort") ?? ""] ? (c.req.query("sort") as string) : ""}
      dir={c.req.query("dir") === "desc" ? "desc" : "asc"}
      regions={scopedRegions(allRegions, scope, c.get("lang"))}
      homeCells={optionsOfType(allOptions, "home_cell")}
      departments={departments}
      groups={optionsOfType(allOptions, "group")}
      fellowships={optionsOfType(allOptions, "fellowship_category")}
      positionDefs={positionDefs}
      ageGroups={ageGroups}
      lang={c.get("lang")}
    />,
  );
});

// ---------- shared form read/validate ----------

const OPTION_FIELD: Record<string, string> = {
  ethnicity_id: "ethnicity",
  education_id: "education",
  family_group_id: "family_group",
  fellowship_category_id: "fellowship_category",
  sector_id: "sector",
  group_id: "group",
  home_cell_id: "home_cell",
};

const FORM_KEYS = [
  "name_myanmar", "name_english", "gender", "marital_status", "date_of_birth", "blood_type",
  "phone", "nrc_number", "languages", "address", "father_name", "mother_name",
  "family_group_id", "ethnicity_id", "education_id", "job", "work_skills", "income",
  "region_id", "township", "home_cell_id", "department_id", "group_id", "fellowship_category_id", "sector_id",
  "salvation_date", "status", "notes",
] as const;

type Validated = { values: FormValues; errors: string[]; data: Record<string, string | number | null> | null };

function readAndValidate(body: Record<string, unknown>, scope: Scope, options: OptionRow[], departments: { id: number }[] = []): Validated {
  const v: FormValues = {};
  for (const k of FORM_KEYS) v[k] = s(body[k]);
  const errors: string[] = [];

  if (!v.name_myanmar && !v.name_english) errors.push(msg("val.name"));

  const regionId = asInt(v.region_id);
  let regionOk = false;
  if (regionId === null) errors.push(msg("val.state"));
  else if (scope.scopeAll) regionOk = true;
  else regionOk = scope.stateIds.includes(regionId);
  if (regionId !== null && !regionOk) errors.push(msg("val.scope"));

  if (v.gender && !(v.gender in GENDERS)) errors.push(msg("val.gender"));
  if (v.marital_status && !(v.marital_status in MARITAL_STATUSES)) errors.push(msg("val.marital"));
  if (v.blood_type && !BLOOD_TYPES.includes(v.blood_type) &&
      !findOption(options, "blood_type", v.blood_type, 0)) {
    errors.push(msg("val.blood"));
  }

  let dob: string | null = "";
  if (v.date_of_birth) {
    dob = parseDateFlexible(v.date_of_birth);
    if (dob === null) errors.push(msg("val.dob"));
    else if (isFutureDate(dob)) errors.push(msg("val.dobFuture"));
  }
  let salvation: string | null = "";
  if (v.salvation_date) {
    salvation = parseDateFlexible(v.salvation_date);
    if (salvation === null) errors.push(msg("val.salvation"));
    else if (isFutureDate(salvation)) errors.push(msg("val.salvationFuture"));
  }

  let income: number | null = null;
  if (v.income) {
    const digits = v.income.replace(/[,\s]/g, "");
    if (/^\d+$/.test(digits)) income = Number(digits);
    else errors.push(msg("val.income"));
  }

  const status = v.status && v.status in STATUSES ? v.status : "active";

  let departmentId: number | null = null;
  if (v.department_id) {
    departmentId = asInt(v.department_id);
    if (departmentId === null || !departments.some((d) => d.id === departmentId)) {
      errors.push(msg("val.department"));
      departmentId = null;
    }
  }

  const optionIds: Record<string, number | null> = {};
  for (const [field, type] of Object.entries(OPTION_FIELD)) {
    const raw = v[field];
    if (!raw) { optionIds[field] = null; continue; }
    const found = options.find((o) => o.type === type && o.id === asInt(raw));
    if (!found) errors.push(msg("val.option"));
    optionIds[field] = found ? found.id : null;
  }

  if (errors.length > 0) return { values: v, errors, data: null };
  return {
    values: v,
    errors,
    data: {
      name_myanmar: v.name_myanmar || null,
      name_english: v.name_english || null,
      gender: v.gender,
      marital_status: v.marital_status,
      date_of_birth: dob === "" ? null : dob,
      blood_type: v.blood_type,
      phone: v.phone || null,
      nrc_number: v.nrc_number || null,
      languages: v.languages || null,
      address: v.address || null,
      township: v.township || null,
      father_name: v.father_name || null,
      mother_name: v.mother_name || null,
      job: v.job || null,
      work_skills: v.work_skills || null,
      income,
      salvation_date: salvation === "" ? null : salvation,
      status,
      notes: v.notes || null,
      region_id: regionId,
      department_id: departmentId,
      ...optionIds,
    },
  };
}

function defaultValues(scope: Scope, allRegions: Region[]): FormValues {
  const v: FormValues = { status: "active" };
  if (!scope.scopeAll && scope.stateIds.length === 1) v.region_id = String(scope.stateIds[0]);
  return v;
}

// ---------- CSV export ----------

const EXPORT_HEADER = [
  "ID", "Name English", "Name Myanmar", "Gender", "Married Status", "Date of Birth", "Age",
  "Blood Type", "Phone Number", "NRC Number", "Ethnicity", "Language", "Education", "Job",
  "Work Skills", "Income", "Address", "Father's Name", "Mother's Name", "Salvation Date",
  "Family Group", "Fellowship Categories", "Participating Sector", "Group", "Home Cell", "Department", "Township", "State", "Status",
  "Household", "Relationship", "Household Address", "Household Township", "Household Phone",
];

membersRoutes.get("/export", requirePermission("members.export"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const f = parseFilters(c.req.query());
  const cond = listCond(scope, f, f.ageGroup ? await loadAgeGroup(db, f.ageGroup) : null);
  const rows = await db.all(sql`
    SELECT m.*, r.name AS state_name,
      e.label AS ethnicity, ed.label AS education, fg.label AS family_group,
      fc.label AS fellowship, sec.label AS sector, gr.label AS group_label, hc.label AS home_cell,
      cd.name AS department,
      fam.name AS household, fam.address AS household_address,
      fam.township AS household_township, fam.phone AS household_phone
    FROM members m
    JOIN regions r ON r.id = m.region_id
    LEFT JOIN families fam ON fam.id = m.family_id
    LEFT JOIN lookup_options e ON e.id = m.ethnicity_id
    LEFT JOIN lookup_options ed ON ed.id = m.education_id
    LEFT JOIN lookup_options fg ON fg.id = m.family_group_id
    LEFT JOIN lookup_options fc ON fc.id = m.fellowship_category_id
    LEFT JOIN lookup_options sec ON sec.id = m.sector_id
    LEFT JOIN lookup_options gr ON gr.id = m.group_id
    LEFT JOIN lookup_options hc ON hc.id = m.home_cell_id
    LEFT JOIN church_departments cd ON cd.id = m.department_id
    WHERE ${cond}
    ORDER BY m.id ASC`);
  const body = rows.map((r: any) => [
    r.member_code, r.name_english, r.name_myanmar,
    r.gender ? GENDERS[r.gender]?.split(" (")[0] ?? r.gender : "",
    r.marital_status ? MARITAL_STATUSES[r.marital_status]?.split(" (")[0] ?? r.marital_status : "",
    r.date_of_birth ?? "", ageFromDate(r.date_of_birth) ?? "", r.blood_type,
    r.phone, r.nrc_number, r.ethnicity, r.languages, r.education, r.job, r.work_skills,
    r.income, r.address, r.father_name, r.mother_name, r.salvation_date,
    r.family_group, r.fellowship, r.sector, r.group_label, r.home_cell, r.department, r.township, r.state_name,
    r.status ? STATUSES[r.status]?.split(" (")[0] ?? r.status : "",
    r.household, r.relationship, r.household_address, r.household_township, r.household_phone,
  ]);
  const csv = "\uFEFF" + buildCsv([EXPORT_HEADER, ...body]);
  const today = new Date().toISOString().slice(0, 10);
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="members-${today}.csv"`,
  });
});

// ---------- CSV import ----------

membersRoutes.get("/import", requirePermission("members.import"), (c) =>
  c.html(<ImportPage user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))} report={null} error={null} lang={c.get("lang")} />),
);

membersRoutes.get("/import/template", requirePermission("members.import"), (c) => {
  const sample = [
    "", "Aung Aung", "မောင်အောင်", "male", "married", "1990-05-12", "", "O+", "0912345678",
    "12/abc(N)123456", "ဗမာ", "မြန်မာ", "Bachelor", "ဆရာဝန်", "", "300000", "ရန်ကုန်",
    "ဦးအောင်", "ဒေါ်ခင်", "2010-01-05", "Family A", "Youth", "Young Adults", "Group 1", "Cell 1",
    "အင်းစိန်မြို့နယ်", "ရန်ကုန်တိုင်း", "active", "", "", "", "", "",
  ];
  // Department membership is managed in the app; keep it out of the CSV
  // template until the importer can resolve department names.
  const templateHeader = EXPORT_HEADER.filter((h) => h !== "Department");
  const csv = "\uFEFF" + buildCsv([templateHeader, sample]);
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="members-template.csv"',
  });
});

const IMPORT_ALIASES: Record<string, string> = {
  "id": "id",
  "name english": "name_english", "name_english": "name_english",
  "name myanmar": "name_myanmar", "name_myanmar": "name_myanmar",
  "gender": "gender",
  "married status": "marital_status", "marital status": "marital_status",
  "date of birth": "dob", "dob": "dob",
  "age": "age",
  "blood type": "blood_type",
  "phone number": "phone", "phone": "phone", "phone no": "phone",
  "nrc number": "nrc", "nrc": "nrc",
  "ethnicity": "ethnicity",
  "language": "language", "languages": "language",
  "education": "education",
  "job": "job", "occupation": "job",
  "work skills": "skills",
  "income": "income",
  "address": "address",
  "father's name": "father", "father name": "father",
  "mother's name": "mother", "mother name": "mother",
  "salvation date": "salvation",
  "family group": "family_group",
  "fellowship categories": "fellowship", "fellowship category": "fellowship", "fellowship": "fellowship",
  "participating sector": "sector", "sector": "sector",
  "group": "group",
  "home cell": "home_cell",
  "state": "state", "region": "state",
  "township": "township", "township (မြို့နယ်)": "township",
  "status": "status",
  "household": "household", "family": "household", "household name": "household",
  "household address": "household_address", "household township": "household_township",
  "household phone": "household_phone", "household phone number": "household_phone",
  "relationship": "relationship", "relation": "relationship",
  "notes": "notes", "note": "notes",
};

/** Relationship keys accepted in CSV import (export writes the same keys). */
const IMPORT_RELATIONSHIPS = [
  "head", "spouse", "son", "daughter", "father", "mother",
  "brother", "sister", "grandchild", "other",
] as const;

const IMPORT_OPTION_FIELDS: Record<string, string> = {
  ethnicity: "ethnicity",
  education: "education",
  family_group: "family_group",
  fellowship: "fellowship_category",
  sector: "sector",
  group: "group",
  home_cell: "home_cell",
};

function resolveRegion(all: Region[], raw: string): number | null {
  const strip = (v: string) => normKey(v).replace(/\s+(region|state|division)$/, "");
  const want = normKey(raw);
  const wantStripped = strip(raw);
  for (const r of all) {
    if (strip(r.name) === want || strip(r.nameEn) === want || normKey(r.slug) === want) return r.id;
    if (strip(r.name) === wantStripped || strip(r.nameEn) === wantStripped || normKey(r.slug) === wantStripped) return r.id;
  }
  return null;
}

type ImportRow = {
  line: number;
  data: Record<string, string | number | null>;
  optionLabels: Record<string, string>;
  key: string;
  /** Household name + relationship inside it (round-trips the export columns). */
  household: string | null;
  relationship: string;
  householdAddress: string | null;
  householdTownship: string | null;
  householdPhone: string | null;
};

type AnalyzeResult = { report: ImportReport; validRows: ImportRow[]; pending: Map<string, { type: string; label: string }> };

async function analyzeImport(db: DB, csvText: string, scope: Scope, userId: number, lang: Lang): Promise<AnalyzeResult> {
  const grid = parseCsv(csvText);
  if (grid.length < 2) throw new Error(msg("imp.noDataRow"));
  const idx = headerIndex(grid[0]!, IMPORT_ALIASES);
  if (!idx.has("name_myanmar") && !idx.has("name_english")) {
    throw new Error(msg("imp.noNameColumn"));
  }

  const allRegions = await loadRegions(db);
  const allOptions = await loadAllOptions(db);
  const dupRows = await db.all<{ region_id: number; nm: string | null }>(sql`
    SELECT region_id,
      CASE WHEN name_myanmar IS NOT NULL AND name_myanmar <> '' THEN name_myanmar ELSE name_english END AS nm
    FROM members`);
  const existingKeys = new Set(
    dupRows.filter((r) => r.nm).map((r) => `${r.region_id}|${normKey(r.nm!)}`),
  );
  const seen = new Set<string>();

  const errors: { line: number; msg: string }[] = [];
  let errorCount = 0;
  let duplicates = 0;
  let totalRows = 0;
  const validRows: ImportRow[] = [];
  const pending = new Map<string, { type: string; label: string }>();

  for (let i = 1; i < grid.length; i++) {
    const row = grid[i]!;
    const line = i + 1;
    // Blank lines (common at the end of exported sheets) are not data rows.
    if (row.every((cell) => !cell.trim())) continue;
    totalRows += 1;
    const rec = (k: string) => {
      const j = idx.get(k);
      return j === undefined ? "" : (row[j] ?? "").trim();
    };
    const rowErrors: string[] = [];
    const nameMm = rec("name_myanmar");
    const nameEn = rec("name_english");
    if (!nameMm && !nameEn) rowErrors.push(msg("imp.noName"));

    let regionId: number | null = null;
    const stateRaw = rec("state");
    if (stateRaw) {
      regionId = resolveRegion(allRegions, stateRaw);
      if (regionId === null) rowErrors.push(`${msg("imp.stateNotFound")}: ${stateRaw}`);
    } else if (scope.scopeAll) {
      rowErrors.push(msg("imp.noState"));
    } else if (scope.stateIds.length === 1) {
      regionId = scope.stateIds[0]!;
    } else {
      rowErrors.push(msg("imp.noState"));
    }
    if (regionId !== null && !scope.scopeAll && !scope.stateIds.includes(regionId)) {
      rowErrors.push(msg("imp.outOfScope"));
    }

    const gender = normEnum(rec("gender"), GENDERS);
    if (gender === null) rowErrors.push(msg("imp.badGender"));
    const marital = normEnum(rec("marital_status"), MARITAL_STATUSES);
    if (marital === null) rowErrors.push(msg("imp.badMarital"));

    let blood = rec("blood_type");
    if (blood) {
      blood = blood.toUpperCase().replace(/\s+/g, "").replace("POSITIVE", "+").replace("NEGATIVE", "-").replace("RH", "");
      if (!BLOOD_TYPES.includes(blood) &&
          // managed blood_type options match by label (case-insensitive)
          !allOptions.some((o) => o.type === "blood_type" && o.label.toUpperCase() === blood)) {
        rowErrors.push(`${msg("imp.badBlood")}: ${blood}`);
      }
    }

    const statusRaw = rec("status");
    let status = "active";
    if (statusRaw) {
      const sn = normEnum(statusRaw, STATUSES);
      if (sn === null) rowErrors.push(`${msg("imp.badStatus")}: ${statusRaw}`);
      else status = sn;
    }

    const dobRaw = rec("dob");
    let dob: string | null = null;
    if (dobRaw) {
      dob = parseDateFlexible(dobRaw);
      if (dob === null) rowErrors.push(`${msg("imp.badDob")}: ${dobRaw}`);
      else if (isFutureDate(dob)) rowErrors.push(`${msg("val.dobFuture")}: ${dobRaw}`);
    }
    const salRaw = rec("salvation");
    let salvation: string | null = null;
    if (salRaw) {
      salvation = parseDateFlexible(salRaw);
      if (salvation === null) rowErrors.push(`${msg("imp.badSalvation")}: ${salRaw}`);
      else if (isFutureDate(salvation)) rowErrors.push(`${msg("val.salvationFuture")}: ${salRaw}`);
    }

    const incomeRaw = rec("income").replace(/[,\s]/g, "");
    let income: number | null = null;
    if (incomeRaw) {
      if (/^\d+$/.test(incomeRaw)) income = Number(incomeRaw);
      else rowErrors.push(`${msg("imp.badIncome")}: ${rec("income")}`);
    }

    // Household + relationship (round-trip of the export columns). Households
    // are matched/created by name inside the member's state at commit time.
    const relRaw = rec("relationship").toLowerCase().replace(/[\s-]+/g, "_");
    let relationship = "";
    if (relRaw) {
      if ((IMPORT_RELATIONSHIPS as readonly string[]).includes(relRaw)) relationship = relRaw;
      else rowErrors.push(`${msg("imp.badRelationship")}: ${rec("relationship")}`);
    }
    const householdName = rec("household");
    const householdAddress = rec("household_address");
    const householdTownship = rec("household_township");
    const householdPhone = rec("household_phone");
    if (householdName.length > 120) rowErrors.push(`${msg("imp.badHousehold")}: ${householdName.slice(0, 40)}`);
    if (householdAddress.length > 200) rowErrors.push(`${msg("imp.badHouseholdAddress")}: ${householdAddress.slice(0, 40)}`);
    if (householdTownship.length > 120) rowErrors.push(`${msg("imp.badHouseholdTownship")}: ${householdTownship.slice(0, 40)}`);
    if (householdPhone.length > 60) rowErrors.push(`${msg("imp.badHouseholdPhone")}: ${householdPhone.slice(0, 40)}`);
    if (!householdName && (householdAddress || householdTownship || householdPhone)) {
      rowErrors.push(msg("imp.householdNoName"));
    }

    // Township is stored on the member as its managed option label; register a
    // new township so it shows up in the cascade dropdowns after import too.
    let township = rec("township");
    if (township) {
      const found = findOption(allOptions, "township", township, regionId ?? 0);
      if (found) township = found.label;
      else pending.set(`township:${normKey(township)}`, { type: "township", label: township });
    }

    const optionLabels: Record<string, string> = {};
    for (const [field, type] of Object.entries(IMPORT_OPTION_FIELDS)) {
      const label = rec(field);
      if (!label) continue;
      // Resolve within the row's state first; all-states options match anywhere.
      const found = findOption(allOptions, type, label, regionId ?? 0);
      if (found) optionLabels[field] = String(found.id);
      else {
        optionLabels[field] = `new:${type}:${normKey(label)}`;
        pending.set(`${type}:${normKey(label)}`, { type, label });
      }
    }

    if (rowErrors.length > 0) {
      errorCount++;
      if (errors.length < 50) errors.push({ line, msg: rowErrors.map((e) => renderMsg(e, lang)).join("; ") });
      continue;
    }

    const key = `${regionId}|${normKey(nameMm || nameEn)}`;
    if (existingKeys.has(key) || seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    validRows.push({
      line,
      optionLabels,
      key,
      household: householdName || null,
      relationship,
      householdAddress: householdName ? householdAddress || null : null,
      householdTownship: householdName ? householdTownship || null : null,
      householdPhone: householdName ? householdPhone || null : null,
      data: {
        name_myanmar: nameMm || null,
        name_english: nameEn || null,
        gender: gender ?? "",
        marital_status: marital ?? "",
        date_of_birth: dob,
        blood_type: blood,
        phone: rec("phone") || null,
        nrc_number: rec("nrc") || null,
        languages: rec("language") || null,
        address: rec("address") || null,
        township: township || null,
        father_name: rec("father") || null,
        mother_name: rec("mother") || null,
        job: rec("job") || null,
        work_skills: rec("skills") || null,
        income,
        salvation_date: salvation,
        status,
        notes: rec("notes") || null,
        region_id: regionId,
      },
    });
  }

  return {
    report: {
      done: false,
      total: totalRows,
      valid: validRows.length,
      inserted: 0,
      duplicates,
      errorCount,
      errors,
      newOptions: [...pending.values()].map((p) => `${p.type}: ${p.label}`),
    },
    validRows,
    pending,
  };
}

const TYPE_TO_COLUMN: Record<string, string> = {
  ethnicity: "ethnicity_id",
  education: "education_id",
  family_group: "family_group_id",
  fellowship_category: "fellowship_category_id",
  sector: "sector_id",
  group: "group_id",
  home_cell: "home_cell_id",
};

/** Find or create an import option. Rows without a state fall back to the
 * all-states (regionId 0) option; rows with a state resolve/create region-scoped.
 * parentId/township let Home Cells and Family Groups keep the cascade (and the
 * per-township INS_FG001 numbering) intact. */
async function ensureOption(
  db: DB, cache: OptionRow[], type: string, label: string, lang: Lang, regionId = 0,
  opts: { parentId?: number | null; township?: OptionRow | null } = {},
): Promise<number> {
  const hit = findOption(cache, type, label, regionId);
  if (hit) return hit.id;
  try {
    const code = type === "family_group"
      ? nextFamilyGroupCode(cache.filter((o) => o.type === type).map((o) => o.code ?? ""), opts.township ?? null)
      : nextCodeCandidate(cache.filter((o) => o.type === type).map((o) => o.code ?? ""), type);
    const shortCode = type === "township" ? (abbrevFromLabel(label) || null) : null;
    const rows = await db
      .insert(lookupOptions)
      .values({ type, label, regionId, parentId: opts.parentId ?? null, code, shortCode })
      .returning({ id: lookupOptions.id, type: lookupOptions.type, label: lookupOptions.label, active: lookupOptions.active, sortOrder: lookupOptions.sortOrder, regionId: lookupOptions.regionId, parentId: lookupOptions.parentId, regionalChurchId: lookupOptions.regionalChurchId, code: lookupOptions.code, shortCode: lookupOptions.shortCode });
    cache.push(rows[0]!);
    return rows[0]!.id;
  } catch {
    const fresh = await db.select().from(lookupOptions)
      .where(and(eq(lookupOptions.type, type), eq(lookupOptions.label, label), eq(lookupOptions.regionId, regionId))).limit(1);
    if (fresh[0]) return fresh[0].id;
    throw new Error(`${renderMsg(msg("imp.cannotAddOption"), lang)}: ${label}`);
  }
}

membersRoutes.post("/import", requirePermission("members.import"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const userId = c.get("user").id;
  const lang = c.get("lang");
  const body = await c.req.parseBody();
  const action = s(body.action);
  const renderError = (msgRaw: string) =>
    c.html(<ImportPage user={c.get("user")} perms={c.get("perms")} report={null} error={renderMsg(msgRaw, lang)} lang={lang} />, 400);

  try {
    let csvText = "";
    if (action === "commit") {
      const b64 = s(body.csv_b64);
      if (!b64) throw new Error(msg("imp.noCsvData"));
      if (b64.length > 8_000_000) throw new Error(msg("imp.tooLarge"));
      csvText = b64decode(b64);
    } else {
      const file = body.file;
      if (!file || typeof file !== "object" || !("text" in file)) throw new Error(msg("imp.noFile"));
      const f = file as File;
      if (f.size > 4 * 1024 * 1024) throw new Error(msg("imp.fileTooBig"));
      csvText = await f.text();
    }

    const { report, validRows, pending } = await analyzeImport(db, csvText, scope, userId, lang);

    if (action === "commit") {
      const optionCache = await loadAllOptions(db);
      let inserted = 0;
      for (const row of validRows) {
        const data: Record<string, string | number | null> = { ...row.data };
        const rowRegion = Number(data.region_id ?? 0) || 0;

        // Township: keep the managed dropdown in sync and use its canonical label.
        let townshipOpt: OptionRow | null = null;
        if (data.township) {
          const rawTownship = String(data.township);
          const found = findOption(optionCache, "township", rawTownship, rowRegion);
          if (found) {
            townshipOpt = found;
            data.township = found.label;
          } else {
            const newId = await ensureOption(db, optionCache, "township", rawTownship, lang, rowRegion);
            townshipOpt = optionCache.find((o) => o.id === newId) ?? null;
          }
        }

        // Resolve/create options; Home Cells are parented to the row's Township.
        let homeCellId: number | null = null;
        for (const [field, val] of Object.entries(row.optionLabels)) {
          const type = IMPORT_OPTION_FIELDS[field];
          const col = type ? TYPE_TO_COLUMN[type] : undefined;
          if (!type || !col || type === "family_group") continue;
          if (val.startsWith("new:")) {
            const p = pending.get(val.slice(4));
            if (!p) continue;
            // Create the option in the member's state (0 when the row has no state).
            data[col] = await ensureOption(db, optionCache, p.type, p.label, lang, rowRegion, {
              parentId: p.type === "home_cell" ? townshipOpt?.id ?? null : null,
            });
          } else {
            data[col] = Number(val);
          }
          if (type === "home_cell") homeCellId = Number(data[col]) || null;
        }
        // Family Groups: parent = Home Cell, code numbered per Township (INS_FG001…).
        for (const [field, val] of Object.entries(row.optionLabels)) {
          if (IMPORT_OPTION_FIELDS[field] !== "family_group") continue;
          if (val.startsWith("new:")) {
            const p = pending.get(val.slice(4));
            if (!p) continue;
            data.family_group_id = await ensureOption(db, optionCache, "family_group", p.label, lang, rowRegion, {
              parentId: homeCellId, township: townshipOpt,
            });
          } else {
            data.family_group_id = Number(val);
          }
        }
        const importId = await insertMember(db, data, userId);

        // Attach to (or create) the household named in the CSV, in the member's state.
        if (row.household) {
          const rel = row.relationship || "other";
          const [existingFamily] = await db.all<{
            id: number; address: string | null; township: string | null; phone: string | null;
          }>(
            sql`SELECT id, address, township, phone FROM families WHERE region_id = ${rowRegion} AND LOWER(name) = LOWER(${row.household}) LIMIT 1`,
          );
          let familyId = existingFamily?.id;
          if (!familyId) {
            const createdFamily = await db.insert(families)
              .values({
                name: row.household, regionId: rowRegion, createdBy: userId,
                address: row.householdAddress, township: row.householdTownship, phone: row.householdPhone,
              })
              .returning({ id: families.id });
            familyId = createdFamily[0]!.id;
          } else {
            // Fill only blank details so a later import never overwrites edits.
            const patch: Partial<typeof families.$inferInsert> = {};
            if (!existingFamily.address && row.householdAddress) patch.address = row.householdAddress;
            if (!existingFamily.township && row.householdTownship) patch.township = row.householdTownship;
            if (!existingFamily.phone && row.householdPhone) patch.phone = row.householdPhone;
            if (Object.keys(patch).length > 0) {
              await db.update(families).set(patch).where(eq(families.id, familyId));
            }
          }
          await db.update(members).set({ householdId: familyId, relationship: rel }).where(eq(members.id, importId));
          if (rel === "head") {
            await db.update(families).set({ headMemberId: importId }).where(eq(families.id, familyId));
          }
        }

        await db.insert(memberHistory).values({
          memberId: importId, actorId: userId, action: "create",
          snapshotJson: JSON.stringify({
            source: "csv-import", ...data,
            household: row.household, relationship: row.relationship,
          }),
        });
        inserted++;
      }
      report.done = true;
      report.inserted = inserted;
      return c.html(<ImportPage user={c.get("user")} perms={c.get("perms")} report={report} error={null} lang={lang} />);
    }

    if (validRows.length > 0) report.csvB64 = b64encode(csvText);
    return c.html(<ImportPage user={c.get("user")} perms={c.get("perms")} report={report} error={null} lang={lang} />);
  } catch (e) {
    const msgRaw = e instanceof Error ? e.message : msg("imp.failed");
    return renderError(msgRaw);
  }
});

// ---------- detail loader + insert/update helpers ----------

async function loadMemberDetail(db: DB, id: number): Promise<(MemberDetail & { region_id: number }) | undefined> {
  const rows = await db.all(sql`
    SELECT m.*, m.family_id AS household_id, r.name AS state_name, r.name_en AS state_name_en,
      (m.photo IS NOT NULL) AS has_photo,
      e.label AS ethnicity, ed.label AS education, fg.label AS family_group,
      fg.code AS family_group_code,
      fc.label AS fellowship, sec.label AS sector, gr.label AS group_label, hc.label AS home_cell,
      hc.parent_id AS home_cell_township_id,
      hc.regional_church_id AS home_cell_regional_church_id,
      ht.label AS home_cell_township,
      cd.name AS department, m.department_id,
      (SELECT GROUP_CONCAT(position, ',') FROM member_positions WHERE member_id = m.id) AS positions,
      fam.name AS household_name
    FROM members m
    JOIN regions r ON r.id = m.region_id
    LEFT JOIN families fam ON fam.id = m.family_id
    LEFT JOIN lookup_options e ON e.id = m.ethnicity_id
    LEFT JOIN lookup_options ed ON ed.id = m.education_id
    LEFT JOIN lookup_options fg ON fg.id = m.family_group_id
    LEFT JOIN lookup_options fc ON fc.id = m.fellowship_category_id
    LEFT JOIN lookup_options sec ON sec.id = m.sector_id
    LEFT JOIN lookup_options gr ON gr.id = m.group_id
    LEFT JOIN lookup_options hc ON hc.id = m.home_cell_id
    LEFT JOIN lookup_options ht ON ht.id = hc.parent_id AND ht.type = 'township'
    LEFT JOIN church_departments cd ON cd.id = m.department_id
    WHERE m.id = ${id}`);
  return rows[0] as any;
}

function inScope(row: { region_id: number; home_cell_id?: number | null }, scope: Scope): boolean {
  if (!scope.scopeAll && !scope.stateIds.includes(row.region_id)) return false;
  if (scope.homeCellIds.length > 0) {
    return row.home_cell_id != null && scope.homeCellIds.includes(row.home_cell_id);
  }
  return true;
}

/** Client-side canvas output is small; keep a hard cap on what reaches D1. */
const MAX_PHOTO_BYTES = 400 * 1024;

type PhotoInput = { bytes: Uint8Array | null; touched: boolean; error: string | null };

/** Reads the hidden photo_data field produced by the browser resizer. */
function parsePhoto(body: Record<string, unknown>): PhotoInput {
  const remove = s(body.photo_remove) === "1";
  if (remove) return { bytes: null, touched: true, error: null };
  const raw = s(body.photo_data);
  if (!raw) return { bytes: null, touched: false, error: null };
  const match = /^data:image\/webp;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw);
  if (!match) return { bytes: null, touched: true, error: msg("photo.badType") };
  let bytes: Uint8Array;
  try {
    const bin = atob(match[1]!.replace(/\s+/g, ""));
    bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  } catch {
    return { bytes: null, touched: true, error: msg("photo.badType") };
  }
  if (bytes.length > MAX_PHOTO_BYTES) return { bytes: null, touched: true, error: msg("photo.tooLarge") };
  const webp = bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (!webp) return { bytes: null, touched: true, error: msg("photo.badType") };
  return { bytes, touched: true, error: null };
}

async function savePhoto(db: DB, id: number, bytes: Uint8Array | null): Promise<void> {
  // D1 binds ArrayBuffer for BLOB values (a bare Uint8Array is not portable).
  const value = bytes ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : null;
  await db.run(sql`UPDATE members SET photo = ${value} WHERE id = ${id}`);
}

const SNAKE_TO_CAMEL: Record<string, string> = {
  name_myanmar: "nameMyanmar", name_english: "nameEnglish", marital_status: "maritalStatus",
  date_of_birth: "dateOfBirth", blood_type: "bloodType", nrc_number: "nrcNumber",
  father_name: "fatherName", mother_name: "motherName", work_skills: "workSkills",
  salvation_date: "salvationDate", region_id: "regionId", ethnicity_id: "ethnicityId",
  education_id: "educationId", family_group_id: "familyGroupId",
  fellowship_category_id: "fellowshipCategoryId", sector_id: "sectorId", group_id: "groupId", home_cell_id: "homeCellId",
  department_id: "departmentId",
};

/** Drizzle keys by TS property names (camelCase); our form data uses DB column names. */
function toDrizzleValues(data: Record<string, string | number | null>): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(data)) out[SNAKE_TO_CAMEL[k] ?? k] = v;
  return out;
}

async function insertMember(db: DB, data: Record<string, string | number | null>, userId: number): Promise<number> {
  const created = await db
    .insert(members)
    .values({ ...toDrizzleValues(data), createdBy: userId, updatedBy: userId } as typeof members.$inferInsert)
    .returning({ id: members.id });
  const id = created[0]!.id;
  await db.update(members).set({ memberCode: `CH-${String(id).padStart(5, "0")}` }).where(eq(members.id, id));
  return id;
}

function rowToValues(row: MemberDetail): FormValues {
  const num = (v: number | null) => (v === null || v === undefined ? "" : String(v));
  return {
    name_myanmar: row.name_myanmar ?? "",
    name_english: row.name_english ?? "",
    gender: row.gender,
    marital_status: row.marital_status,
    date_of_birth: row.date_of_birth ?? "",
    blood_type: row.blood_type,
    phone: row.phone ?? "",
    nrc_number: row.nrc_number ?? "",
    languages: row.languages ?? "",
    address: row.address ?? "",
    township: row.township ?? "",
    father_name: row.father_name ?? "",
    mother_name: row.mother_name ?? "",
    job: row.job ?? "",
    work_skills: row.work_skills ?? "",
    income: row.income === null ? "" : String(row.income),
    salvation_date: row.salvation_date ?? "",
    status: row.status,
    notes: row.notes ?? "",
    region_id: num(row.region_id),
    ethnicity_id: num(row.ethnicity_id),
    education_id: num(row.education_id),
    family_group_id: num(row.family_group_id),
    fellowship_category_id: num(row.fellowship_category_id),
    sector_id: num(row.sector_id),
    group_id: num(row.group_id),
    home_cell_id: num(row.home_cell_id),
    department_id: num(row.department_id ?? null),
  };
}

// ---------- create ----------

// Option types rendered on the member form (Family + Church cards).
const FORM_OPTION_TYPES = ["ethnicity", "education", "family_group", "fellowship_category", "sector", "group", "home_cell", "township", "blood_type"];

function formOptions(all: OptionRow[], keep?: (o: OptionRow) => boolean) {
  return Object.fromEntries(
    FORM_OPTION_TYPES.map((t) => [t, all.filter((o) => o.type === t && (o.active === 1 || (keep?.(o) ?? false)))]),
  );
}

membersRoutes.get("/new", requirePermission("members.create"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const allRegions = await loadRegions(db);
  const options = await loadAllOptions(db);
  const departments = await loadDepartments(db, false);
  const modal = c.req.query("modal") === "1";
  const render = (status: 400 | 200) =>
    c.html(
      <MemberFormFragment
        user={c.get("user")} perms={c.get("perms")} values={defaultValues(scope, allRegions)}
        errors={[]} member={null} regions={scopedRegions(allRegions, scope, c.get("lang"))}
        options={formOptions(options)} departments={departments}
        lang={c.get("lang")} modal={modal}
      />,
      status,
    );
  if (modal) return render(200);
  return c.html(
    <MemberFormPage
      user={c.get("user")} perms={c.get("perms")} values={defaultValues(scope, allRegions)}
      errors={[]} member={null} regions={scopedRegions(allRegions, scope, c.get("lang"))}
      options={formOptions(options)} departments={departments}
      lang={c.get("lang")}
    />,
  );
});

membersRoutes.post("/", requirePermission("members.create"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const body = await c.req.parseBody();
  const fromModal = s(body.from_modal) === "1" || c.req.header("X-Requested-With") === "modal";
  const options = await loadAllOptions(db);
  const departments = await loadDepartments(db, false);
  const { values, errors, data } = readAndValidate(body, scope, options, departments);
  const photo = parsePhoto(body);
  if (photo.error) errors.push(photo.error);
  const allRegions = await loadRegions(db);
  const render = (status: 400 | 200) =>
    c.html(
      fromModal
        ? <MemberFormFragment
            user={c.get("user")} perms={c.get("perms")} values={values}
            errors={errors.map((e) => renderMsg(e, c.get("lang")))}
            member={null} regions={scopedRegions(allRegions, scope, c.get("lang"))}
            options={formOptions(options)} departments={departments}
            lang={c.get("lang")} modal
          />
        : <MemberFormPage
            user={c.get("user")} perms={c.get("perms")} values={values}
            errors={errors.map((e) => renderMsg(e, c.get("lang")))}
            member={null} regions={scopedRegions(allRegions, scope, c.get("lang"))}
            options={formOptions(options)} departments={departments}
            lang={c.get("lang")}
          />,
      status,
    );
  if (!data || photo.error) return render(400);
  const id = await insertMember(db, data, c.get("user").id);
  if (photo.touched) await savePhoto(db, id, photo.bytes);
  await db.insert(memberHistory).values({
    memberId: id, actorId: c.get("user").id, action: "create",
    snapshotJson: JSON.stringify(data),
  });
  if (fromModal) return c.redirect(`/members/${id}?ok=member-created`, 303);
  return c.redirect(`/members/${id}?ok=member-created`, 302);
});

// ---------- detail / edit / update / delete ----------

membersRoutes.get("/:id", requirePermission("members.view"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  const notFound = () => c.redirect("/members?err=err-notfound", 302);
  if (!Number.isInteger(id) || id < 1) return notFound();
  const row = await loadMemberDetail(db, id);
  if (!row || !inScope(row, scope)) return notFound();
  const historyRows = await db.all<{ id: number; action: string; created_at: number; actor_name: string }>(sql`
    SELECT h.id, h.action, h.created_at, u.username AS actor_name
    FROM member_history h JOIN users u ON u.id = h.actor_id
    WHERE h.member_id = ${id}
    ORDER BY h.created_at DESC, h.id DESC
    LIMIT 100`);
  return c.html(
    <MemberDetailPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))} m={row}
      history={historyRows as any} positionDefs={await loadPositionDefs(db)} lang={c.get("lang")}
    />,
  );
});

// ---------- Service position assignment (list modal) ----------

type PositionMemberState = {
  id: number;
  name: string;
  homeCell: string | null;
  homeCellId: number | null;
  townshipId: number | null;
  townshipName: string | null;
  regionalChurchId: number | null;
  departmentId: number | null;
  regionName: string;
};

async function positionFormState(db: DB, memberId: number, row: MemberDetail & { region_id: number }) {
  const current = await getMemberPositions(db, memberId);
  const home = current.find((p) => p.scopeType === "home_cell");
  const department = current.find((p) => p.scopeType === "department");
  const church = current.find((p) => p.scopeType === "church");
  const regional = current.find((p) => p.scopeType === "region");
  const township = current.find((p) => p.scopeType === "township");
  const cluster = current.find((p) => p.scopeType === "cluster");
  const townshipId = row.home_cell_township_id ?? null;
  return {
    member: {
      id: memberId,
      name: "",
      homeCell: row.home_cell,
      homeCellId: row.home_cell_id,
      townshipId,
      townshipName: row.home_cell_township ?? null,
      regionalChurchId: row.home_cell_regional_church_id ?? null,
      departmentId: row.department_id ?? null,
      regionName: row.state_name,
    } as PositionMemberState,
    assignments: {
      homeCell: home?.position ?? "",
      department: department?.position ?? "",
      departmentId: department?.departmentId ?? null,
      memberDepartmentId: row.department_id ?? null,
      church: church?.position ?? "",
      churchId: church?.regionalChurchId ?? row.home_cell_regional_church_id ?? null,
      region: regional?.position ?? "",
      regionId: regional?.regionId ?? row.region_id,
      township: township?.position ?? "",
      cluster: cluster?.position ?? "",
      clusterId: cluster?.supervisionClusterId ?? null,
    },
    departments: await loadDepartments(db),
    defs: await loadPositionDefs(db),
    regionalChurches: await loadRegionalChurches(db, {
      regionId: row.region_id, activeOnly: true,
    }),
    clusters: await loadSupervisionClusters(db, {
      regionId: row.region_id, activeOnly: true,
    }),
  };
}

membersRoutes.get("/:id/position", requirePermission("members.update"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/members?err=err-notfound", 302);
  const row = await loadMemberDetail(db, id);
  if (!row || !inScope(row, scope)) return c.redirect("/members?err=err-notfound", 302);
  const state = await positionFormState(db, id, row);
  const member = { ...state.member, name: row.name_myanmar || row.name_english || `#${id}` };
  const formProps = {
    member, assignments: state.assignments, departments: state.departments,
    positionDefs: state.defs, regionalChurches: state.regionalChurches, clusters: state.clusters,
    canManageDepartments: c.get("perms").has("options.manage") && scope.scopeAll,
    canManagePositions: c.get("perms").has("options.manage") && scope.scopeAll,
    canManageRegional: c.get("perms").has("options.manage"), lang: c.get("lang"),
  };
  if (c.req.query("modal") !== "1") {
    return c.html(
      <MemberPositionPage
        user={c.get("user")} perms={c.get("perms")}
        {...formProps}
      />,
    );
  }
  return c.html(<MemberPositionForm {...formProps} />);
});

membersRoutes.post("/:id/position", requirePermission("members.update"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  const back = (url: string) => {
    c.header("X-Redirect-To", url);
    return c.redirect(url, 303);
  };
  if (!Number.isInteger(id) || id < 1) return back("/members?err=err-notfound");
  const row = await loadMemberDetail(db, id);
  if (!row || !inScope(row, scope)) return back("/members?err=err-notfound");
  const body = await c.req.parseBody();
  const t = getDict(c.get("lang"));
  const departments = await loadDepartments(db);
  const defs = await loadPositionDefs(db);
  const regionalChurches = await loadRegionalChurches(db, { regionId: row.region_id, activeOnly: true });
  const clusters = await loadSupervisionClusters(db, { regionId: row.region_id, activeOnly: true });
  const homePosition = s(body.home_cell_position) || s(body.position);
  const townshipPosition = s(body.township_position);
  const clusterPosition = s(body.cluster_position);
  const clusterRaw = s(body.supervision_cluster_id);
  const clusterId = clusterRaw && /^\d+$/.test(clusterRaw) ? Number(clusterRaw) : null;
  const regionPosition = s(body.region_position);
  const departmentPosition = s(body.department_position);
  const churchPosition = s(body.church_position);
  const churchRaw = s(body.church_id);
  const churchId = churchRaw && /^\d+$/.test(churchRaw) ? Number(churchRaw) : null;
  const departmentRaw = s(body.department_id);
  const departmentId = departmentRaw && /^\d+$/.test(departmentRaw) ? Number(departmentRaw) : null;
  const memberDepartmentRaw = s(body.department_member_id);
  const memberDepartmentId = memberDepartmentRaw && /^\d+$/.test(memberDepartmentRaw) ? Number(memberDepartmentRaw) : null;
  const state = {
    homeCell: homePosition,
    township: townshipPosition,
    cluster: clusterPosition,
    clusterId: clusterId ?? null,
    region: regionPosition,
    regionId: row.region_id,
    department: departmentPosition,
    departmentId: departmentId ?? null,
    memberDepartmentId,
    church: churchPosition,
    churchId: churchId ?? row.home_cell_regional_church_id ?? null,
  };
  const memberState = {
    id, name: row.name_myanmar || row.name_english || `#${id}`,
    homeCell: row.home_cell, homeCellId: row.home_cell_id,
    townshipId: row.home_cell_township_id ?? null,
    townshipName: row.home_cell_township ?? null,
    regionalChurchId: row.home_cell_regional_church_id ?? null,
    departmentId: row.department_id ?? null,
    regionName: row.state_name,
  };
  const renderError = (message: string) => c.html(
    <MemberPositionForm
      member={memberState}
      assignments={state} departments={departments}
      positionDefs={defs} regionalChurches={regionalChurches} clusters={clusters}
      canManageDepartments={c.get("perms").has("options.manage") && scope.scopeAll}
      canManagePositions={c.get("perms").has("options.manage") && scope.scopeAll}
      canManageRegional={c.get("perms").has("options.manage")}
      error={message} lang={c.get("lang")}
    />,
    400,
  );

  const validFor = (code: string, scope: Parameters<typeof isDefinedForScope>[2]) =>
    isDefinedForScope(defs, code, scope) || isPositionForScope(code, scope as any);

  if (homePosition && !validFor(homePosition, "home_cell")) {
    return renderError(t("flash.positionInvalid"));
  }
  if (homePosition && !row.home_cell_id) return renderError(t("flash.positionNoHomeCell"));
  if (townshipPosition) {
    if (!validFor(townshipPosition, "township")) return renderError(t("flash.positionInvalid"));
    if (!row.home_cell_township_id) return renderError(t("flash.positionNoHomeCell"));
  }
  if (clusterPosition) {
    if (!validFor(clusterPosition, "cluster")) return renderError(t("flash.positionInvalid"));
    if (!clusterId || !clusters.some((cluster) => cluster.id === clusterId)) {
      return renderError(t("flash.positionClusterRequired"));
    }
  }
  const regionDef = regionPosition
    ? defs.find((d) => d.scopeType === "region" && d.code === regionPosition && d.active === 1)
    : undefined;
  if (regionPosition) {
    if (!regionDef || isPastorPositionCode(regionDef.code)) return renderError(t("flash.positionInvalid"));
  }
  if (departmentPosition && !validFor(departmentPosition, "department")) {
    return renderError(t("flash.positionInvalid"));
  }
  if (departmentPosition && (!departmentId || !departments.some((d) => d.id === departmentId))) {
    return renderError(t("flash.departmentRequired"));
  }
  if (memberDepartmentRaw && (!memberDepartmentId || !departments.some((d) => d.id === memberDepartmentId))) {
    return renderError(t("flash.departmentRequired"));
  }
  if (churchPosition && !validFor(churchPosition, "church")) {
    return renderError(t("flash.positionInvalid"));
  }
  if (churchPosition && (!churchId || !regionalChurches.some((r) => r.id === churchId))) {
    return renderError(t("flash.positionChurchRequired"));
  }

  const assignments: PositionAssignment[] = [];
  if (homePosition && row.home_cell_id) {
    if (await positionTaken(db, "home_cell", homePosition, { homeCellId: row.home_cell_id, exceptMemberId: id })) {
      return renderError(t("flash.positionTaken"));
    }
    assignments.push({ scopeType: "home_cell", position: homePosition, homeCellId: row.home_cell_id });
  }
  if (townshipPosition && row.home_cell_township_id) {
    if (await positionTaken(db, "township", townshipPosition, { homeCellId: row.home_cell_township_id, exceptMemberId: id })) {
      return renderError(t("flash.positionTaken"));
    }
    assignments.push({ scopeType: "township", position: townshipPosition, homeCellId: row.home_cell_township_id });
  }
  if (clusterPosition && clusterId) {
    if (await positionTaken(db, "cluster", clusterPosition, { supervisionClusterId: clusterId, exceptMemberId: id })) {
      return renderError(t("flash.positionTaken"));
    }
    assignments.push({ scopeType: "cluster", position: clusterPosition, supervisionClusterId: clusterId });
  }
  if (regionPosition && regionDef) {
    if (await positionTaken(db, "region", regionPosition, {
      regionId: row.region_id, exceptMemberId: id, allowMultiple: regionDef.allowMultiple === 1,
    })) {
      return renderError(t("flash.positionTaken"));
    }
    assignments.push({
      scopeType: "region", position: regionPosition, regionId: row.region_id,
      slotUnique: regionDef.allowMultiple === 1 ? 0 : 1,
    });
  }
  if (departmentPosition && departmentId) {
    if (await positionTaken(db, "department", departmentPosition, { departmentId, exceptMemberId: id })) {
      return renderError(t("flash.positionTaken"));
    }
    assignments.push({ scopeType: "department", position: departmentPosition, departmentId });
  }
  if (churchPosition && churchId) {
    if (await positionTaken(db, "church", churchPosition, { regionalChurchId: churchId, exceptMemberId: id })) {
      return renderError(t("flash.positionTaken"));
    }
    assignments.push({ scopeType: "church", position: churchPosition, regionalChurchId: churchId });
  }

  // Department membership is independent from the department role: a member
  // can belong to a department without holding one of its leadership roles.
  // Choosing a role also keeps the member attached to that department.
  const effectiveDepartmentId = departmentPosition && departmentId ? departmentId : memberDepartmentId;
  const previous = await getMemberPositions(db, id);
  try {
    await setMemberPositions(db, id, assignments, c.get("user").id);
    if ((row.department_id ?? null) !== effectiveDepartmentId) {
      await db.update(members).set({
        departmentId: effectiveDepartmentId,
        updatedAt: Math.floor(Date.now() / 1000),
        updatedBy: c.get("user").id,
      }).where(eq(members.id, id));
    }
  } catch {
    return renderError(t("flash.positionTaken"));
  }
  await db.insert(memberHistory).values({
    memberId: id, actorId: c.get("user").id, action: "position",
    snapshotJson: JSON.stringify({ assignments, home_cell_id: row.home_cell_id, department_id: effectiveDepartmentId }),
  });

  // Record who changed which roles, with the previous assignments for the audit trail.
  const roleLabel = (code: string, scopeType: string) => {
    const def = defs.find((d) => d.code === code && d.scopeType === scopeType);
    return def ? positionDefLabel(def, c.get("lang")) : positionLabel(code, c.get("lang"));
  };
  const describe = (a: PositionAssignment) => {
    switch (a.scopeType) {
      case "home_cell": return `${roleLabel(a.position, "home_cell")} · ${row.home_cell ?? ""}`;
      case "township": return `${roleLabel(a.position, "township")} · ${row.home_cell_township ?? ""}`;
      case "cluster": {
        const cluster = clusters.find((r) => r.id === a.supervisionClusterId);
        return `${roleLabel(a.position, "cluster")} · ${cluster?.nameEn || cluster?.name || ""}`;
      }
      case "region": return `${roleLabel(a.position, "region")} · ${row.state_name}`;
      case "department": {
        const department = departments.find((d) => d.id === a.departmentId);
        return `${roleLabel(a.position, "department")} · ${department?.name ?? ""}`;
      }
      case "church": {
        const church = regionalChurches.find((r) => r.id === a.regionalChurchId);
        return `${roleLabel(a.position, "church")} · ${church?.nameEn || church?.name || ""}`;
      }
      default: return roleLabel(a.position, "church");
    }
  };
  const keyOf = (p: { scopeType: string; position: string }) => `${p.scopeType}:${p.position}`;
  const beforeKeys = previous.map(keyOf).sort().join("|");
  const afterKeys = assignments.map(keyOf).sort().join("|");
  if (beforeKeys !== afterKeys) {
    await recordPositionHistory(db, {
      entity: "assignment", action: "assigned", actorId: c.get("user").id,
      scopeType: assignments.length === 1 ? assignments[0]!.scopeType : null,
      memberId: id,
      summary: assignments.length > 0 ? assignments.map(describe).join("; ") : null,
      changes: [{
        field: "assignment",
        from: previous.map((p) => p.position).join(", ") || null,
        to: assignments.map((a) => a.position).join(", ") || null,
      }],
    });
  }
  return back("/members?ok=member-position");
});

membersRoutes.get("/:id/photo", requirePermission("members.view"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.notFound();
  const rows = await db.all<{ photo: ArrayBuffer | number[] | null; region_id: number; updated_at: number }>(sql`
    SELECT photo, region_id, updated_at FROM members WHERE id = ${id}`);
  const row = rows[0];
  if (!row?.photo || !inScope(row, scope)) return c.notFound();
  // D1 returns BLOBs as byte arrays through the driver; wrap them for Response.
  const photo = Array.isArray(row.photo) ? Uint8Array.from(row.photo) : new Uint8Array(row.photo);
  const etag = `W/"member-${id}-${row.updated_at}-${photo.byteLength}"`;
  const headers: Record<string, string> = {
    "Content-Type": "image/webp",
    "Content-Length": String(photo.byteLength),
    "Cache-Control": "private, no-cache",
    "ETag": etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (c.req.header("If-None-Match") === etag) return new Response(null, { status: 304, headers });
  return new Response(photo, { headers });
});

membersRoutes.get("/:id/edit", requirePermission("members.update"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/members?err=err-notfound", 302);
  const row = await loadMemberDetail(db, id);
  if (!row || !inScope(row, scope)) return c.redirect("/members?err=err-notfound", 302);
  const allRegions = await loadRegions(db);
  const options = await loadAllOptions(db);
  const departments = await loadDepartments(db, false);
  const formProps = {
    user: c.get("user"), perms: c.get("perms"), values: rowToValues(row), errors: [] as string[],
    member: {
      id,
      photoUrl: row.has_photo ? `/members/${id}/photo?v=${row.updated_at}` : undefined,
    },
    regions: scopedRegions(allRegions, scope, c.get("lang")),
    options: formOptions(options, (o) => o.type === "township" ? o.label === row.township : o.id === (row as any)[`${o.type}_id`]),
    departments,
    lang: c.get("lang"),
  };
  if (c.req.query("modal") === "1") return c.html(<MemberFormFragment {...formProps} modal />);
  return c.html(<MemberFormPage {...formProps} />);
});

membersRoutes.post("/bulk", requirePermission("members.update"), async (c) => {
  try {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const body = await c.req.parseBody({ all: true });
  const action = s(body.bulk_action);
  const groupId = intParam(s(body.group_id) || undefined);
  const departmentId = intParam(s(body.department_id) || undefined);
  const ids = ([] as number[]).concat(...(multi(body.ids).map((v) => ints([v]))));
  if (!ids.length) return c.redirect("/members?err=" + encodeURIComponent("bulk.noSelection"), 302);
  if (!action && !groupId && !departmentId) return c.redirect("/members?err=" + encodeURIComponent("bulk.noAction"), 302);
  if (departmentId) {
    const departments = await loadDepartments(db);
    if (!departments.some((d) => d.id === departmentId)) {
      return c.redirect("/members?err=" + encodeURIComponent("bulk.badDepartment"), 302);
    }
  }
  if (groupId) {
    // The id must be a managed Group option, not any other option's id.
    const allOptions = await loadAllOptions(db);
    if (!allOptions.some((o) => o.id === groupId && o.type === "group")) {
      return c.redirect("/members?err=" + encodeURIComponent("bulk.badGroup"), 302);
    }
  }
  const canDeleteRows = c.get("perms").has("members.delete");

  // Restrict to rows visible inside the caller's state scope.
  const owned = await db.all<{ id: number }>(sql`SELECT id FROM members m WHERE ${scopeCond(scope)} AND m.id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  const allowed = owned.map((r) => r.id);
  if (!allowed.length) return c.redirect("/members?err=" + encodeURIComponent("bulk.noSelection"), 302);

  const actorId = c.get("user").id;
  const now = Math.floor(Date.now() / 1000);
  let flash = "bulk.done";
  if (action === "delete" && canDeleteRows) {
    await db.delete(members).where(inArray(members.id, allowed));
    for (const mid of allowed) {
      await db.insert(memberHistory).values({
        memberId: mid, actorId, action: "bulk_delete", snapshotJson: JSON.stringify({ id: mid, bulk: true }),
      });
    }
    flash = "bulk.deleted";
  } else {
    const set: Record<string, unknown> = { updatedBy: actorId, updatedAt: now };
    if (action === "status_active") set.status = "active";
    if (action === "status_inactive") set.status = "inactive";
    if (groupId) set.groupId = groupId;
    if (departmentId) set.departmentId = departmentId;
    if (Object.keys(set).length > 2) {
      await db.update(members).set(set as any).where(inArray(members.id, allowed));
      // bulk_group is the generic label for bulk assignment (group or department).
      const historyAction = !action && (groupId || departmentId) ? "bulk_group" : "bulk_status";
      for (const mid of allowed) {
        await db.insert(memberHistory).values({
          memberId: mid, actorId, action: historyAction,
          snapshotJson: JSON.stringify({ id: mid, status: set.status ?? null, groupId: groupId ?? null, departmentId: departmentId ?? null, bulk: true }),
        });
      }
      flash = "bulk.updated";
    }
  }
  return c.redirect(`/members?ok=${encodeURIComponent(flash)}`, 302);
  } catch (e: any) {
    const msg = String(e?.message ?? e ?? "unknown");
    return c.redirect("/members?err=" + encodeURIComponent("bulk.failed: " + msg.slice(0, 120)), 302);
  }
});

membersRoutes.post("/:id", requirePermission("members.update"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/members?err=err-notfound", 302);
  const existing = await loadMemberDetail(db, id);
  if (!existing || !inScope(existing, scope)) return c.redirect("/members?err=err-notfound", 302);

  const body = await c.req.parseBody();
  const fromModal = s(body.from_modal) === "1";
  const options = await loadAllOptions(db);
  const departments = await loadDepartments(db, false);
  const { values, errors, data } = readAndValidate(body, scope, options, departments);
  const photo = parsePhoto(body);
  if (photo.error) errors.push(photo.error);
  const allRegions = await loadRegions(db);
  if (!data || photo.error) {
    const formProps = {
      user: c.get("user"), perms: c.get("perms"), values,
      errors: errors.map((e) => renderMsg(e, c.get("lang"))),
      member: {
        id,
        photoUrl: existing.has_photo ? `/members/${id}/photo?v=${existing.updated_at}` : undefined,
      },
      regions: scopedRegions(allRegions, scope, c.get("lang")),
      options: formOptions(options, (o) => o.type === "township" ? o.label === existing.township : o.id === (existing as any)[`${o.type}_id`]),
      departments,
      lang: c.get("lang"),
    };
    if (fromModal) return c.html(<MemberFormFragment {...formProps} modal />, 400);
    return c.html(<MemberFormPage {...formProps} />, 400);
  }
  await db
    .update(members)
    .set({ ...toDrizzleValues(data), updatedBy: c.get("user").id, updatedAt: Math.floor(Date.now() / 1000) } as typeof members.$inferInsert)
    .where(eq(members.id, id));
  // Roles were granted inside one state, so they cannot follow a member to
  // another state: drop the ones still tied to the state they left behind.
  if ((existing.region_id ?? null) !== (data.region_id ?? null)) {
    await db.run(sql`
      DELETE FROM member_positions
       WHERE member_id = ${id}
         AND (
           (scope_type = 'region' AND region_id = ${existing.region_id})
           OR (scope_type = 'cluster' AND supervision_cluster_id IN (
                SELECT id FROM supervision_clusters WHERE region_id = ${existing.region_id}))
           OR (scope_type = 'church' AND regional_church_id IN (
                SELECT id FROM regional_churches WHERE region_id = ${existing.region_id}))
           OR (scope_type IN ('home_cell', 'township') AND scope_id IN (
                SELECT id FROM lookup_options
                 WHERE type IN ('home_cell', 'township') AND region_id = ${existing.region_id}))
         )`);
  }
  // A leadership row is tied to the member's current Home Cell. Moving the
  // member to another cell must not leave a leader assigned to the old cell.
  if ((existing.home_cell_id ?? null) !== (data.home_cell_id ?? null)) {
    await setHomeCellPosition(db, id, "", null, c.get("user").id);
  }
  if (photo.touched) await savePhoto(db, id, photo.bytes);
  await db.insert(memberHistory).values({
    memberId: id, actorId: c.get("user").id, action: "update",
    snapshotJson: JSON.stringify(data),
  });
  if (fromModal) return c.redirect("/members?ok=member-updated", 303);
  return c.redirect(`/members/${id}?ok=member-updated`, 302);
});

// ---------- bulk actions on selected members ----------

membersRoutes.post("/:id/delete", requirePermission("members.delete"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/members?err=err-notfound", 302);
  const existing = await loadMemberDetail(db, id);
  if (!existing || !inScope(existing, scope)) return c.redirect("/members?err=err-notfound", 302);
  await db.delete(members).where(eq(members.id, id));
  await db.insert(memberHistory).values({
    memberId: id, actorId: c.get("user").id, action: "delete",
    snapshotJson: JSON.stringify({ id, name_english: existing.name_english, name_myanmar: existing.name_myanmar }),
  });
  return c.redirect("/members?ok=member-deleted", 302);
});
