-- Members belong to one church department at a time; leadership positions
-- remain in member_positions so a department can have leaders from anywhere.
ALTER TABLE members ADD COLUMN department_id INTEGER REFERENCES church_departments(id);
CREATE INDEX members_department_idx ON members(department_id);
