-- Hierarchy for lookup options (State → Township → Home Cell → Family Group)
-- plus per-state duplicate labels.
--
-- SQLite cannot drop a table-level UNIQUE constraint, so the table is rebuilt:
--   UNIQUE (type, label)            -> UNIQUE (type, label, region_id)
--   region_id NULL = all states     -> region_id NOT NULL, 0 = all states
--                                      (same 0-wildcard convention as
--                                      user_state_assignments; no FK because 0
--                                      is not a real region id)
--   new parent_id column            -> Home Cell belongs to a Township,
--                                      Family Group belongs to a Home Cell
--                                      (optional; NULL = no parent)
--
-- D1 cannot turn foreign keys off (PRAGMA foreign_keys = OFF is a no-op), and
-- members rows reference option ids, so dropping the parent table needs
-- deferred FK checks: the ids are preserved verbatim, and by the time the
-- deferred checks run at the end of this transaction the new table carries the
-- same name and ids, so every members row still finds its parent row.
PRAGMA defer_foreign_keys = true;

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
