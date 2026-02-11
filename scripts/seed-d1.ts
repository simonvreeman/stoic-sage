/**
 * Seed the D1 database with parsed entries.
 *
 * Supports multiple source texts. Pass a JSON file path as the first argument.
 * Each entry must have { source, book, entry, text }.
 *
 * Usage:
 *   npx tsx scripts/seed-d1.ts data/meditations.json [--local]
 *   npx tsx scripts/seed-d1.ts data/enchiridion.json [--local]
 *
 * Pass --local to seed the local development database instead of remote.
 * Only clears entries matching the source in the provided data file.
 */

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

interface Entry {
  source: string;
  book: number;
  entry: string;
  text: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMP_SQL = resolve(__dirname, "../.seed-temp.sql");
const DB_NAME = "stoic-sage-db";
const BATCH_SIZE = 50;

const isLocal = process.argv.includes("--local");
const remoteFlag = isLocal ? "--local" : "--remote";

// First non-flag argument is the data file path
const dataFileArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!dataFileArg) {
  console.error("Usage: npx tsx scripts/seed-d1.ts <data-file.json> [--local]");
  console.error("Example: npx tsx scripts/seed-d1.ts data/enchiridion.json");
  process.exit(1);
}

const DATA_PATH = resolve(dataFileArg);

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
  const rawEntries = JSON.parse(readFileSync(DATA_PATH, "utf-8"));

  // Support both old format (no source) and new format (with source)
  const entries: Entry[] = rawEntries.map((e: any) => ({
    source: e.source || "meditations",
    book: e.book,
    entry: e.entry,
    text: e.text,
  }));

  const source = entries[0]?.source;
  if (!source) {
    console.error("No entries found in data file.");
    process.exit(1);
  }

  console.log(`Loaded ${entries.length} entries (source: ${source}) from ${DATA_PATH}`);
  console.log(`Seeding ${isLocal ? "local" : "remote"} database...`);

  // Clear only entries for this source
  console.log(`Clearing existing '${source}' entries...`);
  runSQL(`DELETE FROM entries WHERE source = '${escapeSQL(source)}';`);

  // Insert in batches
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const values = batch
      .map(
        (e) =>
          `('${escapeSQL(e.source)}', ${e.book}, '${escapeSQL(e.entry)}', '${escapeSQL(e.text)}')`,
      )
      .join(",\n");

    runSQL(`INSERT INTO entries (source, book, entry, text) VALUES\n${values};`);
    console.log(`  Inserted ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length}`);
  }

  // Verify
  console.log("\nVerifying...");
  const result = execSync(
    `npx wrangler d1 execute ${DB_NAME} ${remoteFlag} --command "SELECT source, COUNT(*) as count FROM entries GROUP BY source;" --json`,
    { encoding: "utf-8" },
  );

  const parsed = JSON.parse(result);
  const counts = parsed[0]?.results || [];
  for (const row of counts) {
    console.log(`  ${row.source}: ${row.count} entries`);
  }

  const sourceCount = counts.find((r: any) => r.source === source)?.count || 0;
  const totalCount = counts.reduce((sum: number, r: any) => sum + r.count, 0);
  console.log(`  Total: ${totalCount} entries`);

  // Cleanup
  try {
    unlinkSync(TEMP_SQL);
  } catch {
    // ignore
  }

  if (sourceCount === entries.length) {
    console.log("Seed complete!");
  } else {
    console.error(`WARNING: Expected ${entries.length} for ${source}, got ${sourceCount}`);
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
