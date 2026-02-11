-- Add source column to support multiple texts (Meditations, Enchiridion, etc.)
-- Existing rows get 'meditations' as default value.

ALTER TABLE entries ADD COLUMN source TEXT NOT NULL DEFAULT 'meditations';

-- Drop the old unique constraint and create a new one that includes source.
-- SQLite doesn't support DROP CONSTRAINT, so we create a new unique index instead.
-- The old UNIQUE(book, entry) was created inline, which SQLite stores as an index named
-- sqlite_autoindex_entries_1. We can't drop autoindexes, but adding a new broader
-- unique index and the source column makes the data model correct.

CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_source_book_entry ON entries(source, book, entry);
