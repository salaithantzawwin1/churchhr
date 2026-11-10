import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import type { AppEnv } from "../env";
import { getDb } from "../db/client";
import { churchDepartments } from "../db/schema";
import { requirePermission } from "../middleware";
import { flashFromQuery } from "../flash";
import { OrganizationPage, type OrgCell, type OrgDepartment, type OrgLeader } from "../views/organization";
import { DepartmentDetailPage, DepartmentsPage, type AdminDepartmentRow } from "../views/departments";
import { asInt, intParam, s } from "../util";

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
             WHERE m.home_cell_id = hc.id AND m.status = 'active') AS member_count
    FROM lookup_options hc
    JOIN regions r ON r.id = hc.region_id
    LEFT JOIN lookup_options t ON t.id = hc.parent_id AND t.type = 'township'
    WHERE hc.type = 'home_cell' AND hc.active = 1 AND ${scopeCond(scope)}
    ORDER BY r.id, t.sort_order, t.label, hc.sort_order, hc.label`);

  const departments = await db.all<OrgDepartment>(sql`
    SELECT d.id, d.name, d.name_en, d.sort_order,
      (SELECT COUNT(*) FROM members m
        WHERE m.department_id = d.id AND m.status = 'active') AS member_count
    FROM church_departments d
    WHERE d.active = 1
    ORDER BY d.sort_order, d.name`);

  const leaders = await db.all<OrgLeader>(sql`
    SELECT mp.position, mp.scope_type, mp.scope_id, mp.department_id,
           m.id AS member_id,
           COALESCE(NULLIF(m.name_myanmar, ''), m.name_english) AS member_name,
           (m.photo IS NOT NULL) AS has_photo, m.updated_at
    FROM member_positions mp
    JOIN members m ON m.id = mp.member_id
    WHERE m.status = 'active'
    ORDER BY mp.position`);

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
      departments={departments} leaders={leaders}
      canManageDepartments={c.get("perms").has("options.manage")}
      unassignedMembers={unassignedRows[0]?.n ?? 0}
    />,
  );
});

// ---------- Department detail ----------

organizationRoutes.get("/departments/:id", requirePermission("members.view"), async (c) => {
  const db = getDb(c.env);
  const id = intParam(c.req.param("id"));
  if (!id) return c.notFound();
  const department = (await db.all<OrgDepartment>(sql`
    SELECT d.id, d.name, d.name_en, d.sort_order,
      (SELECT COUNT(*) FROM members m
        WHERE m.department_id = d.id AND m.status = 'active') AS member_count
    FROM church_departments d WHERE d.id = ${id} LIMIT 1`))[0];
  if (!department) return c.notFound();
  const leaders = await db.all<OrgLeader>(sql`
    SELECT mp.position, mp.scope_type, mp.scope_id, mp.department_id,
           m.id AS member_id,
           COALESCE(NULLIF(m.name_myanmar, ''), m.name_english) AS member_name,
           (m.photo IS NOT NULL) AS has_photo, m.updated_at
    FROM member_positions mp
    JOIN members m ON m.id = mp.member_id
    WHERE mp.scope_type = 'department' AND mp.department_id = ${id} AND m.status = 'active'
    ORDER BY mp.position`);
  return c.html(
    <DepartmentDetailPage
      user={c.get("user")} perms={c.get("perms")}
      flash={flashFromQuery(c.req.query(), c.get("lang"))}
      lang={c.get("lang")} department={department} leaders={leaders}
      canManage={c.get("perms").has("options.manage")}
    />,
  );
});

// ---------- Church departments ----------

async function loadAdminDepartments(db: ReturnType<typeof getDb>): Promise<AdminDepartmentRow[]> {
  return db.all<AdminDepartmentRow>(sql`
    SELECT d.id, d.name, d.name_en AS nameEn, d.active, d.sort_order AS sortOrder,
      (SELECT COALESCE(NULLIF(m.name_myanmar, ''), m.name_english)
         FROM members m JOIN member_positions mp ON mp.member_id = m.id
        WHERE mp.scope_type = 'department' AND mp.department_id = d.id
          AND mp.position = 'department_head' AND m.status = 'active'
        LIMIT 1) AS head_name,
      (SELECT COALESCE(NULLIF(m.name_myanmar, ''), m.name_english)
         FROM members m JOIN member_positions mp ON mp.member_id = m.id
        WHERE mp.scope_type = 'department' AND mp.department_id = d.id
          AND mp.position = 'department_assistant' AND m.status = 'active'
        LIMIT 1) AS assistant_name,
      (SELECT COALESCE(NULLIF(m.name_myanmar, ''), m.name_english)
         FROM members m JOIN member_positions mp ON mp.member_id = m.id
        WHERE mp.scope_type = 'department' AND mp.department_id = d.id
          AND mp.position = 'department_secretary' AND m.status = 'active'
        LIMIT 1) AS secretary_name,
      (SELECT COALESCE(NULLIF(m.name_myanmar, ''), m.name_english)
         FROM members m JOIN member_positions mp ON mp.member_id = m.id
        WHERE mp.scope_type = 'department' AND mp.department_id = d.id
          AND mp.position = 'department_treasurer' AND m.status = 'active'
        LIMIT 1) AS treasurer_name,
      (SELECT COUNT(*) FROM member_positions mp
        WHERE mp.scope_type = 'department' AND mp.department_id = d.id) AS role_count,
      (SELECT COUNT(*) FROM members m
        WHERE m.department_id = d.id AND m.status = 'active') AS member_count
    FROM church_departments d
    ORDER BY d.active DESC, d.sort_order, d.name`);
}

organizationRoutes.get("/departments", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const departments = await loadAdminDepartments(db);
  return c.html(
    <DepartmentsPage
      user={c.get("user")} perms={c.get("perms")}
      flash={flashFromQuery(c.req.query(), c.get("lang"))}
      lang={c.get("lang")} departments={departments}
    />,
  );
});

function departmentSortOrder(raw: string, fallback = 0): number {
  const n = asInt(raw);
  if (n === null || n < 0) return fallback;
  return Math.min(n, 9999);
}

function departmentNameError(name: string, nameEn: string): string | null {
  if (!name) return "department-name-required";
  if (name.length > 80 || nameEn.length > 120) return "department-name-long";
  return null;
}

organizationRoutes.post("/departments", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const body = await c.req.parseBody();
  const name = s(body.name);
  const nameEn = s(body.name_en);
  const invalid = departmentNameError(name, nameEn);
  if (invalid) return c.redirect(`/organization/departments?err=${invalid}`, 303);
  try {
    const duplicate = await db.all<{ id: number }>(sql`
      SELECT id FROM church_departments WHERE lower(name) = lower(${name}) LIMIT 1`);
    if (duplicate.length > 0) return c.redirect("/organization/departments?err=department-name-taken", 303);
    await db.insert(churchDepartments).values({
      name, nameEn: nameEn || null, active: 1,
      sortOrder: departmentSortOrder(s(body.sort_order)),
    });
  } catch {
    return c.redirect("/organization/departments?err=department-name-taken", 303);
  }
  return c.redirect("/organization/departments?ok=department-created", 303);
});

organizationRoutes.post("/departments/:id", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const id = intParam(c.req.param("id"));
  if (!id) return c.redirect("/organization/departments?err=err-notfound", 303);
  const current = (await db.select({
    id: churchDepartments.id, active: churchDepartments.active, sortOrder: churchDepartments.sortOrder,
  }).from(churchDepartments).where(eq(churchDepartments.id, id)))[0];
  if (!current) return c.redirect("/organization/departments?err=err-notfound", 303);

  const body = await c.req.parseBody();
  const name = s(body.name);
  const nameEn = s(body.name_en);
  const invalid = departmentNameError(name, nameEn);
  if (invalid) return c.redirect(`/organization/departments?err=${invalid}`, 303);

  const active = s(body.active) === "1" ? 1 : 0;
  if (current.active === 1 && active === 0) {
    const assigned = await db.all<{ n: number }>(sql`
      SELECT
        (SELECT COUNT(*) FROM member_positions
          WHERE scope_type = 'department' AND department_id = ${id}) +
        (SELECT COUNT(*) FROM members
          WHERE department_id = ${id}) AS n`);
    if ((assigned[0]?.n ?? 0) > 0) {
      return c.redirect("/organization/departments?err=department-in-use", 303);
    }
  }

  try {
    const duplicate = await db.all<{ id: number }>(sql`
      SELECT id FROM church_departments
       WHERE lower(name) = lower(${name}) AND id <> ${id} LIMIT 1`);
    if (duplicate.length > 0) return c.redirect("/organization/departments?err=department-name-taken", 303);
    await db.update(churchDepartments).set({
      name, nameEn: nameEn || null, active,
      sortOrder: departmentSortOrder(s(body.sort_order), current.sortOrder),
    }).where(eq(churchDepartments.id, id));
  } catch {
    return c.redirect("/organization/departments?err=department-name-taken", 303);
  }
  return c.redirect("/organization/departments?ok=department-updated", 303);
});
