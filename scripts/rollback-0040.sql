-- Manual rollback for 0040_move_regional_positions.
--
-- Restoring the pre-migration dump is always the preferred recovery, and the
-- deploy workflow keeps one for 14 days as a run artifact. This script exists
-- for the case where the dump is gone or the move must be undone by hand.
--
-- What it reverses (everything 0040 recorded in its own log):
--   * moves each logged assignment back to scope_type 'regional_church' with
--     its old church id,
--   * gives regional-pastor rows their member_id back (from the pastor profile
--     0040 created/reused, via pastors.source_member_id),
--   * re-creates the three regional_church catalogue rows 0040 deleted.
--
-- What it deliberately leaves alone:
--   * the pastor profiles 0040 created (additive, harmless to the old code),
--   * position_history (it records what was true at the time),
--   * the region-scope catalogue rows (unused by the old code).
--
-- Restored rows get slot_unique = 0 so a legitimate duplicate can never trip the
-- region slot index mid-rollback; re-enable slots in Administration afterwards.
--
-- Run only after the code that expects the old scope is live:
--   npx wrangler d1 execute church-members-db --remote --file=scripts/rollback-0040.sql
--
-- The guard below aborts the script when 0040 never ran (the log is empty), so a
-- copy on a fresh database fails loudly instead of doing nothing quietly.

CREATE TABLE _rollback_0040_guard (ran INTEGER NOT NULL CHECK (ran = 1));
INSERT INTO _rollback_0040_guard (ran)
  SELECT CASE WHEN (SELECT COUNT(*) FROM region_position_migration) > 0 THEN 1 ELSE 0 END;

-- 1. Catalogue rows the old code looks up (labels as they were before 0040/0041).
INSERT OR IGNORE INTO position_defs
  (scope_type, code, name_myanmar, name_english, name_korean, active, sort_order, allow_multiple, min_holders)
VALUES
  ('regional_church', 'regional_pastor',    'ဒေသ အသင်းအုပ်ဆရာ',   'Regional Pastor',    '지역 목사', 1, 10, 0, 1),
  ('regional_church', 'regional_secretary', 'ဒေသ အတွင်းရေးမှူး',   'Regional Secretary', '지역 서기', 1, 20, 0, 1),
  ('regional_church', 'regional_treasurer', 'ဒေသ ဘဏ္ဍာရေးမှူး',    'Regional Treasurer', '지역 회계', 1, 30, 0, 1);

-- 2. Put each logged assignment back on its church.
UPDATE member_positions AS mp
SET scope_type = log.old_scope_type,
    regional_church_id = log.old_regional_church_id,
    region_id = NULL,
    priority = 1,
    slot_unique = 0
FROM region_position_migration AS log
WHERE log.assignment_id = mp.id
  AND mp.scope_type = 'region';

-- 3. Regional pastors were converted from member rows to pastor profiles; give
--    the member link back so the old screens show the holder again.
UPDATE member_positions
SET member_id = (
      SELECT p.source_member_id FROM pastors p
       WHERE p.id = member_positions.pastor_id
    ),
    pastor_id = NULL
WHERE scope_type = 'regional_church'
  AND position = 'regional_pastor'
  AND member_id IS NULL
  AND pastor_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM pastors p
     WHERE p.id = member_positions.pastor_id
       AND p.source_member_id IS NOT NULL
  );

DROP TABLE _rollback_0040_guard;

-- 4. Report what the rollback produced.
SELECT 'restored_rows' AS check_name, COUNT(*) AS n
  FROM member_positions
 WHERE scope_type = 'regional_church'
   AND id IN (SELECT assignment_id FROM region_position_migration);

SELECT 'regional_church_defs' AS check_name, COUNT(*) AS n
  FROM position_defs
 WHERE scope_type = 'regional_church'
   AND code IN ('regional_pastor', 'regional_secretary', 'regional_treasurer');
