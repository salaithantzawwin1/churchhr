import { asc, eq } from "drizzle-orm";
import type { DB } from "./db/client";
import { lookupOptions, members, OPTION_TYPES, type OptionType } from "./db/schema";

export type OptionRow = {
  id: number;
  type: string;
  label: string;
  active: number;
  sortOrder: number;
  /** null = available in every State/Region. */
  regionId: number | null;
};

export async function loadAllOptions(db: DB): Promise<OptionRow[]> {
  return (await db
    .select({
      id: lookupOptions.id, type: lookupOptions.type, label: lookupOptions.label,
      active: lookupOptions.active, sortOrder: lookupOptions.sortOrder, regionId: lookupOptions.regionId,
    })
    .from(lookupOptions)
    .orderBy(asc(lookupOptions.type), asc(lookupOptions.sortOrder), asc(lookupOptions.label))) as OptionRow[];
}

export function optionsOfType(all: OptionRow[], type: OptionType): OptionRow[] {
  return all.filter((o) => o.type === type);
}

/** Case-insensitive label match within a type (for form/import resolution). */
export function findOption(all: OptionRow[], type: string, label: string): OptionRow | undefined {
  const want = norm(label);
  return all.find((o) => o.type === type && norm(o.label) === want);
}
function norm(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
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
