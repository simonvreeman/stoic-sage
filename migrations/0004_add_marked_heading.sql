-- Add marked and heading columns for qualitative data support.
-- marked: tracks notable/highlighted passages from source HTML (<mark> tags).
-- heading: stores Book 1 person/topic names from Meditations (e.g., "Rusticus").
ALTER TABLE entries ADD COLUMN marked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE entries ADD COLUMN heading TEXT;
