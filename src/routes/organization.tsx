import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { eq, sql } from "drizzle-orm";
import type { AppEnv } from "../env";
import { getDb, type DB } from "../db/client";
import { churchDepartments } from "../db/schema";
import { requirePermission } from "../middleware";
import { flashFromQuery, flashText } from "../flash";
import { OrganizationPage, type OrgCell, type OrgDepartment, type OrgLeader } from "../views/organization";
import { DepartmentDetailPage, DepartmentModal, DepartmentsPage, type AdminDepartmentRow } from "../views/departments";
import { ForbiddenPage } from "../views/errors";
import { RegionalChurchesPage, PositionsPage, PositionModal, RegionalChurchModal, type ListStatus, type RegionalValues } from "../views/org-settings";
import { SupervisionClusterModal, SupervisionClustersPage, type ClusterHomeCell, type ClusterValues } from "../views/clusters";
import { PositionHistoryPage } from "../views/position-history";
import { VacancyReportPage } from "../views/vacancies";
import { VACANCY_SCOPES, loadVacancyReport, type VacancyScope } from "../vacancies";
import { diffPositionDefs, loadPositionHistory, recordPositionHistory } from "../position-history";
import { loadPositionDefs, codeFromEnglishName, isConfigurableScope, type ConfigurablePositionScope, type PositionDefRow } from "../position-catalog";
import { clusterName, loadRegionalChurches, loadSupervisionClusters, regionalChurchName, type RegionalChurchRow, type SupervisionClusterRow } from "../org-units";
import { loadPastor, loadPastorOptions, loadPastors, pastorName, type PastorRow } from "../pastors";
import { PastorsPage, PastorModal, PastorDetailPage, type PastorValues } from "../views/pastors";
import { buildCsv } from "../csv";
import { getDict } from "../i18n";
import { asInt, intParam, s, todayInYangon } from "../util";

export const organizationRoutes = new Hono<AppEnv>();

/** Positions and departments are church-wide, so only an all-state options
 *  administrator may change them. State-scoped managers keep their regional
 *  church and Home Cell settings. */
const requireAllStates = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("scopeAll")) {
    return c.html(<ForbiddenPage path={new URL(c.req.url).pathname} lang={c.get("lang")} />, 403);
  }
  await next();
});

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

/** True when a Regional Church's state is inside the signed-in user's scope. */
function regionInScope(scope: Scope, regionId: number): boolean {
  return scope.scopeAll || scope.stateIds.includes(regionId);
}

organizationRoutes.get("/", requirePermission("members.view"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const tabParam = c.req.query("tab");
  const tab: "church" | "main" | "regional" | "home-cells" =
    tabParam === "home-cells" ? "home-cells"
      : tabParam === "regional" ? "regional"
        : tabParam === "main" ? "main"
          : "church";

  const cells = await db.all<OrgCell>(sql`
    SELECT hc.id, hc.label, hc.code, hc.region_id,
           hc.parent_id AS township_id,
           hc.regional_church_id,
           r.name AS state_name, r.name_en AS state_name_en,
           t.label AS township,
           hc.supervision_cluster_id,
           (SELECT COUNT(*) FROM members m
             WHERE m.home_cell_id = hc.id AND m.status = 'active') AS member_count
    FROM lookup_options hc
    JOIN regions r ON r.id = hc.region_id
    LEFT JOIN lookup_options t ON t.id = hc.parent_id AND t.type = 'township'
    WHERE hc.type = 'home_cell' AND hc.active = 1 AND ${scopeCond(scope)}
    ORDER BY r.id, t.sort_order, t.label, hc.sort_order, hc.label`);

  const regionalChurches = await loadRegionalChurches(db, { scopeAll: scope.scopeAll, stateIds: scope.stateIds });
  const clusters = await loadSupervisionClusters(db, { scopeAll: scope.scopeAll, stateIds: scope.stateIds });
  const positionDefs = await loadPositionDefs(db);

  const departments = await db.all<OrgDepartment>(sql`
    SELECT d.id, d.name, d.name_en, d.sort_order,
      (SELECT COUNT(*) FROM members m
        WHERE m.department_id = d.id AND m.status = 'active') AS member_count,
      (SELECT GROUP_CONCAT(DISTINCT hc.regional_church_id)
         FROM members m JOIN lookup_options hc ON hc.id = m.home_cell_id
        WHERE m.department_id = d.id AND m.status = 'active'
          AND hc.regional_church_id IS NOT NULL) AS church_ids
    FROM church_departments d
    WHERE d.active = 1
    ORDER BY d.sort_order, d.name`);

  const leaders = await db.all<OrgLeader>(sql`
    SELECT mp.position, mp.scope_type, mp.scope_id, mp.department_id, mp.regional_church_id,
           mp.supervision_cluster_id,
           m.id AS member_id,
           COALESCE(NULLIF(m.name_myanmar, ''), m.name_english) AS member_name,
           (m.photo IS NOT NULL) AS has_photo, m.updated_at
    FROM member_positions mp
    JOIN members m ON m.id = mp.member_id
    WHERE m.status = 'active'
    UNION ALL
    SELECT 'cluster_pastor' AS position, 'cluster' AS scope_type, NULL AS scope_id,
           NULL AS department_id, NULL AS regional_church_id,
           cp.cluster_id AS supervision_cluster_id,
           NULL AS member_id,
           COALESCE(NULLIF(p.name, ''), p.name_en) AS member_name,
           0 AS has_photo, p.updated_at
    FROM cluster_pastor_assignments cp
    JOIN pastors p ON p.id = cp.pastor_id
    WHERE p.active = 1
    ORDER BY position`);

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
      regionalChurches={regionalChurches} clusters={clusters} positionDefs={positionDefs}
      canManageDepartments={c.get("perms").has("options.manage") && scope.scopeAll}
      canManageStructure={c.get("perms").has("options.manage")}
      canManageClusters={c.get("perms").has("options.manage")}
      canManagePositions={c.get("perms").has("options.manage") && scope.scopeAll}
      selectedChurchId={intParam(c.req.query("church"))}
      region={intParam(c.req.query("region"))}
      unassignedMembers={unassignedRows[0]?.n ?? 0}
    />,
  );
});

// ---------- Department detail ----------

organizationRoutes.get("/departments/new", requirePermission("options.manage"), requireAllStates, async (c) => {
  if (!modalRequest(c)) return c.redirect("/organization/departments", 303);
  return c.html(<DepartmentModal lang={c.get("lang")} />);
});

organizationRoutes.get("/departments/:id/edit", requirePermission("options.manage"), requireAllStates, async (c) => {
  const db = getDb(c.env);
  const id = intParam(c.req.param("id"));
  const department = id ? (await loadAdminDepartments(db)).find((d) => d.id === id) : undefined;
  if (!department) return c.redirect("/organization/departments?err=err-notfound", 303);
  if (!modalRequest(c)) return c.redirect("/organization/departments", 303);
  return c.html(<DepartmentModal department={department} lang={c.get("lang")} />);
});

organizationRoutes.get("/departments/:id", requirePermission("members.view"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  if (!id) return c.notFound();
  const department = (await db.all<OrgDepartment>(sql`
    SELECT d.id, d.name, d.name_en, d.sort_order,
      (SELECT COUNT(*) FROM members m
        WHERE m.department_id = d.id AND m.status = 'active') AS member_count
    FROM church_departments d WHERE d.id = ${id} LIMIT 1`))[0];
  if (!department) return c.notFound();
  const leaders = await db.all<OrgLeader>(sql`
    SELECT mp.position, mp.scope_type, mp.scope_id, mp.department_id, mp.regional_church_id,
           mp.supervision_cluster_id,
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
      canManage={c.get("perms").has("options.manage") && scope.scopeAll}
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

organizationRoutes.get("/departments", requirePermission("options.manage"), requireAllStates, async (c) => {
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

organizationRoutes.post("/departments", requirePermission("options.manage"), requireAllStates, async (c) => {
  const db = getDb(c.env);
  const body = await c.req.parseBody();
  const name = s(body.name);
  const nameEn = s(body.name_en);
  const sortOrder = departmentSortOrder(s(body.sort_order));
  const values = { name, nameEn, sortOrder, active: true };
  const modal = modalRequest(c);
  const fail = async (code: string) => modal
    ? c.html(<DepartmentModal values={values} error={flashText(code, c.get("lang"))} lang={c.get("lang")} />, 422)
    : c.redirect(`/organization/departments?err=${code}`, 303);
  const invalid = departmentNameError(name, nameEn);
  if (invalid) return await fail(invalid);
  try {
    const duplicate = await db.all<{ id: number }>(sql`
      SELECT id FROM church_departments WHERE lower(name) = lower(${name}) LIMIT 1`);
    if (duplicate.length > 0) return await fail("department-name-taken");
    await db.insert(churchDepartments).values({
      name, nameEn: nameEn || null, active: 1, sortOrder,
    });
  } catch {
    return await fail("department-name-taken");
  }
  const landing = "/organization/departments?ok=department-created";
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

organizationRoutes.post("/departments/:id", requirePermission("options.manage"), requireAllStates, async (c) => {
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
  const active = s(body.active) === "1" ? 1 : 0;
  const sortOrder = departmentSortOrder(s(body.sort_order), current.sortOrder);
  const department = (await loadAdminDepartments(db)).find((d) => d.id === id)!;
  const values = { name, nameEn, sortOrder, active: active === 1 };
  const modal = modalRequest(c);
  const fail = async (code: string) => modal
    ? c.html(
      <DepartmentModal department={department} values={values} error={flashText(code, c.get("lang"))} lang={c.get("lang")} />,
      422,
    )
    : c.redirect(`/organization/departments?err=${code}`, 303);
  const invalid = departmentNameError(name, nameEn);
  if (invalid) return await fail(invalid);

  if (current.active === 1 && active === 0) {
    const assigned = await db.all<{ n: number }>(sql`
      SELECT
        (SELECT COUNT(*) FROM member_positions
          WHERE scope_type = 'department' AND department_id = ${id}) +
        (SELECT COUNT(*) FROM members
          WHERE department_id = ${id}) AS n`);
    if ((assigned[0]?.n ?? 0) > 0) {
      return await fail("department-in-use");
    }
  }

  try {
    const duplicate = await db.all<{ id: number }>(sql`
      SELECT id FROM church_departments
       WHERE lower(name) = lower(${name}) AND id <> ${id} LIMIT 1`);
    if (duplicate.length > 0) return await fail("department-name-taken");
    await db.update(churchDepartments).set({
      name, nameEn: nameEn || null, active, sortOrder,
    }).where(eq(churchDepartments.id, id));
  } catch {
    return await fail("department-name-taken");
  }
  const landing = "/organization/departments?ok=department-updated";
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

// ---------- Editable position catalogue ----------

async function adminPositionDefs(db: DB): Promise<PositionDefRow[]> {
  return db.all<PositionDefRow>(sql`
    SELECT pd.id, pd.scope_type AS scopeType, pd.code,
           pd.name_myanmar AS nameMyanmar, pd.name_english AS nameEnglish,
           pd.name_korean AS nameKorean, pd.active, pd.sort_order AS sortOrder,
           (SELECT COUNT(*) FROM member_positions mp
             WHERE mp.position = pd.code AND mp.scope_type = pd.scope_type) AS usageCount
    FROM position_defs pd
    ORDER BY pd.scope_type, pd.sort_order, pd.id`);
}

function positionScopeFrom(value: string | undefined): ConfigurablePositionScope {
  return isConfigurableScope(value) ? value : "church";
}

function listQuery(raw: string | undefined): string {
  return (raw ?? "").slice(0, 80);
}

function listStatus(raw: string | undefined): ListStatus {
  return raw === "active" || raw === "inactive" ? raw : "all";
}

function positionNameError(nameMm: string, nameEn: string): string | null {
  if (!nameMm) return "position-name-mm";
  if (nameMm.length > 100 || nameEn.length > 100) return "position-name-long";
  return null;
}

/** The settings modals fetch a bare form with this header; a direct visit
 *  falls back to the list page instead of rendering a form without a shell. */
function modalRequest(c: { req: { header: (name: string) => string | undefined } }): boolean {
  return c.req.header("X-Requested-With") === "modal";
}

organizationRoutes.get("/positions", requirePermission("options.manage"), requireAllStates, async (c) => {
  const db = getDb(c.env);
  const scope = positionScopeFrom(c.req.query("scope"));
  const defs = await adminPositionDefs(db);
  return c.html(
    <PositionsPage
      user={c.get("user")} perms={c.get("perms")}
      flash={flashFromQuery(c.req.query(), c.get("lang"))}
      lang={c.get("lang")} scope={scope} defs={defs}
      q={listQuery(c.req.query("q"))} status={listStatus(c.req.query("status"))}
    />,
  );
});

organizationRoutes.get("/positions/new", requirePermission("options.manage"), requireAllStates, async (c) => {
  const scope = positionScopeFrom(c.req.query("scope"));
  if (!modalRequest(c)) return c.redirect(`/organization/positions?scope=${scope}`, 303);
  return c.html(<PositionModal scope={scope} lang={c.get("lang")} />);
});

organizationRoutes.get("/positions/:id/edit", requirePermission("options.manage"), requireAllStates, async (c) => {
  const db = getDb(c.env);
  const id = intParam(c.req.param("id"));
  const def = id ? (await adminPositionDefs(db)).find((d) => d.id === id) : undefined;
  if (!def) return c.redirect("/organization/positions?err=err-notfound", 303);
  if (!modalRequest(c)) return c.redirect(`/organization/positions?scope=${def.scopeType}`, 303);
  return c.html(<PositionModal scope={def.scopeType} def={def} lang={c.get("lang")} />);
});

organizationRoutes.post("/positions", requirePermission("options.manage"), requireAllStates, async (c) => {
  const db = getDb(c.env);
  const body = await c.req.parseBody();
  const scope = positionScopeFrom(s(body.scope));
  const back = `/organization/positions?scope=${scope}`;
  const nameMm = s(body.name_myanmar).slice(0, 100);
  const nameEn = s(body.name_english).slice(0, 100);
  const nameKr = s(body.name_korean).slice(0, 100);
  const sortOrder = departmentSortOrder(s(body.sort_order));
  const values = { nameMyanmar: nameMm, nameEnglish: nameEn, nameKorean: nameKr, sortOrder, active: true };
  // A modal submit gets the form back with the error instead of a redirect, so
  // the dialog stays open and keeps what was typed.
  const modal = modalRequest(c);
  const fail = (err: string) => modal
    ? c.html(<PositionModal scope={scope} values={values} error={flashText(err, c.get("lang"))} lang={c.get("lang")} />, 422)
    : c.redirect(`${back}&err=${err}`, 303);
  const invalid = positionNameError(nameMm, nameEn);
  if (invalid) return fail(invalid);
  if (!nameEn) return fail("position-name-en");

  const base = codeFromEnglishName(scope, nameEn);
  let code = base;
  for (let n = 2; n < 50; n += 1) {
    const existing = await db.all<{ id: number }>(sql`
      SELECT id FROM position_defs WHERE scope_type = ${scope} AND code = ${code} LIMIT 1`);
    if (existing.length === 0) break;
    code = `${base}_${n}`;
  }
  try {
    await db.run(sql`
      INSERT INTO position_defs (scope_type, code, name_myanmar, name_english, name_korean, active, sort_order)
      VALUES (${scope}, ${code}, ${nameMm}, ${nameEn || null}, ${nameKr || null}, 1, ${sortOrder})`);
  } catch {
    return fail("position-code-taken");
  }
  const created = (await db.all<{ id: number }>(sql`
    SELECT id FROM position_defs WHERE scope_type = ${scope} AND code = ${code} LIMIT 1`))[0];
  await recordPositionHistory(db, {
    entity: "def", action: "created", actorId: c.get("user").id,
    scopeType: scope, code, positionDefId: created?.id ?? null,
    summary: nameEn || nameMm,
  });
  const landing = `${back}&ok=position-created`;
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

organizationRoutes.post("/positions/:id", requirePermission("options.manage"), requireAllStates, async (c) => {
  const db = getDb(c.env);
  const id = intParam(c.req.param("id"));
  if (!id) return c.redirect("/organization/positions?err=err-notfound", 303);
  const current = (await db.all<PositionDefRow>(sql`
    SELECT id, scope_type AS scopeType, code, name_myanmar AS nameMyanmar,
           name_english AS nameEnglish, name_korean AS nameKorean, active,
           sort_order AS sortOrder
    FROM position_defs WHERE id = ${id} LIMIT 1`))[0];
  if (!current) return c.redirect("/organization/positions?err=err-notfound", 303);
  const back = `/organization/positions?scope=${current.scopeType}`;
  const body = await c.req.parseBody();
  const nameMm = s(body.name_myanmar).slice(0, 100);
  const nameEn = s(body.name_english).slice(0, 100);
  const nameKr = s(body.name_korean).slice(0, 100);
  const active = s(body.active) === "1" ? 1 : 0;
  const sortOrder = departmentSortOrder(s(body.sort_order), current.sortOrder);
  const values = {
    nameMyanmar: nameMm, nameEnglish: nameEn, nameKorean: nameKr,
    sortOrder, active: active === 1,
  };
  const modal = modalRequest(c);
  const fail = async (err: string) => {
    if (!modal) return c.redirect(`${back}&err=${err}`, 303);
    const def = (await adminPositionDefs(db)).find((d) => d.id === id);
    return c.html(
      <PositionModal scope={current.scopeType} def={def} values={values}
        error={flashText(err, c.get("lang"))} lang={c.get("lang")} />,
      422,
    );
  };
  const invalid = positionNameError(nameMm, nameEn);
  if (invalid) return await fail(invalid);
  if (current.active === 1 && active === 0) {
    const used = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM member_positions
      WHERE position = ${current.code} AND scope_type = ${current.scopeType}`);
    if ((used[0]?.n ?? 0) > 0) return await fail("position-in-use");
  }
  await db.run(sql`
    UPDATE position_defs
       SET name_myanmar = ${nameMm}, name_english = ${nameEn || null}, name_korean = ${nameKr || null},
           active = ${active}, sort_order = ${sortOrder},
           updated_at = unixepoch()
     WHERE id = ${id}`);
  const changes = diffPositionDefs(current, {
    nameMyanmar: nameMm, nameEnglish: nameEn || null, nameKorean: nameKr || null, active, sortOrder,
  });
  if (changes.length > 0) {
    await recordPositionHistory(db, {
      entity: "def", action: "updated", actorId: c.get("user").id,
      scopeType: current.scopeType, code: current.code, positionDefId: id,
      summary: nameEn || nameMm, changes,
    });
  }
  const landing = `${back}&ok=position-updated`;
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

organizationRoutes.post("/positions/:id/delete", requirePermission("options.manage"), requireAllStates, async (c) => {
  const db = getDb(c.env);
  const id = intParam(c.req.param("id"));
  if (!id) return c.redirect("/organization/positions?err=err-notfound", 303);
  const current = (await db.all<{ scopeType: string; code: string; nameMyanmar: string; nameEnglish: string | null }>(sql`
    SELECT scope_type AS scopeType, code, name_myanmar AS nameMyanmar, name_english AS nameEnglish
    FROM position_defs WHERE id = ${id} LIMIT 1`))[0];
  if (!current) return c.redirect("/organization/positions?err=err-notfound", 303);
  const back = `/organization/positions?scope=${current.scopeType}`;
  const used = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM member_positions
    WHERE position = ${current.code} AND scope_type = ${current.scopeType}`);
  if ((used[0]?.n ?? 0) > 0) return c.redirect(`${back}&err=position-in-use`, 303);
  await db.run(sql`DELETE FROM position_defs WHERE id = ${id}`);
  await recordPositionHistory(db, {
    entity: "def", action: "deleted", actorId: c.get("user").id,
    scopeType: current.scopeType, code: current.code, positionDefId: id,
    summary: current.nameEnglish || current.nameMyanmar,
  });
  return c.redirect(`${back}&ok=position-deleted`, 303);
});

// ---------- Position change history ----------

organizationRoutes.get("/positions/history", requirePermission("options.manage"), requireAllStates, async (c) => {
  const db = getDb(c.env);
  const rawType = c.req.query("type");
  const filter = rawType === "def" || rawType === "assignment" ? rawType : "all";
  const rows = await loadPositionHistory(db, { entity: filter, limit: 300 });
  return c.html(
    <PositionHistoryPage
      user={c.get("user")} perms={c.get("perms")}
      flash={flashFromQuery(c.req.query(), c.get("lang"))}
      lang={c.get("lang")} rows={rows} filter={filter}
    />,
  );
});

// ---------- Vacancy report ----------

function vacancyScopeFrom(value: string | undefined): VacancyScope | null {
  return value && (VACANCY_SCOPES as readonly string[]).includes(value) ? value as VacancyScope : null;
}

organizationRoutes.get("/vacancies", requirePermission("members.view"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const scopeFilter = vacancyScopeFrom(c.req.query("scope"));
  const report = await loadVacancyReport(db, {
    scopeAll: scope.scopeAll, stateIds: scope.stateIds,
    lang: c.get("lang"), scope: scopeFilter ?? undefined,
  });
  return c.html(
    <VacancyReportPage
      user={c.get("user")} perms={c.get("perms")}
      flash={flashFromQuery(c.req.query(), c.get("lang"))}
      lang={c.get("lang")} report={report} scope={scopeFilter}
    />,
  );
});

organizationRoutes.get("/vacancies.csv", requirePermission("members.view"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const lang = c.get("lang");
  const t = getDict(lang);
  const scopeFilter = vacancyScopeFrom(c.req.query("scope"));
  const report = await loadVacancyReport(db, {
    scopeAll: scope.scopeAll, stateIds: scope.stateIds, lang, scope: scopeFilter ?? undefined,
  });
  const scopeLabels: Record<VacancyScope, string> = {
    church: t("vacancy.scopeChurch"),
    regional_church: t("vacancy.scopeRegional"),
    cluster: t("vacancy.scopeCluster"),
    home_cell: t("vacancy.scopeHomeCell"),
    township: t("vacancy.scopeSupervision"),
    department: t("vacancy.scopeDepartment"),
  };
  const rows: string[][] = [[
    t("vacancy.colScope"), t("vacancy.colStructure"), t("vacancy.colState"),
    t("vacancy.colTownship"), t("vacancy.colRegional"), t("vacancy.colPosition"),
    t("vacancy.colCode"), t("vacancy.colSlots"), t("vacancy.colFilled"), t("vacancy.colVacant"),
  ]];
  for (const structure of report.structures) {
    for (const item of structure.vacancies) {
      rows.push([
        scopeLabels[structure.scope], structure.name, structure.stateName ?? "",
        structure.townshipName ?? "", structure.regionalChurchName ?? "",
        item.name, item.code, String(structure.slots), String(structure.filled),
        String(structure.vacancies.length),
      ]);
    }
  }
  const csv = "\uFEFF" + buildCsv(rows);
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="position-vacancies-${todayInYangon()}.csv"`,
  });
});

// ---------- Regional churches ----------

async function orgRegions(db: DB, scope: Scope, lang: string): Promise<{ id: number; name: string }[]> {
  const conditions = [sql`1=1`];
  if (!scope.scopeAll) {
    if (scope.stateIds.length === 0) conditions.push(sql`1=0`);
    else conditions.push(sql`id IN (${sql.join(scope.stateIds.map((id) => sql`${id}`), sql`, `)})`);
  }
  return db.all<{ id: number; name: string }>(sql`
    SELECT id, ${lang !== "mm" ? sql`COALESCE(name_en, name)` : sql`name`} AS name
    FROM regions WHERE ${sql.join(conditions, sql` AND `)} ORDER BY id`);
}

type AdminHomeCell = {
  id: number; label: string; regionId: number; regionalChurchId: number | null;
  supervisionClusterId: number | null; township: string | null;
};

async function loadAdminHomeCells(db: DB, scope: Scope): Promise<AdminHomeCell[]> {
  const conditions = [sql`hc.type = 'home_cell'`, sql`hc.active = 1`];
  if (!scope.scopeAll) {
    if (scope.stateIds.length === 0) conditions.push(sql`1=0`);
    else conditions.push(sql`hc.region_id IN (${sql.join(scope.stateIds.map((id) => sql`${id}`), sql`, `)})`);
  }
  return db.all<AdminHomeCell>(sql`
    SELECT hc.id, hc.label, hc.region_id AS regionId, hc.regional_church_id AS regionalChurchId,
           hc.supervision_cluster_id AS supervisionClusterId, t.label AS township
    FROM lookup_options hc
    LEFT JOIN lookup_options t ON t.id = hc.parent_id AND t.type = 'township'
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY hc.region_id, t.sort_order, t.label, hc.sort_order, hc.label`);
}

organizationRoutes.get("/regional-churches", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const churches = await loadRegionalChurches(db, { activeOnly: false, scopeAll: scope.scopeAll, stateIds: scope.stateIds });
  const regions = await orgRegions(db, scope, c.get("lang"));
  const homeCells = await loadAdminHomeCells(db, scope);
  return c.html(
    <RegionalChurchesPage
      user={c.get("user")} perms={c.get("perms")}
      flash={flashFromQuery(c.req.query(), c.get("lang"))}
      lang={c.get("lang")} churches={churches} regions={regions} homeCells={homeCells}
      q={listQuery(c.req.query("q"))} status={listStatus(c.req.query("status"))}
      region={intParam(c.req.query("region"))}
    />,
  );
});

organizationRoutes.get("/regional-churches/new", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  if (!modalRequest(c)) return c.redirect("/organization/regional-churches", 303);
  return c.html(
    <RegionalChurchModal
      regions={await orgRegions(db, scope, c.get("lang"))}
      homeCells={await loadAdminHomeCells(db, scope)}
      lang={c.get("lang")}
    />,
  );
});

organizationRoutes.get("/regional-churches/:id/edit", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  const church = id
    ? (await loadRegionalChurches(db, { activeOnly: false, scopeAll: scope.scopeAll, stateIds: scope.stateIds })).find((r) => r.id === id)
    : undefined;
  if (!church) return c.redirect("/organization/regional-churches?err=err-notfound", 303);
  if (!modalRequest(c)) return c.redirect("/organization/regional-churches", 303);
  return c.html(
    <RegionalChurchModal
      church={church}
      regions={await orgRegions(db, scope, c.get("lang"))}
      homeCells={await loadAdminHomeCells(db, scope)}
      lang={c.get("lang")}
    />,
  );
});

async function regionalChurchNameTaken(db: DB, name: string, exceptId?: number): Promise<boolean> {
  const rows = await db.all<{ id: number }>(sql`
    SELECT id FROM regional_churches WHERE lower(name) = lower(${name}) LIMIT 1`);
  return rows.some((r) => r.id !== exceptId);
}

organizationRoutes.post("/regional-churches", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const body = await c.req.parseBody();
  const name = s(body.name).slice(0, 80);
  const nameEn = s(body.name_en).slice(0, 120);
  const regionId = asInt(s(body.region_id));
  const sortOrder = departmentSortOrder(s(body.sort_order));
  const values: RegionalValues = { name, nameEn, regionId: regionId ?? "", sortOrder, active: true };
  // A modal submit gets the sheet back with the error so the dialog stays open
  // and keeps what was typed; a valid save only returns where to land.
  const modal = modalRequest(c);
  const fail = async (err: string) => {
    if (!modal) return c.redirect(`/organization/regional-churches?err=${err}`, 303);
    return c.html(
      <RegionalChurchModal
        regions={await orgRegions(db, scope, c.get("lang"))}
        homeCells={await loadAdminHomeCells(db, scope)}
        values={values} error={flashText(err, c.get("lang"))} lang={c.get("lang")}
      />,
      422,
    );
  };
  if (!name) return await fail("regional-name-required");
  if (!regionId) return await fail("regional-state-required");
  const allowedRegions = await orgRegions(db, scope, c.get("lang"));
  if (!allowedRegions.some((r) => r.id === regionId)) return await fail("err-scope");
  if (await regionalChurchNameTaken(db, name)) return await fail("regional-name-taken");
  try {
    await db.run(sql`
      INSERT INTO regional_churches (name, name_en, region_id, active, sort_order)
      VALUES (${name}, ${nameEn || null}, ${regionId}, 1, ${sortOrder})`);
  } catch {
    return await fail("regional-name-taken");
  }
  const landing = "/organization/regional-churches?ok=regional-created";
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

organizationRoutes.post("/regional-churches/:id", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  if (!id) return c.redirect("/organization/regional-churches?err=err-notfound", 303);
  const current = (await db.all<Pick<RegionalChurchRow, "id" | "name" | "nameEn" | "regionId" | "active" | "sortOrder">>(sql`
    SELECT id, name, name_en AS nameEn, region_id AS regionId, active, sort_order AS sortOrder
    FROM regional_churches WHERE id = ${id} LIMIT 1`))[0];
  if (!current || !regionInScope(scope, current.regionId)) {
    return c.redirect("/organization/regional-churches?err=err-notfound", 303);
  }
  // Details + Home Cells are one form now: read the raw form data so every
  // ticked Home Cell survives repeated checkbox names.
  const form = await c.req.formData();
  const field = (key: string) => String(form.get(key) ?? "");
  const name = field("name").slice(0, 80);
  const nameEn = field("name_en").slice(0, 120);
  const regionId = asInt(field("region_id")) ?? current.regionId;
  const active = field("active") === "1" ? 1 : 0;
  const sortOrder = departmentSortOrder(field("sort_order"), current.sortOrder);
  const selectedCellIds = form.getAll("home_cell_ids")
    .map((v) => Number(String(v)))
    .filter((n) => Number.isInteger(n) && n > 0);
  const cellsPresent = form.has("cells_present");
  const values: RegionalValues = { name, nameEn, regionId, sortOrder, active: active === 1 };
  const modal = modalRequest(c);
  const fail = async (err: string | null, cellErr?: string) => {
    const code = cellErr || err || "err-notfound";
    if (!modal) return c.redirect(`/organization/regional-churches?err=${code}`, 303);
    const church = (await loadRegionalChurches(db, { activeOnly: false, scopeAll: scope.scopeAll, stateIds: scope.stateIds }))
      .find((r) => r.id === id);
    return c.html(
      <RegionalChurchModal
        church={church}
        regions={await orgRegions(db, scope, c.get("lang"))}
        homeCells={await loadAdminHomeCells(db, scope)}
        values={values}
        error={err ? flashText(err, c.get("lang")) : null}
        cellError={cellErr ? flashText(cellErr, c.get("lang")) : null}
        selectedCellIds={selectedCellIds}
        lang={c.get("lang")}
      />,
      422,
    );
  };
  if (!name) return await fail("regional-name-required");
  const allowedRegions = await orgRegions(db, scope, c.get("lang"));
  if (!allowedRegions.some((r) => r.id === regionId)) return await fail("err-scope");
  if (await regionalChurchNameTaken(db, name, id)) return await fail("regional-name-taken");
  const attached = await db.all<{ n: number }>(sql`
    SELECT
      (SELECT COUNT(*) FROM lookup_options WHERE regional_church_id = ${id}) +
      (SELECT COUNT(*) FROM member_positions WHERE regional_church_id = ${id}) AS n`);
  const used = attached[0]?.n ?? 0;
  if (regionId !== current.regionId && used > 0) return await fail("regional-state-locked");
  if (current.active === 1 && active === 0 && used > 0) return await fail("regional-in-use");
  if (cellsPresent && selectedCellIds.length > 0) {
    const valid = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM lookup_options
      WHERE type = 'home_cell' AND region_id = ${regionId}
        AND (regional_church_id IS NULL OR regional_church_id = ${id})
        AND id IN (${sql.join(selectedCellIds.map((v) => sql`${v}`), sql`, `)})`);
    if ((valid[0]?.n ?? 0) !== selectedCellIds.length) {
      return await fail(null, "regional-cell-invalid");
    }
  }
  await db.run(sql`
    UPDATE regional_churches
       SET name = ${name}, name_en = ${nameEn || null}, region_id = ${regionId},
           active = ${active}, sort_order = ${sortOrder}
     WHERE id = ${id}`);
  if (cellsPresent) {
    await db.run(sql`UPDATE lookup_options SET regional_church_id = NULL WHERE regional_church_id = ${id}`);
    if (selectedCellIds.length > 0) {
      await db.run(sql`
        UPDATE lookup_options SET regional_church_id = ${id}
        WHERE id IN (${sql.join(selectedCellIds.map((v) => sql`${v}`), sql`, `)})`);
    }
  }
  const landing = "/organization/regional-churches?ok=regional-updated";
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

organizationRoutes.post("/regional-churches/:id/cells", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  if (!id) return c.redirect("/organization/regional-churches?err=err-notfound", 303);
  const church = (await db.all<{ id: number; regionId: number }>(sql`
    SELECT id, region_id AS regionId FROM regional_churches WHERE id = ${id} LIMIT 1`))[0];
  if (!church || !regionInScope(scope, church.regionId)) {
    return c.redirect("/organization/regional-churches?err=err-notfound", 303);
  }
  // Checkboxes share one name, and parseBody keeps only the last value, so the
  // raw form data is read to keep every ticked Home Cell. Clearing the last
  // attachment arrives with no body at all, which leaves the list empty.
  let ids: number[] = [];
  try {
    const form = await c.req.formData();
    ids = form.getAll("home_cell_ids")
      .map((v) => Number(String(v)))
      .filter((n) => Number.isInteger(n) && n > 0);
  } catch {
    ids = [];
  }
  const modal = modalRequest(c);
  if (ids.length > 0) {
    const valid = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM lookup_options
      WHERE type = 'home_cell' AND region_id = ${church.regionId}
        AND (regional_church_id IS NULL OR regional_church_id = ${id})
        AND id IN (${sql.join(ids.map((v) => sql`${v}`), sql`, `)})`);
    if ((valid[0]?.n ?? 0) !== ids.length) {
      if (!modal) return c.redirect("/organization/regional-churches?err=regional-cell-invalid", 303);
      // Keep the sheet open with the rejected picks still ticked.
      const row = (await loadRegionalChurches(db, { activeOnly: false, scopeAll: scope.scopeAll, stateIds: scope.stateIds }))
        .find((r) => r.id === id);
      return c.html(
        <RegionalChurchModal
          church={row}
          regions={await orgRegions(db, scope, c.get("lang"))}
          homeCells={await loadAdminHomeCells(db, scope)}
          cellError={flashText("regional-cell-invalid", c.get("lang"))}
          selectedCellIds={ids}
          lang={c.get("lang")}
        />,
        422,
      );
    }
  }
  await db.run(sql`UPDATE lookup_options SET regional_church_id = NULL WHERE regional_church_id = ${id}`);
  if (ids.length > 0) {
    await db.run(sql`
      UPDATE lookup_options SET regional_church_id = ${id}
      WHERE id IN (${sql.join(ids.map((v) => sql`${v}`), sql`, `)})`);
  }
  const landing = "/organization/regional-churches?ok=regional-cells";
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

organizationRoutes.post("/regional-churches/:id/delete", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  if (!id) return c.redirect("/organization/regional-churches?err=err-notfound", 303);
  const church = (await db.all<{ regionId: number }>(sql`
    SELECT region_id AS regionId FROM regional_churches WHERE id = ${id} LIMIT 1`))[0];
  if (!church || !regionInScope(scope, church.regionId)) {
    return c.redirect("/organization/regional-churches?err=err-notfound", 303);
  }
  const used = await db.all<{ n: number }>(sql`
    SELECT
      (SELECT COUNT(*) FROM lookup_options WHERE regional_church_id = ${id}) +
      (SELECT COUNT(*) FROM member_positions WHERE regional_church_id = ${id}) AS n`);
  if ((used[0]?.n ?? 0) > 0) return c.redirect("/organization/regional-churches?err=regional-in-use", 303);
  await db.run(sql`DELETE FROM regional_churches WHERE id = ${id}`);
  return c.redirect("/organization/regional-churches?ok=regional-deleted", 303);
});

// ---------- Pastors ----------

async function pastorChurches(db: DB, scope: Scope, lang: string): Promise<{ id: number; name: string; regionId: number }[]> {
  const rows = await loadRegionalChurches(db, {
    activeOnly: true, scopeAll: scope.scopeAll, stateIds: scope.stateIds,
  });
  return rows.map((c) => ({ id: c.id, name: regionalChurchName(c, lang), regionId: c.regionId }));
}

function pastorSortOrder(raw: string, fallback = 0): number {
  const n = asInt(raw);
  if (n === null || n < 0) return fallback;
  return Math.min(n, 9999);
}

async function pastorNameTaken(
  db: DB, name: string, regionId: number, churchId: number | null, exceptId?: number,
): Promise<boolean> {
  const rows = await db.all<{ id: number }>(sql`
    SELECT id FROM pastors
     WHERE lower(name) = lower(${name}) AND region_id = ${regionId}
       AND COALESCE(regional_church_id, 0) = ${churchId ?? 0}
     LIMIT 1`);
  return rows.some((r) => r.id !== exceptId);
}

async function validPastorChurch(db: DB, churchId: number | null, regionId: number): Promise<boolean> {
  if (churchId == null) return true;
  const rows = await db.all<{ id: number }>(sql`
    SELECT id FROM regional_churches
     WHERE id = ${churchId} AND region_id = ${regionId} AND active = 1 LIMIT 1`);
  return rows.length > 0;
}

/** Same 500×500 WebP data URL contract the member photo pipeline produces. */
const MAX_PASTOR_PHOTO_BYTES = 400 * 1024;
type PastorPhotoInput = { bytes: Uint8Array | null; touched: boolean; error: string | null };

function parsePastorPhoto(body: Record<string, unknown>): PastorPhotoInput {
  if (s(body.photo_remove) === "1") return { bytes: null, touched: true, error: null };
  const raw = s(body.photo_data);
  if (!raw) return { bytes: null, touched: false, error: null };
  const match = /^data:image\/webp;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw);
  if (!match) return { bytes: null, touched: true, error: "photo.badType" };
  let bytes: Uint8Array;
  try {
    const bin = atob(match[1]!.replace(/\s+/g, ""));
    bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  } catch {
    return { bytes: null, touched: true, error: "photo.badType" };
  }
  if (bytes.length > MAX_PASTOR_PHOTO_BYTES) return { bytes: null, touched: true, error: "photo.tooLarge" };
  const webp = bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (!webp) return { bytes: null, touched: true, error: "photo.badType" };
  return { bytes, touched: true, error: null };
}

async function savePastorPhoto(db: DB, id: number, bytes: Uint8Array | null): Promise<void> {
  const value = bytes ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : null;
  await db.run(sql`UPDATE pastors SET photo = ${value}, updated_at = unixepoch() WHERE id = ${id}`);
}

function pastorFormFields(body: Record<string, unknown>) {
  return {
    name: s(body.name).slice(0, 100),
    nameEn: s(body.name_en).slice(0, 100),
    title: s(body.title).slice(0, 40),
    position: s(body.position).slice(0, 80),
    gender: s(body.gender).slice(0, 20),
    maritalStatus: s(body.marital_status).slice(0, 20),
    dateOfBirth: s(body.date_of_birth).slice(0, 10),
    regionId: asInt(s(body.region_id)),
    churchId: asInt(s(body.regional_church_id)),
    phone: s(body.phone).slice(0, 40),
    email: s(body.email).slice(0, 120),
    address: s(body.address).slice(0, 300),
    ordinationDate: s(body.ordination_date).slice(0, 10),
    notes: s(body.notes).slice(0, 1000),
  };
}

organizationRoutes.get("/pastors", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  return c.html(
    <PastorsPage
      user={c.get("user")} perms={c.get("perms")}
      flash={flashFromQuery(c.req.query(), c.get("lang"))}
      lang={c.get("lang")}
      pastors={await loadPastors(db, { activeOnly: false, scopeAll: scope.scopeAll, stateIds: scope.stateIds })}
      regions={await orgRegions(db, scope, c.get("lang"))}
      q={listQuery(c.req.query("q"))} status={listStatus(c.req.query("status"))}
      region={intParam(c.req.query("region"))}
    />,
  );
});

organizationRoutes.get("/pastors/new", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  if (!modalRequest(c)) return c.redirect("/organization/pastors", 303);
  return c.html(
    <PastorModal
      regions={await orgRegions(db, scope, c.get("lang"))}
      churches={await pastorChurches(db, scope, c.get("lang"))}
      lang={c.get("lang")}
    />,
  );
});

organizationRoutes.get("/pastors/:id/photo", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  if (!id) return c.notFound();
  const rows = await db.all<{ photo: ArrayBuffer | number[] | null; region_id: number; updated_at: number }>(sql`
    SELECT photo, region_id, updated_at FROM pastors WHERE id = ${id}`);
  const row = rows[0];
  if (!row?.photo || !regionInScope(scope, row.region_id)) return c.notFound();
  const photo = Array.isArray(row.photo) ? Uint8Array.from(row.photo) : new Uint8Array(row.photo);
  const etag = `W/"pastor-${id}-${row.updated_at}-${photo.byteLength}"`;
  const headers: Record<string, string> = {
    "Content-Type": "image/webp",
    "Content-Length": String(photo.byteLength),
    "Cache-Control": "private, no-cache",
    "ETag": etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (c.req.header("If-None-Match") === etag) return new Response(null, { status: 304, headers });
  return new Response(photo, { headers });
});

organizationRoutes.get("/pastors/:id", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  if (!id) return c.redirect("/organization/pastors?err=err-notfound", 303);
  const pastor = await loadPastor(db, id, { activeOnly: false, scopeAll: scope.scopeAll, stateIds: scope.stateIds });
  if (!pastor) return c.redirect("/organization/pastors?err=err-notfound", 303);
  return c.html(
    <PastorDetailPage
      pastor={pastor}
      user={c.get("user")} perms={c.get("perms")}
      flash={flashFromQuery(c.req.query(), c.get("lang"))}
      lang={c.get("lang")}
    />,
  );
});

organizationRoutes.get("/pastors/:id/edit", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  const pastor = id
    ? (await loadPastors(db, { activeOnly: false, scopeAll: scope.scopeAll, stateIds: scope.stateIds }))
      .find((p) => p.id === id)
    : undefined;
  if (!pastor) return c.redirect("/organization/pastors?err=err-notfound", 303);
  if (!modalRequest(c)) return c.redirect("/organization/pastors", 303);
  return c.html(
    <PastorModal
      pastor={pastor}
      regions={await orgRegions(db, scope, c.get("lang"))}
      churches={await pastorChurches(db, scope, c.get("lang"))}
      lang={c.get("lang")}
    />,
  );
});

organizationRoutes.post("/pastors", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const body = await c.req.parseBody();
  const f = pastorFormFields(body);
  const photo = parsePastorPhoto(body);
  const sortOrder = pastorSortOrder(s(body.sort_order));
  const values: PastorValues = {
    name: f.name,
    nameEn: f.nameEn,
    title: f.title,
    position: f.position,
    gender: f.gender,
    maritalStatus: f.maritalStatus,
    dateOfBirth: f.dateOfBirth,
    regionId: f.regionId ?? "",
    regionalChurchId: f.churchId ?? "",
    phone: f.phone,
    email: f.email,
    address: f.address,
    ordinationDate: f.ordinationDate,
    notes: f.notes,
    sortOrder,
    active: true,
  };
  const modal = modalRequest(c);
  const fail = async (err: string) => {
    if (!modal) return c.redirect(`/organization/pastors?err=${err}`, 303);
    return c.html(
      <PastorModal
        regions={await orgRegions(db, scope, c.get("lang"))}
        churches={await pastorChurches(db, scope, c.get("lang"))}
        values={values} error={flashText(err, c.get("lang"))} lang={c.get("lang")}
      />,
      422,
    );
  };
  if (!f.name) return await fail("pastor-name-required");
  if (!f.regionId) return await fail("pastor-state-required");
  if (photo.error) return await fail("pastor-photo-invalid");
  const allowed = await orgRegions(db, scope, c.get("lang"));
  if (!allowed.some((r) => r.id === f.regionId)) return await fail("err-scope");
  if (!await validPastorChurch(db, f.churchId, f.regionId)) return await fail("pastor-church-invalid");
  if (await pastorNameTaken(db, f.name, f.regionId, f.churchId)) return await fail("pastor-name-taken");
  await db.run(sql`
    INSERT INTO pastors (name, name_en, title, position, gender, marital_status, date_of_birth,
                         region_id, regional_church_id, phone, email, address, ordination_date, notes, active, sort_order)
    VALUES (${f.name}, ${f.nameEn || null}, ${f.title || null}, ${f.position || null},
            ${f.gender}, ${f.maritalStatus}, ${f.dateOfBirth || null}, ${f.regionId}, ${f.churchId},
            ${f.phone || null}, ${f.email || null}, ${f.address || null}, ${f.ordinationDate || null},
            ${f.notes || null}, 1, ${sortOrder})`);
  if (photo.touched) {
    const created = await db.all<{ id: number }>(sql`
      SELECT id FROM pastors WHERE name = ${f.name} AND region_id = ${f.regionId}
        AND COALESCE(regional_church_id, 0) = ${f.churchId ?? 0} ORDER BY id DESC LIMIT 1`);
    if (created[0]) await savePastorPhoto(db, created[0].id, photo.bytes);
  }
  const landing = "/organization/pastors?ok=pastor-created";
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

organizationRoutes.post("/pastors/:id", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  if (!id) return c.redirect("/organization/pastors?err=err-notfound", 303);
  const current = (await loadPastors(db, { activeOnly: false, scopeAll: scope.scopeAll, stateIds: scope.stateIds }))
    .find((p) => p.id === id);
  if (!current) return c.redirect("/organization/pastors?err=err-notfound", 303);
  const body = await c.req.parseBody();
  const f = pastorFormFields(body);
  const photo = parsePastorPhoto(body);
  const regionId = f.regionId ?? current.regionId;
  const active = s(body.active) === "1" ? 1 : 0;
  const sortOrder = pastorSortOrder(s(body.sort_order), current.sortOrder);
  const values: PastorValues = {
    name: f.name,
    nameEn: f.nameEn,
    title: f.title,
    position: f.position,
    gender: f.gender,
    maritalStatus: f.maritalStatus,
    dateOfBirth: f.dateOfBirth,
    regionId,
    regionalChurchId: f.churchId ?? "",
    phone: f.phone,
    email: f.email,
    address: f.address,
    ordinationDate: f.ordinationDate,
    notes: f.notes,
    sortOrder,
    active: active === 1,
  };
  const modal = modalRequest(c);
  const fail = async (err: string) => {
    if (!modal) return c.redirect(`/organization/pastors?err=${err}`, 303);
    return c.html(
      <PastorModal
        pastor={current}
        regions={await orgRegions(db, scope, c.get("lang"))}
        churches={await pastorChurches(db, scope, c.get("lang"))}
        values={values} error={flashText(err, c.get("lang"))} lang={c.get("lang")}
      />,
      422,
    );
  };
  if (!f.name) return await fail("pastor-name-required");
  if (photo.error) return await fail("pastor-photo-invalid");
  const allowed = await orgRegions(db, scope, c.get("lang"));
  if (!allowed.some((r) => r.id === regionId)) return await fail("err-scope");
  if (!await validPastorChurch(db, f.churchId, regionId)) return await fail("pastor-church-invalid");
  if (await pastorNameTaken(db, f.name, regionId, f.churchId, id)) return await fail("pastor-name-taken");
  await db.run(sql`
    UPDATE pastors
       SET name = ${f.name}, name_en = ${f.nameEn || null}, title = ${f.title || null},
           position = ${f.position || null}, gender = ${f.gender}, marital_status = ${f.maritalStatus},
           date_of_birth = ${f.dateOfBirth || null}, region_id = ${regionId},
           regional_church_id = ${f.churchId}, phone = ${f.phone || null}, email = ${f.email || null},
           address = ${f.address || null}, ordination_date = ${f.ordinationDate || null},
           notes = ${f.notes || null}, active = ${active}, sort_order = ${sortOrder},
           updated_at = unixepoch()
     WHERE id = ${id}`);
  if (photo.touched) await savePastorPhoto(db, id, photo.bytes);
  const landing = "/organization/pastors?ok=pastor-updated";
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

organizationRoutes.post("/pastors/:id/delete", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  if (!id) return c.redirect("/organization/pastors?err=err-notfound", 303);
  const current = (await loadPastors(db, { activeOnly: false, scopeAll: scope.scopeAll, stateIds: scope.stateIds }))
    .find((p) => p.id === id);
  if (!current) return c.redirect("/organization/pastors?err=err-notfound", 303);
  const used = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM cluster_pastor_assignments WHERE pastor_id = ${id}`);
  if ((used[0]?.n ?? 0) > 0) return c.redirect("/organization/pastors?err=pastor-in-use", 303);
  await db.run(sql`DELETE FROM pastors WHERE id = ${id}`);
  return c.redirect("/organization/pastors?ok=pastor-deleted", 303);
});

// ---------- Home Cell supervision clusters ----------

async function adminClusters(db: DB, scope: Scope): Promise<SupervisionClusterRow[]> {
  return loadSupervisionClusters(db, { activeOnly: false, scopeAll: scope.scopeAll, stateIds: scope.stateIds });
}

async function clusterNameTaken(db: DB, name: string, regionId: number, exceptId?: number): Promise<boolean> {
  const rows = await db.all<{ id: number }>(sql`
    SELECT id FROM supervision_clusters
     WHERE lower(name) = lower(${name}) AND region_id = ${regionId} LIMIT 1`);
  return rows.some((r) => r.id !== exceptId);
}

async function clusterPastorCandidates(db: DB, regionId: number): Promise<{ id: number; name: string; regionId: number }[]> {
  return loadPastorOptions(db, { regionId });
}

organizationRoutes.get("/clusters", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  return c.html(
    <SupervisionClustersPage
      user={c.get("user")} perms={c.get("perms")}
      flash={flashFromQuery(c.req.query(), c.get("lang"))}
      lang={c.get("lang")} clusters={await adminClusters(db, scope)}
      regions={await orgRegions(db, scope, c.get("lang"))}
      homeCells={await loadAdminHomeCells(db, scope) as ClusterHomeCell[]}
      q={listQuery(c.req.query("q"))} status={listStatus(c.req.query("status"))}
      region={intParam(c.req.query("region"))}
    />,
  );
});

organizationRoutes.get("/clusters/new", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  if (!modalRequest(c)) return c.redirect("/organization/clusters", 303);
  return c.html(
    <SupervisionClusterModal
      regions={await orgRegions(db, scope, c.get("lang"))}
      homeCells={await loadAdminHomeCells(db, scope) as ClusterHomeCell[]}
      lang={c.get("lang")}
    />,
  );
});

organizationRoutes.get("/clusters/:id/edit", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  const cluster = id ? (await adminClusters(db, scope)).find((r) => r.id === id) : undefined;
  if (!cluster) return c.redirect("/organization/clusters?err=err-notfound", 303);
  if (!modalRequest(c)) return c.redirect("/organization/clusters", 303);
  return c.html(
    <SupervisionClusterModal
      cluster={cluster}
      regions={await orgRegions(db, scope, c.get("lang"))}
      homeCells={await loadAdminHomeCells(db, scope) as ClusterHomeCell[]}
      pastorCandidates={await clusterPastorCandidates(db, cluster.regionId)}
      lang={c.get("lang")}
    />,
  );
});

organizationRoutes.post("/clusters", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const body = await c.req.parseBody();
  const name = s(body.name).slice(0, 80);
  const nameEn = s(body.name_en).slice(0, 120);
  const regionId = asInt(s(body.region_id));
  const sortOrder = departmentSortOrder(s(body.sort_order));
  const values: ClusterValues = {
    name, nameEn, regionId: regionId ?? "", sortOrder, active: true, pastorId: "",
  };
  const modal = modalRequest(c);
  const fail = async (err: string) => {
    if (!modal) return c.redirect(`/organization/clusters?err=${err}`, 303);
    return c.html(
      <SupervisionClusterModal
        regions={await orgRegions(db, scope, c.get("lang"))}
        homeCells={await loadAdminHomeCells(db, scope) as ClusterHomeCell[]}
        values={values} error={flashText(err, c.get("lang"))} lang={c.get("lang")}
      />,
      422,
    );
  };
  if (!name) return await fail("cluster-name-required");
  if (!regionId) return await fail("cluster-state-required");
  const allowed = await orgRegions(db, scope, c.get("lang"));
  if (!allowed.some((r) => r.id === regionId)) return await fail("err-scope");
  if (await clusterNameTaken(db, name, regionId)) return await fail("cluster-name-taken");
  await db.run(sql`
    INSERT INTO supervision_clusters (name, name_en, region_id, active, sort_order)
    VALUES (${name}, ${nameEn || null}, ${regionId}, 1, ${sortOrder})`);
  const landing = "/organization/clusters?ok=cluster-created";
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

organizationRoutes.post("/clusters/:id", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  if (!id) return c.redirect("/organization/clusters?err=err-notfound", 303);
  const current = (await db.all<{ id: number; regionId: number; active: number; sortOrder: number }>(sql`
    SELECT id, region_id AS regionId, active, sort_order AS sortOrder
    FROM supervision_clusters WHERE id = ${id} LIMIT 1`))[0];
  if (!current || !regionInScope(scope, current.regionId)) {
    return c.redirect("/organization/clusters?err=err-notfound", 303);
  }
  // The editor is one form now, so read the raw form data once and keep every
  // ticked Home Cell instead of only the last repeated value.
  const form = await c.req.formData();
  const field = (key: string) => String(form.get(key) ?? "");
  const name = field("name").slice(0, 80);
  const nameEn = field("name_en").slice(0, 120);
  const regionId = asInt(field("region_id")) ?? current.regionId;
  const active = field("active") === "1" ? 1 : 0;
  const sortOrder = departmentSortOrder(field("sort_order"), current.sortOrder);
  const pastorId = asInt(field("pastor_id"));
  const selectedCellIds = form.getAll("home_cell_ids")
    .map((v) => Number(String(v)))
    .filter((n) => Number.isInteger(n) && n > 0);
  const cellsPresent = form.has("cells_present");
  const values: ClusterValues = {
    name, nameEn, regionId, sortOrder, active: active === 1, pastorId: pastorId ?? "",
  };
  const modal = modalRequest(c);
  const fail = async (err: string | null, cellErr?: string) => {
    const code = cellErr || err || "err-notfound";
    if (!modal) return c.redirect(`/organization/clusters?err=${code}`, 303);
    const cluster = (await adminClusters(db, scope)).find((r) => r.id === id);
    return c.html(
      <SupervisionClusterModal
        cluster={cluster}
        regions={await orgRegions(db, scope, c.get("lang"))}
        homeCells={await loadAdminHomeCells(db, scope) as ClusterHomeCell[]}
        pastorCandidates={await clusterPastorCandidates(db, regionId)}
        values={values}
        error={err ? flashText(err, c.get("lang")) : null}
        cellError={cellErr ? flashText(cellErr, c.get("lang")) : null}
        selectedCellIds={selectedCellIds}
        lang={c.get("lang")}
      />,
      422,
    );
  };
  if (!name) return await fail("cluster-name-required");
  const allowed = await orgRegions(db, scope, c.get("lang"));
  if (!allowed.some((r) => r.id === regionId)) return await fail("err-scope");
  if (await clusterNameTaken(db, name, regionId, id)) return await fail("cluster-name-taken");
  if (pastorId) {
    const validPastor = await db.all<{ id: number }>(sql`
      SELECT id FROM pastors
      WHERE id = ${pastorId} AND active = 1 AND region_id = ${regionId} LIMIT 1`);
    if (validPastor.length === 0) return await fail("cluster-pastor-invalid");
  }
  const attached = await db.all<{ n: number }>(sql`
    SELECT
      (SELECT COUNT(*) FROM lookup_options WHERE supervision_cluster_id = ${id}) +
      (SELECT COUNT(*) FROM member_positions WHERE supervision_cluster_id = ${id}) +
      (SELECT COUNT(*) FROM cluster_pastor_assignments WHERE cluster_id = ${id}) AS n`);
  const used = attached[0]?.n ?? 0;
  if (regionId !== current.regionId && used > 0) return await fail("cluster-state-locked");
  if (current.active === 1 && active === 0 && used > 0) return await fail("cluster-in-use");
  if (cellsPresent && selectedCellIds.length > 0) {
    const valid = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM lookup_options
      WHERE type = 'home_cell' AND region_id = ${regionId}
        AND id IN (${sql.join(selectedCellIds.map((v) => sql`${v}`), sql`, `)})`);
    if ((valid[0]?.n ?? 0) !== selectedCellIds.length) {
      return await fail(null, "cluster-cell-invalid");
    }
  }
  await db.run(sql`
    UPDATE supervision_clusters
       SET name = ${name}, name_en = ${nameEn || null}, region_id = ${regionId},
           active = ${active}, sort_order = ${sortOrder}
     WHERE id = ${id}`);
  if (pastorId) {
    await db.run(sql`
      INSERT INTO cluster_pastor_assignments (cluster_id, pastor_id, created_by)
      VALUES (${id}, ${pastorId}, ${c.get("user").id})
      ON CONFLICT(cluster_id) DO UPDATE SET
        pastor_id = excluded.pastor_id, updated_at = unixepoch()`);
  } else {
    await db.run(sql`DELETE FROM cluster_pastor_assignments WHERE cluster_id = ${id}`);
  }
  if (cellsPresent) {
    await db.run(sql`UPDATE lookup_options SET supervision_cluster_id = NULL WHERE supervision_cluster_id = ${id}`);
    if (selectedCellIds.length > 0) {
      await db.run(sql`
        UPDATE lookup_options SET supervision_cluster_id = ${id}
        WHERE id IN (${sql.join(selectedCellIds.map((v) => sql`${v}`), sql`, `)})`);
    }
  }
  const landing = "/organization/clusters?ok=cluster-updated";
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

organizationRoutes.post("/clusters/:id/delete", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  if (!id) return c.redirect("/organization/clusters?err=err-notfound", 303);
  const cluster = (await db.all<{ regionId: number }>(sql`
    SELECT region_id AS regionId FROM supervision_clusters WHERE id = ${id} LIMIT 1`))[0];
  if (!cluster || !regionInScope(scope, cluster.regionId)) {
    return c.redirect("/organization/clusters?err=err-notfound", 303);
  }
  const used = await db.all<{ n: number }>(sql`
    SELECT
      (SELECT COUNT(*) FROM lookup_options WHERE supervision_cluster_id = ${id}) +
      (SELECT COUNT(*) FROM member_positions WHERE supervision_cluster_id = ${id}) AS n`);
  if ((used[0]?.n ?? 0) > 0) return c.redirect("/organization/clusters?err=cluster-in-use", 303);
  await db.run(sql`DELETE FROM cluster_pastor_assignments WHERE cluster_id = ${id}`);
  await db.run(sql`DELETE FROM supervision_clusters WHERE id = ${id}`);
  return c.redirect("/organization/clusters?ok=cluster-deleted", 303);
});
