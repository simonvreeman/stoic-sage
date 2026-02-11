/**
 * Seed the D1 database with parsed Meditations entries.
 *
 * Reads data/meditations.json and inserts all entries into the D1 database
 * using wrangler d1 execute with --file. Runs in batches to stay within limits.
 *
 * Usage: npx tsx scripts/seed-d1.ts [--local]
 *
 * Pass --local to seed the local development database instead of remote.
 */

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

interface Entry {
  book: number;
  entry: string;
  text: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, "../data/meditations.json");
const TEMP_SQL = resolve(__dirname, "../.seed-temp.sql");
const DB_NAME = "stoic-sage-db";
const BATCH_SIZE = 50;

const isLocal = process.argv.includes("--local");
const remoteFlag = isLocal ? "--local" : "--remote";

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

function runSQL(sql: string) {
  writeFileSync(TEMP_SQL, sql);
  execSync(`npx wrangler d1 execute ${DB_NAME} ${remoteFlag} --file="${TEMP_SQL}"`, {
    stdio: "pipe",
  });
}

async function main() {
  const entries: Entry[] = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  console.log(`Loaded ${entries.length} entries from ${DATA_PATH}`);
  console.log(`Seeding ${isLocal ? "local" : "remote"} database...`);

  // Clear existing data
  console.log("Clearing existing entries...");
  runSQL("DELETE FROM entries;");

  // Insert in batches
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const values = batch
      .map((e) => `(${e.book}, '${escapeSQL(e.entry)}', '${escapeSQL(e.text)}')`)
      .join(",\n");

    runSQL(`INSERT INTO entries (book, entry, text) VALUES\n${values};`);
    console.log(`  Inserted ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length}`);
  }

  // Verify
  console.log("\nVerifying...");
  const result = execSync(
    `npx wrangler d1 execute ${DB_NAME} ${remoteFlag} --command "SELECT COUNT(*) as count FROM entries;" --json`,
    { encoding: "utf-8" },
  );

  const parsed = JSON.parse(result);
  const count = parsed[0]?.results?.[0]?.count;
  console.log(`Database has ${count} entries`);

  // Cleanup
  try {
    unlinkSync(TEMP_SQL);
  } catch {
    // ignore
  }

  if (count === entries.length) {
    console.log("Seed complete!");
  } else {
    console.error(`WARNING: Expected ${entries.length}, got ${count}`);
    process.exit(1);
  }
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
