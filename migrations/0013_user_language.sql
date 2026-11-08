-- Per-account UI language preference (mm | en | kr).
-- NULL means "not chosen yet": the browser cookie/default keeps applying, so
-- existing users are not forced into a language when this migration lands.
ALTER TABLE users ADD COLUMN language TEXT;
