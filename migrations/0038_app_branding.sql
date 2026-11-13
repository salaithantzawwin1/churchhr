-- Login branding: one optional church name and one optional photo shown in the
-- sign-in brand panel. A missing row/photo falls back to the bundled logo.
CREATE TABLE app_branding (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  church_name TEXT,
  photo BLOB,
  photo_type TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT OR IGNORE INTO app_branding (id, church_name, photo, photo_type, updated_at)
VALUES (1, NULL, NULL, NULL, unixepoch());
