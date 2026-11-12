-- A pastor's spouse is usually another pastor in this directory, so the link is
-- a nullable self reference. The app keeps it mutual and clears it on delete.
ALTER TABLE pastors ADD COLUMN spouse_pastor_id INTEGER REFERENCES pastors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS pastors_spouse_idx ON pastors(spouse_pastor_id);
