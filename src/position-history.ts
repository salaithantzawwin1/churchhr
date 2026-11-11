import { sql } from "drizzle-orm";
import type { DB } from "./db/client";

export type PositionHistoryEntity = "def" | "assignment";
export type PositionHistoryAction = "created" | "updated" | "deleted" | "assigned";

export type PositionChange = { field: string; from: string | null; to: string | null };

export type PositionHistoryRow = {
  id: number;
  entity: PositionHistoryEntity;
  action: PositionHistoryAction;
  scopeType: string | null;
  code: string | null;
  positionDefId: number | null;
  memberId: number | null;
  actorId: number;
  actorName: string;
  memberName: string | null;
  summary: string | null;
  changesJson: string | null;
  createdAt: number;
};

type RecordEntry = {
  entity: PositionHistoryEntity;
  action: PositionHistoryAction;
  actorId: number;
  scopeType?: string | null;
  code?: string | null;
  positionDefId?: number | null;
  memberId?: number | null;
  summary?: string | null;
  changes?: PositionChange[];
};

/** Append one audit row. Called by the position routes after the change itself
 * has been written, so the history reflects what was actually saved. */
export async function recordPositionHistory(db: DB, entry: RecordEntry): Promise<void> {
  await db.run(sql`
    INSERT INTO position_history
      (entity, action, scope_type, code, position_def_id, member_id, actor_id, summary, changes_json)
    VALUES
      (${entry.entity}, ${entry.action}, ${entry.scopeType ?? null}, ${entry.code ?? null},
       ${entry.positionDefId ?? null}, ${entry.memberId ?? null}, ${entry.actorId},
       ${entry.summary ?? null}, ${entry.changes && entry.changes.length > 0 ? JSON.stringify(entry.changes) : null})`);
}

/** Changed fields between two saved definitions (labels, active flag, order). */
export function diffPositionDefs(
  before: { nameMyanmar: string; nameEnglish: string | null; nameKorean: string | null; active: number; sortOrder: number },
  after: { nameMyanmar: string; nameEnglish: string | null; nameKorean: string | null; active: number; sortOrder: number },
): PositionChange[] {
  const pairs: [string, string | null, string | null][] = [
    ["name_myanmar", before.nameMyanmar, after.nameMyanmar],
    ["name_english", before.nameEnglish, after.nameEnglish],
    ["name_korean", before.nameKorean, after.nameKorean],
    ["active", String(before.active), String(after.active)],
    ["sort_order", String(before.sortOrder), String(after.sortOrder)],
  ];
  return pairs
    .filter(([, from, to]) => (from ?? "") !== (to ?? ""))
    .map(([field, from, to]) => ({ field, from: from ?? null, to: to ?? null }));
}

export async function loadPositionHistory(
  db: DB,
  opts: { entity?: PositionHistoryEntity | "all"; scopeType?: string; limit?: number } = {},
): Promise<PositionHistoryRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 300, 1), 1000);
  const conditions = [sql`1=1`];
  if (opts.entity && opts.entity !== "all") conditions.push(sql`h.entity = ${opts.entity}`);
  if (opts.scopeType) conditions.push(sql`h.scope_type = ${opts.scopeType}`);
  return db.all<PositionHistoryRow>(sql`
    SELECT h.id, h.entity, h.action, h.scope_type AS scopeType, h.code,
           h.position_def_id AS positionDefId, h.member_id AS memberId,
           h.actor_id AS actorId, u.username AS actorName,
           COALESCE(NULLIF(m.name_myanmar, ''), m.name_english) AS memberName,
           h.summary, h.changes_json AS changesJson, h.created_at AS createdAt
    FROM position_history h
    JOIN users u ON u.id = h.actor_id
    LEFT JOIN members m ON m.id = h.member_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY h.created_at DESC, h.id DESC
    LIMIT ${limit}`);
}

export function parseChanges(row: Pick<PositionHistoryRow, "changesJson">): PositionChange[] {
  if (!row.changesJson) return [];
  try {
    const parsed = JSON.parse(row.changesJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
