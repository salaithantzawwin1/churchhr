-- Township (မြို့နယ်) — free-text area under state/region, used by the member form,
-- member detail, CSV import/export, and the dashboard Township filter.
ALTER TABLE members ADD COLUMN township TEXT;
CREATE INDEX members_township_idx ON members(township);
