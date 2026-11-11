-- Audit trail for the editable position catalogue and member assignments.
-- Rows keep a text snapshot so history survives a renamed or deleted role, and
-- member_id has no FK so assignments remain auditable after a member is removed.
CREATE TABLE IF NOT EXISTS position_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,              -- def | assignment
  action TEXT NOT NULL,              -- created | updated | deleted | assigned
  scope_type TEXT,
  code TEXT,
  position_def_id INTEGER,
  member_id INTEGER,
  actor_id INTEGER NOT NULL REFERENCES users(id),
  summary TEXT,
  changes_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS position_history_created_idx ON position_history(created_at);
CREATE INDEX IF NOT EXISTS position_history_entity_idx ON position_history(entity, created_at);
CREATE INDEX IF NOT EXISTS position_history_member_idx ON position_history(member_id, created_at);
