-- Leadership assignments for the organization structure.
--
-- A position is deliberately separate from members.home_cell_id: the member's
-- home cell says where they belong, while this table says which service role
-- they hold in that cell. scope_type/scope_id leave room for church-level
-- positions later without another schema change.
CREATE TABLE member_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'home_cell',
  scope_id INTEGER REFERENCES lookup_options(id),
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX member_positions_member_idx ON member_positions(member_id);
CREATE INDEX member_positions_scope_idx ON member_positions(scope_type, scope_id);

-- One active home-cell position per member, and one person per leadership slot
-- (a cell cannot accidentally get two leaders). Partial index keeps future
-- church-wide rows (scope_id NULL) out of the slot constraint.
CREATE UNIQUE INDEX member_positions_member_scope_uq
  ON member_positions(member_id, scope_type);
CREATE UNIQUE INDEX member_positions_slot_uq
  ON member_positions(scope_type, scope_id, position)
  WHERE scope_id IS NOT NULL;
