-- View tracking and rating for daily reflections (VRE-270 + VRE-271)
CREATE TABLE IF NOT EXISTS entry_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES entries(id),
  viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
  view_type TEXT NOT NULL DEFAULT 'daily',
  rating INTEGER
);

CREATE INDEX idx_entry_views_entry ON entry_views(entry_id);
CREATE INDEX idx_entry_views_date ON entry_views(viewed_at);
