-- Ministry history for a pastor: where they served, in which post, and from
-- which year to which year. Years are stored rather than full dates because
-- appointment records are kept by year; end_year NULL means "still serving".
CREATE TABLE pastor_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pastor_id INTEGER NOT NULL REFERENCES pastors(id) ON DELETE CASCADE,
  start_year INTEGER NOT NULL,
  end_year INTEGER,
  region_id INTEGER REFERENCES regions(id),
  township TEXT,
  church_name TEXT,
  position TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX pastor_history_pastor_idx ON pastor_history(pastor_id, start_year DESC);
