-- Age-group categories used by the dashboard breakdown cards.
-- Ranges are admin-adjustable on /admin/options (type=age_group).
CREATE TABLE age_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  min_age INTEGER NOT NULL,
  max_age INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO age_groups (name, min_age, max_age, sort_order) VALUES
  ('Adult', 31, 120, 1),
  ('Youth', 17, 30, 2),
  ('12-16', 12, 16, 3),
  ('Sunday School', 5, 11, 4);
