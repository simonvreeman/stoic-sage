/**
 * Weighted random selection utility for Daily Reflections.
 *
 * Applies a three-layer weighting stack to bias entry selection:
 *   final_weight = marked_boost × source_weight × rating_multiplier
 *
 * Layer 1: Marked boost — curated <mark> passages get 1.3x (VRE-284)
 * Layer 2: Source weight — Meditations 1.0, Discourses/Enchiridion 0.85, Fragments 0.75
 * Layer 3: Rating multiplier — 1.0x placeholder (VRE-271 future)
 *
 * Used by /api/daily (seeded PRNG for deterministic daily entry)
 * and /api/random (Math.random for true randomness).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EntryStub {
  id: number;
  source: string;
  marked: number; // 0 or 1
}

interface WeightedEntry extends EntryStub {
  weight: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const REFLECTION_WEIGHTS = {
  /** Multiplier for entries with marked = 1 (editorial quality signal). */
  MARKED_BOOST: 1.3,

  /** Source priority weights — same values used in search. */
  SOURCE_WEIGHTS: {
    meditations: 1.0,
    discourses: 0.85,
    enchiridion: 0.85,
    fragments: 0.75,
  } as Record<string, number>,
};

// ---------------------------------------------------------------------------
// Seeded PRNG — Mulberry32
// ---------------------------------------------------------------------------

/**
 * Mulberry32 seeded PRNG.
 * Returns a function that produces deterministic floats in [0, 1).
 * Same seed always produces the same sequence.
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Weight calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the selection weight for a single entry.
 *
 * Currently applies two active layers:
 *   1. Marked boost (1.3x for marked entries)
 *   2. Source weight (Meditations > Discourses/Enchiridion > Fragments)
 *
 * Future layers (VRE-270 spaced repetition, VRE-271 ratings) will add
 * additional multiplicative factors here.
 */
export function calculateEntryWeight(entry: EntryStub): number {
  const markedBoost =
    entry.marked === 1 ? REFLECTION_WEIGHTS.MARKED_BOOST : 1.0;
  const sourceWeight =
    REFLECTION_WEIGHTS.SOURCE_WEIGHTS[entry.source] || 1.0;

  // Layer 3 placeholder — VRE-271 will replace with actual rating multiplier
  const ratingMultiplier = 1.0;

  return markedBoost * sourceWeight * ratingMultiplier;
}

// ---------------------------------------------------------------------------
// Weighted random selection — reservoir sampling
// ---------------------------------------------------------------------------

/**
 * Select one entry using weighted reservoir sampling.
 * O(n) time, O(1) space, single pass.
 *
 * @param entries - Array of entries with pre-calculated weights.
 * @param rng    - Random number generator returning floats in [0, 1).
 */
function weightedRandomSelection(
  entries: WeightedEntry[],
  rng: () => number,
): WeightedEntry {
  let totalWeight = 0;
  let selected = entries[0];

  for (const entry of entries) {
    totalWeight += entry.weight;
    if (rng() * totalWeight < entry.weight) {
      selected = entry;
    }
  }

  return selected;
}

// ---------------------------------------------------------------------------
// High-level selection helpers
// ---------------------------------------------------------------------------

/**
 * Select a daily entry using date-seeded weighted random selection.
 * Same seed (date) always returns the same entry.
 *
 * @returns The selected entry's `id`.
 */
export function selectDailyEntry(
  entries: EntryStub[],
  dateSeed: number,
): number {
  const rng = mulberry32(dateSeed);
  const weighted: WeightedEntry[] = entries.map((e) => ({
    ...e,
    weight: calculateEntryWeight(e),
  }));
  return weightedRandomSelection(weighted, rng).id;
}

/**
 * Select a random entry using weighted random selection.
 * Uses Math.random — different result each call.
 *
 * @returns The selected entry's `id`.
 */
export function selectRandomEntry(entries: EntryStub[]): number {
  const weighted: WeightedEntry[] = entries.map((e) => ({
    ...e,
    weight: calculateEntryWeight(e),
  }));
  return weightedRandomSelection(weighted, Math.random).id;
}
