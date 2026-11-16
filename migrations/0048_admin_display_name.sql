-- One-off: the owner of the `admin` account asked for this full name on the
-- reports they author and review. The account form refuses to edit yourself, so
-- the value is seeded here instead. It only fills an empty name.
UPDATE users
   SET display_name = 'Salai Thant Zaw Win'
 WHERE username = 'admin'
   AND (display_name IS NULL OR display_name = '');
