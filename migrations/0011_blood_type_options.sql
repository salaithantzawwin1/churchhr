-- Blood Type as a managed dropdown: members.blood_type keeps storing the
-- LABEL (same text convention as township), so no member rows change. The
-- option rows give the label list a stable short code (BLD-001…) and make it
-- editable on the Options page like any other list.
--
-- lookup_options UNIQUE is (type, label, region_id); seeded rows use region 0
-- (all states) and active=0: the std eight types stay on the member form via
-- the enum fallback, while anything the church adds (e.g. "သွေးအရင်းမတစိ") is
-- managed here.  Activation/deactivation happens on the Options page.
INSERT INTO lookup_options (type, label, region_id, parent_id, active, sort_order, code)
  SELECT 'blood_type', 'A+', 0, NULL, 0, 10, 'BLD-001' WHERE
    NOT EXISTS (SELECT 1 FROM lookup_options WHERE type = 'blood_type' AND label = 'A+');
INSERT INTO lookup_options (type, label, region_id, parent_id, active, sort_order, code)
  SELECT 'blood_type', 'A-', 0, NULL, 0, 20, 'BLD-002' WHERE
    NOT EXISTS (SELECT 1 FROM lookup_options WHERE type = 'blood_type' AND label = 'A-');
INSERT INTO lookup_options (type, label, region_id, parent_id, active, sort_order, code)
  SELECT 'blood_type', 'AB+', 0, NULL, 0, 30, 'BLD-003' WHERE
    NOT EXISTS (SELECT 1 FROM lookup_options WHERE type = 'blood_type' AND label = 'AB+');
INSERT INTO lookup_options (type, label, region_id, parent_id, active, sort_order, code)
  SELECT 'blood_type', 'AB-', 0, NULL, 0, 40, 'BLD-004' WHERE
    NOT EXISTS (SELECT 1 FROM lookup_options WHERE type = 'blood_type' AND label = 'AB-');
INSERT INTO lookup_options (type, label, region_id, parent_id, active, sort_order, code)
  SELECT 'blood_type', 'B+', 0, NULL, 0, 50, 'BLD-005' WHERE
    NOT EXISTS (SELECT 1 FROM lookup_options WHERE type = 'blood_type' AND label = 'B+');
INSERT INTO lookup_options (type, label, region_id, parent_id, active, sort_order, code)
  SELECT 'blood_type', 'B-', 0, NULL, 0, 60, 'BLD-006' WHERE
    NOT EXISTS (SELECT 1 FROM lookup_options WHERE type = 'blood_type' AND label = 'B-');
INSERT INTO lookup_options (type, label, region_id, parent_id, active, sort_order, code)
  SELECT 'blood_type', 'O+', 0, NULL, 0, 70, 'BLD-007' WHERE
    NOT EXISTS (SELECT 1 FROM lookup_options WHERE type = 'blood_type' AND label = 'O+');
INSERT INTO lookup_options (type, label, region_id, parent_id, active, sort_order, code)
  SELECT 'blood_type', 'O-', 0, NULL, 0, 80, 'BLD-008' WHERE
    NOT EXISTS (SELECT 1 FROM lookup_options WHERE type = 'blood_type' AND label = 'O-');
