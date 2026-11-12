-- Pastors are a separate directory from members. They belong to a
-- State/Region and, optionally, one of its Regional Churches. Cluster pastoral
-- oversight now references this table instead of a member row.
CREATE TABLE pastors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_en TEXT,
  region_id INTEGER NOT NULL REFERENCES regions(id),
  regional_church_id INTEGER REFERENCES regional_churches(id),
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Set only while migrating an existing cluster assignment; unused afterwards.
  source_member_id INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX pastors_region_idx ON pastors(region_id, active, sort_order);
CREATE INDEX pastors_church_idx ON pastors(regional_church_id, active, sort_order);
CREATE INDEX pastors_source_member_idx ON pastors(source_member_id);

-- Rebuild the cluster-pastor join table: SQLite cannot make the old NOT NULL
-- member_id optional in place. Any existing assignment is copied into a pastor
-- row first, so no production cluster loses its pastor during the switch.
CREATE TABLE cluster_pastor_assignments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cluster_id INTEGER NOT NULL UNIQUE REFERENCES supervision_clusters(id) ON DELETE CASCADE,
  pastor_id INTEGER NOT NULL REFERENCES pastors(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO pastors (name, name_en, region_id, source_member_id)
SELECT COALESCE(NULLIF(m.name_myanmar, ''), m.name_english, 'Pastor ' || m.id),
       NULLIF(m.name_english, ''), m.region_id, m.id
FROM cluster_pastor_assignments cp
JOIN members m ON m.id = cp.member_id
GROUP BY m.id;

INSERT INTO cluster_pastor_assignments_new (cluster_id, pastor_id, created_by, created_at, updated_at)
SELECT cp.cluster_id, p.id, cp.created_by, cp.created_at, cp.updated_at
FROM cluster_pastor_assignments cp
JOIN pastors p ON p.source_member_id = cp.member_id;

DROP TABLE cluster_pastor_assignments;
ALTER TABLE cluster_pastor_assignments_new RENAME TO cluster_pastor_assignments;
CREATE INDEX cluster_pastor_assignments_pastor_idx
  ON cluster_pastor_assignments(pastor_id);
