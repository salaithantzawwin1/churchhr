import { and, eq } from "drizzle-orm";
import type { DB } from "./db/client";
import { memberPositions } from "./db/schema";

/** Code-defined position catalogue. Adding a future Home Cell position only
 * needs an entry here; the assignment form and structure pages pick it up. */
export const HOME_CELL_POSITIONS = [
  { value: "home_cell_leader", mm: "အိမ်အသင်းခေါင်းဆောင်", en: "Home Cell Leader", kr: "홈셀 리더" },
  { value: "home_cell_assistant", mm: "ဒုတိယခေါင်းဆောင်", en: "Second Leader", kr: "부리더" },
  { value: "home_cell_secretary", mm: "အတွင်းရေးမှူး", en: "Secretary", kr: "서기" },
  { value: "home_cell_treasurer", mm: "ဘဏ္ဍာရေးမှူး", en: "Treasurer", kr: "회계" },
] as const;

export type HomeCellPositionCode = (typeof HOME_CELL_POSITIONS)[number]["value"];

export function isHomeCellPosition(value: string): value is HomeCellPositionCode {
  return HOME_CELL_POSITIONS.some((p) => p.value === value);
}

export function positionLabel(value: string | null | undefined, lang: string): string {
  const found = HOME_CELL_POSITIONS.find((p) => p.value === value);
  if (!found) return value ?? "";
  if (lang === "mm") return found.mm;
  if (lang === "kr") return found.kr;
  return found.en;
}

/** Current Home Cell assignment for one member (one row per scope by schema). */
export async function getHomeCellPosition(db: DB, memberId: number) {
  const rows = await db
    .select({
      id: memberPositions.id,
      memberId: memberPositions.memberId,
      position: memberPositions.position,
      scopeId: memberPositions.scopeId,
    })
    .from(memberPositions)
    .where(and(eq(memberPositions.memberId, memberId), eq(memberPositions.scopeType, "home_cell")))
    .limit(1);
  return rows[0] ?? null;
}

/** Replace a member's Home Cell position. Empty position clears it. */
export async function setHomeCellPosition(
  db: DB,
  memberId: number,
  position: string,
  homeCellId: number | null,
  actorId: number,
) {
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
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
  });
}

/** Another member already holding this position in the cell (excluding self). */
export async function positionTaken(
  db: DB,
  homeCellId: number,
  position: string,
  exceptMemberId: number,
) {
  const rows = await db
    .select({ memberId: memberPositions.memberId })
    .from(memberPositions)
    .where(and(
      eq(memberPositions.scopeType, "home_cell"),
      eq(memberPositions.scopeId, homeCellId),
      eq(memberPositions.position, position),
    ))
    .limit(5);
  return rows.some((r) => r.memberId !== exceptMemberId);
}
