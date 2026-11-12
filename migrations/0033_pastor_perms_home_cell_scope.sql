-- The pastor directory gets its own permissions so viewing it can be granted
-- separately from dropdown administration. Every role that administered
-- options keeps the access it had before.
INSERT OR IGNORE INTO role_permissions (role_id, permission)
SELECT role_id, 'pastors.view' FROM role_permissions WHERE permission = 'options.manage';
INSERT OR IGNORE INTO role_permissions (role_id, permission)
SELECT role_id, 'pastors.manage' FROM role_permissions WHERE permission = 'options.manage';

-- Optional per-user member-list scope: when rows exist here, the account only
-- sees members of those Home Cells (inside its State/Region scope).
CREATE TABLE IF NOT EXISTS user_home_cell_assignments (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  home_cell_id INTEGER NOT NULL REFERENCES lookup_options(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, home_cell_id)
);
CREATE INDEX IF NOT EXISTS user_home_cell_user_idx ON user_home_cell_assignments(user_id);
