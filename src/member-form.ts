import { asInt, isFutureDate, parseDateFlexible, s } from "./util";
import { BLOOD_TYPES, GENDERS, MARITAL_STATUSES, STATUSES } from "./enums";
import { ALL_STATES, findOption, type OptionRow } from "./lookup";

/** The member fields a form may post. The member form and the household
 *  quick-add form both go through readMemberForm(), so a rule cannot apply to
 *  one screen and be missing on the other. */
export const MEMBER_FORM_KEYS = [
  "name_myanmar", "name_english", "gender", "marital_status", "date_of_birth", "blood_type",
  "phone", "nrc_number", "languages", "address", "father_name", "mother_name",
  "family_group_id", "ethnicity_id", "education_id", "job", "work_skills", "income",
  "region_id", "township", "home_cell_id", "department_id", "group_id", "fellowship_category_id", "sector_id",
  "salvation_date", "status", "notes",
] as const;

const OPTION_FIELD: Record<string, string> = {
  ethnicity_id: "ethnicity",
  education_id: "education",
  family_group_id: "family_group",
  fellowship_category_id: "fellowship_category",
  sector_id: "sector",
  group_id: "group",
  home_cell_id: "home_cell",
};

export type MemberScope = { scopeAll: boolean; stateIds: number[] };
export type MemberFormValues = Record<string, string>;

export type MemberFormResult = {
  values: MemberFormValues;
  /** Already translated messages, ready to render. */
  errors: string[];
  /** Null when validation failed; otherwise the row to insert/update. */
  data: Record<string, string | number | null> | null;
};

export type MemberFormOptions = {
  scope: MemberScope;
  options: OptionRow[];
  departments?: { id: number }[];
  regions?: { id: number }[];
  t: (key: string) => string;
};

/** Read and validate a member form. `regions` and `departments` keep an
 *  all-state editor from saving an id that no longer exists; an empty list
 *  means the caller does not offer that choice (e.g. households have no
 *  department field). */
export function readMemberForm(
  body: Record<string, unknown>,
  opts: MemberFormOptions,
): MemberFormResult {
  const { t, scope } = opts;
  const departments = opts.departments ?? [];
  const regions = opts.regions ?? [];
  const v: MemberFormValues = {};
  for (const k of MEMBER_FORM_KEYS) v[k] = s(body[k]);
  const errors: string[] = [];

  if (!v.name_myanmar && !v.name_english) errors.push(t("val.name"));

  const regionId = asInt(v.region_id);
  let regionOk = false;
  if (regionId === null) errors.push(t("val.state"));
  // Scope-all may pick any state, but only one that still exists: an id from a
  // hand-edited form reached the insert and failed its foreign key (HTTP 500).
  else if (scope.scopeAll) regionOk = regions.length === 0 || regions.some((r) => r.id === regionId);
  else regionOk = scope.stateIds.includes(regionId);
  if (regionId !== null && !regionOk) errors.push(t("val.scope"));

  if (v.gender && !(v.gender in GENDERS)) errors.push(t("val.gender"));
  if (v.marital_status && !(v.marital_status in MARITAL_STATUSES)) errors.push(t("val.marital"));
  if (v.blood_type && !BLOOD_TYPES.includes(v.blood_type) &&
      !findOption(opts.options, "blood_type", v.blood_type, 0)) {
    errors.push(t("val.blood"));
  }

  let dob: string | null = "";
  if (v.date_of_birth) {
    dob = parseDateFlexible(v.date_of_birth);
    if (dob === null) errors.push(t("val.dob"));
    else if (isFutureDate(dob)) errors.push(t("val.dobFuture"));
  }
  let salvation: string | null = "";
  if (v.salvation_date) {
    salvation = parseDateFlexible(v.salvation_date);
    if (salvation === null) errors.push(t("val.salvation"));
    else if (isFutureDate(salvation)) errors.push(t("val.salvationFuture"));
  }

  let income: number | null = null;
  if (v.income) {
    const digits = v.income.replace(/[,\s]/g, "");
    if (/^\d+$/.test(digits)) income = Number(digits);
    else errors.push(t("val.income"));
  }

  const status = v.status && v.status in STATUSES ? v.status : "active";

  let departmentId: number | null = null;
  if (v.department_id) {
    departmentId = asInt(v.department_id);
    if (departmentId === null || !departments.some((d) => d.id === departmentId)) {
      errors.push(t("val.department"));
      departmentId = null;
    }
  }

  // Home Cell is the member's place in the reporting structure, so no save
  // path may create a member without one. Legacy rows that predate this rule
  // stay readable and are fixed the next time they are edited.
  if (!v.home_cell_id) errors.push(t("val.homeCell"));

  const optionIds: Record<string, number | null> = {};
  for (const [field, type] of Object.entries(OPTION_FIELD)) {
    const raw = v[field];
    if (!raw) { optionIds[field] = null; continue; }
    const found = opts.options.find((o) => o.type === type && o.id === asInt(raw));
    // A state-scoped option from another state would silently attach the member
    // to a structure the editor cannot see, so only accept the member's own
    // state plus all-states (region 0) options.
    if (found && found.regionId !== ALL_STATES && found.regionId !== regionId) {
      errors.push(t("val.option"));
      optionIds[field] = null;
      continue;
    }
    if (!found) errors.push(t("val.option"));
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
