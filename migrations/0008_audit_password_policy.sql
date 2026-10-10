-- Member change history (what changed, who, when) + per-IP login rate limiting.
--
-- member_history captures one row per mutating request on a member (create,
-- update, delete, bulk actions) — not per-field diffs — so the listing stays
-- small; snapshot_json holds the full record after the change.
CREATE TABLE member_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,              -- no FK: kept after member delete
  actor_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('create','update','delete','bulk_status','bulk_delete','bulk_group')),
  snapshot_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX member_history_member_idx ON member_history(member_id, created_at);
CREATE INDEX member_history_actor_idx ON member_history(actor_id);

-- per-IP sliding-window login rate limiting (see routes/auth.tsx).
CREATE TABLE login_attempts (
  ip TEXT NOT NULL,
  at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX login_attempts_ip_idx ON login_attempts(ip, at);
