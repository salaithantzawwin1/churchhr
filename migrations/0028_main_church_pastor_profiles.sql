-- Main church + a pastor profile database.
-- The main church stays a regional_churches row so Home Cells and positions
-- keep their foreign keys, but is_main lets the UI show it separately from
-- the regional church list and scope church leadership per church.
ALTER TABLE regional_churches ADD COLUMN is_main INTEGER NOT NULL DEFAULT 0;
UPDATE regional_churches
   SET is_main = 1
 WHERE name = 'Yangon Church (Main)'
   AND region_id = (SELECT id FROM regions WHERE name_en = 'Yangon' LIMIT 1);
CREATE UNIQUE INDEX regional_churches_one_main_uq
  ON regional_churches(region_id) WHERE is_main = 1;

-- Existing church-wide positions belonged to the central church; attach them
-- to the main church before church leadership becomes per-church.
UPDATE member_positions
   SET regional_church_id = (
     SELECT id FROM regional_churches WHERE is_main = 1 ORDER BY id LIMIT 1
   )
 WHERE scope_type = 'church' AND regional_church_id IS NULL;

-- Pastor profile fields, kept on the separate pastor record (not members).
ALTER TABLE pastors ADD COLUMN title TEXT;
ALTER TABLE pastors ADD COLUMN position TEXT;
ALTER TABLE pastors ADD COLUMN gender TEXT NOT NULL DEFAULT '';
ALTER TABLE pastors ADD COLUMN marital_status TEXT NOT NULL DEFAULT '';
ALTER TABLE pastors ADD COLUMN date_of_birth TEXT;
ALTER TABLE pastors ADD COLUMN email TEXT;
ALTER TABLE pastors ADD COLUMN address TEXT;
ALTER TABLE pastors ADD COLUMN ordination_date TEXT;
ALTER TABLE pastors ADD COLUMN notes TEXT;
ALTER TABLE pastors ADD COLUMN photo BLOB;
