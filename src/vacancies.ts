import { sql } from "drizzle-orm";
import type { DB } from "./db/client";
import type { Lang } from "./i18n";
import { defsForChurch, defsForScope, loadPositionDefs, positionDefLabel, type ConfigurablePositionScope, type PositionDefRow } from "./position-catalog";

export type VacancyScope = ConfigurablePositionScope;

/** Order structures appear in on the report and in the CSV export. */
export const VACANCY_SCOPES: VacancyScope[] = [
  "church",
  "region",
  "cluster",
  "home_cell",
  "township",
  "department",
];

export type VacancyItem = { code: string; name: string };

export type VacancyStructure = {
  scope: VacancyScope;
  id: number | null;
  name: string;
  stateName: string | null;
  townshipName: string | null;
  regionalChurchName: string | null;
  slots: number;
  filled: number;
  vacancies: VacancyItem[];
};

export type VacancyTotals = { structures: number; slots: number; filled: number; vacant: number };

export type VacancyReport = {
  structures: VacancyStructure[];
  totals: VacancyTotals;
  byScope: Record<VacancyScope, VacancyTotals>;
  generatedAt: number;
};

type Scope = { scopeAll: boolean; stateIds: number[] };

type StructureRow = {
  id: number;
  name: string;
  nameEn: string | null;
  stateName: string;
  stateNameEn: string | null;
  townshipName: string | null;
  regionalName: string | null;
  regionalNameEn: string | null;
  /** Church a Home Cell belongs to; null for structures that are not church-bound. */
  regionalChurchId?: number | null;
};

function stateFilter(scope: Scope, column: string) {
  if (scope.scopeAll) return sql`1=1`;
  if (scope.stateIds.length === 0) return sql`1=0`;
  return sql`${sql.raw(column)} IN (${sql.join(scope.stateIds.map((id) => sql`${id}`), sql`, `)})`;
}

function assignedKey(scope: string, code: string, id: number | null): string {
  return `${scope}:${id ?? 0}:${code}`;
}

/** Slot key used to match a member_positions row to its structure + role. */
function positionKey(row: {
  position: string;
  scope_type: string;
  scope_id: number | null;
  department_id: number | null;
  regional_church_id: number | null;
  region_id: number | null;
  supervision_cluster_id: number | null;
}): string {
  switch (row.scope_type) {
    case "church":
      return assignedKey("church", row.position, row.regional_church_id);
    case "region":
      return assignedKey("region", row.position, row.region_id);
    case "department":
      return assignedKey("department", row.position, row.department_id);
    case "cluster":
      return assignedKey("cluster", row.position, row.supervision_cluster_id);
    case "home_cell":
    case "township":
      return assignedKey(row.scope_type, row.position, row.scope_id);
    default:
      return assignedKey(row.scope_type, row.position, null);
  }
}

function emptyTotals(): VacancyTotals {
  return { structures: 0, slots: 0, filled: 0, vacant: 0 };
}

/** Every configured role slot across all structures, with the ones that have no
 * active holder. Structures with no roles defined are left out of the report. */
export async function loadVacancyReport(
  db: DB,
  opts: { scopeAll: boolean; stateIds: number[]; lang: Lang; scope?: VacancyScope },
): Promise<VacancyReport> {
  const scope: Scope = { scopeAll: opts.scopeAll, stateIds: opts.stateIds };
  const lang = opts.lang;
  const defs = await loadPositionDefs(db);
  const defsByScope: Record<VacancyScope, PositionDefRow[]> = {
    church: defsForScope(defs, "church"),
    region: defsForScope(defs, "region"),
    cluster: defsForScope(defs, "cluster"),
    home_cell: defsForScope(defs, "home_cell"),
    township: defsForScope(defs, "township"),
    department: defsForScope(defs, "department"),
  };

  const held = new Map<string, number>();
  const heldRows = await db.all<{
    position: string;
    scope_type: string;
    scope_id: number | null;
    department_id: number | null;
    regional_church_id: number | null;
    region_id: number | null;
    supervision_cluster_id: number | null;
  }>(sql`
    SELECT mp.position, mp.scope_type, mp.scope_id, mp.department_id, mp.regional_church_id,
           mp.region_id, mp.supervision_cluster_id
    FROM member_positions mp
    LEFT JOIN members m ON m.id = mp.member_id
    LEFT JOIN pastors p ON p.id = mp.pastor_id
    WHERE (mp.member_id IS NOT NULL AND m.status = 'active')
       OR (mp.pastor_id IS NOT NULL AND p.active = 1)`);
  for (const row of heldRows) {
    const key = positionKey(row);
    held.set(key, (held.get(key) ?? 0) + 1);
  }

  const regionRows = await db.all<StructureRow>(sql`
    SELECT r.id, r.name, r.name_en AS nameEn,
           r.name AS stateName, r.name_en AS stateNameEn,
           NULL AS townshipName, NULL AS regionalName, NULL AS regionalNameEn
    FROM regions r
    WHERE ${stateFilter(scope, "r.id")}
    ORDER BY r.name`);

  const churchRows = await db.all<StructureRow>(sql`
    SELECT rc.id, rc.name, rc.name_en AS nameEn,
           r.name AS stateName, r.name_en AS stateNameEn,
           NULL AS townshipName, NULL AS regionalName, NULL AS regionalNameEn
    FROM regional_churches rc
    JOIN regions r ON r.id = rc.region_id
    WHERE rc.active = 1 AND ${stateFilter(scope, "rc.region_id")}
    ORDER BY r.name, rc.sort_order, rc.name`);

  const homeCellRows = await db.all<StructureRow>(sql`
    SELECT hc.id, hc.label AS name, NULL AS nameEn,
           r.name AS stateName, r.name_en AS stateNameEn,
           t.label AS townshipName,
           rc.name AS regionalName, rc.name_en AS regionalNameEn,
           hc.regional_church_id AS regionalChurchId
    FROM lookup_options hc
    JOIN regions r ON r.id = hc.region_id
    LEFT JOIN lookup_options t ON t.id = hc.parent_id AND t.type = 'township'
    LEFT JOIN regional_churches rc ON rc.id = hc.regional_church_id
    WHERE hc.type = 'home_cell' AND hc.active = 1 AND ${stateFilter(scope, "hc.region_id")}
    ORDER BY r.id, t.sort_order, t.label, hc.sort_order, hc.label`);

  const clusterRows = await db.all<StructureRow>(sql`
    SELECT sc.id, sc.name, sc.name_en AS nameEn,
           r.name AS stateName, r.name_en AS stateNameEn,
           NULL AS townshipName, NULL AS regionalName, NULL AS regionalNameEn
    FROM supervision_clusters sc
    JOIN regions r ON r.id = sc.region_id
    WHERE sc.active = 1 AND ${stateFilter(scope, "sc.region_id")}
    ORDER BY r.id, sc.sort_order, sc.name`);

  const townshipRows = await db.all<StructureRow>(sql`
    SELECT t.id, t.label AS name, NULL AS nameEn,
           r.name AS stateName, r.name_en AS stateNameEn,
           NULL AS townshipName, NULL AS regionalName, NULL AS regionalNameEn
    FROM lookup_options t
    JOIN regions r ON r.id = t.region_id
    WHERE t.type = 'township' AND t.active = 1 AND ${stateFilter(scope, "t.region_id")}
    ORDER BY r.id, t.sort_order, t.label`);

  const departmentRows = await db.all<StructureRow>(sql`
    SELECT d.id, d.name, d.name_en AS nameEn,
           '' AS stateName, NULL AS stateNameEn,
           NULL AS townshipName, NULL AS regionalName, NULL AS regionalNameEn
    FROM church_departments d
    WHERE d.active = 1
    ORDER BY d.sort_order, d.name`);

  const localized = (name: string, nameEn: string | null) => (lang !== "mm" && nameEn ? nameEn : name);
  const stateOf = (row: StructureRow) =>
    lang !== "mm" && row.stateNameEn ? row.stateNameEn : row.stateName || null;

  /** Roles that apply to one structure. A role filed under a single church
   *  exists only there, so it must not be reported as a slot of its siblings. */
  const defsForStructure = (
    scopeType: VacancyScope, id: number | null, row: StructureRow | null,
  ): PositionDefRow[] => {
    const all = defsByScope[scopeType];
    if (scopeType === "church") return defsForChurch(all, id);
    if (scopeType === "home_cell") return defsForChurch(all, row?.regionalChurchId ?? null);
    return all;
  };

  const structures: VacancyStructure[] = [];
  const push = (scopeType: VacancyScope, id: number | null, row: StructureRow | null, displayName: string) => {
    const roleDefs = defsForStructure(scopeType, id, row);
    if (roleDefs.length === 0) return;
    let slots = 0;
    let filled = 0;
    const vacancies: VacancyItem[] = [];
    for (const def of roleDefs) {
      const count = held.get(assignedKey(scopeType, def.code, id)) ?? 0;
      const required = Math.max(0, def.minHolders ?? 1);
      slots += required;
      filled += Math.min(count, required);
      if (count < required) {
        vacancies.push({ code: def.code, name: positionDefLabel(def, lang) });
      }
    }
    if (vacancies.length === 0) return;
    structures.push({
      scope: scopeType,
      id,
      name: displayName,
      stateName: row ? stateOf(row) : null,
      townshipName: row?.townshipName ?? null,
      regionalChurchName: row ? localized(row.regionalName ?? "", row.regionalNameEn) || null : null,
      slots,
      filled,
      vacancies,
    });
  };

  for (const row of regionRows) push("region", row.id, row, localized(row.name, row.nameEn));
  for (const row of churchRows) push("church", row.id, row, localized(row.name, row.nameEn));
  for (const row of clusterRows) push("cluster", row.id, row, localized(row.name, row.nameEn));
  for (const row of homeCellRows) push("home_cell", row.id, row, row.name);
  for (const row of townshipRows) push("township", row.id, row, row.name);
  for (const row of departmentRows) push("department", row.id, row, localized(row.name, row.nameEn));

  const byScope = Object.fromEntries(VACANCY_SCOPES.map((s) => [s, emptyTotals()])) as Record<VacancyScope, VacancyTotals>;
  for (const structure of structures) {
    const bucket = byScope[structure.scope];
    bucket.structures += 1;
    bucket.slots += structure.slots;
    bucket.filled += structure.filled;
    bucket.vacant += structure.vacancies.length;
  }
  const totals = emptyTotals();
  for (const s of VACANCY_SCOPES) {
    totals.structures += byScope[s].structures;
    totals.slots += byScope[s].slots;
    totals.filled += byScope[s].filled;
    totals.vacant += byScope[s].vacant;
  }

  const filtered = opts.scope ? structures.filter((s) => s.scope === opts.scope) : structures;
  return {
    structures: filtered,
    totals: opts.scope ? byScope[opts.scope] : totals,
    byScope,
    generatedAt: Math.floor(Date.now() / 1000),
  };
}
