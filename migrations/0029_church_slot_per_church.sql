-- 0021 made the church leadership slot unique by position alone, so only one
-- church in the whole registry could hold a Senior Pastor. The per-church slot
-- index from 0022 (regional_church_id + position) is the real constraint; this
-- drops the global one so each church can fill its own positions.
DROP INDEX IF EXISTS member_positions_church_slot_uq;
