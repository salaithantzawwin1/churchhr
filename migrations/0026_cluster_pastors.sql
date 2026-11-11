-- Pastoral oversight for Home Cell supervision clusters. A pastor can cover
-- more than one cluster, so this is separate from member_positions (which
-- allows one row per member and scope). Each cluster has at most one pastor.
CREATE TABLE cluster_pastor_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cluster_id INTEGER NOT NULL UNIQUE REFERENCES supervision_clusters(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX cluster_pastor_assignments_member_idx
  ON cluster_pastor_assignments(member_id);
