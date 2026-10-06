import { sql } from "drizzle-orm";
import type { DB } from "./db/client";

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
};

export async function loadDashboard(db: DB, scope: { scopeAll: boolean; stateIds: number[] }): Promise<DashboardData> {
  const idList = () => sql.join(scope.stateIds.map((id) => sql`${id}`));
  const cond = scope.scopeAll
    ? sql`1=1`
    : scope.stateIds.length > 0
      ? sql`region_id IN (${idList()})`
      : sql`1=0`;

  const statusRows = await db.all<{ status: string; n: number }>(
    sql`SELECT status, COUNT(*) AS n FROM members WHERE ${cond} GROUP BY status`,
  );
  const genderRows = await db.all<{ gender: string; n: number }>(
    sql`SELECT gender, COUNT(*) AS n FROM members WHERE ${cond} AND gender <> '' GROUP BY gender`,
  );

  const byState = scope.scopeAll
    ? await db.all<{ id: number; name: string; n: number }>(sql`
        SELECT r.id, r.name, r.name_en AS name_en, COUNT(m.id) AS n FROM regions r
        LEFT JOIN members m ON m.region_id = r.id GROUP BY r.id ORDER BY r.id`)
    : scope.stateIds.length > 0
      ? await db.all<{ id: number; name: string; n: number }>(sql`
          SELECT r.id, r.name, r.name_en AS name_en, COUNT(m.id) AS n FROM regions r
          LEFT JOIN members m ON m.region_id = r.id
          WHERE r.id IN (${idList()}) GROUP BY r.id ORDER BY r.id`)
      : [];

  const recent = await db.all<{ id: number; name: string; state_name: string }>(sql`
    SELECT m.id,
      COALESCE(NULLIF(m.name_myanmar, ''), NULLIF(m.name_english, ''), '—') AS name,
      r.name AS state_name, r.name_en AS state_name_en
    FROM members m JOIN regions r ON r.id = m.region_id
    WHERE ${cond} ORDER BY m.id DESC LIMIT 5`);

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
      AND ${cond}
    GROUP BY ag.id
    ORDER BY ag.sort_order, ag.min_age`);

  const familyGroupRow = await db.all<{ members: number; groups: number }>(sql`
    SELECT COUNT(*) AS members, COUNT(DISTINCT family_group_id) AS groups
    FROM members
    WHERE ${cond} AND status = 'active' AND family_group_id IS NOT NULL`);

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
  };
}
