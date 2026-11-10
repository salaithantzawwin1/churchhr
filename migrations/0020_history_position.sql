-- Allow the new leadership assignment to appear in a member's history.
-- SQLite cannot alter a CHECK constraint, so rebuild the small audit table and
-- keep every existing row.
CREATE TABLE member_history_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  actor_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN (
    'create','update','delete','bulk_status','bulk_delete','bulk_group','position'
  )),
  snapshot_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO member_history_new (id, member_id, actor_id, action, snapshot_json, created_at)
  SELECT id, member_id, actor_id, action, snapshot_json, created_at FROM member_history;
DROP TABLE member_history;
ALTER TABLE member_history_new RENAME TO member_history;
CREATE INDEX member_history_member_idx ON member_history(member_id, created_at);
CREATE INDEX member_history_actor_idx ON member_history(actor_id);
