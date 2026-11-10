-- Church-level organization: departments and positions that sit above Home Cells.
--
-- Departments are a first-class registry (not a member dropdown option) so a
-- department can exist before it has any leaders. Position rows keep using
-- member_positions; department_id is separate from scope_id because scope_id
-- references lookup_options for Home Cells.
CREATE TABLE church_departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_en TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX church_departments_name_uq ON church_departments(name);

ALTER TABLE member_positions ADD COLUMN department_id INTEGER REFERENCES church_departments(id);
CREATE INDEX member_positions_department_idx ON member_positions(department_id);

-- One person per department position, and one person per church-wide position.
-- Home Cell slots already have member_positions_slot_uq from migration 0019.
CREATE UNIQUE INDEX member_positions_department_slot_uq
  ON member_positions(scope_type, department_id, position)
  WHERE department_id IS NOT NULL;
CREATE UNIQUE INDEX member_positions_church_slot_uq
  ON member_positions(scope_type, position)
  WHERE scope_type = 'church';
