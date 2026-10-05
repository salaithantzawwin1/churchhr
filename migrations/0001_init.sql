-- Church Member Registry — core schema (RBAC + members + lookup options)

CREATE TABLE regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);

CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  PRIMARY KEY (role_id, permission)
);

CREATE TABLE user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- region_id = 0 means "all states" (wildcard row) -> intentionally no FK here
CREATE TABLE user_state_assignments (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, region_id)
);

CREATE TABLE lookup_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (type, label)
);
CREATE INDEX lookup_options_type_idx ON lookup_options(type);

CREATE TABLE members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_code TEXT UNIQUE,
  name_english TEXT,
  name_myanmar TEXT,
  gender TEXT NOT NULL DEFAULT '',
  marital_status TEXT NOT NULL DEFAULT '',
  date_of_birth TEXT,
  blood_type TEXT NOT NULL DEFAULT '',
  phone TEXT,
  nrc_number TEXT,
  ethnicity_id INTEGER REFERENCES lookup_options(id),
  languages TEXT,
  education_id INTEGER REFERENCES lookup_options(id),
  job TEXT,
  work_skills TEXT,
  income INTEGER,
  address TEXT,
  father_name TEXT,
  mother_name TEXT,
  salvation_date TEXT,
  family_group_id INTEGER REFERENCES lookup_options(id),
  fellowship_category_id INTEGER REFERENCES lookup_options(id),
  group_id INTEGER REFERENCES lookup_options(id),
  home_cell_id INTEGER REFERENCES lookup_options(id),
  region_id INTEGER NOT NULL REFERENCES regions(id),
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX members_region_idx ON members(region_id);
CREATE INDEX members_status_idx ON members(status);
CREATE INDEX members_group_idx ON members(group_id);
CREATE INDEX members_home_cell_idx ON members(home_cell_id);
