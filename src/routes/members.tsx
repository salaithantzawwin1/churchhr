import { Hono } from "hono";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppEnv } from "../env";
import { getDb, type DB } from "../db/client";
import { lookupOptions, members, regions } from "../db/schema";
import { requirePermission } from "../middleware";
import { flashFromQuery } from "../flash";
import { findOption, loadAllOptions, optionsOfType, type OptionRow } from "../lookup";
import { buildCsv, headerIndex, parseCsv } from "../csv";
import {
  asInt, ageFromDate, b64decode, b64encode, intParam, normKey,
  parseDateFlexible, s,
} from "../util";
import { BLOOD_TYPES, GENDERS, MARITAL_STATUSES, STATUSES, normEnum } from "../enums";
import { getDict } from "../i18n";
import {
  ImportPage, MemberDetailPage, MemberFormFragment, MemberFormPage, MembersListPage,
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
  "val.income": "val.income",
  "val.option": "val.option",
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
};

/** Marks a message as a translate-at-render key (called from sync validators). */
function msg(key: string): string {
  return validMsgKeys[key] ? `@${key}` : key;
}

/** Renders a message produced by validators/import: @key -> dictionary, else literal. */
function renderMsg(raw: string, lang: "mm" | "en"): string {
  if (!raw.startsWith("@")) return raw;
  const t = getDict(lang);
  const key = validMsgKeys[raw.slice(1)];
  return key ? t(key) : raw.slice(1);
}

type Scope = { scopeAll: boolean; stateIds: number[] };
type Region = { id: number; name: string; nameEn: string; slug: string };

function scopeOf(c: { get: (k: "scopeAll" | "stateIds") => any }): Scope {
  return { scopeAll: c.get("scopeAll"), stateIds: c.get("stateIds") };
}

/** SQL fragment: restrict rows to assigned states (all-state users see everything). */
function scopeCond(scope: Scope) {
  if (scope.scopeAll) return sql`1=1`;
  if (scope.stateIds.length === 0) return sql`1=0`;
  // unqualified: raw queries alias members as "m", so "members"."region_id" would fail
  return sql`region_id IN (${sql.join(scope.stateIds.map((id) => sql`${id}`))})`;
}

function parseFilters(q: Record<string, string | undefined>): Filters {
  return {
    q: (q.q ?? "").trim().slice(0, 100),
    state: intParam(q.state),
    gender: q.gender && q.gender in GENDERS ? q.gender : "",
    status: q.status && q.status in STATUSES ? q.status : "",
    homeCell: intParam(q.home_cell),
    group: intParam(q.group),
    fellowship: intParam(q.fellowship),
  };
}

function listCond(scope: Scope, f: Filters) {
  let cond = scopeCond(scope);
  if (f.state) cond = sql`${cond} AND m.region_id = ${f.state}`;
  if (f.q) {
    const like = `%${f.q}%`;
    cond = sql`${cond} AND (m.name_myanmar LIKE ${like} OR m.name_english LIKE ${like} OR m.phone LIKE ${like} OR m.nrc_number LIKE ${like} OR m.member_code LIKE ${like} OR CAST(m.id AS TEXT) LIKE ${like})`;
  }
  if (f.gender) cond = sql`${cond} AND m.gender = ${f.gender}`;
  if (f.status) cond = sql`${cond} AND m.status = ${f.status}`;
  if (f.homeCell) cond = sql`${cond} AND m.home_cell_id = ${f.homeCell}`;
  if (f.group) cond = sql`${cond} AND m.group_id = ${f.group}`;
  if (f.fellowship) cond = sql`${cond} AND m.fellowship_category_id = ${f.fellowship}`;
  return cond;
}

async function loadRegions(db: DB): Promise<Region[]> {
  return (await db
    .select({ id: regions.id, name: regions.name, nameEn: regions.nameEn, slug: regions.slug })
    .from(regions)
    .orderBy(regions.id)) as Region[];
}

function scopedRegions(all: Region[], scope: Scope, lang: "mm" | "en"): { id: number; name: string }[] {
  return all
    .filter((r) => scope.scopeAll || scope.stateIds.includes(r.id))
    .map((r) => ({ id: r.id, name: lang === "en" && r.nameEn ? r.nameEn : r.name }));
}

// ---------- GET /members (list + search + filter + pagination) ----------

membersRoutes.get("/", requirePermission("members.view"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const f = parseFilters(c.req.query());
  const page = Math.max(1, intParam(c.req.query("page")) ?? 1);
  const cond = listCond(scope, f);

  const countRows = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM members m WHERE ${cond}`);
  const total = countRows[0]?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const currentPage = Math.min(page, pages);
  const offset = (currentPage - 1) * PER_PAGE;

  const rows = await db.all(sql`
    SELECT m.id, m.member_code, m.name_myanmar, m.name_english, m.gender, m.phone, m.status,
           r.name AS state_name, r.name_en AS state_name_en, hc.label AS home_cell, gr.label AS group_label
    FROM members m
    JOIN regions r ON r.id = m.region_id
    LEFT JOIN lookup_options hc ON hc.id = m.home_cell_id
    LEFT JOIN lookup_options gr ON gr.id = m.group_id
    WHERE ${cond}
    ORDER BY m.id DESC
    LIMIT ${PER_PAGE} OFFSET ${offset}`);

  const allRegions = await loadRegions(db);
  const allOptions = await loadAllOptions(db);
  return c.html(
    <MembersListPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))}
      rows={rows as any} total={total} page={currentPage} pages={pages} filters={f}
      regions={scopedRegions(allRegions, scope, c.get("lang"))}
      homeCells={optionsOfType(allOptions, "home_cell")}
      groups={optionsOfType(allOptions, "group")}
      fellowships={optionsOfType(allOptions, "fellowship_category")}
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
  group_id: "group",
  home_cell_id: "home_cell",
};

const FORM_KEYS = [
  "name_myanmar", "name_english", "gender", "marital_status", "date_of_birth", "blood_type",
  "phone", "nrc_number", "languages", "address", "father_name", "mother_name",
  "family_group_id", "ethnicity_id", "education_id", "job", "work_skills", "income",
  "region_id", "township", "home_cell_id", "group_id", "fellowship_category_id",
  "salvation_date", "status", "notes",
] as const;

type Validated = { values: FormValues; errors: string[]; data: Record<string, string | number | null> | null };

function readAndValidate(body: Record<string, unknown>, scope: Scope, options: OptionRow[]): Validated {
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
  if (v.blood_type && !BLOOD_TYPES.includes(v.blood_type)) errors.push(msg("val.blood"));

  let dob: string | null = "";
  if (v.date_of_birth) {
    dob = parseDateFlexible(v.date_of_birth);
    if (dob === null) errors.push(msg("val.dob"));
  }
  let salvation: string | null = "";
  if (v.salvation_date) {
    salvation = parseDateFlexible(v.salvation_date);
    if (salvation === null) errors.push(msg("val.salvation"));
  }

  let income: number | null = null;
  if (v.income) {
    const digits = v.income.replace(/[,\s]/g, "");
    if (/^\d+$/.test(digits)) income = Number(digits);
    else errors.push(msg("val.income"));
  }

  const status = v.status && v.status in STATUSES ? v.status : "active";

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
  "Family Group", "Fellowship Categories", "Group", "Home Cell", "Township", "State", "Status",
];

membersRoutes.get("/export", requirePermission("members.export"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const f = parseFilters(c.req.query());
  const cond = listCond(scope, f);
  const rows = await db.all(sql`
    SELECT m.*, r.name AS state_name,
      e.label AS ethnicity, ed.label AS education, fg.label AS family_group,
      fc.label AS fellowship, gr.label AS group_label, hc.label AS home_cell
    FROM members m
    JOIN regions r ON r.id = m.region_id
    LEFT JOIN lookup_options e ON e.id = m.ethnicity_id
    LEFT JOIN lookup_options ed ON ed.id = m.education_id
    LEFT JOIN lookup_options fg ON fg.id = m.family_group_id
    LEFT JOIN lookup_options fc ON fc.id = m.fellowship_category_id
    LEFT JOIN lookup_options gr ON gr.id = m.group_id
    LEFT JOIN lookup_options hc ON hc.id = m.home_cell_id
    WHERE ${cond}
    ORDER BY m.id ASC`);
  const body = rows.map((r: any) => [
    r.member_code, r.name_english, r.name_myanmar,
    r.gender ? GENDERS[r.gender]?.split(" (")[0] ?? r.gender : "",
    r.marital_status ? MARITAL_STATUSES[r.marital_status]?.split(" (")[0] ?? r.marital_status : "",
    r.date_of_birth ?? "", ageFromDate(r.date_of_birth) ?? "", r.blood_type,
    r.phone, r.nrc_number, r.ethnicity, r.languages, r.education, r.job, r.work_skills,
    r.income, r.address, r.father_name, r.mother_name, r.salvation_date,
    r.family_group, r.fellowship, r.group_label, r.home_cell, r.township, r.state_name,
    r.status ? STATUSES[r.status]?.split(" (")[0] ?? r.status : "",
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
    "ဦးအောင်", "ဒေါ်ခင်", "2010-01-05", "Family A", "Youth", "Group 1", "Cell 1",
    "အင်းစိန်မြို့နယ်", "ရန်ကုန်တိုင်း", "active",
  ];
  const csv = "\uFEFF" + buildCsv([EXPORT_HEADER, sample]);
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
  "group": "group",
  "home cell": "home_cell",
  "state": "state", "region": "state",
  "township": "township", "township (မြို့နယ်)": "township",
  "status": "status",
  "notes": "notes", "note": "notes",
};

const IMPORT_OPTION_FIELDS: Record<string, string> = {
  ethnicity: "ethnicity",
  education: "education",
  family_group: "family_group",
  fellowship: "fellowship_category",
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
};

type AnalyzeResult = { report: ImportReport; validRows: ImportRow[]; pending: Map<string, { type: string; label: string }> };

async function analyzeImport(db: DB, csvText: string, scope: Scope, userId: number): Promise<AnalyzeResult> {
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
  const validRows: ImportRow[] = [];
  const pending = new Map<string, { type: string; label: string }>();

  for (let i = 1; i < grid.length; i++) {
    const row = grid[i]!;
    const line = i + 1;
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
      if (!BLOOD_TYPES.includes(blood)) rowErrors.push(`${msg("imp.badBlood")}: ${blood}`);
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
    }
    const salRaw = rec("salvation");
    let salvation: string | null = null;
    if (salRaw) {
      salvation = parseDateFlexible(salRaw);
      if (salvation === null) rowErrors.push(`${msg("imp.badSalvation")}: ${salRaw}`);
    }

    const incomeRaw = rec("income").replace(/[,\s]/g, "");
    let income: number | null = null;
    if (incomeRaw) {
      if (/^\d+$/.test(incomeRaw)) income = Number(incomeRaw);
      else rowErrors.push(`${msg("imp.badIncome")}: ${rec("income")}`);
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
      if (errors.length < 50) errors.push({ line, msg: rowErrors.join("; ") });
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
        township: rec("township") || null,
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
      total: grid.length - 1,
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
  group: "group_id",
  home_cell: "home_cell_id",
};

/** Find or create an import option. Rows without a state fall back to the
 * all-states (regionId 0) option; rows with a state resolve/create region-scoped. */
async function ensureOption(
  db: DB, cache: OptionRow[], type: string, label: string, lang: "mm" | "en", regionId = 0,
): Promise<number> {
  const hit = findOption(cache, type, label, regionId);
  if (hit) return hit.id;
  try {
    const rows = await db
      .insert(lookupOptions)
      .values({ type, label, regionId })
      .returning({ id: lookupOptions.id, type: lookupOptions.type, label: lookupOptions.label, active: lookupOptions.active, sortOrder: lookupOptions.sortOrder, regionId: lookupOptions.regionId, parentId: lookupOptions.parentId });
    cache.push(rows[0]!);
    return rows[0]!.id;
  } catch {
    const fresh = await db.select().from(lookupOptions)
      .where(and(eq(lookupOptions.type, type), eq(lookupOptions.label, label))).limit(1);
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

    const { report, validRows, pending } = await analyzeImport(db, csvText, scope, userId);

    if (action === "commit") {
      const optionCache = await loadAllOptions(db);
      let inserted = 0;
      for (const row of validRows) {
        const data: Record<string, string | number | null> = { ...row.data };
        for (const [field, val] of Object.entries(row.optionLabels)) {
          const type = IMPORT_OPTION_FIELDS[field];
          if (!type) continue;
          const col = TYPE_TO_COLUMN[type];
          if (!col) continue;
          if (val.startsWith("new:")) {
            const p = pending.get(val.slice(4));
            if (p) {
              // Create the option in the member's state (0 when the row has no state).
              const rowRegion = Number(data.region_id ?? 0) || 0;
              data[col] = await ensureOption(db, optionCache, p.type, p.label, lang, rowRegion);
            }
          } else {
            data[col] = Number(val);
          }
        }
        await insertMember(db, data, userId);
        inserted++;
      }
      report.done = true;
      report.inserted = inserted;
      return c.html(<ImportPage user={c.get("user")} perms={c.get("perms")} report={report} error={null} />);
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
    SELECT m.*, r.name AS state_name, r.name_en AS state_name_en,
      e.label AS ethnicity, ed.label AS education, fg.label AS family_group,
      fc.label AS fellowship, gr.label AS group_label, hc.label AS home_cell
    FROM members m
    JOIN regions r ON r.id = m.region_id
    LEFT JOIN lookup_options e ON e.id = m.ethnicity_id
    LEFT JOIN lookup_options ed ON ed.id = m.education_id
    LEFT JOIN lookup_options fg ON fg.id = m.family_group_id
    LEFT JOIN lookup_options fc ON fc.id = m.fellowship_category_id
    LEFT JOIN lookup_options gr ON gr.id = m.group_id
    LEFT JOIN lookup_options hc ON hc.id = m.home_cell_id
    WHERE m.id = ${id}`);
  return rows[0] as any;
}

function inScope(row: { region_id: number }, scope: Scope): boolean {
  return scope.scopeAll || scope.stateIds.includes(row.region_id);
}

const SNAKE_TO_CAMEL: Record<string, string> = {
  name_myanmar: "nameMyanmar", name_english: "nameEnglish", marital_status: "maritalStatus",
  date_of_birth: "dateOfBirth", blood_type: "bloodType", nrc_number: "nrcNumber",
  father_name: "fatherName", mother_name: "motherName", work_skills: "workSkills",
  salvation_date: "salvationDate", region_id: "regionId", ethnicity_id: "ethnicityId",
  education_id: "educationId", family_group_id: "familyGroupId",
  fellowship_category_id: "fellowshipCategoryId", group_id: "groupId", home_cell_id: "homeCellId",
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
    group_id: num(row.group_id),
    home_cell_id: num(row.home_cell_id),
  };
}

// ---------- create ----------

// Option types rendered on the member form (Family + Church cards).
const FORM_OPTION_TYPES = ["ethnicity", "education", "family_group", "fellowship_category", "group", "home_cell", "township"];

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
  return c.html(
    <MemberFormPage
      user={c.get("user")} perms={c.get("perms")} values={defaultValues(scope, allRegions)}
      errors={[]} member={null} regions={scopedRegions(allRegions, scope, c.get("lang"))}
      options={formOptions(options)}
      lang={c.get("lang")}
    />,
  );
});

membersRoutes.post("/", requirePermission("members.create"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const body = await c.req.parseBody();
  const options = await loadAllOptions(db);
  const { values, errors, data } = readAndValidate(body, scope, options);
  const allRegions = await loadRegions(db);
  const render = (status: 400 | 200) =>
    c.html(
      <MemberFormPage
        user={c.get("user")} perms={c.get("perms")} values={values}
        errors={errors.map((e) => renderMsg(e, c.get("lang")))}
        member={null} regions={scopedRegions(allRegions, scope, c.get("lang"))}
        options={formOptions(options)}
        lang={c.get("lang")}
      />,
      status,
    );
  if (!data) return render(400);
  const id = await insertMember(db, data, c.get("user").id);
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
  return c.html(
    <MemberDetailPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))} m={row} lang={c.get("lang")}
    />,
  );
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
  const formProps = {
    user: c.get("user"), perms: c.get("perms"), values: rowToValues(row), errors: [] as string[],
    member: { id }, regions: scopedRegions(allRegions, scope, c.get("lang")),
    options: formOptions(options, (o) => o.type === "township" ? o.label === row.township : o.id === (row as any)[`${o.type}_id`]),
    lang: c.get("lang"),
  };
  if (c.req.query("modal") === "1") return c.html(<MemberFormFragment {...formProps} modal />);
  return c.html(<MemberFormPage {...formProps} />);
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
  const { values, errors, data } = readAndValidate(body, scope, options);
  const allRegions = await loadRegions(db);
  if (!data) {
    const formProps = {
      user: c.get("user"), perms: c.get("perms"), values,
      errors: errors.map((e) => renderMsg(e, c.get("lang"))),
      member: { id }, regions: scopedRegions(allRegions, scope, c.get("lang")),
      options: formOptions(options, (o) => o.type === "township" ? o.label === existing.township : o.id === (existing as any)[`${o.type}_id`]),
      lang: c.get("lang"),
    };
    if (fromModal) return c.html(<MemberFormFragment {...formProps} modal />, 400);
    return c.html(<MemberFormPage {...formProps} />, 400);
  }
  await db
    .update(members)
    .set({ ...toDrizzleValues(data), updatedBy: c.get("user").id, updatedAt: Math.floor(Date.now() / 1000) } as typeof members.$inferInsert)
    .where(eq(members.id, id));
  if (fromModal) return c.redirect("/members?ok=member-updated", 303);
  return c.redirect(`/members/${id}?ok=member-updated`, 302);
});

membersRoutes.post("/:id/delete", requirePermission("members.delete"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) return c.redirect("/members?err=err-notfound", 302);
  const existing = await loadMemberDetail(db, id);
  if (!existing || !inScope(existing, scope)) return c.redirect("/members?err=err-notfound", 302);
  await db.delete(members).where(eq(members.id, id));
  return c.redirect("/members?ok=member-deleted", 302);
});
