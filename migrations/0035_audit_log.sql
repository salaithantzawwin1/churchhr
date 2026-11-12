-- Audit trail: who did what, when, and from which device.
--
-- Rows are written by the request middleware in src/audit.ts for every
-- successful state-changing request, so the log does not depend on each route
-- remembering to call it. Username is snapshotted next to user_id so the entry
-- still reads correctly after the account is renamed or removed.
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL DEFAULT (unixepoch()),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT,
  -- Dotted action key (member.update, report.review, login.failed …), the
  -- label shown on the page comes from the dictionary.
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  -- Optional human detail captured by the route (e.g. the changed name).
  summary TEXT,
  ip TEXT,
  user_agent TEXT,
  -- "Phone · Chrome · Android" derived from the user agent.
  device TEXT,
  method TEXT,
  path TEXT,
  status INTEGER
);

CREATE INDEX audit_log_at_idx ON audit_log(at DESC);
CREATE INDEX audit_log_user_idx ON audit_log(user_id, at DESC);
CREATE INDEX audit_log_action_idx ON audit_log(action, at DESC);
CREATE INDEX audit_log_entity_idx ON audit_log(entity, entity_id);

-- Only administrators read the audit trail.
INSERT OR IGNORE INTO role_permissions (role_id, permission) VALUES (1, 'audit.view');
