-- One member record can back at most one pastor child: two children pointing at
-- the same person would hide a real child from the Hope School count.
CREATE UNIQUE INDEX pastor_children_member_unique
  ON pastor_children(member_id) WHERE member_id IS NOT NULL;
