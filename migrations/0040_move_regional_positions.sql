-- Move regional leadership from a church to its State/Region and convert member
-- holders of the Regional Pastor post into pastor-directory rows.
--
-- The old church id is kept in region_position_migration so this migration can
-- be rolled back without guessing which church a region assignment came from.
-- Position history is intentionally left untouched: it records what was true at
-- the time, not the new structure.
CREATE TABLE region_position_migration (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  member_id INTEGER,
  pastor_id INTEGER,
  old_scope_type TEXT NOT NULL,
  old_regional_church_id INTEGER,
  old_position TEXT NOT NULL,
  new_region_id INTEGER NOT NULL,
  new_scope_type TEXT NOT NULL DEFAULT 'region',
  conflict INTEGER NOT NULL DEFAULT 0,
  moved_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX region_position_migration_assignment_idx
  ON region_position_migration(assignment_id);

-- Reuse an existing pastor profile for a member when one is already linked;
-- otherwise create one from the member record and keep source_member_id for
-- traceability. The member row itself is never deleted.
INSERT INTO pastors (
  name, name_en, title, position, gender, marital_status, date_of_birth,
  region_id, regional_church_id, phone, email, address, ordination_date,
  notes, photo, active, sort_order, source_member_id
)
SELECT
  COALESCE(NULLIF(m.name_myanmar, ''), NULLIF(m.name_english, ''), 'Pastor ' || m.id),
  NULLIF(m.name_english, ''), NULL, NULL, m.gender, m.marital_status,
  m.date_of_birth, m.region_id, NULL, m.phone, NULL, m.address, NULL,
  m.notes, m.photo, CASE WHEN m.status = 'active' THEN 1 ELSE 0 END, 0, m.id
FROM member_positions mp
JOIN members m ON m.id = mp.member_id
WHERE mp.scope_type = 'regional_church'
  AND mp.position = 'regional_pastor'
  AND mp.member_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM pastors p WHERE p.source_member_id = m.id
  );

UPDATE member_positions
SET pastor_id = (
      SELECT p.id FROM pastors p
       WHERE p.source_member_id = member_positions.member_id
       ORDER BY p.id LIMIT 1
    ),
    member_id = NULL
WHERE scope_type = 'regional_church'
  AND position = 'regional_pastor'
  AND member_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM pastors p WHERE p.source_member_id = member_positions.member_id
  );

-- Regional Pastor and Assistant Pastor may have several holders. Secretary and
-- Treasurer stay single-holder; if legacy data already has more than one in a
-- region, keep every row but mark the extras non-unique and record a conflict so
-- an administrator can review them instead of the migration failing.
UPDATE member_positions
SET slot_unique = 0
WHERE scope_type = 'regional_church'
  AND position IN ('regional_secretary', 'regional_treasurer')
  AND id NOT IN (
    SELECT MIN(mp.id)
    FROM member_positions mp
    JOIN regional_churches rc ON rc.id = mp.regional_church_id
    WHERE mp.scope_type = 'regional_church'
      AND mp.position IN ('regional_secretary', 'regional_treasurer')
    GROUP BY rc.region_id, mp.position
  );

UPDATE member_positions
SET slot_unique = 0
WHERE scope_type = 'regional_church'
  AND position = 'regional_pastor';

INSERT INTO region_position_migration (
  assignment_id, member_id, pastor_id, old_scope_type,
  old_regional_church_id, old_position, new_region_id, new_scope_type, conflict
)
SELECT mp.id, mp.member_id, mp.pastor_id, mp.scope_type,
       mp.regional_church_id, mp.position, rc.region_id, 'region',
       CASE WHEN mp.slot_unique = 0
                  AND mp.position IN ('regional_secretary', 'regional_treasurer')
            THEN 1 ELSE 0 END
FROM member_positions mp
JOIN regional_churches rc ON rc.id = mp.regional_church_id
WHERE mp.scope_type = 'regional_church'
  AND mp.position IN ('regional_pastor', 'regional_secretary', 'regional_treasurer');

UPDATE member_positions
SET scope_type = 'region',
    region_id = (
      SELECT rc.region_id FROM regional_churches rc
       WHERE rc.id = member_positions.regional_church_id
    ),
    regional_church_id = NULL,
    priority = 1
WHERE scope_type = 'regional_church'
  AND position IN ('regional_pastor', 'regional_secretary', 'regional_treasurer');

-- Keep the old catalogue rows only as historical labels were never stored on
-- assignments; the live definitions move to the region scope.
INSERT OR IGNORE INTO position_defs (
  scope_type, code, name_myanmar, name_english, name_korean, active,
  sort_order, parent_code
)
SELECT 'region', code, name_myanmar, name_english, name_korean, active,
       sort_order, parent_code
FROM position_defs
WHERE scope_type = 'regional_church'
  AND code IN ('regional_pastor', 'regional_secretary', 'regional_treasurer');

DELETE FROM position_defs
WHERE scope_type = 'regional_church'
  AND code IN ('regional_pastor', 'regional_secretary', 'regional_treasurer');

UPDATE position_defs
SET allow_multiple = 1, min_holders = 1
WHERE scope_type = 'region' AND code = 'regional_pastor';

UPDATE position_defs
SET allow_multiple = 0, min_holders = 1
WHERE scope_type = 'region' AND code IN ('regional_secretary', 'regional_treasurer');

-- A church has one Senior Pastor but may have several Assistant Pastors.
-- An optional Assistant slot does not create a false vacancy.
UPDATE position_defs
SET allow_multiple = 0, min_holders = 1
WHERE code = 'church_senior_pastor';
UPDATE position_defs
SET allow_multiple = 1, min_holders = 0
WHERE code = 'church_assistant_pastor';
