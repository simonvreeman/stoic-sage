/**
 * Parse Seneca's "On the Shortness of Life" HTML into structured JSON entries.
 *
 * Source: https://vreeman.com/seneca/on-the-shortness-of-life
 *
 * Output: data/seneca-shortness.json
 * Format: Array of { source: "seneca-shortness", book: number, entry: string, text: string, marked?: boolean }
 *   - book = chapter number (1-20)
 *   - entry = paragraph index within chapter as string (e.g., "1", "2")
 *
 * HTML Structure:
 *   - Single <main> element, flat paragraph structure
 *   - Content boundary: between <main> and <h2 id="fn"> (footnotes section)
 *   - Chapter markers: <p> containing <strong id="chapter-N">
 *   - Continuation paragraphs: plain <p> without <strong id="chapter-...">
 *   - Blockquotes: <blockquote><p>...</p></blockquote> — continuation content
 *   - Footnote refs: <sup><a href="#fn-N"> — strip during parsing
 *   - 1 marked passage expected (the famous opening line)
 *
 * Usage: npx tsx scripts/parse-seneca-shortness.ts
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
  marked?: boolean;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_URL = "https://vreeman.com/seneca/on-the-shortness-of-life";
const OUTPUT_PATH = resolve(__dirname, "../data/seneca-shortness.json");

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

  // Convert <br> to newlines (for poetry/verse)
  clone.find("br").replaceWith("\n");

  return clone.text().trim();
}

/**
 * Check if an element contains any <mark> tags.
 */
function hasMarkTag(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<cheerio.Element>,
): boolean {
  return el.find("mark").length > 0;
}

/**
 * Parse all chapters from the Seneca HTML.
 *
 * Strategy:
 * - Walk through all elements in <main>
 * - Detect chapter starts via <strong id="chapter-N"> inside <p> tags
 * - Each paragraph within a chapter becomes a separate entry
 * - Blockquotes are treated as continuation content for the preceding entry
 * - The chapter-starting paragraph itself is the first entry
 */
function parseChapters($: cheerio.CheerioAPI): Entry[] {
  const allEntries: Entry[] = [];

  // Find content within <main>, stopping at footnotes
  const main = $("main");
  if (main.length === 0) {
    throw new Error("Could not find <main> element");
  }

  // Collect all direct children of main until the footnotes section
  const children = main.children().toArray();

  let currentChapter = 0;
  let currentEntryIndex = 0;
  let pendingText: string[] = []; // accumulates text for multi-part entries (blockquotes)
  let pendingMarked = false;

  function flushEntry() {
    if (currentChapter > 0 && pendingText.length > 0) {
      const text = pendingText.join("\n\n").trim();
      if (text) {
        allEntries.push({
          source: "seneca-shortness",
          book: currentChapter,
          entry: String(currentEntryIndex),
          text,
          ...(pendingMarked ? { marked: true } : {}),
        });
      }
      pendingText = [];
      pendingMarked = false;
    }
  }

  for (const child of children) {
    const el = $(child);
    const tagName = child.type === "tag" ? (child as cheerio.Element).tagName?.toLowerCase() : null;

    // Stop at footnotes section
    if (tagName === "h2" && el.attr("id") === "fn") break;

    if (tagName === "p") {
      // Check if this paragraph starts a new chapter
      const strongEl = el.find('strong[id^="chapter-"]');

      if (strongEl.length > 0) {
        // Flush previous entry
        flushEntry();

        // Extract chapter number
        const chapterId = strongEl.attr("id") || "";
        const chapterMatch = chapterId.match(/^chapter-(\d+)$/);
        if (chapterMatch) {
          currentChapter = parseInt(chapterMatch[1], 10);
          currentEntryIndex = 1;

          // Extract text (the chapter-starting paragraph IS the first entry)
          const text = extractText($, el);
          const marked = hasMarkTag($, el);

          // Remove the chapter number prefix (e.g., "1 " or "20 ")
          const cleanText = text.replace(/^\d+\s+/, "").trim();

          if (cleanText) {
            pendingText = [cleanText];
            pendingMarked = marked;
          }
        }
      } else if (currentChapter > 0) {
        // Continuation paragraph — new entry within current chapter
        flushEntry();
        currentEntryIndex++;

        const text = extractText($, el);
        const marked = hasMarkTag($, el);

        if (text) {
          pendingText = [text];
          pendingMarked = marked;
        }
      }
    } else if (tagName === "blockquote" && currentChapter > 0) {
      // Blockquote is continuation content — append to current entry
      const bqParagraphs = el.find("p").toArray();
      for (const bqP of bqParagraphs) {
        const text = extractText($, $(bqP));
        if (text) pendingText.push(text);
      }
      if (hasMarkTag($, el)) pendingMarked = true;
    }
  }

  // Flush last entry
  flushEntry();

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

  console.log("\nEntries per chapter:");
  for (const [ch, count] of Array.from(chapterCounts.entries()).sort(([a], [b]) => a - b)) {
    console.log(`  Chapter ${ch}: ${count} entries`);
  }

  // Marked entries
  const markedEntries = allEntries.filter((e) => e.marked);
  console.log(`\nMarked entries: ${markedEntries.length}`);
  if (markedEntries.length > 0) {
    for (const e of markedEntries) {
      console.log(`  ${e.book}.${e.entry}: ${e.text.substring(0, 80)}...`);
    }
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
    console.log(`  ${e.book}.${e.entry}: ${e.text.substring(0, 100)}...`);
  }

  // Write output
  writeFileSync(OUTPUT_PATH, JSON.stringify(allEntries, null, 2));
  console.log(`\nWritten to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
