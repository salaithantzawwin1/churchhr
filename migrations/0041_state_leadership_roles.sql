-- State/Region leadership mirrors the church leadership chart, and every
-- state-level role uses the same "State …" name.
--
-- The three seats that already existed keep their codes and their holders:
-- the state's leading pastor seat and the secretary/treasurer seats are simply
-- named for the level they serve. No second pastor or secretary seat is added,
-- so no state ends up with two seats meaning the same thing.
--
-- The missing seats (Assistant Pastor and the Women's Department team) use new
-- region_* codes so they never collide with the church slots. min_holders stays
-- 0 for those optional seats, so an unfilled department never turns into a
-- vacancy report entry, and sort_order keeps the chart order: leading pastor →
-- assistant pastor → secretary → treasurer → women's department.

UPDATE position_defs
SET name_myanmar = 'ဒေသ သင်းအုပ်ဆရာ', name_english = 'State Senior Pastor',
    name_korean = '지역 담임 목사', sort_order = 10
WHERE scope_type = 'region' AND code = 'regional_pastor';

UPDATE position_defs
SET name_english = 'State Secretary', name_korean = '지역 서기', sort_order = 20
WHERE scope_type = 'region' AND code = 'regional_secretary';

UPDATE position_defs
SET name_english = 'State Treasurer', name_korean = '지역 회계', sort_order = 30
WHERE scope_type = 'region' AND code = 'regional_treasurer';

INSERT OR IGNORE INTO position_defs (
  scope_type, code, name_myanmar, name_english, name_korean,
  active, sort_order, allow_multiple, min_holders
) VALUES
  ('region', 'regional_assistant_pastor', 'ဒေသ ဒုတိယသင်းအုပ်ဆရာ',
   'State Assistant Pastor', '지역 부목사', 1, 15, 1, 0),
  ('region', 'regional_women_leader', 'ဒေသ အမျိုးသမီးဌာန ခေါင်းဆောင်',
   'State Women''s Department Leader', '지역 여성부장', 1, 40, 0, 0),
  ('region', 'regional_women_secretary', 'ဒေသ အမျိုးသမီးဌာန အတွင်းရေးမှူး',
   'State Women''s Department Secretary', '지역 여성부 서기', 1, 50, 0, 0);
