-- Households keep their own placement so a Family Group can be created from
-- their Home Cell even before a head member exists. Existing rows stay NULL
-- until the household is next saved; nothing is backfilled here.
ALTER TABLE families ADD COLUMN home_cell_id INTEGER REFERENCES lookup_options(id);
ALTER TABLE families ADD COLUMN group_id INTEGER REFERENCES lookup_options(id);
ALTER TABLE families ADD COLUMN family_group_id INTEGER REFERENCES lookup_options(id);
