/**
 * Parse Fragments of Epictetus HTML into structured JSON entries.
 *
 * Source: https://vreeman.com/discourses/fragments
 * Robert Dobbin translation.
 *
 * Output: data/fragments.json
 * Format: Array of { source: "fragments", book: number, entry: string, text: string }
 *   - book = integer part of fragment number (1-28)
 *   - entry = full fragment ID as string (e.g., "1", "10a", "28b")
 *
 * HTML Structure:
 *   - All fragments under single <h2 id="fragments">
 *   - Content ends at <h2 id="fn"> (footnotes section)
 *   - Only <p> tags in content area (no bare text nodes)
 *   - Fragment detection: regex /^\d+[a-z]?\.\s/ on paragraph text
 *   - Continuation <p> tags (no number prefix) belong to preceding fragment
 *   - Superscript footnote refs: <sup> — must be stripped
 *   - 31 entries total: 1-28, plus 10a, 28a, 28b
 *
 * Usage: npx tsx scripts/parse-fragments.ts
 */

import * as cheerio from "cheerio";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface Entry {
  source: string;
  book: number;
  entry: string;
  text: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_URL = "https://vreeman.com/discourses/fragments";
const OUTPUT_PATH = resolve(__dirname, "../data/fragments.json");

/**
 * Extract clean text from a cheerio element.
 * Strips footnotes (sup tags) and navigation anchors.
 */
function extractText(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<cheerio.Element>,
): string {
  const clone = el.clone();

  // Remove footnote references (<sup> tags)
  clone.find("sup").remove();

  // Remove navigation/return anchor links
  clone.find("a.return").remove();
  clone.find("a").each(function () {
    const href = $(this).attr("href") || "";
    const text = $(this).text().trim();
    // Remove anchors that are just "#" or link to footnotes or header
    if (text === "#" || text === "↑" || href.startsWith("#fn-") || href === "#header") {
      $(this).remove();
    }
  });

  return clone.text().trim();
}

/**
 * Parse all fragments from the HTML.
 *
 * Strategy:
 * - Find <h2 id="fragments"> heading
 * - Collect all <p> siblings until <h2 id="fn">
 * - Detect fragment starts with regex /^(\d+[a-z]?)\.\s/
 * - Continuation paragraphs (no number prefix) join the preceding fragment
 */
function parseFragments($: cheerio.CheerioAPI): Entry[] {
  const allEntries: Entry[] = [];
  const fragmentsHeading = $('h2#fragments');

  if (fragmentsHeading.length === 0) {
    throw new Error('Could not find <h2 id="fragments"> heading');
  }

  // Collect all <p> elements between #fragments and #fn headings
  const paragraphs: { text: string }[] = [];
  const headingNode = fragmentsHeading.get(0);
  if (!headingNode) throw new Error("No heading node found");

  let node = headingNode.nextSibling;
  while (node) {
    if (node.type === "tag") {
      const tagName = (node as cheerio.Element).tagName?.toLowerCase();
      if (tagName === "h2") break; // footnotes section
      if (tagName === "p") {
        const text = extractText($, $(node));
        if (text) paragraphs.push({ text });
      }
    }
    node = node.nextSibling;
  }

  if (paragraphs.length === 0) {
    throw new Error("No paragraphs found in fragments section");
  }

  // Parse fragments: each starts with "N." or "Na." pattern
  const fragmentRegex = /^(\d+[a-z]?)\.\s+/;
  let currentEntry: { id: string; bookNum: number; parts: string[] } | null = null;

  for (const p of paragraphs) {
    const match = p.text.match(fragmentRegex);
    if (match) {
      // Flush previous entry
      if (currentEntry) {
        allEntries.push({
          source: "fragments",
          book: currentEntry.bookNum,
          entry: currentEntry.id,
          text: currentEntry.parts.join("\n\n"),
        });
      }
      // Start new fragment, strip the "N. " prefix
      const entryId = match[1];
      const bookNum = parseInt(entryId.replace(/[a-z]+$/, ""), 10);
      const cleanText = p.text.replace(fragmentRegex, "").trim();
      currentEntry = {
        id: entryId,
        bookNum,
        parts: cleanText ? [cleanText] : [],
      };
    } else {
      // Continuation paragraph — belongs to preceding fragment
      if (currentEntry) {
        currentEntry.parts.push(p.text);
      } else {
        console.warn(`Orphan paragraph (no preceding fragment): ${p.text.substring(0, 60)}...`);
      }
    }
  }

  // Flush last entry
  if (currentEntry) {
    allEntries.push({
      source: "fragments",
      book: currentEntry.bookNum,
      entry: currentEntry.id,
      text: currentEntry.parts.join("\n\n"),
    });
  }

  return allEntries;
}

/**
 * Strip trailing footnote numbers from text (e.g., "...detachment.1" → "...detachment.")
 * These are leftovers from superscript footnote refs that weren't in <sup> tags.
 */
function cleanFootnoteRefs(text: string): string {
  return text.replace(/(\.)(\d{1,2})(?=\s|$)/g, "$1");
}

async function main() {
  console.log(`Fetching ${SOURCE_URL}...`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  console.log(`Fetched ${html.length} bytes`);

  const $ = cheerio.load(html);
  let allEntries = parseFragments($);

  // Clean footnote refs from text
  allEntries = allEntries.map((e) => ({
    ...e,
    text: cleanFootnoteRefs(e.text),
  }));

  // Validation
  console.log(`\nTotal: ${allEntries.length} entries`);

  // Show all fragment IDs
  const ids = allEntries.map((e) => e.entry);
  console.log(`Fragment IDs: ${ids.join(", ")}`);

  // Check for letter-suffixed entries
  const suffixed = allEntries.filter((e) => /[a-z]$/.test(e.entry));
  if (suffixed.length > 0) {
    console.log(`\nLetter-suffixed entries: ${suffixed.map((e) => e.entry).join(", ")}`);
  }

  // Multi-paragraph entries
  const multiParagraph = allEntries.filter((e) => e.text.includes("\n\n"));
  if (multiParagraph.length > 0) {
    console.log(`\nMulti-paragraph entries: ${multiParagraph.map((e) => e.entry).join(", ")}`);
  }

  // Check for empty texts
  const emptyEntries = allEntries.filter((e) => !e.text);
  if (emptyEntries.length > 0) {
    console.error(`\nWARNING: ${emptyEntries.length} entries with empty text:`);
    for (const e of emptyEntries) {
      console.error(`  ${e.entry}`);
    }
  }

  // Check for duplicates
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const e of allEntries) {
    const key = `${e.book}-${e.entry}`;
    if (seen.has(key)) duplicates.push(e.entry);
    seen.add(key);
  }
  if (duplicates.length > 0) {
    console.error(`\nWARNING: Duplicate entries: ${duplicates.join(", ")}`);
  } else {
    console.log("\nNo duplicates found.");
  }

  // Sample entries
  console.log("\nSample entries:");
  for (const e of allEntries.slice(0, 3)) {
    console.log(`  ${e.entry}: ${e.text.substring(0, 100)}...`);
  }

  // Show a letter-suffixed entry
  const sample10a = allEntries.find((e) => e.entry === "10a");
  if (sample10a) {
    console.log(`\n  10a: ${sample10a.text.substring(0, 100)}...`);
  }

  // Write output
  writeFileSync(OUTPUT_PATH, JSON.stringify(allEntries, null, 2));
  console.log(`\nWritten to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
