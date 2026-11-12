import { sql } from "drizzle-orm";
import type { DB } from "./db/client";

export type RegionalChurchRow = {
  id: number;
  name: string;
  nameEn: string | null;
  regionId: number;
  stateName: string;
  stateNameEn: string | null;
  active: number;
  sortOrder: number;
  isMain: number;
  cellCount?: number;
};

export type SupervisionClusterRow = {
  id: number;
  name: string;
  nameEn: string | null;
  regionId: number;
  stateName: string;
  stateNameEn: string | null;
  active: number;
  sortOrder: number;
  cellCount?: number;
  pastorId?: number | null;
  pastorName?: string | null;
};

export type TownshipRow = {
  id: number;
  label: string;
  regionId: number;
  stateName: string;
  stateNameEn: string | null;
};

type LoadRegionalOptions = {
  activeOnly?: boolean;
  regionId?: number;
  scopeAll?: boolean;
  stateIds?: number[];
};

/** Load Regional Churches, optionally restricted to the signed-in user's
 * states or to the region of the member being edited. */
export async function loadRegionalChurches(db: DB, opts: LoadRegionalOptions = {}): Promise<RegionalChurchRow[]> {
  const conditions = [sql`1=1`];
  if (opts.activeOnly !== false) conditions.push(sql`rc.active = 1`);
  if (opts.regionId) conditions.push(sql`rc.region_id = ${opts.regionId}`);
  if (!opts.scopeAll && opts.stateIds) {
    if (opts.stateIds.length === 0) conditions.push(sql`1=0`);
    else conditions.push(sql`rc.region_id IN (${sql.join(opts.stateIds.map((id) => sql`${id}`), sql`, `)})`);
  }
  return db.all<RegionalChurchRow>(sql`
    SELECT rc.id, rc.name, rc.name_en AS nameEn, rc.region_id AS regionId,
           r.name AS stateName, r.name_en AS stateNameEn,
           rc.active, rc.sort_order AS sortOrder, rc.is_main AS isMain,
           (SELECT COUNT(*) FROM lookup_options hc
             WHERE hc.regional_church_id = rc.id AND hc.type = 'home_cell' AND hc.active = 1) AS cellCount
    FROM regional_churches rc
    JOIN regions r ON r.id = rc.region_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY rc.active DESC, rc.sort_order, rc.name`);
}

export function regionalChurchName(row: Pick<RegionalChurchRow, "name" | "nameEn">, lang: string): string {
  return lang !== "mm" && row.nameEn ? row.nameEn : row.name;
}

/** Load Home Cell supervision clusters, optionally limited to one state or
 * the signed-in user's assigned states. */
export async function loadSupervisionClusters(db: DB, opts: LoadRegionalOptions = {}): Promise<SupervisionClusterRow[]> {
  const conditions = [sql`1=1`];
  if (opts.activeOnly !== false) conditions.push(sql`sc.active = 1`);
  if (opts.regionId) conditions.push(sql`sc.region_id = ${opts.regionId}`);
  if (!opts.scopeAll && opts.stateIds) {
    if (opts.stateIds.length === 0) conditions.push(sql`1=0`);
    else conditions.push(sql`sc.region_id IN (${sql.join(opts.stateIds.map((id) => sql`${id}`), sql`, `)})`);
  }
  return db.all<SupervisionClusterRow>(sql`
    SELECT sc.id, sc.name, sc.name_en AS nameEn, sc.region_id AS regionId,
           r.name AS stateName, r.name_en AS stateNameEn,
           sc.active, sc.sort_order AS sortOrder,
           (SELECT COUNT(*) FROM lookup_options hc
             WHERE hc.supervision_cluster_id = sc.id
               AND hc.type = 'home_cell' AND hc.active = 1) AS cellCount,
           (SELECT cp.pastor_id FROM cluster_pastor_assignments cp
             WHERE cp.cluster_id = sc.id) AS pastorId,
           (SELECT COALESCE(NULLIF(p.name, ''), p.name_en)
              FROM cluster_pastor_assignments cp
              JOIN pastors p ON p.id = cp.pastor_id
             WHERE cp.cluster_id = sc.id AND p.active = 1 LIMIT 1) AS pastorName
    FROM supervision_clusters sc
    JOIN regions r ON r.id = sc.region_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY sc.active DESC, sc.sort_order, sc.name`);
}

/** Display name for a supervision cluster, falling back to the Myanmar name. */
export function clusterName(row: Pick<SupervisionClusterRow, "name" | "nameEn">, lang: string): string {
  return lang !== "mm" && row.nameEn ? row.nameEn : row.name;
}

/** Townships are the Home Cell supervision areas (a cluster of cells). */
export async function loadTownships(db: DB, opts: LoadRegionalOptions = {}): Promise<TownshipRow[]> {
  const conditions = [sql`t.type = 'township'`, sql`t.active = 1`];
  if (opts.regionId) conditions.push(sql`t.region_id = ${opts.regionId}`);
  if (!opts.scopeAll && opts.stateIds) {
    if (opts.stateIds.length === 0) conditions.push(sql`1=0`);
    else conditions.push(sql`t.region_id IN (${sql.join(opts.stateIds.map((id) => sql`${id}`), sql`, `)})`);
  }
  return db.all<TownshipRow>(sql`
    SELECT t.id, t.label, t.region_id AS regionId,
           r.name AS stateName, r.name_en AS stateNameEn
    FROM lookup_options t
    JOIN regions r ON r.id = t.region_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY r.id, t.sort_order, t.label`);
}
