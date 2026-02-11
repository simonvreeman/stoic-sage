/**
 * Generate embeddings for all Meditations entries and upsert to Vectorize.
 *
 * Reads data/meditations.json, calls Workers AI REST API for embeddings,
 * writes NDJSON file, then uses `wrangler vectorize upsert` to insert vectors.
 *
 * Requires environment variables:
 *   CLOUDFLARE_ACCOUNT_ID — Cloudflare account ID
 *   CLOUDFLARE_API_TOKEN  — API token with Workers AI permissions
 *
 * Usage: npx tsx scripts/embed-entries.ts
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

interface EmbeddingResponse {
  result: {
    shape: [number, number];
    data: number[][];
  };
  success: boolean;
  errors: unknown[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, "../data/meditations.json");
const NDJSON_PATH = resolve(__dirname, "../.vectors-temp.ndjson");
const INDEX_NAME = "meditations-index";
const EMBED_BATCH_SIZE = 100; // Workers AI max per request

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error(
    "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.",
  );
  process.exit(1);
}

const AI_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/baai/bge-base-en-v1.5`;

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: texts }),
  });

  const json = (await res.json()) as EmbeddingResponse;
  if (!json.success) {
    throw new Error(`Embedding API error: ${JSON.stringify(json.errors)}`);
  }

  return json.result.data;
}

async function main() {
  const entries: Entry[] = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  console.log(`Loaded ${entries.length} entries`);

  const vectors: string[] = [];

  for (let i = 0; i < entries.length; i += EMBED_BATCH_SIZE) {
    const batch = entries.slice(i, i + EMBED_BATCH_SIZE);
    const texts = batch.map((e) => e.text);

    console.log(
      `Embedding batch ${Math.floor(i / EMBED_BATCH_SIZE) + 1}/${Math.ceil(entries.length / EMBED_BATCH_SIZE)} (${batch.length} entries)...`,
    );

    const embeddings = await getEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      const e = batch[j];
      vectors.push(
        JSON.stringify({
          id: `${e.book}-${e.entry}`,
          values: embeddings[j],
          metadata: { book: e.book, entry: e.entry },
        }),
      );
    }
  }

  console.log(`\nGenerated ${vectors.length} vectors. Writing NDJSON...`);
  writeFileSync(NDJSON_PATH, vectors.join("\n"));

  console.log("Upserting to Vectorize...");
  execSync(
    `npx wrangler vectorize upsert ${INDEX_NAME} --file="${NDJSON_PATH}"`,
    { stdio: "inherit" },
  );

  // Cleanup
  try {
    unlinkSync(NDJSON_PATH);
  } catch {
    // ignore
  }

  console.log("Done! Vectors upserted to Vectorize.");
}

main().catch((err) => {
  console.error(err);
  try {
    unlinkSync(NDJSON_PATH);
  } catch {
    // ignore
  }
  process.exit(1);
});
