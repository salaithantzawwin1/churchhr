-- Read-only pre-merge check for migrations 0027-0046 (especially 0040).
-- Every statement here is a SELECT: nothing is inserted, updated or deleted.
--
-- Run against production D1 with:
--   npx wrangler d1 execute church-members-db --remote --file=scripts/pre-0040-check.sql
-- (add --json for machine-readable output)

-- 1. Overall size of the rows 0040 will touch.
SELECT 'positions_by_scope' AS check_name, scope_type, COUNT(*) AS n
  FROM member_positions
 GROUP BY scope_type
 ORDER BY scope_type;

-- 2. Everything 0040 will move (regional_church -> region), by position.
SELECT 'moved_by_position' AS check_name, position, COUNT(*) AS n
  FROM member_positions
 WHERE scope_type = 'regional_church'
 GROUP BY position
 ORDER BY position;

-- 3. Legacy rows 0040 will NOT move: scope stays regional_church and the new
--    code no longer reads that scope, so these would become invisible.
--    Any row here must be resolved before merging.
SELECT 'left_behind_rows' AS check_name, id, member_id, position,
       regional_church_id, created_at
  FROM member_positions
 WHERE scope_type = 'regional_church'
   AND position NOT IN ('regional_pastor','regional_secretary','regional_treasurer')
 ORDER BY id;

-- 4. States that would end up with more than one holder of a single-holder
--    seat. 0040 keeps every row but marks the extras slot_unique = 0 and logs
--    conflict = 1 in region_position_migration (no UI reads that log).
SELECT 'slot_conflicts' AS check_name, rc.region_id, mp.position, COUNT(*) AS n,
       GROUP_CONCAT(mp.id) AS assignment_ids
  FROM member_positions mp
  JOIN regional_churches rc ON rc.id = mp.regional_church_id
 WHERE mp.scope_type = 'regional_church'
   AND mp.position IN ('regional_secretary','regional_treasurer')
 GROUP BY rc.region_id, mp.position
HAVING COUNT(*) > 1
 ORDER BY rc.region_id, mp.position;

-- 5. Members who pastor several clusters: 0027 creates one pastor row, so this
--    is informational only.
SELECT 'member_multi_cluster' AS check_name, cp.member_id, COUNT(*) AS clusters
  FROM cluster_pastor_assignments cp
 GROUP BY cp.member_id
HAVING COUNT(*) > 1
 ORDER BY cp.member_id;

-- 6. Members who are both a cluster pastor and a regional pastor: 0040 reuses
--    the pastor row created by 0027 instead of duplicating it.
SELECT 'member_pastor_both_roles' AS check_name, COUNT(DISTINCT mp.member_id) AS n
  FROM member_positions mp
 WHERE mp.scope_type = 'regional_church'
   AND mp.position = 'regional_pastor'
   AND mp.member_id IN (SELECT member_id FROM cluster_pastor_assignments);

-- 7. Orphans that would make the rebuild/move unsafe (all should be 0).
SELECT 'orphans' AS check_name,
       (SELECT COUNT(*) FROM member_positions mp
          LEFT JOIN members m ON m.id = mp.member_id
         WHERE mp.member_id IS NOT NULL AND m.id IS NULL)              AS positions_without_member,
       (SELECT COUNT(*) FROM member_positions mp
          LEFT JOIN regional_churches rc ON rc.id = mp.regional_church_id
         WHERE mp.regional_church_id IS NOT NULL AND rc.id IS NULL)    AS positions_without_church,
       (SELECT COUNT(*) FROM cluster_pastor_assignments cp
          LEFT JOIN members m ON m.id = cp.member_id
         WHERE m.id IS NULL)                                           AS cluster_pastor_without_member,
       (SELECT COUNT(*) FROM regional_churches rc
         WHERE NOT EXISTS (SELECT 1 FROM regions r WHERE r.id = rc.region_id))
                                                                       AS churches_without_region;

-- 8. Duplicate positions per member+scope, which would make the new unique
--    indexes in 0031/0039 fail (0019 already prevented these; expect no rows).
SELECT 'duplicate_member_scope' AS check_name, member_id, scope_type, COUNT(*) AS n
  FROM member_positions
 WHERE member_id IS NOT NULL
 GROUP BY member_id, scope_type
HAVING COUNT(*) > 1
 ORDER BY member_id;

-- 9. Duplicate department names, which would break the 0037 unique index
--    (name was globally unique before, so expect no rows).
SELECT 'duplicate_departments' AS check_name, name, COUNT(*) AS n
  FROM church_departments
 GROUP BY name
HAVING COUNT(*) > 1;

-- 10. 0028 lookups: exactly one main church per region is allowed, and the
--     migration only recognises this exact name in Yangon.
SELECT 'main_church_candidates' AS check_name, id, name, region_id
  FROM regional_churches
 WHERE name = 'Yangon Church (Main)';

-- 11. 0028 attaches every church-wide position to the single main church.
--     Informational: shows what those rows will point at.
SELECT 'church_wide_positions' AS check_name, scope_type, position, COUNT(*) AS n,
       COUNT(regional_church_id) AS already_scoped
  FROM member_positions
 WHERE scope_type = 'church'
 GROUP BY position;

-- 12. 0033/0035/0042 insert permissions with hardcoded role ids 1-4.
SELECT 'system_roles' AS check_name, id, name
  FROM roles
 WHERE id BETWEEN 1 AND 4
 ORDER BY id;

-- 13. Region-scope positions that 0040 deletes from the catalogue.
SELECT 'position_defs_to_delete' AS check_name, id, scope_type, code, name_english
  FROM position_defs
 WHERE scope_type = 'regional_church'
 ORDER BY id;
