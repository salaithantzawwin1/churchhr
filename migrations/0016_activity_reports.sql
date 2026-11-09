-- Daily activity reports: one row per user per day.
--
-- Users write a short report about what they did (visits, meetings, follow-ups)
-- and leaders with reports.review can read the reports inside their state scope.
-- The unique index keeps one report per author per day; the reviewer columns
-- are already in place for the review flow that comes next.

CREATE TABLE activity_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id),
  region_id INTEGER NOT NULL REFERENCES regions(id),
  township TEXT,
  home_cell_id INTEGER REFERENCES lookup_options(id),
  group_id INTEGER REFERENCES lookup_options(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  attendance INTEGER,
  new_contacts INTEGER,
  follow_ups INTEGER,
  challenges TEXT,
  prayer_requests TEXT,
  next_steps TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  reviewer_id INTEGER REFERENCES users(id),
  review_note TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX activity_reports_author_date_uq ON activity_reports(author_id, report_date);
CREATE INDEX activity_reports_region_date_idx ON activity_reports(region_id, report_date);
CREATE INDEX activity_reports_status_idx ON activity_reports(status);

-- Same grants as the member permissions: admins and state managers can review
-- their states' reports, data entry can write their own, viewers can read.
INSERT OR IGNORE INTO role_permissions (role_id, permission) VALUES
  (1, 'reports.view'), (1, 'reports.create'), (1, 'reports.review'),
  (2, 'reports.view'), (2, 'reports.create'), (2, 'reports.review'),
  (3, 'reports.view'), (3, 'reports.create'),
  (4, 'reports.view');
