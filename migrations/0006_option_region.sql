-- State/Region scoping for lookup options (Township, Home Cell, Group).
-- region_id NULL means the option applies to every state; a value limits it to
-- one State/Region. D1 cannot turn foreign keys off (no PRAGMA foreign_keys=OFF),
-- so we add the column in place instead of rebuilding the table.
ALTER TABLE lookup_options ADD COLUMN region_id INTEGER REFERENCES regions(id);
CREATE INDEX lookup_options_region_idx ON lookup_options(region_id);

-- Seed a Township option for every township already on members, scoped to the
-- single state it appears in (NULL = seen in more than one state).
INSERT OR IGNORE INTO lookup_options (type, label, region_id)
SELECT 'township', township,
  CASE WHEN COUNT(DISTINCT region_id) = 1 THEN MIN(region_id) ELSE NULL END
FROM members
WHERE township IS NOT NULL AND TRIM(township) <> ''
GROUP BY township;
