import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { AppEnv } from "../env";
import { getDb } from "../db/client";
import { requirePermission } from "../middleware";
import { flashFromQuery } from "../flash";
import { OrganizationPage, type OrgCell } from "../views/organization";

export const organizationRoutes = new Hono<AppEnv>();

type Scope = { scopeAll: boolean; stateIds: number[] };

function scopeOf(c: { get: (k: "scopeAll" | "stateIds") => any }): Scope {
  return { scopeAll: c.get("scopeAll"), stateIds: c.get("stateIds") };
}

/** Restrict the structure to the assigned states (all-state users see all). */
function scopeCond(scope: Scope) {
  if (scope.scopeAll) return sql`1=1`;
  if (scope.stateIds.length === 0) return sql`1=0`;
  return sql`hc.region_id IN (${sql.join(scope.stateIds.map((id) => sql`${id}`), sql`, `)})`;
}

organizationRoutes.get("/", requirePermission("members.view"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const tab = c.req.query("tab") === "home-cells" ? "home-cells" : "church";

  const cells = await db.all<OrgCell>(sql`
    SELECT hc.id, hc.label, hc.code, hc.region_id,
           r.name AS state_name, r.name_en AS state_name_en,
           t.label AS township,
           (SELECT COUNT(*) FROM members m
             WHERE m.home_cell_id = hc.id AND m.status = 'active') AS member_count,
           (SELECT COALESCE(NULLIF(m.name_myanmar, ''), m.name_english)
              FROM members m JOIN member_positions mp ON mp.member_id = m.id
             WHERE mp.scope_type = 'home_cell' AND mp.scope_id = hc.id
               AND mp.position = 'home_cell_leader' AND m.status = 'active'
             LIMIT 1) AS leader_name,
           (SELECT COALESCE(NULLIF(m.name_myanmar, ''), m.name_english)
              FROM members m JOIN member_positions mp ON mp.member_id = m.id
             WHERE mp.scope_type = 'home_cell' AND mp.scope_id = hc.id
               AND mp.position = 'home_cell_assistant' AND m.status = 'active'
             LIMIT 1) AS assistant_name,
           (SELECT COALESCE(NULLIF(m.name_myanmar, ''), m.name_english)
              FROM members m JOIN member_positions mp ON mp.member_id = m.id
             WHERE mp.scope_type = 'home_cell' AND mp.scope_id = hc.id
               AND mp.position = 'home_cell_secretary' AND m.status = 'active'
             LIMIT 1) AS secretary_name,
           (SELECT COALESCE(NULLIF(m.name_myanmar, ''), m.name_english)
              FROM members m JOIN member_positions mp ON mp.member_id = m.id
             WHERE mp.scope_type = 'home_cell' AND mp.scope_id = hc.id
               AND mp.position = 'home_cell_treasurer' AND m.status = 'active'
             LIMIT 1) AS treasurer_name
    FROM lookup_options hc
    JOIN regions r ON r.id = hc.region_id
    LEFT JOIN lookup_options t ON t.id = hc.parent_id AND t.type = 'township'
    WHERE hc.type = 'home_cell' AND hc.active = 1 AND ${scopeCond(scope)}
    ORDER BY r.id, t.sort_order, t.label, hc.sort_order, hc.label`);

  const unassignedRows = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM members m
    WHERE m.home_cell_id IS NULL AND m.status = 'active'
      AND (${scope.scopeAll ? sql`1=1` : scope.stateIds.length === 0
        ? sql`1=0`
        : sql`m.region_id IN (${sql.join(scope.stateIds.map((id) => sql`${id}`), sql`, `)})`})`);

  return c.html(
    <OrganizationPage
      user={c.get("user")} perms={c.get("perms")} flash={flashFromQuery(c.req.query(), c.get("lang"))}
      lang={c.get("lang")} tab={tab} cells={cells}
      unassignedMembers={unassignedRows[0]?.n ?? 0}
    />,
  );
});
