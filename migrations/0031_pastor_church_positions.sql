-- Pastoral posts (Senior Pastor, Assistant Pastor, …) are filled from the pastor
-- directory, which has no members row. member_positions therefore needs a
-- nullable member_id plus an optional pastor_id. SQLite cannot relax NOT NULL in
-- place, so the table is rebuilt with every row and index preserved.
CREATE TABLE member_positions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
  pastor_id INTEGER REFERENCES pastors(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'home_cell',
  scope_id INTEGER REFERENCES lookup_options(id),
  department_id INTEGER REFERENCES church_departments(id),
  regional_church_id INTEGER REFERENCES regional_churches(id),
  supervision_cluster_id INTEGER REFERENCES supervision_clusters(id),
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO member_positions_new (
  id, member_id, pastor_id, position, scope_type, scope_id, department_id,
  regional_church_id, supervision_cluster_id, created_by, created_at, updated_at
)
SELECT id, member_id, NULL, position, scope_type, scope_id, department_id,
       regional_church_id, supervision_cluster_id, created_by, created_at, updated_at
FROM member_positions;

DROP TABLE member_positions;
ALTER TABLE member_positions_new RENAME TO member_positions;

-- The same indexes migration 0019/0021/0023/0025 created, plus pastor slots.
CREATE INDEX member_positions_member_idx ON member_positions(member_id);
CREATE INDEX member_positions_pastor_idx ON member_positions(pastor_id);
CREATE INDEX member_positions_scope_idx ON member_positions(scope_type, scope_id);
CREATE INDEX member_positions_department_idx ON member_positions(department_id);
CREATE INDEX member_positions_regional_church_idx ON member_positions(regional_church_id);
CREATE INDEX member_positions_supervision_cluster_idx ON member_positions(supervision_cluster_id);

CREATE UNIQUE INDEX member_positions_member_scope_uq
  ON member_positions(member_id, scope_type);
CREATE UNIQUE INDEX member_positions_pastor_scope_uq
  ON member_positions(pastor_id, scope_type)
  WHERE pastor_id IS NOT NULL;
CREATE UNIQUE INDEX member_positions_slot_uq
  ON member_positions(scope_type, scope_id, position)
  WHERE scope_id IS NOT NULL;
CREATE UNIQUE INDEX member_positions_department_slot_uq
  ON member_positions(scope_type, department_id, position)
  WHERE department_id IS NOT NULL;
CREATE UNIQUE INDEX member_positions_regional_slot_uq
  ON member_positions(scope_type, regional_church_id, position)
  WHERE regional_church_id IS NOT NULL;
CREATE UNIQUE INDEX member_positions_cluster_slot_uq
  ON member_positions(scope_type, supervision_cluster_id, position)
  WHERE supervision_cluster_id IS NOT NULL;
