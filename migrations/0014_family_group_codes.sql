-- Township short codes + Family Groups numbered per Township (INS_FG001, INS_FG002…).
--
-- A township's short_code is the prefix used for its Family Group codes. The
-- admin can change it on Options → Township (e.g. Insein -> INS). Family Groups
-- hang under a Home Cell (parent_id), so the township is found by walking one
-- more level up the parent chain.
--
-- Existing FMG-xxx codes are renumbered to the per-township scheme; groups with
-- no township keep the old FMG-NNN numbering (handled by townshipBase() too).

ALTER TABLE lookup_options ADD COLUMN short_code TEXT;

-- Backfill township short codes from the existing TWP-001 code (TWP001) so
-- every township starts with a stable prefix; admins can edit it to INS etc.
UPDATE lookup_options
SET short_code = REPLACE(code, '-', '')
WHERE type = 'township' AND code IS NOT NULL AND (short_code IS NULL OR short_code = '');

-- Renumber family groups per township: Family Group -> Home Cell -> Township.
UPDATE lookup_options
SET code = (
  SELECT x.base || '_FG' || printf('%03d', x.rn)
  FROM (
    SELECT fg.id AS fid,
           COALESCE(NULLIF(t.short_code, ''), 'FG') AS base,
           ROW_NUMBER() OVER (PARTITION BY COALESCE(t.id, 0) ORDER BY fg.id) AS rn
    FROM lookup_options fg
    LEFT JOIN lookup_options hc ON hc.id = fg.parent_id AND hc.type = 'home_cell'
    LEFT JOIN lookup_options t ON t.id = hc.parent_id AND t.type = 'township'
    WHERE fg.type = 'family_group'
  ) x
  WHERE x.fid = lookup_options.id
)
WHERE type = 'family_group';

-- Two townships in the same state may not share a short code, otherwise their
-- Family Group code sequences would collide.
CREATE UNIQUE INDEX lookup_options_short_code_uq
  ON lookup_options(type, region_id, short_code) WHERE short_code IS NOT NULL;
