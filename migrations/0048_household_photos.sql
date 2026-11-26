-- Household family photo: 500×500 WebP (quality 85), generated in the browser
-- like members.photo (0015), so no photo_type column is needed.
ALTER TABLE families ADD COLUMN photo BLOB;
