-- "Participating sector" for members (Youth, Women, Men, ...).
-- Options are managed on /admin/options?type=sector.
ALTER TABLE members ADD COLUMN sector_id INTEGER REFERENCES lookup_options(id);
CREATE INDEX IF NOT EXISTS members_sector_idx ON members(sector_id);
