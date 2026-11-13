-- Regional leadership belongs to a State/Region, not to one church. This
-- migration adds the region scope and the flags that let a role have several
-- holders (Regional Pastor, Assistant Pastor) while single-holder roles keep a
-- database-level slot guard.
--
-- Existing rows are untouched: region_id stays NULL until 0040 moves the old
-- regional_church assignments, slot_unique defaults to 1 so every current slot
-- keeps its unique index, and allow_multiple defaults to 0.
ALTER TABLE member_positions ADD COLUMN region_id INTEGER REFERENCES regions(id);
ALTER TABLE member_positions ADD COLUMN priority INTEGER NOT NULL DEFAULT 1;
ALTER TABLE member_positions ADD COLUMN slot_unique INTEGER NOT NULL DEFAULT 1;
ALTER TABLE position_defs ADD COLUMN allow_multiple INTEGER NOT NULL DEFAULT 0;
ALTER TABLE position_defs ADD COLUMN min_holders INTEGER NOT NULL DEFAULT 1;

CREATE INDEX member_positions_region_idx ON member_positions(region_id);
CREATE INDEX member_positions_priority_idx
  ON member_positions(scope_type, region_id, priority, position);

-- A person still holds one role per scope, but a region role is now keyed by
-- the region, so one person may serve two different regions. Church roles have
-- region_id NULL and stay one-per-scope (COALESCE keeps NULL rows together).
DROP INDEX IF EXISTS member_positions_member_scope_uq;
DROP INDEX IF EXISTS member_positions_pastor_scope_uq;
CREATE UNIQUE INDEX member_positions_member_scope_uq
  ON member_positions(member_id, scope_type, COALESCE(region_id, 0));
CREATE UNIQUE INDEX member_positions_pastor_scope_uq
  ON member_positions(pastor_id, scope_type, COALESCE(region_id, 0))
  WHERE pastor_id IS NOT NULL;

-- Slot uniqueness is now opt-in per assignment. Multi-holder rows set
-- slot_unique = 0 and are not covered by these indexes.
DROP INDEX IF EXISTS member_positions_slot_uq;
DROP INDEX IF EXISTS member_positions_department_slot_uq;
DROP INDEX IF EXISTS member_positions_regional_slot_uq;
DROP INDEX IF EXISTS member_positions_cluster_slot_uq;
CREATE UNIQUE INDEX member_positions_slot_uq
  ON member_positions(scope_type, scope_id, position)
  WHERE scope_id IS NOT NULL AND slot_unique = 1;
CREATE UNIQUE INDEX member_positions_department_slot_uq
  ON member_positions(scope_type, department_id, position)
  WHERE department_id IS NOT NULL AND slot_unique = 1;
CREATE UNIQUE INDEX member_positions_regional_slot_uq
  ON member_positions(scope_type, regional_church_id, position)
  WHERE regional_church_id IS NOT NULL AND slot_unique = 1;
CREATE UNIQUE INDEX member_positions_cluster_slot_uq
  ON member_positions(scope_type, supervision_cluster_id, position)
  WHERE supervision_cluster_id IS NOT NULL AND slot_unique = 1;
CREATE UNIQUE INDEX member_positions_region_slot_uq
  ON member_positions(scope_type, region_id, position)
  WHERE region_id IS NOT NULL AND slot_unique = 1;
