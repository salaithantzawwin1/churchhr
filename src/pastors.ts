import { sql } from "drizzle-orm";
import type { DB } from "./db/client";

export type PastorRow = {
  id: number;
  name: string;
  nameEn: string | null;
  title: string | null;
  position: string | null;
  gender: string;
  maritalStatus: string;
  dateOfBirth: string | null;
  regionId: number;
  regionalChurchId: number | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  ordinationDate: string | null;
  notes: string | null;
  active: number;
  sortOrder: number;
  stateName: string;
  stateNameEn: string | null;
  churchName: string | null;
  churchNameEn: string | null;
  hasPhoto: number | boolean;
};

type PastorFilter = {
  activeOnly?: boolean;
  scopeAll?: boolean;
  stateIds?: number[];
  regionId?: number;
  churchId?: number;
};

/** Load the pastor directory, optionally limited to the signed-in user's
 * states (the same scope used by the organization settings pages). */
export async function loadPastors(db: DB, opts: PastorFilter = {}): Promise<PastorRow[]> {
  const conditions = [sql`1=1`];
  if (opts.activeOnly !== false) conditions.push(sql`p.active = 1`);
  if (opts.regionId) conditions.push(sql`p.region_id = ${opts.regionId}`);
  if (opts.churchId) conditions.push(sql`p.regional_church_id = ${opts.churchId}`);
  if (!opts.scopeAll && opts.stateIds) {
    if (opts.stateIds.length === 0) conditions.push(sql`1=0`);
    else conditions.push(sql`p.region_id IN (${sql.join(opts.stateIds.map((id) => sql`${id}`), sql`, `)})`);
  }
  return db.all<PastorRow>(sql`
    SELECT p.id, p.name, p.name_en AS nameEn, p.title, p.position, p.gender,
           p.marital_status AS maritalStatus, p.date_of_birth AS dateOfBirth,
           p.region_id AS regionId, p.regional_church_id AS regionalChurchId,
           p.phone, p.email, p.address, p.ordination_date AS ordinationDate,
           p.notes, p.active, p.sort_order AS sortOrder,
           r.name AS stateName, r.name_en AS stateNameEn,
           rc.name AS churchName, rc.name_en AS churchNameEn,
           (p.photo IS NOT NULL) AS hasPhoto
    FROM pastors p
    JOIN regions r ON r.id = p.region_id
    LEFT JOIN regional_churches rc ON rc.id = p.regional_church_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY p.active DESC, p.sort_order, p.name`);
}

/** One pastor, scoped like the directory list. */
export async function loadPastor(db: DB, id: number, opts: PastorFilter = {}): Promise<PastorRow | null> {
  const rows = await loadPastors(db, { ...opts, activeOnly: false });
  return rows.find((p) => p.id === id) ?? null;
}

/** Active pastors in one state, used by the cluster editor instead of the
 * member picker. */
export async function loadPastorOptions(
  db: DB,
  opts: { regionId: number; churchId?: number | null },
): Promise<{ id: number; name: string; regionId: number }[]> {
  const conditions = [sql`p.active = 1`, sql`p.region_id = ${opts.regionId}`];
  if (opts.churchId) conditions.push(sql`(p.regional_church_id IS NULL OR p.regional_church_id = ${opts.churchId})`);
  return db.all<{ id: number; name: string; regionId: number }>(sql`
    SELECT p.id, COALESCE(NULLIF(p.name, ''), p.name_en) AS name, p.region_id AS regionId
    FROM pastors p
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY p.sort_order, p.name`);
}

/** Display name for a pastor, falling back to the Myanmar name. */
export function pastorName(row: Pick<PastorRow, "name" | "nameEn">, lang: string): string {
  return lang !== "mm" && row.nameEn ? row.nameEn : row.name;
}
