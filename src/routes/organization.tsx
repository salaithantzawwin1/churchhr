import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { eq, sql } from "drizzle-orm";
import type { AppEnv } from "../env";
import { getDb, type DB } from "../db/client";
import { churchDepartments } from "../db/schema";
import { requirePermission } from "../middleware";
import { flashFromQuery, flashText } from "../flash";
import { OrganizationPage, type OrgCell, type OrgDepartment, type OrgLeader } from "../views/organization";
import { DepartmentDetailPage, DepartmentsPage, type AdminDepartmentRow } from "../views/departments";
import { ForbiddenPage } from "../views/errors";
import { RegionalChurchesPage, PositionsPage, PositionModal, RegionalChurchModal, type ListStatus, type RegionalValues } from "../views/org-settings";
import { SupervisionClusterModal, SupervisionClustersPage, type ClusterHomeCell } from "../views/clusters";
import { PositionHistoryPage } from "../views/position-history";
import { VacancyReportPage } from "../views/vacancies";
import { VACANCY_SCOPES, loadVacancyReport, type VacancyScope } from "../vacancies";
import { diffPositionDefs, loadPositionHistory, recordPositionHistory } from "../position-history";
import { loadPositionDefs, codeFromEnglishName, isConfigurableScope, type ConfigurablePositionScope, type PositionDefRow } from "../position-catalog";
import { clusterName, loadRegionalChurches, loadSupervisionClusters, type RegionalChurchRow, type SupervisionClusterRow } from "../org-units";
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
  const tab: "church" | "regional" | "home-cells" = tabParam === "home-cells" ? "home-cells" : tabParam === "regional" ? "regional" : "church";

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
        WHERE m.department_id = d.id AND m.status = 'active') AS member_count
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
      regionalChurches={regionalChurches} clusters={clusters} positionDefs={positionDefs}
      canManageDepartments={c.get("perms").has("options.manage") && scope.scopeAll}
      canManageStructure={c.get("perms").has("options.manage")}
      canManageClusters={c.get("perms").has("options.manage")}
      canManagePositions={c.get("perms").has("options.manage") && scope.scopeAll}
      unassignedMembers={unassignedRows[0]?.n ?? 0}
    />,
  );
});

// ---------- Department detail ----------

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
  const body = await c.req.parseBody();
  const name = s(body.name).slice(0, 80);
  const nameEn = s(body.name_en).slice(0, 120);
  const regionId = asInt(s(body.region_id)) ?? current.regionId;
  const active = s(body.active) === "1" ? 1 : 0;
  const sortOrder = departmentSortOrder(s(body.sort_order), current.sortOrder);
  const values: RegionalValues = { name, nameEn, regionId, sortOrder, active: active === 1 };
  const modal = modalRequest(c);
  const fail = async (err: string) => {
    if (!modal) return c.redirect(`/organization/regional-churches?err=${err}`, 303);
    const church = (await loadRegionalChurches(db, { activeOnly: false, scopeAll: scope.scopeAll, stateIds: scope.stateIds }))
      .find((r) => r.id === id);
    return c.html(
      <RegionalChurchModal
        church={church}
        regions={await orgRegions(db, scope, c.get("lang"))}
        homeCells={await loadAdminHomeCells(db, scope)}
        values={values} error={flashText(err, c.get("lang"))} lang={c.get("lang")}
      />,
      422,
    );
  };
  if (!name) return await fail("regional-name-required");
  const allowedRegions = await orgRegions(db, scope, c.get("lang"));
  if (!allowedRegions.some((r) => r.id === regionId)) return await fail("err-scope");
  if (await regionalChurchNameTaken(db, name, id)) return await fail("regional-name-taken");
  if (regionId !== current.regionId) {
    const attached = await db.all<{ n: number }>(sql`
      SELECT
        (SELECT COUNT(*) FROM lookup_options WHERE regional_church_id = ${id}) +
        (SELECT COUNT(*) FROM member_positions WHERE regional_church_id = ${id}) AS n`);
    if ((attached[0]?.n ?? 0) > 0) return await fail("regional-state-locked");
  }
  if (current.active === 1 && active === 0) {
    const used = await db.all<{ n: number }>(sql`
      SELECT
        (SELECT COUNT(*) FROM lookup_options WHERE regional_church_id = ${id}) +
        (SELECT COUNT(*) FROM member_positions WHERE regional_church_id = ${id}) AS n`);
    if ((used[0]?.n ?? 0) > 0) return await fail("regional-in-use");
  }
  await db.run(sql`
    UPDATE regional_churches
       SET name = ${name}, name_en = ${nameEn || null}, region_id = ${regionId},
           active = ${active}, sort_order = ${sortOrder}
     WHERE id = ${id}`);
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
  if (!name) return c.redirect("/organization/clusters?err=cluster-name-required", 303);
  if (!regionId) return c.redirect("/organization/clusters?err=cluster-state-required", 303);
  const allowed = await orgRegions(db, scope, c.get("lang"));
  if (!allowed.some((r) => r.id === regionId)) return c.redirect("/organization/clusters?err=err-scope", 303);
  if (await clusterNameTaken(db, name, regionId)) return c.redirect("/organization/clusters?err=cluster-name-taken", 303);
  await db.run(sql`
    INSERT INTO supervision_clusters (name, name_en, region_id, active, sort_order)
    VALUES (${name}, ${nameEn || null}, ${regionId}, 1, ${sortOrder})`);
  return c.redirect("/organization/clusters?ok=cluster-created", 303);
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
  const body = await c.req.parseBody();
  const name = s(body.name).slice(0, 80);
  const nameEn = s(body.name_en).slice(0, 120);
  const regionId = asInt(s(body.region_id)) ?? current.regionId;
  const active = s(body.active) === "1" ? 1 : 0;
  const sortOrder = departmentSortOrder(s(body.sort_order), current.sortOrder);
  if (!name) return c.redirect("/organization/clusters?err=cluster-name-required", 303);
  const allowed = await orgRegions(db, scope, c.get("lang"));
  if (!allowed.some((r) => r.id === regionId)) return c.redirect("/organization/clusters?err=err-scope", 303);
  if (await clusterNameTaken(db, name, regionId, id)) return c.redirect("/organization/clusters?err=cluster-name-taken", 303);
  const attached = await db.all<{ n: number }>(sql`
    SELECT
      (SELECT COUNT(*) FROM lookup_options WHERE supervision_cluster_id = ${id}) +
      (SELECT COUNT(*) FROM member_positions WHERE supervision_cluster_id = ${id}) AS n`);
  const used = attached[0]?.n ?? 0;
  if (regionId !== current.regionId && used > 0) return c.redirect("/organization/clusters?err=cluster-state-locked", 303);
  if (current.active === 1 && active === 0 && used > 0) return c.redirect("/organization/clusters?err=cluster-in-use", 303);
  await db.run(sql`
    UPDATE supervision_clusters
       SET name = ${name}, name_en = ${nameEn || null}, region_id = ${regionId},
           active = ${active}, sort_order = ${sortOrder}
     WHERE id = ${id}`);
  return c.redirect("/organization/clusters?ok=cluster-updated", 303);
});

organizationRoutes.post("/clusters/:id/cells", requirePermission("options.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  if (!id) return c.redirect("/organization/clusters?err=err-notfound", 303);
  const cluster = (await db.all<{ regionId: number }>(sql`
    SELECT region_id AS regionId FROM supervision_clusters WHERE id = ${id} LIMIT 1`))[0];
  if (!cluster || !regionInScope(scope, cluster.regionId)) {
    return c.redirect("/organization/clusters?err=err-notfound", 303);
  }
  let ids: number[] = [];
  try {
    const form = await c.req.formData();
    ids = form.getAll("home_cell_ids")
      .map((v) => Number(String(v)))
      .filter((n) => Number.isInteger(n) && n > 0);
  } catch {
    ids = [];
  }
  if (ids.length > 0) {
    const valid = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM lookup_options
      WHERE type = 'home_cell' AND region_id = ${cluster.regionId}
        AND id IN (${sql.join(ids.map((v) => sql`${v}`), sql`, `)})`);
    if ((valid[0]?.n ?? 0) !== ids.length) {
      return c.redirect("/organization/clusters?err=cluster-cell-invalid", 303);
    }
  }
  await db.run(sql`UPDATE lookup_options SET supervision_cluster_id = NULL WHERE supervision_cluster_id = ${id}`);
  if (ids.length > 0) {
    await db.run(sql`
      UPDATE lookup_options SET supervision_cluster_id = ${id}
      WHERE id IN (${sql.join(ids.map((v) => sql`${v}`), sql`, `)})`);
  }
  return c.redirect("/organization/clusters?ok=cluster-cells", 303);
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
  await db.run(sql`DELETE FROM supervision_clusters WHERE id = ${id}`);
  return c.redirect("/organization/clusters?ok=cluster-deleted", 303);
});
