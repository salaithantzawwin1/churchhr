-- Leadership is a hierarchy, not a flat list: a position may sit under another
-- position of the same scope (e.g. Assistant Secretary under Church Secretary).
-- The chart renders parents before children; an empty value means top level.
ALTER TABLE position_defs ADD COLUMN parent_code TEXT;
