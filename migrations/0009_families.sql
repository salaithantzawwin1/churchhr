-- Households: a proper family registry above the loose family_group label.
--
-- families holds one row per household; the head member anchors it. Members
-- get family_id (which household) + relationship (head/spouse/son/daughter/…).
-- The legacy family_group_id lookup label stays untouched for reporting
-- continuity; members created from the new "add family member" flow copy the
-- head's family_group / group / home cell so assignments happen automatically.
--
-- No FK on head_member_id: the head member might be deleted while the family
-- row (with its name/contact info) should stay as a registry record.
CREATE TABLE families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  head_member_id INTEGER,
  address TEXT,
  township TEXT,
  phone TEXT,
  region_id INTEGER NOT NULL REFERENCES regions(id),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX families_region_idx ON families(region_id);
CREATE INDEX families_head_idx ON families(head_member_id);

-- Which household a member belongs to + their role inside it.
ALTER TABLE members ADD COLUMN family_id INTEGER REFERENCES families(id);
ALTER TABLE members ADD COLUMN relationship TEXT NOT NULL DEFAULT '';
CREATE INDEX members_family_idx ON members(family_id);
