-- Hierarchy for lookup options (State → Township → Home Cell → Family Group)
-- plus per-state duplicate labels.
--
-- SQLite cannot drop a table-level UNIQUE constraint, so lookup_options is
-- rebuilt:
--   UNIQUE (type, label)        -> UNIQUE (type, label, region_id)
--   region_id NULL = all states -> region_id NOT NULL, 0 = all states
--                                 (same 0-wildcard convention as
--                                 user_state_assignments; no FK because 0 is
--                                 not a real region id)
--   new parent_id column        -> Home Cell under Township, Family Group
--                                 under Home Cell (optional, NULL = none)
--
-- D1 enforces foreign keys and PRAGMA defer_foreign_keys resets after every
-- statement, so dropping the parent table while members rows still reference
-- option ids fails. Instead the member option references are parked in a side
-- table for the duration of the rebuild and restored afterwards (the rebuild
-- preserves every option id, so the references stay valid).
DROP TABLE IF EXISTS lookup_options_new;  -- cleanup of a partially applied run

CREATE TABLE _member_option_refs AS
  SELECT id, ethnicity_id, education_id, family_group_id,
         fellowship_category_id, group_id, home_cell_id
  FROM members;

UPDATE members
  SET ethnicity_id = NULL, education_id = NULL, family_group_id = NULL,
      fellowship_category_id = NULL, group_id = NULL, home_cell_id = NULL;

CREATE TABLE lookup_options_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  region_id INTEGER NOT NULL DEFAULT 0,
  parent_id INTEGER REFERENCES lookup_options(id),
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (type, label, region_id)
);

INSERT INTO lookup_options_new (id, type, label, region_id, active, sort_order)
  SELECT id, type, label, COALESCE(region_id, 0), active, sort_order
  FROM lookup_options;

DROP TABLE lookup_options;
ALTER TABLE lookup_options_new RENAME TO lookup_options;

CREATE INDEX lookup_options_type_idx ON lookup_options(type);
CREATE INDEX lookup_options_region_idx ON lookup_options(region_id);
CREATE INDEX lookup_options_parent_idx ON lookup_options(parent_id);

UPDATE members SET
  ethnicity_id = (SELECT r.ethnicity_id FROM _member_option_refs r WHERE r.id = members.id),
  education_id = (SELECT r.education_id FROM _member_option_refs r WHERE r.id = members.id),
  family_group_id = (SELECT r.family_group_id FROM _member_option_refs r WHERE r.id = members.id),
  fellowship_category_id = (SELECT r.fellowship_category_id FROM _member_option_refs r WHERE r.id = members.id),
  group_id = (SELECT r.group_id FROM _member_option_refs r WHERE r.id = members.id),
  home_cell_id = (SELECT r.home_cell_id FROM _member_option_refs r WHERE r.id = members.id);

DROP TABLE _member_option_refs;
