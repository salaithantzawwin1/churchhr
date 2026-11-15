-- Education on the member record: one row per school year, so last year's
-- class and school stay readable after the child moves up a grade.
-- Pastors' children keep using pastor_children (it already carries the same
-- school/grade/year facts); the Hope School report reads both.
CREATE TABLE student_enrolments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  academic_year TEXT NOT NULL,
  grade TEXT,
  -- 'hope' = the church's own school, 'other' = any outside school.
  school_kind TEXT NOT NULL DEFAULT 'hope',
  school_name TEXT,
  -- active | graduated | left
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX student_enrolments_member_idx ON student_enrolments(member_id);
CREATE INDEX student_enrolments_year_idx ON student_enrolments(academic_year);
