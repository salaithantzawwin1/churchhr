-- A position can be defined for one regional church only (NULL = every church
-- in its state). This lets one church own, say, a Women's Department seat while
-- a sister church in the same state does not.
ALTER TABLE position_defs ADD COLUMN regional_church_id INTEGER REFERENCES regional_churches(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS position_defs_church_idx ON position_defs(regional_church_id);
