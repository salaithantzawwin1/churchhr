import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { and, eq, sql } from "drizzle-orm";
import type { AppEnv } from "../env";
import { getDb, type DB } from "../db/client";
import { churchDepartments, memberHistory, memberPositions, members } from "../db/schema";
import { requireAnyPermission, requirePermission } from "../middleware";
import { flashFromQuery, flashText } from "../flash";
import { OrganizationPage, type OrgCell, type OrgDepartment, type OrgLeader } from "../views/organization";
import { DepartmentDetailPage, DepartmentModal, DepartmentsPage, type AdminDepartmentRow, type DepartmentLeaderRow, type DepartmentMemberRow } from "../views/departments";
import { ForbiddenPage } from "../views/errors";
import { RegionalChurchesPage, PositionsPage, PositionModal, RegionalChurchModal, type ListStatus, type RegionalValues } from "../views/org-settings";
import { AssignLeaderModal } from "../views/org-assign";
import { SupervisionClusterModal, SupervisionClustersPage, type ClusterHomeCell, type ClusterValues } from "../views/clusters";
import { PositionHistoryPage } from "../views/position-history";
import { VacancyReportPage } from "../views/vacancies";
import { VACANCY_SCOPES, loadVacancyReport, type VacancyScope } from "../vacancies";
import { diffPositionDefs, loadPositionHistory, recordPositionHistory } from "../position-history";
import { loadPositionDefs, codeFromEnglishName, defsForScope, isConfigurableScope, positionDefLabel, type ConfigurablePositionScope, type PositionDefRow } from "../position-catalog";
import { clusterName, loadRegionalChurches, loadSupervisionClusters, regionalChurchName, type RegionalChurchRow, type SupervisionClusterRow } from "../org-units";
import { loadPastor, loadPastorOptions, loadPastors, pastorName, type PastorRow } from "../pastors";
import { PastorsPage, PastorModal, PastorDetailPage, PastorHistoryModal, type PastorValues, type SpouseOption } from "../views/pastors";
import { loadPastorHistory, loadPastorHistoryRow, readHistoryForm, historyValues } from "../pastor-history";
import { positionTaken } from "../positions";
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

/** Restrict member rows by the signed-in user's assigned states. */
function memberScopeCond(scope: Scope) {
  if (scope.scopeAll) return sql`1=1`;
  if (scope.stateIds.length === 0) return sql`1=0`;
  return sql`m.region_id IN (${sql.join(scope.stateIds.map((id) => sql`${id}`), sql`, `)})`;
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
  // Main Church leads the page; the other tabs are explicit links.
  const tab: "church" | "main" | "regional" | "home-cells" =
    tabParam === "home-cells" ? "home-cells"
      : tabParam === "regional" ? "regional"
        : tabParam === "church" ? "church"
          : "main";

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
    SELECT d.id, d.name, d.name_en, d.sort_order, d.regional_church_id,
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
           COALESCE(NULLIF(m.name_myanmar, ''), m.name_english,
                    NULLIF(p.name, ''), p.name_en) AS member_name,
           (COALESCE(m.photo, p.photo) IS NOT NULL) AS has_photo,
           CASE
             WHEN m.photo IS NOT NULL THEN '/members/' || m.id || '/photo?v=' || m.updated_at
             WHEN p.photo IS NOT NULL THEN '/organization/pastors/' || p.id || '/photo?v=' || p.updated_at
             ELSE NULL
           END AS photo_url,
           COALESCE(m.updated_at, p.updated_at) AS updated_at
    FROM member_positions mp
    LEFT JOIN members m ON m.id = mp.member_id
    LEFT JOIN pastors p ON p.id = mp.pastor_id
    WHERE (mp.member_id IS NOT NULL AND m.status = 'active')
       OR (mp.pastor_id IS NOT NULL AND p.active = 1)
    UNION ALL
    SELECT 'cluster_pastor' AS position, 'cluster' AS scope_type, NULL AS scope_id,
           NULL AS department_id, NULL AS regional_church_id,
           cp.cluster_id AS supervision_cluster_id,
           NULL AS member_id,
           COALESCE(NULLIF(p.name, ''), p.name_en) AS member_name,
           (p.photo IS NOT NULL) AS has_photo,
           CASE WHEN p.photo IS NOT NULL
                THEN '/organization/pastors/' || p.id || '/photo?v=' || p.updated_at
                ELSE NULL END AS photo_url,
           p.updated_at
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

// ---------- Church leadership assignment ----------

/** Members of one church, offered as candidates for a leadership slot. Each row
 *  carries the church position the member already holds, so the dialog can warn
 *  before a save moves that role. */
async function assignCandidates(db: DB, churchId: number, q: string) {
  const like = `%${q}%`;
  return db.all<{
    id: number; name: string; home_cell: string | null;
    church_position: string | null; church_id: number | null; church_name: string | null;
  }>(sql`
    SELECT m.id,
           COALESCE(NULLIF(m.name_myanmar, ''), m.name_english, '#') AS name,
           hc.label AS home_cell,
           mp.position AS church_position,
           mp.regional_church_id AS church_id,
           rc.name AS church_name
    FROM members m
    LEFT JOIN lookup_options hc ON hc.id = m.home_cell_id
    LEFT JOIN member_positions mp ON mp.member_id = m.id AND mp.scope_type = 'church'
    LEFT JOIN regional_churches rc ON rc.id = mp.regional_church_id
    WHERE m.status = 'active' AND hc.regional_church_id = ${churchId}
      ${q ? sql`AND (m.name_myanmar LIKE ${like} OR m.name_english LIKE ${like})` : sql``}
    ORDER BY name LIMIT 300`);
}

/** Pastoral posts are filled from the pastor directory, not the member list. */
function isPastorSlot(def: PositionDefRow): boolean {
  return def.scopeType === "church" && /pastor/i.test(def.code);
}

/** Pastors of this church's state, offered for a pastoral post. Pastors already
 *  serving this church come first, and each row carries the church slot they
 *  hold so the dialog can warn before a save moves that role. */
async function pastorCandidates(db: DB, church: { id: number; regionId: number }, q: string) {
  const like = `%${q}%`;
  return db.all<{
    id: number; name: string; home_cell: string | null;
    church_position: string | null; church_id: number | null; church_name: string | null;
  }>(sql`
    SELECT p.id,
           COALESCE(NULLIF(p.name, ''), p.name_en, '#') AS name,
           rc.name AS home_cell,
           mp.position AS church_position,
           mp.regional_church_id AS church_id,
           mrc.name AS church_name
    FROM pastors p
    LEFT JOIN regional_churches rc ON rc.id = p.regional_church_id
    LEFT JOIN member_positions mp ON mp.pastor_id = p.id AND mp.scope_type = 'church'
    LEFT JOIN regional_churches mrc ON mrc.id = mp.regional_church_id
    WHERE p.active = 1 AND p.region_id = ${church.regionId}
      AND (p.regional_church_id IS NULL OR p.regional_church_id = ${church.id})
      ${q ? sql`AND (p.name LIKE ${like} OR p.name_en LIKE ${like})` : sql``}
    ORDER BY (mp.regional_church_id = ${church.id} OR p.regional_church_id = ${church.id}) DESC,
             p.sort_order, name LIMIT 300`);
}

/** code → localized church position label, for labels on a member's current slot. */
function churchPositionLabels(defs: PositionDefRow[], lang: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of defs) {
    if (def.scopeType === "church") out[def.code] = positionDefLabel(def, lang);
  }
  return out;
}

type AssignTab = "church" | "main";

/** The dialog remembers which tab opened it, so a save never changes tabs. */
function assignTab(raw: unknown): AssignTab {
  return raw === "main" ? "main" : "church";
}

function assignLanding(tab: AssignTab, churchId: number | null, ok?: string): string {
  const base = tab === "main"
    ? "/organization?tab=main"
    : churchId ? `/organization?tab=church&church=${churchId}` : "/organization?tab=church";
  return ok ? `${base}&ok=${ok}` : base;
}

/** Dialog opened from a vacant node: pick the member who fills this slot. */
organizationRoutes.get("/assign", requirePermission("members.update"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const churchId = intParam(c.req.query("church"));
  const code = s(c.req.query("position"));
  const q = listQuery(c.req.query("q"));
  const tab = assignTab(c.req.query("tab"));
  if (!modalRequest(c)) return c.redirect("/organization", 303);

  const churches = await loadRegionalChurches(db, { scopeAll: scope.scopeAll, stateIds: scope.stateIds });
  const church = churchId ? churches.find((ch) => ch.id === churchId) : undefined;
  const def = (await loadPositionDefs(db)).find((d) => d.scopeType === "church" && d.code === code) ?? null;
  if (!church || !def) return c.html(<p class="muted">Not found</p>, 404);

  // A member holder may live in another church's Home Cell and a pastor has no
  // member row at all, so the current name is resolved here for both cases.
  const pastorSlot = isPastorSlot(def);
  // A pastor post may still be held by an older member assignment, so both kinds
  // of holder are resolved; either one can be cleared from this dialog.
  const holders = await db.all<{ person_type: string; person_id: number; name: string | null }>(sql`
    SELECT 'pastor' AS person_type, mp.pastor_id AS person_id,
           COALESCE(NULLIF(p.name, ''), p.name_en) AS name
    FROM member_positions mp JOIN pastors p ON p.id = mp.pastor_id
    WHERE mp.scope_type = 'church' AND mp.position = ${def.code}
      AND mp.regional_church_id = ${church.id} AND mp.pastor_id IS NOT NULL
    UNION ALL
    SELECT 'member' AS person_type, mp.member_id AS person_id,
           COALESCE(NULLIF(m.name_myanmar, ''), m.name_english) AS name
    FROM member_positions mp JOIN members m ON m.id = mp.member_id
    WHERE mp.scope_type = 'church' AND mp.position = ${def.code}
      AND mp.regional_church_id = ${church.id} AND mp.member_id IS NOT NULL
    LIMIT 1`);
  const holder = holders[0] ?? null;
  const holderIsPastor = holder?.person_type === "pastor";
  const canSeePastorProfile = c.get("perms").has("options.manage");
  const currentHref = holder
    ? holderIsPastor
      ? (canSeePastorProfile ? `/organization/pastors/${holder.person_id}` : null)
      : `/members/${holder.person_id}`
    : null;

  return c.html(
    <AssignLeaderModal
      lang={c.get("lang")}
      tab={tab}
      churchId={church.id}
      churchName={regionalChurchName(church, c.get("lang"))}
      def={def}
      personField={pastorSlot ? "pastor_id" : "member_id"}
      pastorDirectory={pastorSlot}
      candidates={pastorSlot
        ? await pastorCandidates(db, church, q)
        : await assignCandidates(db, church.id, q)}
      currentId={holder && holderIsPastor === pastorSlot ? holder.person_id : null}
      hasHolder={Boolean(holder)}
      currentName={holder?.name ?? null}
      currentHref={currentHref}
      labels={churchPositionLabels(await loadPositionDefs(db), c.get("lang"))}
    />,
  );
});

/** Saves the slot. An empty member_id clears it, so one dialog handles both. */
organizationRoutes.post("/assign", requirePermission("members.update"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const body = await c.req.parseBody();
  const modal = modalRequest(c);
  const churchId = intParam(s(body.church));
  const code = s(body.position);
  const memberId = intParam(s(body.member_id));
  const pastorId = intParam(s(body.pastor_id));
  const tab = assignTab(body.tab);
  const landing = assignLanding(tab, churchId);
  const done = assignLanding(tab, churchId, memberId || pastorId ? "church-leader-saved" : "church-leader-cleared");

  const churches = await loadRegionalChurches(db, { scopeAll: scope.scopeAll, stateIds: scope.stateIds });
  const church = churchId ? churches.find((ch) => ch.id === churchId) : undefined;
  const def = (await loadPositionDefs(db))
    .find((d) => d.scopeType === "church" && d.code === code && d.active === 1) ?? null;
  if (!church || !def) {
    return modal ? c.json({ ok: false, redirect: landing }) : c.redirect(landing, 303);
  }

  const pastorSlot = isPastorSlot(def);
  const personId = pastorSlot ? pastorId : memberId;
  let memberTarget: { id: number } | null = null;
  let pastorTarget: { id: number } | null = null;
  if (personId && pastorSlot) {
    const rows = await db.all<{ id: number }>(sql`
      SELECT id FROM pastors
      WHERE id = ${personId} AND active = 1 AND region_id = ${church.regionId}
        AND (regional_church_id IS NULL OR regional_church_id = ${church.id}) LIMIT 1`);
    if (!rows[0]) {
      return modal ? c.json({ ok: false, redirect: landing }) : c.redirect(landing, 303);
    }
    pastorTarget = { id: rows[0].id };
  } else if (personId) {
    const rows = await db.all<{ id: number; region_id: number }>(sql`
      SELECT m.id, m.region_id FROM members m
      WHERE m.id = ${personId} AND m.status = 'active' LIMIT 1`);
    if (!rows[0] || !regionInScope(scope, rows[0].region_id)) {
      return modal ? c.json({ ok: false, redirect: landing }) : c.redirect(landing, 303);
    }
    memberTarget = { id: rows[0].id };
  }

  const now = Math.floor(Date.now() / 1000);
  // One holder per slot, and at most one church position per person.
  await db.delete(memberPositions).where(and(
    eq(memberPositions.scopeType, "church"),
    eq(memberPositions.position, def.code),
    eq(memberPositions.regionalChurchId, church.id),
  ));
  if (pastorTarget) {
    await db.delete(memberPositions).where(and(
      eq(memberPositions.scopeType, "church"),
      eq(memberPositions.pastorId, pastorTarget.id),
    ));
    await db.insert(memberPositions).values({
      memberId: null,
      pastorId: pastorTarget.id,
      position: def.code,
      scopeType: "church",
      scopeId: null,
      departmentId: null,
      regionalChurchId: church.id,
      supervisionClusterId: null,
      createdBy: c.get("user").id,
      createdAt: now,
      updatedAt: now,
    });
  } else if (memberTarget) {
    await db.delete(memberPositions).where(and(
      eq(memberPositions.scopeType, "church"),
      eq(memberPositions.memberId, memberTarget.id),
    ));
    await db.insert(memberPositions).values({
      memberId: memberTarget.id,
      position: def.code,
      scopeType: "church",
      scopeId: null,
      departmentId: null,
      regionalChurchId: church.id,
      supervisionClusterId: null,
      createdBy: c.get("user").id,
      createdAt: now,
      updatedAt: now,
    });
  }
  return modal ? c.json({ ok: true, redirect: done }) : c.redirect(done, 303);
});

// ---------- Department detail ----------

organizationRoutes.get("/departments/new", requirePermission("options.manage"), requireAllStates, async (c) => {
  const db = getDb(c.env);
  if (!modalRequest(c)) return c.redirect("/organization/departments", 303);
  return c.html(
    <DepartmentModal lang={c.get("lang")} churches={await positionChurchOptions(db, c.get("lang"))} />,
  );
});

organizationRoutes.get("/departments/:id/edit", requirePermission("options.manage"), requireAllStates, async (c) => {
  const db = getDb(c.env);
  const id = intParam(c.req.param("id"));
  const department = id ? (await loadAdminDepartments(db)).find((d) => d.id === id) : undefined;
  if (!department) return c.redirect("/organization/departments?err=err-notfound", 303);
  if (!modalRequest(c)) return c.redirect("/organization/departments", 303);
  return c.html(
    <DepartmentModal department={department} lang={c.get("lang")}
      churches={await positionChurchOptions(db, c.get("lang"))} />,
  );
});

organizationRoutes.get("/departments/:id", requirePermission("members.view"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  if (!id) return c.notFound();
  // State-scoped managers only see members inside their assigned states, so the
  // count and the table below always agree with the rest of the member list.
  const memberScope = memberScopeCond(scope);
  const positionDefs = await loadPositionDefs(db);
  const department = (await db.all<OrgDepartment>(sql`
    SELECT d.id, d.name, d.name_en, d.sort_order, d.regional_church_id,
      rc.name AS church_name, rc.name_en AS church_name_en,
      (SELECT COUNT(*) FROM members m
        WHERE m.department_id = d.id AND m.status = 'active' AND ${memberScope}) AS member_count
    FROM church_departments d
    LEFT JOIN regional_churches rc ON rc.id = d.regional_church_id
    WHERE d.id = ${id} LIMIT 1`))[0];
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
  // Filters are additive and only narrow the members table; the department's
  // total count above stays as the unfiltered reference.
  const regions = await orgRegions(db, scope, c.get("lang"));
  const q = s(c.req.query("q")).trim().slice(0, 80);
  const genderRaw = s(c.req.query("gender"));
  const gender = genderRaw === "male" || genderRaw === "female" ? genderRaw : "";
  const stateRaw = asInt(s(c.req.query("state")));
  const stateFilter = stateRaw != null && regions.some((r) => r.id === stateRaw) ? stateRaw : null;
  const deptDefs = defsForScope(positionDefs, "department");
  const positionRaw = s(c.req.query("position"));
  const positionFilter = positionRaw === "__none" || deptDefs.some((def) => def.code === positionRaw)
    ? positionRaw
    : "";

  const conditions = [
    sql`m.department_id = ${id}`,
    sql`m.status = 'active'`,
    memberScope,
  ];
  if (q) conditions.push(sql`(m.name_myanmar LIKE ${`%${q}%`} OR m.name_english LIKE ${`%${q}%`} OR m.member_code LIKE ${`%${q}%`})`);
  if (gender) conditions.push(sql`m.gender = ${gender}`);
  if (stateFilter != null) conditions.push(sql`m.region_id = ${stateFilter}`);
  if (positionFilter === "__none") {
    conditions.push(sql`NOT EXISTS (
      SELECT 1 FROM member_positions mp
       WHERE mp.member_id = m.id AND mp.scope_type = 'department' AND mp.department_id = ${id})`);
  } else if (positionFilter) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM member_positions mp
       WHERE mp.member_id = m.id AND mp.scope_type = 'department'
         AND mp.department_id = ${id} AND mp.position = ${positionFilter})`);
  }

  const members = await db.all<DepartmentMemberRow>(sql`
    SELECT m.id, m.name_myanmar, m.name_english, m.gender,
           r.name AS state_name, r.name_en AS state_name_en,
           rc.name AS church_name, rc.name_en AS church_name_en,
           (SELECT GROUP_CONCAT(mp.position, ',')
              FROM member_positions mp
             WHERE mp.member_id = m.id AND mp.scope_type = 'department'
               AND mp.department_id = ${id}) AS positions
    FROM members m
    JOIN regions r ON r.id = m.region_id
    LEFT JOIN lookup_options hc ON hc.id = m.home_cell_id
    LEFT JOIN regional_churches rc ON rc.id = hc.regional_church_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY COALESCE(NULLIF(m.name_myanmar, ''), m.name_english), m.id`);

  const filterParams = new URLSearchParams();
  if (q) filterParams.set("q", q);
  if (gender) filterParams.set("gender", gender);
  if (stateFilter != null) filterParams.set("state", String(stateFilter));
  if (positionFilter) filterParams.set("position", positionFilter);
  const filterQs = filterParams.toString();

  return c.html(
    <DepartmentDetailPage
      user={c.get("user")} perms={c.get("perms")}
      flash={flashFromQuery(c.req.query(), c.get("lang"))}
      lang={c.get("lang")} department={department} leaders={leaders} members={members}
      filters={{ q, gender, state: stateFilter, position: positionFilter }}
      regions={regions} filterQuery={filterQs ? `?${filterQs}` : ""}
      positionDefs={positionDefs}
      canManage={c.get("perms").has("options.manage") && scope.scopeAll}
      canAssign={c.get("perms").has("members.update")}
    />,
  );
});

/** Quick department role assignment from the department's member table. It
 *  only touches the member's department-scoped row; other positions stay. */
organizationRoutes.post("/departments/:id/members/:memberId/position", requirePermission("members.update"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  const memberId = intParam(c.req.param("memberId"));
  const body = await c.req.parseBody();
  const backRaw = s(body.return_query);
  const back = /^\?[A-Za-z0-9_%=&.\-]*$/.test(backRaw) && backRaw.length <= 300 ? backRaw : "";
  const done = (code: string) => `/organization/departments/${id}${back}${back ? "&" : "?"}${code}`;
  if (!id || !memberId) return c.redirect(done("err=err-notfound"), 303);

  const department = (await db.all<{ name: string }>(
    sql`SELECT name FROM church_departments WHERE id = ${id} LIMIT 1`,
  ))[0];
  if (!department) return c.redirect(done("err=err-notfound"), 303);

  const member = (await db.all<{ id: number }>(sql`
    SELECT m.id FROM members m
     WHERE m.id = ${memberId} AND m.department_id = ${id}
       AND m.status = 'active' AND ${memberScopeCond(scope)} LIMIT 1`))[0];
  if (!member) return c.redirect(done("err=err-notfound"), 303);

  const position = s(body.position).slice(0, 100);
  const defs = defsForScope(await loadPositionDefs(db), "department");
  const def = position ? defs.find((d) => d.code === position) : undefined;
  if (position && !def) return c.redirect(done("err=position-invalid"), 303);

  const previous = (await db.all<{ position: string }>(sql`
    SELECT position FROM member_positions
     WHERE member_id = ${memberId} AND scope_type = 'department' LIMIT 1`))[0]?.position ?? "";
  if (previous === position) return c.redirect(done("ok=member-position"), 303);

  if (position && await positionTaken(db, "department", position, { departmentId: id, exceptMemberId: memberId })) {
    return c.redirect(done("err=position-taken"), 303);
  }

  const actorId = c.get("user").id;
  const now = Math.floor(Date.now() / 1000);
  await db.run(sql`
    DELETE FROM member_positions
     WHERE member_id = ${memberId} AND scope_type = 'department'`);
  if (position) {
    await db.insert(memberPositions).values({
      memberId, position, scopeType: "department", departmentId: id,
      createdBy: actorId, createdAt: now, updatedAt: now,
    });
  }
  await db.update(members).set({ updatedBy: actorId, updatedAt: now })
    .where(eq(members.id, memberId));
  await db.insert(memberHistory).values({
    memberId, actorId, action: "position",
    snapshotJson: JSON.stringify({ department_id: id, position: position || null }),
  });
  await recordPositionHistory(db, {
    entity: "assignment", action: position ? "assigned" : "updated", actorId, memberId,
    scopeType: "department", code: position || null, positionDefId: def?.id ?? null,
    summary: position && def
      ? `${positionDefLabel(def, c.get("lang"))} · ${department.name}`
      : `${department.name}`,
  });

  return c.redirect(done("ok=member-position"), 303);
});

// ---------- Church departments ----------

async function loadAdminDepartments(db: ReturnType<typeof getDb>): Promise<AdminDepartmentRow[]> {
  return db.all<AdminDepartmentRow>(sql`
    SELECT d.id, d.name, d.name_en AS nameEn, d.active, d.sort_order AS sortOrder,
      d.regional_church_id AS regionalChurchId,
      rc.name AS church_name, rc.name_en AS church_name_en,
      (SELECT COUNT(*) FROM member_positions mp
        WHERE mp.scope_type = 'department' AND mp.department_id = d.id) AS role_count,
      (SELECT COUNT(*) FROM members m
        WHERE m.department_id = d.id AND m.status = 'active') AS member_count
    FROM church_departments d
    LEFT JOIN regional_churches rc ON rc.id = d.regional_church_id
    ORDER BY d.active DESC, d.sort_order, d.name`);
}

/** Active holders of department roles; the card list names a slot's holder from
 *  this list, so a role added to the catalogue needs no new SQL column. */
async function loadDepartmentLeaders(db: DB): Promise<DepartmentLeaderRow[]> {
  return db.all<DepartmentLeaderRow>(sql`
    SELECT mp.department_id AS departmentId, mp.position,
           m.id AS memberId,
           COALESCE(NULLIF(m.name_myanmar, ''), m.name_english) AS memberName
    FROM member_positions mp
    JOIN members m ON m.id = mp.member_id
    WHERE mp.scope_type = 'department' AND m.status = 'active'
    ORDER BY mp.department_id, mp.position`);
}

organizationRoutes.get("/departments", requirePermission("options.manage"), requireAllStates, async (c) => {
  const db = getDb(c.env);
  const departments = await loadAdminDepartments(db);
  return c.html(
    <DepartmentsPage
      user={c.get("user")} perms={c.get("perms")}
      flash={flashFromQuery(c.req.query(), c.get("lang"))}
      lang={c.get("lang")} departments={departments}
      positionDefs={await loadPositionDefs(db)} leaders={await loadDepartmentLeaders(db)}
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
  const churchId = asInt(s(body.regional_church_id));
  const values = { name, nameEn, sortOrder, active: true, regionalChurchId: churchId ?? "" as const };
  const modal = modalRequest(c);
  const churches = await positionChurchOptions(db, c.get("lang"));
  const fail = async (code: string) => modal
    ? c.html(<DepartmentModal values={values} churches={churches} error={flashText(code, c.get("lang"))} lang={c.get("lang")} />, 422)
    : c.redirect(`/organization/departments?err=${code}`, 303);
  const invalid = departmentNameError(name, nameEn);
  if (invalid) return await fail(invalid);
  if (!await validPositionChurch(db, churchId)) return await fail("err-notfound");
  try {
    const duplicate = await db.all<{ id: number }>(sql`
      SELECT id FROM church_departments
       WHERE lower(name) = lower(${name}) AND COALESCE(regional_church_id, 0) = ${churchId ?? 0}
       LIMIT 1`);
    if (duplicate.length > 0) return await fail("department-name-taken");
    await db.insert(churchDepartments).values({
      name, nameEn: nameEn || null, active: 1, sortOrder,
      regionalChurchId: churchId,
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
  const churchId = asInt(s(body.regional_church_id));
  const department = (await loadAdminDepartments(db)).find((d) => d.id === id)!;
  const values = {
    name, nameEn, sortOrder, active: active === 1,
    regionalChurchId: churchId ?? "" as const,
  };
  const modal = modalRequest(c);
  const churches = await positionChurchOptions(db, c.get("lang"));
  const fail = async (code: string) => modal
    ? c.html(
      <DepartmentModal department={department} values={values} churches={churches} error={flashText(code, c.get("lang"))} lang={c.get("lang")} />,
      422,
    )
    : c.redirect(`/organization/departments?err=${code}`, 303);
  const invalid = departmentNameError(name, nameEn);
  if (invalid) return await fail(invalid);
  if (!await validPositionChurch(db, churchId)) return await fail("err-notfound");

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
       WHERE lower(name) = lower(${name}) AND id <> ${id}
         AND COALESCE(regional_church_id, 0) = ${churchId ?? 0} LIMIT 1`);
    if (duplicate.length > 0) return await fail("department-name-taken");
    await db.update(churchDepartments).set({
      name, nameEn: nameEn || null, active, sortOrder,
      regionalChurchId: churchId,
    }).where(eq(churchDepartments.id, id));
  } catch {
    return await fail("department-name-taken");
  }
  const landing = "/organization/departments?ok=department-updated";
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

// ---------- Editable position catalogue ----------

async function adminPositionDefs(db: DB): Promise<PositionDefRow[]> {
  const rows = await db.all<PositionDefRow & { church_ids: string | null }>(sql`
    SELECT pd.id, pd.scope_type AS scopeType, pd.code,
           pd.name_myanmar AS nameMyanmar, pd.name_english AS nameEnglish,
           pd.name_korean AS nameKorean, pd.parent_code AS parentCode,
           pd.active, pd.sort_order AS sortOrder,
           GROUP_CONCAT(DISTINCT pdc.regional_church_id) AS church_ids,
           (SELECT COUNT(*) FROM member_positions mp
             LEFT JOIN members m ON m.id = mp.member_id
             LEFT JOIN pastors p ON p.id = mp.pastor_id
             WHERE mp.position = pd.code AND mp.scope_type = pd.scope_type
               AND ((mp.member_id IS NOT NULL AND m.status = 'active')
                 OR (mp.pastor_id IS NOT NULL AND p.active = 1))) AS usageCount
    FROM position_defs pd
    LEFT JOIN position_def_churches pdc ON pdc.position_def_id = pd.id
    GROUP BY pd.id
    ORDER BY pd.scope_type, pd.sort_order, pd.id`);
  return rows.map((row) => ({
    ...row,
    regionalChurchIds: (row.church_ids ?? "")
      .split(",")
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0),
  }));
}

/** How many live people hold a catalogue role. A row left behind by a
 *  deactivated member or pastor is shown as vacant everywhere, so it must not
 *  keep the role from being edited, deactivated or deleted. */
async function activeHolderCount(db: DB, code: string, scopeType: string): Promise<number> {
  const rows = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM member_positions mp
    LEFT JOIN members m ON m.id = mp.member_id
    LEFT JOIN pastors p ON p.id = mp.pastor_id
    WHERE mp.position = ${code} AND mp.scope_type = ${scopeType}
      AND ((mp.member_id IS NOT NULL AND m.status = 'active')
        OR (mp.pastor_id IS NOT NULL AND p.active = 1))`);
  return rows[0]?.n ?? 0;
}

/** Church choices for the position form (this admin sees every state). */
async function positionChurchOptions(db: DB, lang: string): Promise<{ id: number; name: string }[]> {
  const rows = await loadRegionalChurches(db, { activeOnly: true, scopeAll: true });
  return rows.map((r) => ({ id: r.id, name: regionalChurchName(r, lang) }));
}

/** A church ticked in a position form must still exist. */
async function validPositionChurch(db: DB, churchId: number | null): Promise<boolean> {
  if (churchId == null) return true;
  const rows = await db.all<{ id: number }>(sql`
    SELECT id FROM regional_churches WHERE id = ${churchId} LIMIT 1`);
  return rows.length > 0;
}

/** Checkbox group -> unique, positive church ids. */
function formChurchIds(raw: unknown): number[] {
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  return [...new Set(list
    .map((value) => asInt(s(value)))
    .filter((id): id is number => id != null && id > 0))];
}

async function replacePositionChurches(db: DB, positionDefId: number, churchIds: number[]): Promise<void> {
  await db.run(sql`DELETE FROM position_def_churches WHERE position_def_id = ${positionDefId}`);
  for (const churchId of churchIds) {
    await db.run(sql`
      INSERT OR IGNORE INTO position_def_churches (position_def_id, regional_church_id)
      VALUES (${positionDefId}, ${churchId})`);
  }
}

/** Parent choices for the position form: same scope, never the position itself. */
function parentOptions(defs: PositionDefRow[], scope: string, lang: string, exceptCode?: string) {
  return defs
    .filter((d) => d.scopeType === scope && d.code !== exceptCode)
    .map((d) => ({ code: d.code, label: positionDefLabel(d, lang) }));
}

/** True when the chosen parent is this position or sits under it, which would
 *  make the chart a loop. */
function parentFormsCycle(defs: PositionDefRow[], scope: string, code: string, parentCode: string): boolean {
  let cursor: string | null = parentCode;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === code || seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = defs.find((d) => d.scopeType === scope && d.code === cursor)?.parentCode ?? null;
  }
  return false;
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
      churches={await positionChurchOptions(db, c.get("lang"))}
      q={listQuery(c.req.query("q"))} status={listStatus(c.req.query("status"))}
    />,
  );
});

organizationRoutes.get("/positions/new", requirePermission("options.manage"), requireAllStates, async (c) => {
  const db = getDb(c.env);
  const scope = positionScopeFrom(c.req.query("scope"));
  if (!modalRequest(c)) return c.redirect(`/organization/positions?scope=${scope}`, 303);
  return c.html(
    <PositionModal scope={scope} lang={c.get("lang")}
      churches={await positionChurchOptions(db, c.get("lang"))}
      parents={parentOptions(await adminPositionDefs(db), scope, c.get("lang"))} />,
  );
});

organizationRoutes.get("/positions/:id/edit", requirePermission("options.manage"), requireAllStates, async (c) => {
  const db = getDb(c.env);
  const id = intParam(c.req.param("id"));
  const defs = await adminPositionDefs(db);
  const def = id ? defs.find((d) => d.id === id) : undefined;
  if (!def) return c.redirect("/organization/positions?err=err-notfound", 303);
  if (!modalRequest(c)) return c.redirect(`/organization/positions?scope=${def.scopeType}`, 303);
  return c.html(
    <PositionModal scope={def.scopeType} def={def} lang={c.get("lang")}
      churches={await positionChurchOptions(db, c.get("lang"))}
      parents={parentOptions(defs, def.scopeType, c.get("lang"), def.code)} />,
  );
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
  const parentCode = s(body.parent_code) || null;
  // Repeated checkbox keys only survive with `all`, which wraps every field in an array.
  const allBody = await c.req.parseBody({ all: true });
  const churchIds = formChurchIds(allBody.church_ids);
  const values = {
    nameMyanmar: nameMm, nameEnglish: nameEn, nameKorean: nameKr, sortOrder, active: true, parentCode,
    regionalChurchIds: churchIds,
  };
  // A modal submit gets the form back with the error instead of a redirect, so
  // the dialog stays open and keeps what was typed.
  const modal = modalRequest(c);
  const churchOptions = await positionChurchOptions(db, c.get("lang"));
  const fail = async (err: string) => modal
    ? c.html(<PositionModal scope={scope} values={values} churches={churchOptions} error={flashText(err, c.get("lang"))} lang={c.get("lang")} />, 422)
    : c.redirect(`${back}&err=${err}`, 303);
  const invalid = positionNameError(nameMm, nameEn);
  if (invalid) return fail(invalid);
  if (!nameEn) return fail("position-name-en");
  for (const churchId of churchIds) {
    if (!await validPositionChurch(db, churchId)) return fail("position-church-invalid");
  }
  if (parentCode) {
    const exists = (await adminPositionDefs(db)).some((d) => d.scopeType === scope && d.code === parentCode);
    if (!exists) return fail("position-parent-invalid");
  }

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
      INSERT INTO position_defs (scope_type, code, name_myanmar, name_english, name_korean, active, sort_order, parent_code)
      VALUES (${scope}, ${code}, ${nameMm}, ${nameEn || null}, ${nameKr || null}, 1, ${sortOrder}, ${parentCode})`);
  } catch {
    return fail("position-code-taken");
  }
  const created = (await db.all<{ id: number }>(sql`
    SELECT id FROM position_defs WHERE scope_type = ${scope} AND code = ${code} LIMIT 1`))[0];
  if (created) await replacePositionChurches(db, created.id, churchIds);
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
  const current = (await adminPositionDefs(db)).find((def) => def.id === id);
  if (!current) return c.redirect("/organization/positions?err=err-notfound", 303);
  const back = `/organization/positions?scope=${current.scopeType}`;
  const body = await c.req.parseBody();
  const nameMm = s(body.name_myanmar).slice(0, 100);
  const nameEn = s(body.name_english).slice(0, 100);
  const nameKr = s(body.name_korean).slice(0, 100);
  const active = s(body.active) === "1" ? 1 : 0;
  const sortOrder = departmentSortOrder(s(body.sort_order), current.sortOrder);
  const parentCode = s(body.parent_code) || null;
  // Repeated checkbox keys only survive with `all`, which wraps every field in an array.
  const allBody = await c.req.parseBody({ all: true });
  const churchIds = formChurchIds(allBody.church_ids);
  const values = {
    nameMyanmar: nameMm, nameEnglish: nameEn, nameKorean: nameKr,
    sortOrder, active: active === 1, parentCode, regionalChurchIds: churchIds,
  };
  const modal = modalRequest(c);
  const churchOptions = await positionChurchOptions(db, c.get("lang"));
  const fail = async (err: string) => {
    if (!modal) return c.redirect(`${back}&err=${err}`, 303);
    return c.html(
      <PositionModal scope={current.scopeType} def={current} values={values}
        churches={churchOptions}
        error={flashText(err, c.get("lang"))} lang={c.get("lang")} />,
      422,
    );
  };
  const invalid = positionNameError(nameMm, nameEn);
  if (invalid) return await fail(invalid);
  for (const churchId of churchIds) {
    if (!await validPositionChurch(db, churchId)) return await fail("position-church-invalid");
  }
  if (parentCode) {
    const defs = await adminPositionDefs(db);
    if (!defs.some((d) => d.scopeType === current.scopeType && d.code === parentCode)) {
      return await fail("position-parent-invalid");
    }
    if (parentFormsCycle(defs, current.scopeType, current.code, parentCode)) {
      return await fail("position-parent-cycle");
    }
  }
  if (current.active === 1 && active === 0) {
    if ((await activeHolderCount(db, current.code, current.scopeType)) > 0) return await fail("position-in-use");
  }
  await db.run(sql`
    UPDATE position_defs
       SET name_myanmar = ${nameMm}, name_english = ${nameEn || null}, name_korean = ${nameKr || null},
           active = ${active}, sort_order = ${sortOrder}, parent_code = ${parentCode},
           updated_at = unixepoch()
     WHERE id = ${id}`);
  await replacePositionChurches(db, id, churchIds);
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
  if ((await activeHolderCount(db, current.code, current.scopeType)) > 0) {
    return c.redirect(`${back}&err=position-in-use`, 303);
  }
  await db.run(sql`DELETE FROM position_def_churches WHERE position_def_id = ${id}`);
  await db.run(sql`DELETE FROM position_defs WHERE id = ${id}`);
  // Children of a removed position become top level instead of vanishing.
  await db.run(sql`
    UPDATE position_defs SET parent_code = NULL, updated_at = unixepoch()
     WHERE scope_type = ${current.scopeType} AND parent_code = ${current.code}`);
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
      churches={await positionChurchOptions(db, c.get("lang"))}
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
      churches={await positionChurchOptions(db, c.get("lang"))}
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
        churches={await positionChurchOptions(db, c.get("lang"))}
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
        churches={await positionChurchOptions(db, c.get("lang"))}
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
  // Any Home Cell of this state may be picked: one that still sits under a
  // sibling church is moved here by the save below, not rejected.
  if (cellsPresent && selectedCellIds.length > 0) {
    const valid = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM lookup_options
      WHERE type = 'home_cell' AND region_id = ${regionId}
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
    // Same rule as the full editor: a Home Cell of this state can be moved here
    // even while another church still owns it.
    const valid = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM lookup_options
      WHERE type = 'home_cell' AND region_id = ${church.regionId}
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
          churches={await positionChurchOptions(db, c.get("lang"))}
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

/** Pastors selectable as a spouse: the directory scoped to the signed-in user. */
async function pastorSpouseOptions(db: DB, scope: Scope): Promise<SpouseOption[]> {
  const rows = await loadPastors(db, { activeOnly: false, scopeAll: scope.scopeAll, stateIds: scope.stateIds });
  return rows.map((p) => ({ id: p.id, name: p.name, nameEn: p.nameEn, title: p.title }));
}

/** Keep the spouse link mutual: setting or clearing one side updates the other. */
async function linkPastorSpouse(db: DB, id: number, spouseId: number | null): Promise<void> {
  await db.run(sql`
    UPDATE pastors SET spouse_pastor_id = NULL, updated_at = unixepoch()
     WHERE spouse_pastor_id = ${id} OR id = ${id}`);
  if (spouseId == null || spouseId === id) return;
  await db.run(sql`
    UPDATE pastors SET spouse_pastor_id = NULL, updated_at = unixepoch()
     WHERE spouse_pastor_id = ${spouseId} OR id = ${spouseId}`);
  await db.run(sql`UPDATE pastors SET spouse_pastor_id = ${spouseId}, updated_at = unixepoch() WHERE id = ${id}`);
  await db.run(sql`UPDATE pastors SET spouse_pastor_id = ${id}, updated_at = unixepoch() WHERE id = ${spouseId}`);
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
    spouseId: asInt(s(body.spouse_pastor_id)),
  };
}

organizationRoutes.get("/pastors", requireAnyPermission("pastors.view", "pastors.manage"), async (c) => {
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

organizationRoutes.get("/pastors/new", requirePermission("pastors.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  if (!modalRequest(c)) return c.redirect("/organization/pastors", 303);
  return c.html(
    <PastorModal
      regions={await orgRegions(db, scope, c.get("lang"))}
      churches={await pastorChurches(db, scope, c.get("lang"))}
      spouses={await pastorSpouseOptions(db, scope)}
      lang={c.get("lang")}
    />,
  );
});

organizationRoutes.get("/pastors/:id/photo", requireAnyPermission("pastors.view", "pastors.manage"), async (c) => {
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

organizationRoutes.get("/pastors/:id", requireAnyPermission("pastors.view", "pastors.manage"), async (c) => {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const id = intParam(c.req.param("id"));
  if (!id) return c.redirect("/organization/pastors?err=err-notfound", 303);
  const pastor = await loadPastor(db, id, { activeOnly: false, scopeAll: scope.scopeAll, stateIds: scope.stateIds });
  if (!pastor) return c.redirect("/organization/pastors?err=err-notfound", 303);
  return c.html(
    <PastorDetailPage
      pastor={pastor}
      history={await loadPastorHistory(db, id)}
      historyRegions={await orgRegions(db, scope, c.get("lang"))}
      user={c.get("user")} perms={c.get("perms")}
      flash={flashFromQuery(c.req.query(), c.get("lang"))}
      lang={c.get("lang")}
    />,
  );
});

organizationRoutes.get("/pastors/:id/edit", requirePermission("pastors.manage"), async (c) => {
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
      spouses={await pastorSpouseOptions(db, scope)}
      lang={c.get("lang")}
    />,
  );
});

organizationRoutes.post("/pastors", requirePermission("pastors.manage"), async (c) => {
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
    spouseId: f.spouseId ?? "",
  };
  const modal = modalRequest(c);
  const fail = async (err: string) => {
    if (!modal) return c.redirect(`/organization/pastors?err=${err}`, 303);
    return c.html(
      <PastorModal
        regions={await orgRegions(db, scope, c.get("lang"))}
        churches={await pastorChurches(db, scope, c.get("lang"))}
        spouses={await pastorSpouseOptions(db, scope)}
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
  if (f.spouseId != null && !(await pastorSpouseOptions(db, scope)).some((p) => p.id === f.spouseId)) {
    return await fail("pastor-spouse-invalid");
  }
  await db.run(sql`
    INSERT INTO pastors (name, name_en, title, position, gender, marital_status, date_of_birth,
                         region_id, regional_church_id, phone, email, address, ordination_date, notes, active, sort_order)
    VALUES (${f.name}, ${f.nameEn || null}, ${f.title || null}, ${f.position || null},
            ${f.gender}, ${f.maritalStatus}, ${f.dateOfBirth || null}, ${f.regionId}, ${f.churchId},
            ${f.phone || null}, ${f.email || null}, ${f.address || null}, ${f.ordinationDate || null},
            ${f.notes || null}, 1, ${sortOrder})`);
  const created = await db.all<{ id: number }>(sql`
    SELECT id FROM pastors WHERE name = ${f.name} AND region_id = ${f.regionId}
      AND COALESCE(regional_church_id, 0) = ${f.churchId ?? 0} ORDER BY id DESC LIMIT 1`);
  const newId = created[0]?.id;
  if (newId != null) {
    if (photo.touched) await savePastorPhoto(db, newId, photo.bytes);
    if (f.spouseId != null) await linkPastorSpouse(db, newId, f.spouseId);
  }
  const landing = "/organization/pastors?ok=pastor-created";
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

organizationRoutes.post("/pastors/:id", requirePermission("pastors.manage"), async (c) => {
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
    spouseId: f.spouseId ?? "",
  };
  const modal = modalRequest(c);
  const fail = async (err: string) => {
    if (!modal) return c.redirect(`/organization/pastors?err=${err}`, 303);
    return c.html(
      <PastorModal
        pastor={current}
        regions={await orgRegions(db, scope, c.get("lang"))}
        churches={await pastorChurches(db, scope, c.get("lang"))}
        spouses={await pastorSpouseOptions(db, scope)}
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
  if (f.spouseId != null &&
    (f.spouseId === id || !(await pastorSpouseOptions(db, scope)).some((p) => p.id === f.spouseId))) {
    return await fail("pastor-spouse-invalid");
  }
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
  await linkPastorSpouse(db, id, f.spouseId);
  const landing = "/organization/pastors?ok=pastor-updated";
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

organizationRoutes.post("/pastors/:id/delete", requirePermission("pastors.manage"), async (c) => {
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
  await db.run(sql`UPDATE pastors SET spouse_pastor_id = NULL WHERE spouse_pastor_id = ${id}`);
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

// ---------- pastor service history ----------
// Back-dated records: "1998–2004 · Pastor · Kalay church · Chin State". The
// years are validated (1900 … this year, end after start) but any past year is
// accepted, so old appointment books can be entered as they are.

async function historyPastor(c: any, id: number) {
  const db = getDb(c.env);
  const scope = scopeOf(c);
  const pastor = await loadPastor(db, id, {
    activeOnly: false, scopeAll: scope.scopeAll, stateIds: scope.stateIds,
  });
  return { db, scope, pastor };
}

organizationRoutes.get("/pastors/:id/history/new", requirePermission("pastors.manage"), async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.redirect("/organization/pastors?err=err-notfound", 303);
  const { db, scope, pastor } = await historyPastor(c, id);
  if (!pastor) return c.redirect("/organization/pastors?err=err-notfound", 303);
  if (!modalRequest(c)) return c.redirect(`/organization/pastors/${id}`, 303);
  return c.html(
    <PastorHistoryModal
      pastorId={id}
      values={historyValues()}
      regions={await orgRegions(db, scope, c.get("lang"))}
      lang={c.get("lang")}
    />,
  );
});

organizationRoutes.get("/pastors/:id/history/:hid/edit", requirePermission("pastors.manage"), async (c) => {
  const id = intParam(c.req.param("id"));
  const hid = intParam(c.req.param("hid"));
  if (!id || !hid) return c.redirect("/organization/pastors?err=err-notfound", 303);
  const { db, scope, pastor } = await historyPastor(c, id);
  if (!pastor) return c.redirect("/organization/pastors?err=err-notfound", 303);
  const row = await loadPastorHistoryRow(db, id, hid);
  if (!row) return c.redirect(`/organization/pastors/${id}?err=err-notfound`, 303);
  if (!modalRequest(c)) return c.redirect(`/organization/pastors/${id}`, 303);
  return c.html(
    <PastorHistoryModal
      pastorId={id} historyId={hid}
      values={historyValues(row)}
      regions={await orgRegions(db, scope, c.get("lang"))}
      lang={c.get("lang")}
    />,
  );
});

organizationRoutes.post("/pastors/:id/history", requirePermission("pastors.manage"), async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.redirect("/organization/pastors?err=err-notfound", 303);
  const { db, scope, pastor } = await historyPastor(c, id);
  if (!pastor) return c.redirect("/organization/pastors?err=err-notfound", 303);
  const lang = c.get("lang");
  const t = getDict(lang);
  const regions = await orgRegions(db, scope, lang);
  const body = await c.req.parseBody();
  const { values, errors, data } = readHistoryForm(body as Record<string, unknown>, regions.map((r) => r.id), t);
  const modal = modalRequest(c);
  if (!data) {
    if (!modal) return c.redirect(`/organization/pastors/${id}?err=err-invalid`, 303);
    return c.html(
      <PastorHistoryModal pastorId={id} values={values} regions={regions} errors={errors} lang={lang} />,
      422,
    );
  }
  await db.run(sql`
    INSERT INTO pastor_history (pastor_id, start_year, end_year, region_id, township, church_name,
                                position, notes, created_by, updated_at)
    VALUES (${id}, ${data.startYear}, ${data.endYear}, ${data.regionId}, ${data.township},
            ${data.churchName}, ${data.position}, ${data.notes}, ${c.get("user").id}, unixepoch())`);
  const landing = `/organization/pastors/${id}?ok=pastor-history-saved`;
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

organizationRoutes.post("/pastors/:id/history/:hid/edit", requirePermission("pastors.manage"), async (c) => {
  const id = intParam(c.req.param("id"));
  const hid = intParam(c.req.param("hid"));
  if (!id || !hid) return c.redirect("/organization/pastors?err=err-notfound", 303);
  const { db, scope, pastor } = await historyPastor(c, id);
  if (!pastor) return c.redirect("/organization/pastors?err=err-notfound", 303);
  const row = await loadPastorHistoryRow(db, id, hid);
  if (!row) return c.redirect(`/organization/pastors/${id}?err=err-notfound`, 303);
  const lang = c.get("lang");
  const t = getDict(lang);
  const regions = await orgRegions(db, scope, lang);
  const body = await c.req.parseBody();
  const { values, errors, data } = readHistoryForm(body as Record<string, unknown>, regions.map((r) => r.id), t);
  const modal = modalRequest(c);
  if (!data) {
    if (!modal) return c.redirect(`/organization/pastors/${id}?err=err-invalid`, 303);
    return c.html(
      <PastorHistoryModal pastorId={id} historyId={hid} values={values} regions={regions} errors={errors} lang={lang} />,
      422,
    );
  }
  await db.run(sql`
    UPDATE pastor_history
       SET start_year = ${data.startYear}, end_year = ${data.endYear}, region_id = ${data.regionId},
           township = ${data.township}, church_name = ${data.churchName}, position = ${data.position},
           notes = ${data.notes}, updated_at = unixepoch()
     WHERE id = ${hid} AND pastor_id = ${id}`);
  const landing = `/organization/pastors/${id}?ok=pastor-history-saved`;
  return modal ? c.json({ ok: true, redirect: landing }) : c.redirect(landing, 303);
});

organizationRoutes.post("/pastors/:id/history/:hid/delete", requirePermission("pastors.manage"), async (c) => {
  const id = intParam(c.req.param("id"));
  const hid = intParam(c.req.param("hid"));
  if (!id || !hid) return c.redirect("/organization/pastors?err=err-notfound", 303);
  const { db, pastor } = await historyPastor(c, id);
  if (!pastor) return c.redirect("/organization/pastors?err=err-notfound", 303);
  await db.run(sql`DELETE FROM pastor_history WHERE id = ${hid} AND pastor_id = ${id}`);
  return c.redirect(`/organization/pastors/${id}?ok=pastor-history-deleted`, 303);
});
