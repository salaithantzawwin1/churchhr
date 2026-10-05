-- Default RBAC: 4 system roles + seeded super admin (admin / admin123, must change on first login)
INSERT INTO roles (id, name, description, is_system) VALUES
  (1, 'Super Admin',    'အခွင့်အရာအားလုံး — တိုင်း/ပြည်နယ် အားလုံး', 1),
  (2, 'State Manager',  'သတ်မှတ်ထားသော တိုင်း/ပြည်နယ်များ အားလုံး စီမံခန့်ခွဲခွင့်', 1),
  (3, 'Data Entry',     'သတ်မှတ်ထားသော တိုင်း/ပြည်နယ်များတွင် member ဖြည့်/ပြင်ခွင့်', 1),
  (4, 'Viewer',         'သတ်မှတ်ထားသော တိုင်း/ပြည်နယ်များကို ဖတ်ရုံသာ', 1);

INSERT INTO role_permissions (role_id, permission) VALUES
  (1, 'dashboard.view'), (1, 'members.view'), (1, 'members.create'), (1, 'members.update'),
  (1, 'members.delete'), (1, 'members.export'), (1, 'members.import'),
  (1, 'users.manage'), (1, 'roles.manage'), (1, 'options.manage'),
  (2, 'dashboard.view'), (2, 'members.view'), (2, 'members.create'), (2, 'members.update'),
  (2, 'members.delete'), (2, 'members.export'), (2, 'members.import'),
  (3, 'dashboard.view'), (3, 'members.view'), (3, 'members.create'), (3, 'members.update'),
  (4, 'dashboard.view'), (4, 'members.view');

INSERT INTO users (id, username, password_hash, active, must_change_password)
  VALUES (1, 'admin', 'pbkdf2-sha256$10000$KTpLXG1+j6CxwtPk9QYXKA==$ClTWyHnm3N5x+wB5BYuGflsOJETXICNCSxq7H5K9ik8=', 1, 1);
INSERT INTO user_roles (user_id, role_id) VALUES (1, 1);
-- wildcard row: all states
INSERT INTO user_state_assignments (user_id, region_id) VALUES (1, 0);
