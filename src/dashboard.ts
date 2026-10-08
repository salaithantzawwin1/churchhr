import { sql } from "drizzle-orm";
import type { DB } from "./db/client";

/** Dashboard filter bar selection (query-string driven; empty = no filter). */
export type DashboardFilter = {
  state: number | null;
  gender: string;
  homeCell: number | null;
  township: string;
};

export const EMPTY_DASH_FILTERS: DashboardFilter = {
  state: null,
  gender: "",
  homeCell: null,
  township: "",
};

export type DashboardData = {
  total: number;
  byStatus: Record<string, number>;
  male: number;
  female: number;
  byState: { id: number; name: string; name_en?: string | null; n: number }[];
  recent: { id: number; name: string; state_name: string; state_name_en?: string | null }[];
  scopeAll: boolean;
  stateCount: number;
  /** Active members per admin-defined age group, split by gender. */
  ageGroups: { id: number; name: string; min_age: number; max_age: number; male: number; female: number }[];
  /** Active members with a family group assigned + distinct group count. */
  familyGroup: { members: number; groups: number };
  /** Current selection, echoed back so the filter bar re-renders selected options. */
  filters: DashboardFilter;
  /** Scope-visible states for the State/Region filter. */
  filterRegions: { id: number; name: string; name_en?: string | null }[];
  /** Active home cells for the Home Cell filter (region_id drives the state cascade). */
  homeCells: { id: number; label: string; region_id: number }[];
  /** Active township options for the Township filter (region_id drives the state cascade). */
  townships: { id: number; label: string; region_id: number }[];
};

export async function loadDashboard(
  db: DB,
  scope: { scopeAll: boolean; stateIds: number[] },
  f: DashboardFilter = EMPTY_DASH_FILTERS,
): Promise<DashboardData> {
  const idList = () => sql.join(scope.stateIds.map((id) => sql`${id}`));
  // Row-level scope on members (table aliased m everywhere below).
  const scopeM = scope.scopeAll
    ? sql`1=1`
    : scope.stateIds.length > 0
      ? sql`m.region_id IN (${idList()})`
      : sql`1=0`;
  // Selected filters — applied to every aggregate so the whole page moves together.
  const mfc = () => {
    let x = sql`1=1`;
    if (f.state) x = sql`${x} AND m.region_id = ${f.state}`;
    if (f.gender) x = sql`${x} AND m.gender = ${f.gender}`;
    if (f.homeCell) x = sql`${x} AND m.home_cell_id = ${f.homeCell}`;
    if (f.township) x = sql`${x} AND m.township = ${f.township}`;
    return x;
  };

  const statusRows = await db.all<{ status: string; n: number }>(
    sql`SELECT m.status AS status, COUNT(*) AS n FROM members m
        WHERE ${scopeM} AND ${mfc()} GROUP BY m.status`,
  );
  const genderRows = await db.all<{ gender: string; n: number }>(
    sql`SELECT m.gender AS gender, COUNT(*) AS n FROM members m
        WHERE ${scopeM} AND ${mfc()} AND m.gender <> '' GROUP BY m.gender`,
  );

  // Regions shown in the bar table: scope + the State filter (so picking one
  // state collapses the table to that row). Filters ride along in the JOIN so
  // a region with no matches still renders as a 0 row.
  let regionCond = scope.scopeAll
    ? sql`1=1`
    : scope.stateIds.length > 0
      ? sql`r.id IN (${idList()})`
      : sql`1=0`;
  if (f.state) regionCond = sql`${regionCond} AND r.id = ${f.state}`;
  const byState = await db.all<{ id: number; name: string; n: number }>(sql`
    SELECT r.id, r.name, r.name_en AS name_en, COUNT(m.id) AS n FROM regions r
    LEFT JOIN members m ON m.region_id = r.id AND ${mfc()}
    WHERE ${regionCond} GROUP BY r.id ORDER BY r.id`);

  const recent = await db.all<{ id: number; name: string; state_name: string }>(sql`
    SELECT m.id,
      COALESCE(NULLIF(m.name_myanmar, ''), NULLIF(m.name_english, ''), '—') AS name,
      r.name AS state_name, r.name_en AS state_name_en
    FROM members m JOIN regions r ON r.id = m.region_id
    WHERE ${scopeM} AND ${mfc()} ORDER BY m.id DESC LIMIT 5`);

  // Active members per admin-defined age group. Age is derived from DOB at query
  // time so changing a range on the Options page re-buckets instantly.
  const ageGroupRows = await db.all<{
    id: number; name: string; min_age: number; max_age: number; male: number | null; female: number | null;
  }>(sql`
    SELECT ag.id, ag.name, ag.min_age, ag.max_age,
      COALESCE(SUM(CASE WHEN m.gender = 'male' THEN 1 ELSE 0 END), 0) AS male,
      COALESCE(SUM(CASE WHEN m.gender = 'female' THEN 1 ELSE 0 END), 0) AS female
    FROM age_groups ag
    LEFT JOIN members m
      ON m.status = 'active'
      AND m.gender IN ('male', 'female')
      AND m.date_of_birth IS NOT NULL AND m.date_of_birth <> ''
      AND CAST((julianday('now') - julianday(m.date_of_birth)) / 365.25 AS INTEGER)
        BETWEEN ag.min_age AND ag.max_age
      AND ${scopeM} AND ${mfc()}
    GROUP BY ag.id
    ORDER BY ag.sort_order, ag.min_age`);

  const familyGroupRow = await db.all<{ members: number; groups: number }>(sql`
    SELECT COUNT(*) AS members, COUNT(DISTINCT m.family_group_id) AS groups
    FROM members m
    WHERE ${scopeM} AND ${mfc()} AND m.status = 'active' AND m.family_group_id IS NOT NULL`);

  // Filter bar options: regions/home cells stay scope-wide and townships stay
  // distinct-once so the dropdowns never collapse while the user is picking.
  const scopeR = scope.scopeAll
    ? sql`1=1`
    : scope.stateIds.length > 0
      ? sql`id IN (${idList()})`
      : sql`1=0`;
  const filterRegions = await db.all<{ id: number; name: string; name_en: string | null }>(
    sql`SELECT id, name, name_en FROM regions WHERE ${scopeR} ORDER BY id`,
  );
  const homeCellRows = await db.all<{ id: number; label: string; region_id: number }>(sql`
    SELECT id, label, region_id FROM lookup_options
    WHERE type = 'home_cell' AND active = 1
    ORDER BY sort_order, label`);
  const townshipRows = await db.all<{ id: number; label: string; region_id: number }>(sql`
    SELECT id, label, region_id FROM lookup_options
    WHERE type = 'township' AND active = 1
    ORDER BY sort_order, label`);

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of statusRows) {
    byStatus[row.status] = row.n;
    total += row.n;
  }
  let male = 0;
  let female = 0;
  for (const row of genderRows) {
    if (row.gender === "male") male = row.n;
    if (row.gender === "female") female = row.n;
  }

  return {
    total, byStatus, male, female,
    byState: byState as any, recent: recent as any,
    scopeAll: scope.scopeAll, stateCount: scope.stateIds.length,
    ageGroups: ageGroupRows.map((g) => ({
      id: g.id, name: g.name, min_age: Number(g.min_age), max_age: Number(g.max_age),
      male: Number(g.male ?? 0), female: Number(g.female ?? 0),
    })),
    familyGroup: {
      members: Number(familyGroupRow[0]?.members ?? 0),
      groups: Number(familyGroupRow[0]?.groups ?? 0),
    },
    filters: f,
    filterRegions: filterRegions as any,
    homeCells: homeCellRows as any,
    townships: townshipRows as any,
  };
}
