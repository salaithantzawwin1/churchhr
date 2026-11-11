-- Organization structure, phase 2:
--   * position_defs  -> editable position catalogue per scope
--   * regional_churches -> optional church-unit layer above Home Cells
--   * member_positions can point at a regional church
--   * Home Cell supervision uses the existing township lookup option as its
--     scope (one supervisor team per township/cluster).
--
-- Existing position codes are seeded unchanged so current member_positions
-- rows keep working after the migration.

CREATE TABLE position_defs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope_type TEXT NOT NULL,
  code TEXT NOT NULL,
  name_myanmar TEXT NOT NULL,
  name_english TEXT,
  name_korean TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX position_defs_scope_code_uq ON position_defs(scope_type, code);
CREATE INDEX position_defs_scope_idx ON position_defs(scope_type, active, sort_order);

INSERT INTO position_defs (scope_type, code, name_myanmar, name_english, name_korean, sort_order) VALUES
  ('church', 'church_senior_pastor', 'သင်းအုပ်ဆရာ', 'Senior Pastor', '담임 목사', 10),
  ('church', 'church_assistant_pastor', 'ဒုတိယသင်းအုပ်ဆရာ', 'Assistant Pastor', '부목사', 20),
  ('church', 'church_secretary', 'အသင်းအတွင်းရေးမှူး', 'Church Secretary', '교회 서기', 30),
  ('church', 'church_treasurer', 'အသင်းဘဏ္ဍာရေးမှူး', 'Church Treasurer', '교회 회계', 40),
  ('home_cell', 'home_cell_leader', 'အိမ်အသင်းခေါင်းဆောင်', 'Home Cell Leader', '홈셀 리더', 10),
  ('home_cell', 'home_cell_assistant', 'ဒုတိယခေါင်းဆောင်', 'Second Leader', '부리더', 20),
  ('home_cell', 'home_cell_secretary', 'အတွင်းရေးမှူး', 'Secretary', '서기', 30),
  ('home_cell', 'home_cell_treasurer', 'ဘဏ္ဍာရေးမှူး', 'Treasurer', '회계', 40),
  ('township', 'home_cell_supervisor', 'Home Cell ကြီးကြပ်မှူး', 'Supervisor', '홈셀 감독', 10),
  ('township', 'home_cell_assistant_supervisor', 'ဒုတိယ ကြီးကြပ်မှူး', 'Second Supervisor', '부감독', 20),
  ('regional_church', 'regional_pastor', 'ဒေသ အသင်းအုပ်ဆရာ', 'Regional Pastor', '지역 목사', 10),
  ('regional_church', 'regional_secretary', 'ဒေသ အတွင်းရေးမှူး', 'Regional Secretary', '지역 서기', 20),
  ('regional_church', 'regional_treasurer', 'ဒေသ ဘဏ္ဍာရေးမှူး', 'Regional Treasurer', '지역 회계', 30),
  ('department', 'department_head', 'ဌာနမှူး', 'Department Head', '부서장', 10),
  ('department', 'department_assistant', 'ဒုတိယဌာနမှူး', 'Assistant Department Head', '부서 부장', 20),
  ('department', 'department_secretary', 'ဌာန အတွင်းရေးမှူး', 'Department Secretary', '부서 서기', 30),
  ('department', 'department_treasurer', 'ဌာန ဘဏ္ဍာရေးမှူး', 'Department Treasurer', '부서 회계', 40);

CREATE TABLE regional_churches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_en TEXT,
  region_id INTEGER NOT NULL REFERENCES regions(id),
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX regional_churches_name_uq ON regional_churches(name);
CREATE INDEX regional_churches_region_idx ON regional_churches(region_id, active, sort_order);

-- Home Cells can belong to one Regional Church. NULL means unassigned, so
-- existing Home Cells are safe and can be attached gradually.
ALTER TABLE lookup_options ADD COLUMN regional_church_id INTEGER REFERENCES regional_churches(id);
CREATE INDEX lookup_options_regional_church_idx ON lookup_options(regional_church_id);

-- Regional leadership is stored separately from scope_id because scope_id has
-- an existing foreign key to lookup_options. Home Cell supervision continues to
-- use scope_id (the township) so it needs no extra column.
ALTER TABLE member_positions ADD COLUMN regional_church_id INTEGER REFERENCES regional_churches(id);
CREATE INDEX member_positions_regional_church_idx ON member_positions(regional_church_id);
CREATE UNIQUE INDEX member_positions_regional_slot_uq
  ON member_positions(scope_type, regional_church_id, position)
  WHERE regional_church_id IS NOT NULL;
