-- Short codes for lookup options + State/Region: e.g. TWP-001, CEL-014, FMG-003,
-- REG-001. Codes give members export / filtering a stable identifier that
-- survives label edits ("အင်းစိန်မြို့နယ်" vs "Insein Township").
--
-- NULL is allowed: legacy rows and non-scoped types (ethnicity, education,
-- fellowship_category, blood_type) stay without code until edited. Codes are
-- unique per (type, region_id) so a township in two states can share "001";
-- all-states options share one numbering space per type.
-- Format per type prefix: township TWP, home_cell CEL, group GRP,
-- family_group FMG; regions REG. Numbering is grouped by prefix only
-- (not per state) so an option's code can be quoted without knowing its state.
ALTER TABLE lookup_options ADD COLUMN code TEXT;
ALTER TABLE regions ADD COLUMN code TEXT;

CREATE UNIQUE INDEX lookup_options_code_uq
  ON lookup_options(type, region_id, code) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX regions_code_uq ON regions(code) WHERE code IS NOT NULL;

-- Backfill: seed every region-scoped type + region with a code so numbering
-- starts consistent (TWP-001…) rather than jumping in later.
UPDATE lookup_options SET
  code = 'TWP-' || printf('%03d',
    (SELECT COUNT(*) FROM lookup_options p WHERE p.type = 'township' AND p.id <= lookup_options.id))
WHERE type = 'township' AND code IS NULL;

UPDATE lookup_options SET
  code = 'CEL-' || printf('%03d',
    (SELECT COUNT(*) FROM lookup_options p WHERE p.type = 'home_cell' AND p.id <= lookup_options.id))
WHERE type = 'home_cell' AND code IS NULL;

UPDATE lookup_options SET
  code = 'GRP-' || printf('%03d',
    (SELECT COUNT(*) FROM lookup_options p WHERE p.type = 'group' AND p.id <= lookup_options.id))
WHERE type = 'group' AND code IS NULL;

UPDATE lookup_options SET
  code = 'FMG-' || printf('%03d',
    (SELECT COUNT(*) FROM lookup_options p WHERE p.type = 'family_group' AND p.id <= lookup_options.id))
WHERE type = 'family_group' AND code IS NULL;

UPDATE regions SET
  code = 'REG-' || printf('%03d',
    (SELECT COUNT(*) FROM regions p WHERE p.id <= regions.id))
WHERE code IS NULL;
