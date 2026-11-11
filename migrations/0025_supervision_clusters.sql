-- Home Cell supervision clusters:
--   * a cluster belongs to one State/Region and can contain Home Cells from
--     several townships (for example four cells split across two townships);
--   * a Home Cell belongs to at most one cluster, while cells without one keep
--     using their township as the supervision area;
--   * cluster leadership is stored in member_positions with scope_type='cluster'
--     so it stays separate from Home Cell Leader and township supervision rows.
CREATE TABLE supervision_clusters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_en TEXT,
  region_id INTEGER NOT NULL REFERENCES regions(id),
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX supervision_clusters_name_region_uq ON supervision_clusters(name, region_id);
CREATE INDEX supervision_clusters_region_idx ON supervision_clusters(region_id, active, sort_order);

ALTER TABLE lookup_options ADD COLUMN supervision_cluster_id INTEGER REFERENCES supervision_clusters(id);
CREATE INDEX lookup_options_supervision_cluster_idx ON lookup_options(supervision_cluster_id);

ALTER TABLE member_positions ADD COLUMN supervision_cluster_id INTEGER REFERENCES supervision_clusters(id);
CREATE INDEX member_positions_supervision_cluster_idx ON member_positions(supervision_cluster_id);
CREATE UNIQUE INDEX member_positions_cluster_slot_uq
  ON member_positions(scope_type, supervision_cluster_id, position)
  WHERE supervision_cluster_id IS NOT NULL;

INSERT INTO position_defs (scope_type, code, name_myanmar, name_english, name_korean, sort_order) VALUES
  ('cluster', 'cluster_supervisor', 'ကြီးကြပ်မှူး', 'Supervisor', '감독', 10),
  ('cluster', 'cluster_assistant_supervisor', 'ဒုတိယ ကြီးကြပ်မှူး', 'Assistant Supervisor', '부감독', 20);
