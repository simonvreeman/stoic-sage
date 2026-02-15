/**
 * Weighted random selection utility for Daily Reflections.
 *
 * Applies a four-layer weighting stack to bias entry selection:
 *   final_weight = base_weight × marked_boost × source_weight × rating_multiplier
 *
 * Layer 0: Base weight — spaced repetition (never-seen 10x, recharges over 30 days)
 * Layer 1: Marked boost — curated <mark> passages get 1.3x (VRE-284)
 * Layer 2: Source weight — Meditations 1.0, Seneca/Discourses/Enchiridion 0.85, Fragments 0.75
 * Layer 3: Rating multiplier — 0.7x to 1.3x based on avg of last 3 ratings (VRE-271)
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
  view_count?: number; // from LEFT JOIN COUNT
  last_seen?: string | null; // ISO datetime from MAX(viewed_at)
  avg_rating?: number | null; // avg of last 3 ratings
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
    "seneca-tranquillity": 0.85,
    "seneca-shortness": 0.85,
    discourses: 0.85,
    enchiridion: 0.85,
    fragments: 0.75,
  } as Record<string, number>,

  /** Base weight for entries never seen before. */
  NEVER_SEEN_WEIGHT: 10.0,

  /** Days until a seen entry fully "recharges" to base weight 5.0. */
  RECHARGE_DAYS: 30,

  /** Rating-to-multiplier mapping (avg of last 3 ratings). */
  RATING_MULTIPLIERS: { 1: 0.7, 2: 1.0, 3: 1.3 } as Record<number, number>,
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
 * Four-layer multiplicative stack:
 *   0. Base weight (spaced repetition — never-seen vs. time-since-last-seen)
 *   1. Marked boost (1.3x for marked entries)
 *   2. Source weight (Meditations > Discourses/Enchiridion > Fragments)
 *   3. Rating multiplier (0.7x–1.3x based on avg of last 3 ratings)
 */
export function calculateEntryWeight(entry: EntryStub): number {
  // Layer 0: Spaced repetition base weight
  let baseWeight: number;
  if (!entry.view_count || entry.view_count === 0) {
    baseWeight = REFLECTION_WEIGHTS.NEVER_SEEN_WEIGHT;
  } else {
    const daysSince = entry.last_seen
      ? (Date.now() - new Date(entry.last_seen).getTime()) / 86_400_000
      : REFLECTION_WEIGHTS.RECHARGE_DAYS;
    const recharged = Math.min(
      daysSince / REFLECTION_WEIGHTS.RECHARGE_DAYS,
      5.0,
    );
    baseWeight = recharged / Math.log2(entry.view_count + 1);
  }

  // Layer 1: Marked boost
  const markedBoost =
    entry.marked === 1 ? REFLECTION_WEIGHTS.MARKED_BOOST : 1.0;

  // Layer 2: Source weight
  const sourceWeight =
    REFLECTION_WEIGHTS.SOURCE_WEIGHTS[entry.source] || 1.0;

  // Layer 3: Rating multiplier (avg of last 3 ratings → nearest integer → lookup)
  let ratingMultiplier = 1.0;
  if (entry.avg_rating != null) {
    const rounded = Math.round(entry.avg_rating) as 1 | 2 | 3;
    ratingMultiplier =
      REFLECTION_WEIGHTS.RATING_MULTIPLIERS[rounded] || 1.0;
  }

  return baseWeight * markedBoost * sourceWeight * ratingMultiplier;
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
