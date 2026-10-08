import { asc } from "drizzle-orm";
import type { DB } from "./db/client";
import { lookupOptions, members, OPTION_TYPES, type OptionType } from "./db/schema";

/** region_id wildcard: the option is available in every State/Region. */
export const ALL_STATES = 0;

export type OptionRow = {
  id: number;
  type: string;
  label: string;
  active: number;
  sortOrder: number;
  /** State this option belongs to; 0 = available in every state. */
  regionId: number;
  /** Optional parent option id (Home Cell -> Township, Family Group -> Home Cell). */
  parentId: number | null;
};

export async function loadAllOptions(db: DB): Promise<OptionRow[]> {
  return (await db
    .select({
      id: lookupOptions.id, type: lookupOptions.type, label: lookupOptions.label,
      active: lookupOptions.active, sortOrder: lookupOptions.sortOrder,
      regionId: lookupOptions.regionId, parentId: lookupOptions.parentId,
    })
    .from(lookupOptions)
    .orderBy(asc(lookupOptions.type), asc(lookupOptions.sortOrder), asc(lookupOptions.label))) as OptionRow[];
}

export function optionsOfType(all: OptionRow[], type: OptionType): OptionRow[] {
  return all.filter((o) => o.type === type);
}

/** lookup type of the parent option for a child type (null = no parent chain). */
export const PARENT_TYPE: Partial<Record<string, string>> = {
  home_cell: "township",
  family_group: "home_cell",
};

export function normLabel(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}
const norm = normLabel;

/**
 * Case-insensitive label match within a type. Region-aware: an option scoped to
 * one state only resolves for that state; 0 (all-states) options match anywhere.
 * Used by the member form and CSV import — `regionId` 0/undefined = don't care.
 */
export function findOption(
  all: OptionRow[],
  type: string,
  label: string,
  regionId?: number,
): OptionRow | undefined {
  const want = norm(label);
  const matches = all.filter((o) => o.type === type && norm(o.label) === want);
  if (regionId === undefined || regionId === null || regionId === ALL_STATES) {
    // No region context: prefer an exact-state option if labels collide,
    // otherwise fall back to an all-states option.
    return matches.find((o) => o.regionId !== ALL_STATES) ?? matches.find((o) => o.regionId === ALL_STATES);
  }
  return (
    matches.find((o) => o.regionId === regionId) ??
    matches.find((o) => o.regionId === ALL_STATES)
  );
}

/** member column for each lookup type (used for usage counts / delete guards). */
export const OPTION_COLUMN: Record<OptionType, keyof typeof members._.columns> = {
  ethnicity: "ethnicityId",
  education: "educationId",
  home_cell: "homeCellId",
  family_group: "familyGroupId",
  fellowship_category: "fellowshipCategoryId",
  group: "groupId",
  // members.township stores the option *label* (text), not an id — usage counts
  // and delete guards for 'township' compare labels (see admin routes).
  township: "township",
};

export function isOptionType(v: string): v is OptionType {
  return (OPTION_TYPES as readonly string[]).includes(v);
}

/** Raw DB column names for each option type (for GROUP BY / COUNT queries). */
export const OPTION_RAW_COLUMN: Record<OptionType, string> = {
  ethnicity: "ethnicity_id",
  education: "education_id",
  home_cell: "home_cell_id",
  family_group: "family_group_id",
  fellowship_category: "fellowship_category_id",
  group: "group_id",
  township: "township",
};
