import { and, eq, ne, sql } from "drizzle-orm";
import type { DB } from "./db/client";
import { memberPositions, members, pastors } from "./db/schema";

export type PositionScope =
  | "home_cell"
  | "department"
  | "church"
  | "region"
  /** Legacy rows only; 0040 moves live regional roles to `region`. */
  | "regional_church"
  | "township"
  | "cluster";

export type PositionDef = {
  value: string;
  scope: PositionScope;
  mm: string;
  en: string;
  kr: string;
};

/** Code-defined position catalogue. Adding a future role only needs an entry
 * here; assignment forms and organization views filter by scope. */
export const POSITIONS: PositionDef[] = [
  { value: "home_cell_leader", scope: "home_cell", mm: "အိမ်အသင်းခေါင်းဆောင်", en: "Home Cell Leader", kr: "홈셀 리더" },
  { value: "home_cell_assistant", scope: "home_cell", mm: "ဒုတိယခေါင်းဆောင်", en: "Second Leader", kr: "부리더" },
  { value: "home_cell_secretary", scope: "home_cell", mm: "အတွင်းရေးမှူး", en: "Secretary", kr: "서기" },
  { value: "home_cell_treasurer", scope: "home_cell", mm: "ဘဏ္ဍာရေးမှူး", en: "Treasurer", kr: "회계" },
  { value: "department_head", scope: "department", mm: "ဌာနမှူး", en: "Department Head", kr: "부서장" },
  { value: "department_assistant", scope: "department", mm: "ဒုတိယဌာနမှူး", en: "Assistant Department Head", kr: "부서 부장" },
  { value: "department_secretary", scope: "department", mm: "ဌာန အတွင်းရေးမှူး", en: "Department Secretary", kr: "부서 서기" },
  { value: "department_treasurer", scope: "department", mm: "ဌာန ဘဏ္ဍာရေးမှူး", en: "Department Treasurer", kr: "부서 회계" },
  { value: "church_senior_pastor", scope: "church", mm: "သင်းအုပ်ဆရာ", en: "Senior Pastor", kr: "담임 목사" },
  { value: "church_assistant_pastor", scope: "church", mm: "ဒုတိယသင်းအုပ်ဆရာ", en: "Assistant Pastor", kr: "부목사" },
  { value: "church_secretary", scope: "church", mm: "အသင်းအတွင်းရေးမှူး", en: "Church Secretary", kr: "교회 서기" },
  { value: "church_treasurer", scope: "church", mm: "အသင်းဘဏ္ဍာရေးမှူး", en: "Church Treasurer", kr: "교회 회계" },
  { value: "regional_pastor", scope: "region", mm: "ဒေသ အသင်းအုပ်ဆရာ", en: "Regional Pastor", kr: "지역 목사" },
  { value: "regional_secretary", scope: "region", mm: "ဒေသ အတွင်းရေးမှူး", en: "Regional Secretary", kr: "지역 서기" },
  { value: "regional_treasurer", scope: "region", mm: "ဒေသ ဘဏ္ဍာရေးမှူး", en: "Regional Treasurer", kr: "지역 회계" },
  { value: "cluster_supervisor", scope: "cluster", mm: "ကြီးကြပ်မှူး", en: "Supervisor", kr: "감독" },
  { value: "cluster_assistant_supervisor", scope: "cluster", mm: "ဒုတိယ ကြီးကြပ်မှူး", en: "Assistant Supervisor", kr: "부감독" },
];

export const HOME_CELL_POSITIONS = POSITIONS.filter((p) => p.scope === "home_cell");
export const DEPARTMENT_POSITIONS = POSITIONS.filter((p) => p.scope === "department");
export const CHURCH_POSITIONS = POSITIONS.filter((p) => p.scope === "church");

export function positionsForScope(scope: PositionScope): PositionDef[] {
  return POSITIONS.filter((p) => p.scope === scope);
}

export function positionScope(value: string): PositionScope | null {
  return POSITIONS.find((p) => p.value === value)?.scope ?? null;
}

export function isPositionForScope(value: string, scope: PositionScope): boolean {
  return positionScope(value) === scope;
}

export function isHomeCellPosition(value: string): boolean {
  return isPositionForScope(value, "home_cell");
}

export function positionLabel(value: string | null | undefined, lang: string): string {
  const found = POSITIONS.find((p) => p.value === value);
  if (!found) return value ?? "";
  if (lang === "mm") return found.mm;
  if (lang === "kr") return found.kr;
  return found.en;
}

/** Comma-separated DB aggregate -> human labels (used by the member list). */
export function positionLabels(csv: string | null | undefined, lang: string): string[] {
  if (!csv) return [];
  return csv.split(",").map((v) => v.trim()).filter(Boolean).map((v) => positionLabel(v, lang));
}

export type MemberPositionRow = {
  id: number;
  memberId: number;
  position: string;
  scopeType: string;
  scopeId: number | null;
  departmentId: number | null;
  regionalChurchId: number | null;
  regionId: number | null;
  supervisionClusterId: number | null;
  priority: number;
};

/** All positions for a member (at most one per scope, enforced by schema). */
export async function getMemberPositions(db: DB, memberId: number): Promise<MemberPositionRow[]> {
  return (await db
    .select({
      id: memberPositions.id,
      memberId: memberPositions.memberId,
      position: memberPositions.position,
      scopeType: memberPositions.scopeType,
      scopeId: memberPositions.scopeId,
      departmentId: memberPositions.departmentId,
      regionalChurchId: memberPositions.regionalChurchId,
      regionId: memberPositions.regionId,
      supervisionClusterId: memberPositions.supervisionClusterId,
      priority: memberPositions.priority,
    })
    .from(memberPositions)
    .where(eq(memberPositions.memberId, memberId))) as MemberPositionRow[];
}

export async function getHomeCellPosition(db: DB, memberId: number): Promise<MemberPositionRow | null> {
  const rows = await getMemberPositions(db, memberId);
  return rows.find((r) => r.scopeType === "home_cell") ?? null;
}

export type PositionAssignment = {
  scopeType: PositionScope;
  position: string;
  /** Home Cell or township id (scope_id). */
  homeCellId?: number | null;
  /** Department id. */
  departmentId?: number | null;
  /** Regional Church id (church scope). */
  regionalChurchId?: number | null;
  /** State/Region id (region scope). */
  regionId?: number | null;
  /** Supervision cluster id. */
  supervisionClusterId?: number | null;
  /** Lower number is the higher priority; equal values share a tier. */
  priority?: number | null;
  /** 1 for a single holder, 0 for a multi-holder role. */
  slotUnique?: number | null;
};

/** Replace every position for a member with the supplied valid assignments.
 * Route validation runs first so a rejected form never reaches this helper. */
export async function setMemberPositions(
  db: DB,
  memberId: number,
  assignments: PositionAssignment[],
  actorId: number,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.delete(memberPositions).where(eq(memberPositions.memberId, memberId));
  const rows = assignments.filter((a) => a.position);
  if (rows.length === 0) return;
  await db.insert(memberPositions).values(rows.map((a) => ({
    memberId,
    position: a.position,
    scopeType: a.scopeType,
    scopeId: a.scopeType === "home_cell" || a.scopeType === "township" ? a.homeCellId ?? null : null,
    departmentId: a.scopeType === "department" ? a.departmentId ?? null : null,
    regionalChurchId: a.scopeType === "church" ? a.regionalChurchId ?? null : null,
    regionId: a.scopeType === "region" ? a.regionId ?? null : null,
    supervisionClusterId: a.scopeType === "cluster" ? a.supervisionClusterId ?? null : null,
    priority: Math.min(99, Math.max(1, a.priority ?? 1)),
    slotUnique: a.slotUnique ?? 1,
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
  })));
}

/** Replace only the Home Cell position, leaving department/church roles intact. */
export async function setHomeCellPosition(
  db: DB,
  memberId: number,
  position: string,
  homeCellId: number | null,
  actorId: number,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .delete(memberPositions)
    .where(and(eq(memberPositions.memberId, memberId), eq(memberPositions.scopeType, "home_cell")));
  if (!position || !isHomeCellPosition(position) || !homeCellId) return;
  await db.insert(memberPositions).values({
    memberId,
    position,
    scopeType: "home_cell",
    scopeId: homeCellId,
    departmentId: null,
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
  });
}

/** Is this slot already held by a different person? Multi-holder roles set
 * allowMultiple so the caller never has to guess from a position code. */
export async function positionTaken(
  db: DB,
  scopeType: PositionScope,
  position: string,
  opts: {
    homeCellId?: number | null;
    departmentId?: number | null;
    regionalChurchId?: number | null;
    regionId?: number | null;
    supervisionClusterId?: number | null;
    exceptMemberId?: number | null;
    exceptPastorId?: number | null;
    allowMultiple?: boolean;
  },
): Promise<boolean> {
  if (opts.allowMultiple) return false;
  const conditions = [
    eq(memberPositions.scopeType, scopeType),
    eq(memberPositions.position, position),
    eq(memberPositions.slotUnique, 1),
  ];
  if (opts.exceptMemberId) conditions.push(ne(memberPositions.memberId, opts.exceptMemberId));
  if (opts.exceptPastorId) conditions.push(ne(memberPositions.pastorId, opts.exceptPastorId));
  if (scopeType === "home_cell" || scopeType === "township") {
    if (!opts.homeCellId) return false;
    conditions.push(eq(memberPositions.scopeId, opts.homeCellId));
  }
  if (scopeType === "department") {
    if (!opts.departmentId) return false;
    conditions.push(eq(memberPositions.departmentId, opts.departmentId));
  }
  if (scopeType === "regional_church" || scopeType === "church") {
    if (!opts.regionalChurchId) return false;
    conditions.push(eq(memberPositions.regionalChurchId, opts.regionalChurchId));
  }
  if (scopeType === "region") {
    if (!opts.regionId) return false;
    conditions.push(eq(memberPositions.regionId, opts.regionId));
  }
  if (scopeType === "cluster") {
    if (!opts.supervisionClusterId) return false;
    conditions.push(eq(memberPositions.supervisionClusterId, opts.supervisionClusterId));
  }
  // Only a live holder keeps a slot: a role left behind by a deactivated member
  // or pastor shows as vacant on every chart, so it must be assignable again.
  conditions.push(sql`((member_positions.member_id IS NOT NULL AND members.status = 'active')
                     OR (member_positions.pastor_id IS NOT NULL AND pastors.active = 1))`);
  const rows = await db
    .select({ memberId: memberPositions.memberId })
    .from(memberPositions)
    .leftJoin(members, eq(members.id, memberPositions.memberId))
    .leftJoin(pastors, eq(pastors.id, memberPositions.pastorId))
    .where(and(...conditions))
    .limit(1);
  return rows.length > 0;
}
