/**
 * Set the `reflectable` column on entries in D1.
 *
 * Marks entries as non-reflectable (reflectable = 0) if they don't work
 * as standalone daily reflections. Two exclusion tiers:
 *
 *   1. Auto-exclude: entries under 10 words (unless whitelisted)
 *   2. Manual exclude: mid-argument Discourses continuations (10-19 words)
 *
 * The script is idempotent — it resets all entries to reflectable = 1 first,
 * then applies exclusions.
 *
 * Usage:
 *   npx tsx scripts/set-reflectable.ts [--local]
 *
 * Pass --local to update the local development database instead of remote.
 */

import { writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMP_SQL = resolve(__dirname, "../.reflectable-temp.sql");
const DB_NAME = "stoic-sage-db";

const isLocal = process.argv.includes("--local");
const remoteFlag = isLocal ? "--local" : "--remote";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Entries under this word count are excluded unless whitelisted. */
const SHORT_THRESHOLD = 10;

/**
 * Short entries (under 10 words) that ARE good standalone reflections.
 * These powerful aphorisms are kept reflectable despite their brevity.
 * Key format: "source-book-entry"
 */
const SHORT_BUT_REFLECTABLE = new Set([
  "meditations-4-2",   // "No random actions, none not based on underlying principles."
  "meditations-6-6",   // "The best revenge is not to be like that."
  "meditations-6-54",  // "What injures the hive injures the bee."
  "meditations-7-17",  // "Well-being is good luck, or good character."
  "meditations-7-21",  // "Close to forgetting it all, close to being forgotten."
  "meditations-7-36",  // "Kingship: to earn a bad reputation by good deeds."
  "meditations-8-22",  // "Stick to what's in front of you—idea, action, utterance."
  "meditations-8-61",  // "To enter others' minds and let them enter yours."
  "meditations-9-5",   // "And you can also commit injustice by doing nothing."
  "meditations-9-20",  // "Leave other people's mistakes where they lie."
]);

/**
 * Entries with 10+ words that are still non-reflectable.
 * These are mid-argument dialogue continuations from the Discourses
 * that require surrounding context to make sense.
 */
const MANUAL_EXCLUSIONS = new Set([
  "discourses-1-3.9",   // "See that you don't turn out like one of those unfortunates."
  "discourses-1-7.9",   // "'To accept the consequence of what has been admitted...'"
  "discourses-1-8.4",   // "'So why aren't we training ourselves...'"
  "discourses-1-8.11",  // "'But wasn't Plato a philosopher?' ..."
  "discourses-1-11.14", // "'And where there is ignorance...' The man agreed."
  "discourses-1-14.2",  // "'Well, don't you think...' 'Yes.'"
  "discourses-1-17.9",  // "'But a measuring bowl is a mere thing of wood...'"
  "discourses-1-21.3",  // "'I want everyone I meet to admire me...'"
  "discourses-2-1.30",  // "But you say, 'Didn't I read to you...'"
  "discourses-2-6.7",   // "'So, talk to him.' 'OK...' 'How?' 'As an equal.'"
  "discourses-2-11.11", // "And if you clash... 'Agreed.'"
  "discourses-2-15.12", // "If the idea of killing me should ever occur to you..."
  "discourses-2-15.18", // "'I want to die...' Why? What has happened?"
  "discourses-2-22.4",  // "'Wait a minute,' I hear someone say..."
  "discourses-3-4.10",  // "It's absurd that I should lose, just so..."
  "discourses-3-5.1",   // "'I am ill here,' said a student, 'and want to go home.'"
  "discourses-3-5.15",  // "'In what? Little phrases?' Hush..."
  "discourses-4-1.2",   // "Who wants to live with delusion... 'No one.'"
  "discourses-4-1.12",  // "'Maybe, but who has power to compel me...'"
  "discourses-4-1.16",  // "'How does that affect whether I am slave or free?'"
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runSQL(sql: string) {
  writeFileSync(TEMP_SQL, sql);
  execSync(
    `npx wrangler d1 execute ${DB_NAME} ${remoteFlag} --file="${TEMP_SQL}"`,
    { stdio: "pipe" },
  );
}

function queryJSON(command: string): any[] {
  const result = execSync(
    `npx wrangler d1 execute ${DB_NAME} ${remoteFlag} --command "${command}" --json`,
    { encoding: "utf-8" },
  );
  const parsed = JSON.parse(result);
  return parsed[0]?.results || [];
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Updating ${isLocal ? "local" : "remote"} database...\n`);

  // Step 1: Reset all entries to reflectable
  console.log("Resetting all entries to reflectable = 1...");
  runSQL("UPDATE entries SET reflectable = 1;");

  // Step 2: Query all entries
  console.log("Querying all entries...");
  const entries = queryJSON(
    "SELECT id, source, book, entry, text FROM entries ORDER BY source, book, entry",
  );
  console.log(`Found ${entries.length} total entries.\n`);

  // Step 3: Determine exclusions
  const toExclude: { id: number; key: string; reason: string; words: number; text: string }[] = [];

  for (const e of entries) {
    const key = `${e.source}-${e.book}-${e.entry}`;
    const words = countWords(e.text);

    // Tier 1: Auto-exclude short entries (unless whitelisted)
    if (words < SHORT_THRESHOLD && !SHORT_BUT_REFLECTABLE.has(key)) {
      toExclude.push({
        id: e.id,
        key,
        reason: `under ${SHORT_THRESHOLD} words`,
        words,
        text: e.text.substring(0, 80),
      });
      continue;
    }

    // Tier 2: Manual exclusions (mid-argument continuations)
    if (MANUAL_EXCLUSIONS.has(key)) {
      toExclude.push({
        id: e.id,
        key,
        reason: "manual exclusion (mid-argument)",
        words,
        text: e.text.substring(0, 80),
      });
    }
  }

  if (toExclude.length === 0) {
    console.log("No entries to exclude. All entries are reflectable.");
    return;
  }

  // Step 4: Apply exclusions in batch
  console.log(`Excluding ${toExclude.length} entries:\n`);
  for (const e of toExclude) {
    console.log(`  ${e.key} (${e.words}w, ${e.reason}): "${e.text}"`);
  }

  const ids = toExclude.map((e) => e.id);
  runSQL(`UPDATE entries SET reflectable = 0 WHERE id IN (${ids.join(",")});`);

  // Step 5: Verify
  console.log("\nVerifying...");
  const counts = queryJSON(
    "SELECT source, SUM(CASE WHEN reflectable = 0 THEN 1 ELSE 0 END) as excluded, COUNT(*) as total FROM entries GROUP BY source",
  );

  let totalExcluded = 0;
  let totalEntries = 0;
  for (const row of counts) {
    console.log(`  ${row.source}: ${row.excluded} excluded / ${row.total} total`);
    totalExcluded += row.excluded;
    totalEntries += row.total;
  }
  console.log(`  Total: ${totalExcluded} excluded / ${totalEntries} total`);
  console.log(`  Reflection pool: ${totalEntries - totalExcluded} entries`);

  // Cleanup
  try {
    unlinkSync(TEMP_SQL);
  } catch {
    // ignore
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error(err);
  try {
    unlinkSync(TEMP_SQL);
  } catch {
    // ignore
  }
  process.exit(1);
});
