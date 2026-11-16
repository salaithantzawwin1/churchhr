-- A report credits a person, not a login handle. An optional full name per
-- account, set by an admin; reports, the byline and the review credit fall back
-- to the username whenever it is empty.
ALTER TABLE users ADD COLUMN display_name TEXT;
