-- 0043: pastor ministry dates and the pastor's children.
-- salvation_date is the day the pastor was saved; ministry_start_date is when
-- ministry began (ordination_date stays the ordination itself). Tenure in the
-- UI is counted from ministry_start_date, falling back to ordination_date.
ALTER TABLE pastors ADD COLUMN salvation_date TEXT;
ALTER TABLE pastors ADD COLUMN ministry_start_date TEXT;

-- A pastor's children, kept for the church's Private Hope School count.
-- grade + academic_year are edited once a year; school is free text unless the
-- Hope School box is ticked. Age is never stored (computed from date_of_birth).
CREATE TABLE IF NOT EXISTS pastor_children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pastor_id INTEGER NOT NULL REFERENCES pastors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  gender TEXT NOT NULL DEFAULT '',
  date_of_birth TEXT,
  grade TEXT,
  academic_year TEXT,
  at_hope_school INTEGER NOT NULL DEFAULT 0,
  school TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS pastor_children_pastor_idx
  ON pastor_children (pastor_id, active, date_of_birth);
CREATE INDEX IF NOT EXISTS pastor_children_school_idx
  ON pastor_children (at_hope_school, active);
