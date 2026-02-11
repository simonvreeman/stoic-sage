/**
 * Parse Enchiridion HTML into structured JSON entries.
 *
 * Source: https://vreeman.com/discourses/enchiridion
 * Robert Dobbin translation.
 *
 * Output: data/enchiridion.json
 * Format: Array of { source: "enchiridion", book: number, entry: string, text: string }
 *   - book = chapter number (1-53)
 *   - entry = sub-entry number as string, or "1" for single-entry chapters
 *
 * HTML Structure:
 *   - Chapters: <h2 id="chapter-N">
 *   - Entries: <p> tags between chapter headings
 *   - Some <p> start with [N] markers for sub-entries
 *   - Some chapters have no markers (single entry, possibly multi-paragraph)
 *   - Footnotes section: <h2 id="fn"> — must be excluded
 *   - Superscript footnote refs: <sup> — must be stripped
 *
 * Usage: npx tsx scripts/parse-enchiridion.ts
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
const SOURCE_URL = "https://vreeman.com/discourses/enchiridion";
const OUTPUT_PATH = resolve(__dirname, "../data/enchiridion.json");

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
 * Parse all chapters from the Enchiridion HTML.
 *
 * Strategy:
 * - Iterate over <h2 id="chapter-N"> headings
 * - Collect all <p> siblings until the next <h2>
 * - If any <p> starts with [N], split into sub-entries
 * - If no markers, join all paragraphs as one entry
 */
function parseChapters($: cheerio.CheerioAPI): Entry[] {
  const allEntries: Entry[] = [];
  const chapterHeadings = $('h2[id^="chapter-"]').toArray();

  for (let i = 0; i < chapterHeadings.length; i++) {
    const heading = $(chapterHeadings[i]);
    const chapterMatch = heading.attr("id")?.match(/^chapter-(\d+)$/);
    if (!chapterMatch) continue;

    const chapterNum = parseInt(chapterMatch[1], 10);

    // Collect all content between this heading and the next <h2>.
    // Most content is in <p> tags, but some chapters (e.g., Ch38) have
    // bare text nodes not wrapped in <p>. We handle both.
    const paragraphs: { text: string }[] = [];

    // Walk through all sibling nodes (elements AND text nodes)
    const headingNode = chapterHeadings[i];
    let node = headingNode.nextSibling;
    while (node) {
      if (node.type === "tag") {
        const tagName = (node as cheerio.Element).tagName?.toLowerCase();
        if (tagName === "h2") break; // next chapter
        if (tagName === "p") {
          const text = extractText($, $(node));
          if (text) paragraphs.push({ text });
        }
        // Skip <sup>, <ol>, and other non-p elements
      } else if (node.type === "text") {
        const text = (node as unknown as { data: string }).data?.trim();
        if (text) paragraphs.push({ text });
      }
      node = node.nextSibling;
    }

    if (paragraphs.length === 0) continue;

    // Check if any paragraphs have [N] markers
    const markerRegex = /^\[(\d+)\]\s*/;
    const hasMarkers = paragraphs.some((p) => markerRegex.test(p.text));

    if (hasMarkers) {
      // Split into sub-entries by [N] markers
      let currentEntry: { num: string; parts: string[] } | null = null;

      for (const p of paragraphs) {
        const match = p.text.match(markerRegex);
        if (match) {
          // Flush previous entry
          if (currentEntry) {
            allEntries.push({
              source: "enchiridion",
              book: chapterNum,
              entry: currentEntry.num,
              text: currentEntry.parts.join("\n\n"),
            });
          }
          // Start new entry, strip the [N] prefix
          const cleanText = p.text.replace(markerRegex, "").trim();
          currentEntry = { num: match[1], parts: cleanText ? [cleanText] : [] };
        } else {
          // Continuation paragraph (e.g., verse in Ch53 between [1] and [2])
          if (currentEntry) {
            currentEntry.parts.push(p.text);
          }
        }
      }

      // Flush last entry
      if (currentEntry) {
        allEntries.push({
          source: "enchiridion",
          book: chapterNum,
          entry: currentEntry.num,
          text: currentEntry.parts.join("\n\n"),
        });
      }
    } else {
      // No markers — entire chapter is one entry
      const text = paragraphs.map((p) => p.text).join("\n\n");
      allEntries.push({
        source: "enchiridion",
        book: chapterNum,
        entry: "1",
        text,
      });
    }
  }

  return allEntries;
}

/**
 * Strip trailing footnote numbers from text (e.g., "...detachment.1" → "...detachment.")
 * These are leftovers from superscript footnote refs that weren't in <sup> tags.
 */
function cleanFootnoteRefs(text: string): string {
  // Match digit(s) immediately after punctuation or at end of sentence that look like footnote refs
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
  let allEntries = parseChapters($);

  // Clean footnote refs from text
  allEntries = allEntries.map((e) => ({
    ...e,
    text: cleanFootnoteRefs(e.text),
  }));

  // Validation
  console.log(`\nTotal: ${allEntries.length} entries across ${new Set(allEntries.map((e) => e.book)).size} chapters`);

  // Per-chapter counts
  const chapterCounts = new Map<number, number>();
  for (const entry of allEntries) {
    chapterCounts.set(entry.book, (chapterCounts.get(entry.book) || 0) + 1);
  }

  const multiEntryChapters = Array.from(chapterCounts.entries())
    .filter(([, count]) => count > 1)
    .sort(([a], [b]) => a - b);

  console.log(`\nChapters with multiple entries:`);
  for (const [ch, count] of multiEntryChapters) {
    const entries = allEntries.filter((e) => e.book === ch).map((e) => e.entry);
    console.log(`  Chapter ${ch}: ${count} entries (${entries.join(", ")})`);
  }

  // Check for empty texts
  const emptyEntries = allEntries.filter((e) => !e.text);
  if (emptyEntries.length > 0) {
    console.error(`\nWARNING: ${emptyEntries.length} entries with empty text:`);
    for (const e of emptyEntries) {
      console.error(`  ${e.book}.${e.entry}`);
    }
  }

  // Check for duplicates
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const e of allEntries) {
    const key = `${e.book}.${e.entry}`;
    if (seen.has(key)) duplicates.push(key);
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
    console.log(`  ${e.book}.${e.entry}: ${e.text.substring(0, 80)}...`);
  }

  // Write output
  writeFileSync(OUTPUT_PATH, JSON.stringify(allEntries, null, 2));
  console.log(`\nWritten to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
