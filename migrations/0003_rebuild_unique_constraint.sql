-- Rebuild entries table to replace the old UNIQUE(book, entry) constraint
-- with a new UNIQUE(source, book, entry) constraint.
-- SQLite cannot drop inline UNIQUE constraints, so we rebuild the table.

CREATE TABLE entries_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL DEFAULT 'meditations',
  book INTEGER NOT NULL,
  entry TEXT NOT NULL,
  text TEXT NOT NULL,
  UNIQUE(source, book, entry)
);

INSERT INTO entries_new (id, source, book, entry, text)
  SELECT id, source, book, entry, text FROM entries;

DROP TABLE entries;

ALTER TABLE entries_new RENAME TO entries;
