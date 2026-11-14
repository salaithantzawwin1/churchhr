-- 0042: granular report editing/deleting and organisation-structure permissions.
-- Existing system roles keep the rights their options.manage bundle already
-- implied; custom roles can now be granted exactly one of them (e.g. Home Cell
-- create + update, no delete).
INSERT OR IGNORE INTO role_permissions (role_id, permission) VALUES
  (1, 'reports.update'), (1, 'reports.delete'),
  (1, 'structures.view'), (1, 'structures.create'), (1, 'structures.update'), (1, 'structures.delete'),
  (2, 'reports.update'),
  (2, 'structures.view'), (2, 'structures.create'), (2, 'structures.update'), (2, 'structures.delete'),
  (3, 'reports.update'), (3, 'structures.view'),
  (4, 'structures.view');
