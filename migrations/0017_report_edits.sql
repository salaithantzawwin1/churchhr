-- Edit history for daily activity reports. Each row is one successful save by
-- the author, with a JSON array of { field, from, to } changes. Reviewers read
-- it on the report detail page to see what changed before they approve it.

CREATE TABLE report_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES activity_reports(id),
  editor_id INTEGER NOT NULL REFERENCES users(id),
  edited_at INTEGER NOT NULL DEFAULT (unixepoch()),
  changes TEXT NOT NULL
);

CREATE INDEX report_edits_report_idx ON report_edits(report_id, edited_at);
