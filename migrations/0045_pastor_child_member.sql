-- A pastor's child may already be a member (relationship = son/daughter). Link
-- the two rows so the Hope School report can count that child once, using the
-- member's yearly education rows and this row only as the fallback.
ALTER TABLE pastor_children ADD COLUMN member_id INTEGER REFERENCES members(id);
CREATE INDEX pastor_children_member_idx ON pastor_children(member_id);
