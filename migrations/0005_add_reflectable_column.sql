-- Add reflectable column to filter daily/random reflection pool.
-- reflectable = 1 (default): entry eligible for daily/random selection.
-- reflectable = 0: entry excluded (too short, mid-argument, not standalone).
ALTER TABLE entries ADD COLUMN reflectable INTEGER NOT NULL DEFAULT 1;
