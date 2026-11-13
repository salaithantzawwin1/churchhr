-- Departments and positions can now belong to specific churches.
--
-- A department with no regional_church_id stays available to every church,
-- which keeps existing rows working. New departments can be filed under one
-- church; the same name may then repeat in another church.
ALTER TABLE church_departments ADD COLUMN regional_church_id INTEGER REFERENCES regional_churches(id) ON DELETE SET NULL;
DROP INDEX IF EXISTS church_departments_name_uq;
CREATE UNIQUE INDEX church_departments_name_church_uq
  ON church_departments(name, IFNULL(regional_church_id, 0));
CREATE INDEX church_departments_church_idx ON church_departments(regional_church_id);

-- A position can be offered in several churches at once. The old single
-- position_defs.regional_church_id column is copied here and left in place for
-- older databases; all reads now use this table.
CREATE TABLE position_def_churches (
  position_def_id INTEGER NOT NULL REFERENCES position_defs(id) ON DELETE CASCADE,
  regional_church_id INTEGER NOT NULL REFERENCES regional_churches(id) ON DELETE CASCADE,
  PRIMARY KEY (position_def_id, regional_church_id)
);
CREATE INDEX position_def_churches_church_idx
  ON position_def_churches(regional_church_id, position_def_id);

INSERT OR IGNORE INTO position_def_churches (position_def_id, regional_church_id)
SELECT id, regional_church_id FROM position_defs WHERE regional_church_id IS NOT NULL;
