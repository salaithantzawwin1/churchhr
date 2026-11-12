import { sql } from "drizzle-orm";
import type { DB } from "./db/client";
import { positionLabel as fallbackPositionLabel } from "./positions";

/** Positions that can be configured from the Organization settings screens. */
export const CONFIGURABLE_POSITION_SCOPES = [
  "church",
  "regional_church",
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
  usageCount?: number;
  /** Set when the position exists only in this church (0034); null = all churches. */
  regionalChurchId?: number | null;
  churchName?: string | null;
  churchNameEn?: string | null;
};

const SCOPE_LABEL_FALLBACK: Record<ConfigurablePositionScope, string> = {
  church: "Church",
  regional_church: "Regional Church",
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
  return db.all<PositionDefRow>(sql`
    SELECT id, scope_type AS scopeType, code, name_myanmar AS nameMyanmar,
           name_english AS nameEnglish, name_korean AS nameKorean,
           parent_code AS parentCode, active, sort_order AS sortOrder,
           regional_church_id AS regionalChurchId
    FROM position_defs
    ORDER BY scope_type, sort_order, id`);
}

/** Positions usable in a church: state-wide ones plus that church's own. */
export function defsForChurch<T extends { regionalChurchId?: number | null }>(
  defs: T[],
  churchId: number | null | undefined,
): T[] {
  if (churchId == null) return defs;
  return defs.filter((d) => d.regionalChurchId == null || d.regionalChurchId === churchId);
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
