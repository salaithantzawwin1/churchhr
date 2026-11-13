import { sql } from "drizzle-orm";
import type { DB } from "./db/client";
import { positionLabel as fallbackPositionLabel } from "./positions";

/** Positions that can be configured from the Organization settings screens. */
export const CONFIGURABLE_POSITION_SCOPES = [
  "church",
  "region",
  "cluster",
  "home_cell",
  "township",
  "department",
] as const;

export type ConfigurablePositionScope = (typeof CONFIGURABLE_POSITION_SCOPES)[number];

export type PositionDefRow = {
  id: number;
  scopeType: ConfigurablePositionScope;
  code: string;
  nameMyanmar: string;
  nameEnglish: string | null;
  nameKorean: string | null;
  /** Code of the position this one reports to, or null for a top-level slot. */
  parentCode: string | null;
  active: number;
  sortOrder: number;
  /** Several people may hold this role in one scope. */
  allowMultiple: number;
  /** Holders required before this role is a vacancy. */
  minHolders: number;
  usageCount?: number;
  /** Churches that may use this position; an empty list means every church. */
  regionalChurchIds?: number[];
  /** Localized church names for the list badge. */
  churchNames?: string[];
};

const SCOPE_LABEL_FALLBACK: Record<ConfigurablePositionScope, string> = {
  church: "Church",
  region: "State / Region",
  cluster: "Supervision Cluster",
  home_cell: "Home Cell",
  township: "Township Supervision",
  department: "Department",
};

export function isConfigurableScope(value: string | null | undefined): value is ConfigurablePositionScope {
  return Boolean(value && (CONFIGURABLE_POSITION_SCOPES as readonly string[]).includes(value));
}

export function positionDefLabel(def: Pick<PositionDefRow, "nameMyanmar" | "nameEnglish" | "nameKorean">, lang: string): string {
  if (lang === "mm") return def.nameMyanmar || def.nameEnglish || "";
  if (lang === "kr") return def.nameKorean || def.nameEnglish || def.nameMyanmar;
  return def.nameEnglish || def.nameMyanmar || "";
}

/** Labels for stored codes, falling back to the old code catalogue so rows
 * created before the catalogue was editable never turn blank. */
export function positionLabelForCode(
  defs: PositionDefRow[],
  code: string | null | undefined,
  lang: string,
): string {
  if (!code) return "";
  const def = defs.find((d) => d.code === code);
  return def ? positionDefLabel(def, lang) : fallbackPositionLabel(code, lang);
}

export function positionLabelsForCsv(defs: PositionDefRow[], csv: string | null | undefined, lang: string): string[] {
  if (!csv) return [];
  return csv.split(",").map((v) => v.trim()).filter(Boolean).map((v) => positionLabelForCode(defs, v, lang));
}

export function positionNameMap(defs: PositionDefRow[], lang: string): Record<string, string> {
  return Object.fromEntries(defs.map((d) => [d.code, positionDefLabel(d, lang)]));
}

export function defsForScope(defs: PositionDefRow[], scope: ConfigurablePositionScope): PositionDefRow[] {
  return defs.filter((d) => d.scopeType === scope && d.active === 1)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/**
 * The lead position of an ordered scope list: the first role that is not nested
 * under another one. A sub-role (e.g. an assistant secretary) therefore never
 * takes the lead slot just because it sorts early.
 */
export function leadDef(rows: PositionDefRow[]): PositionDefRow | null {
  return rows.find((r) => !r.parentCode) ?? rows[0] ?? null;
}

export function isDefinedForScope(
  defs: PositionDefRow[],
  code: string,
  scope: ConfigurablePositionScope,
): boolean {
  return defs.some((d) => d.scopeType === scope && d.active === 1 && d.code === code);
}

export async function loadPositionDefs(db: DB): Promise<PositionDefRow[]> {
  const rows = await db.all<PositionDefRow & { church_ids: string | null }>(sql`
    SELECT pd.id, pd.scope_type AS scopeType, pd.code,
           pd.name_myanmar AS nameMyanmar, pd.name_english AS nameEnglish,
           pd.name_korean AS nameKorean, pd.parent_code AS parentCode,
           pd.active, pd.sort_order AS sortOrder,
           pd.allow_multiple AS allowMultiple, pd.min_holders AS minHolders,
           GROUP_CONCAT(DISTINCT pdc.regional_church_id) AS church_ids
    FROM position_defs pd
    LEFT JOIN position_def_churches pdc ON pdc.position_def_id = pd.id
    GROUP BY pd.id
    ORDER BY pd.scope_type, pd.sort_order, pd.id`);
  return rows.map((row) => ({
    ...row,
    regionalChurchIds: (row.church_ids ?? "")
      .split(",")
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0),
  }));
}

/** Positions usable in a church: state-wide ones plus the ones ticked for it. */
export function defsForChurch<T extends { regionalChurchIds?: number[] }>(
  defs: T[],
  churchId: number | null | undefined,
): T[] {
  if (churchId == null) return defs;
  return defs.filter((d) => {
    const ids = d.regionalChurchIds ?? [];
    return ids.length === 0 || ids.includes(churchId);
  });
}

/** Human scope title for admin tabs (English fallback; views translate it). */
export function scopeFallbackLabel(scope: string): string {
  return isConfigurableScope(scope) ? SCOPE_LABEL_FALLBACK[scope] : scope;
}

/** Stable, readable code that never starts with a digit and is safe in SQL
 * values. The route adds a numeric suffix if the generated code already exists. */
export function codeFromEnglishName(scope: ConfigurablePositionScope, nameEnglish: string): string {
  const base = nameEnglish
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 55);
  return `${scope}_${base || "position"}`;
}
