/**
 * Fetch PAA questions from AlsoAsked API for all seed terms.
 *
 * Calls the AlsoAsked API one term at a time with a delay between requests
 * to avoid rate limiting. Saves raw JSON responses to data/alsoasked/.
 *
 * Usage:
 *   ALSOASKED_API_KEY=aa-live-... npx tsx scripts/fetch-alsoasked.ts
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../data/alsoasked");

const API_KEY = process.env.ALSOASKED_API_KEY;
if (!API_KEY) {
  console.error("Set ALSOASKED_API_KEY environment variable.");
  process.exit(1);
}

const BASE_URL = "https://alsoaskedapi.com/v1";

const TERMS = [
  // Core Stoicism
  "stoicism",
  "what is stoicism",
  "stoic philosophy",
  "how to practice stoicism",
  "stoicism for beginners",
  "benefits of stoicism",
  // Key figures
  "Marcus Aurelius",
  "Marcus Aurelius meditations",
  "Epictetus",
  "Epictetus teachings",
  "Seneca philosophy",
  "Seneca letters",
  // Core concepts
  "dichotomy of control",
  "amor fati",
  "memento mori",
  "stoic virtues",
  "negative visualization",
  "stoic journaling",
  // Applied / life situations
  "stoicism and anxiety",
  "stoicism and grief",
  "stoicism and anger",
  "stoicism and relationships",
  "stoicism and discipline",
  "stoicism and resilience",
  "stoicism at work",
  "stoicism and mental health",
  // Comparisons & modern
  "stoicism vs Buddhism",
  "stoicism vs existentialism",
  "stoicism vs Christianity",
  "is stoicism a religion",
  "stoicism and mindfulness",
  "modern stoicism",
  // Practical / resources
  "best stoic books",
  "stoic quotes",
  "stoic daily routine",
  "stoic exercises",
  "how to read Marcus Aurelius",
  "stoicism reading order",
];

const DELAY_MS = 2000; // 2 seconds between requests

function slugify(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function searchTerm(term: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/search`, {
    method: "POST",
    headers: {
      "X-Api-Key": API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      terms: [term],
      language: "en",
      region: "us",
      depth: 2,
      fresh: false,
      async: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  const credits = res.headers.get("X-AlsoAsked-Credits");
  if (credits) {
    console.log(`  Credits remaining: ${credits}`);
  }

  return res.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`Fetching PAA data for ${TERMS.length} terms...\n`);

  const allResults: Record<string, any> = {};
  let totalQuestions = 0;
  let completed = 0;

  for (const term of TERMS) {
    completed++;
    const slug = slugify(term);
    const outPath = resolve(OUTPUT_DIR, `${slug}.json`);

    console.log(`[${completed}/${TERMS.length}] "${term}"...`);

    try {
      const data = await searchTerm(term);
      writeFileSync(outPath, JSON.stringify(data, null, 2));

      // Count questions
      const queries = data.queries || data[0]?.queries || [];
      let qCount = 0;
      for (const q of queries) {
        qCount += countQuestions(q.results || []);
      }
      totalQuestions += qCount;
      console.log(`  → ${qCount} questions, saved to ${slug}.json`);

      allResults[term] = data;
    } catch (err: any) {
      console.error(`  ERROR: ${err.message}`);
      allResults[term] = { error: err.message };
    }

    // Delay between requests
    if (completed < TERMS.length) {
      await sleep(DELAY_MS);
    }
  }

  // Save combined index
  const indexPath = resolve(OUTPUT_DIR, "_index.json");
  const index = TERMS.map((term) => {
    const slug = slugify(term);
    const data = allResults[term];
    const queries = data?.queries || data?.[0]?.queries || [];
    let qCount = 0;
    for (const q of queries) {
      qCount += countQuestions(q.results || []);
    }
    return { term, slug, file: `${slug}.json`, questions: qCount };
  });
  writeFileSync(indexPath, JSON.stringify(index, null, 2));

  console.log(`\nDone! ${totalQuestions} total questions across ${TERMS.length} terms.`);
  console.log(`Index saved to data/alsoasked/_index.json`);
}

function countQuestions(results: any[]): number {
  let count = 0;
  for (const r of results) {
    count++;
    if (r.results && r.results.length > 0) {
      count += countQuestions(r.results);
    }
  }
  return count;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
