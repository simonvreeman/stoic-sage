/**
 * Parse Discourses of Epictetus HTML into structured JSON entries.
 *
 * Source: https://vreeman.com/discourses/
 * Robert Dobbin translation (selected discourses).
 *
 * Output: data/discourses.json
 * Format: Array of { source: "discourses", book: number, entry: string, text: string }
 *   - book = book number (1-4)
 *   - entry = "{chapter}.{N}" where N is the Schenkl paragraph number (e.g., "1.1", "22.12")
 *
 * HTML Structure:
 *   - 4 books, 64 chapters (non-consecutive numbering in Books 2-4, Dobbin's selection)
 *   - Chapter headings: <h3 id="book{B}-{C}"> with <strong>{B}.{C}</strong>
 *   - Entries marked with [N] at start of <p> text content
 *   - Continuation <p> tags (no [N]) belong to preceding numbered entry
 *   - Blockquotes are continuation content for preceding entry
 *   - <br> in poetry → newline
 *   - <sup> footnotes → stripped
 *   - <em>, <mark>, <a> → text preserved, tags stripped
 *   - Edge case: Chapter 2.22 has bare text nodes and bare <sup> under <main>
 *   - Content between <h2#book1> and <h2#glossary>
 *
 * Usage: npx tsx scripts/parse-discourses.ts
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
const SOURCE_URL = "https://vreeman.com/discourses/";
const OUTPUT_PATH = resolve(__dirname, "../data/discourses.json");

/**
 * Extract clean text from a cheerio element.
 * Strips footnotes (sup tags) and navigation anchors.
 * Converts <br> to newline for poetry.
 */
function extractText(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<cheerio.Element>,
): string {
  const clone = el.clone();

  // Remove footnote references (<sup> tags)
  clone.find("sup").remove();

  // Remove navigation/return anchor links but keep text of content links
  clone.find("a").each(function () {
    const href = $(this).attr("href") || "";
    const text = $(this).text().trim();
    // Remove anchors that are just "#" or link to header
    if (text === "#" || text === "↑" || href === "#header") {
      $(this).remove();
    }
    // Keep text of other links (like #plato glossary links)
  });

  // Convert <br> to newline for poetry/verse
  clone.find("br").replaceWith("\n");

  return clone.text().trim();
}

/**
 * Extract text from a blockquote element.
 * Blockquotes may contain <p> children or bare text.
 */
function extractBlockquoteText(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<cheerio.Element>,
): string {
  const clone = el.clone();
  clone.find("sup").remove();
  clone.find("br").replaceWith("\n");
  return clone.text().trim();
}

/**
 * Parse all chapters from the Discourses HTML.
 *
 * Strategy:
 * - Find all <h3> elements with id matching /^book[1-4]-\d+$/
 * - For each chapter, walk sibling nodes until next <h3> or <h2>
 * - Detect [N] markers in text to identify entries
 * - Group continuation content (non-bracketed paragraphs, blockquotes, bare text) with preceding entry
 */
function parseDiscourses($: cheerio.CheerioAPI): Entry[] {
  const allEntries: Entry[] = [];
  const chapterRegex = /^book([1-4])-(\d+)$/;
  const entryMarkerRegex = /^\[(\d+)\]\s*/;

  // Find all chapter headings
  const chapterHeadings = $("h3").toArray().filter((el) => {
    const id = $(el).attr("id") || "";
    return chapterRegex.test(id);
  });

  console.log(`Found ${chapterHeadings.length} chapter headings`);

  for (let i = 0; i < chapterHeadings.length; i++) {
    const heading = $(chapterHeadings[i]);
    const headingId = heading.attr("id") || "";
    const match = headingId.match(chapterRegex);
    if (!match) continue;

    const bookNum = parseInt(match[1], 10);
    const chapterNum = parseInt(match[2], 10);

    // Collect all content nodes between this heading and the next heading
    const contentParts: { text: string; isBlockquote: boolean }[] = [];
    const headingNode = chapterHeadings[i];
    let node = headingNode.nextSibling;

    while (node) {
      if (node.type === "tag") {
        const tagName = (node as cheerio.Element).tagName?.toLowerCase();
        // Stop at next heading
        if (tagName === "h3" || tagName === "h2") break;

        if (tagName === "p") {
          const text = extractText($, $(node));
          if (text) contentParts.push({ text, isBlockquote: false });
        } else if (tagName === "blockquote") {
          const text = extractBlockquoteText($, $(node));
          if (text) contentParts.push({ text, isBlockquote: true });
        }
        // Skip bare <sup> elements (direct children of main, e.g., ch 2.22)
      } else if (node.type === "text") {
        // Handle bare text nodes (e.g., chapter 2.22 entries [12] and [14])
        const text = (node as unknown as { data: string }).data?.trim();
        if (text) contentParts.push({ text, isBlockquote: false });
      }
      node = node.nextSibling;
    }

    if (contentParts.length === 0) continue;

    // Parse entries: group by [N] markers
    let currentEntry: { num: string; parts: string[] } | null = null;

    for (const part of contentParts) {
      const markerMatch = part.text.match(entryMarkerRegex);

      if (markerMatch && !part.isBlockquote) {
        // Flush previous entry
        if (currentEntry) {
          allEntries.push({
            source: "discourses",
            book: bookNum,
            entry: `${chapterNum}.${currentEntry.num}`,
            text: currentEntry.parts.join("\n\n"),
          });
        }
        // Start new entry, strip the [N] prefix
        const cleanText = part.text.replace(entryMarkerRegex, "").trim();
        currentEntry = {
          num: markerMatch[1],
          parts: cleanText ? [cleanText] : [],
        };
      } else {
        // Continuation content (non-bracketed paragraph, blockquote, bare text)
        if (currentEntry) {
          currentEntry.parts.push(part.text);
        } else {
          console.warn(
            `Orphan content in ${bookNum}.${chapterNum}: ${part.text.substring(0, 60)}...`,
          );
        }
      }
    }

    // Flush last entry
    if (currentEntry) {
      allEntries.push({
        source: "discourses",
        book: bookNum,
        entry: `${chapterNum}.${currentEntry.num}`,
        text: currentEntry.parts.join("\n\n"),
      });
    }
  }

  return allEntries;
}

/**
 * Strip trailing footnote numbers from text.
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
  let allEntries = parseDiscourses($);

  // Clean footnote refs from text
  allEntries = allEntries.map((e) => ({
    ...e,
    text: cleanFootnoteRefs(e.text),
  }));

  // Validation
  console.log(`\nTotal: ${allEntries.length} entries across ${new Set(allEntries.map((e) => e.book)).size} books`);

  // Per-book counts
  const bookCounts = new Map<number, number>();
  for (const entry of allEntries) {
    bookCounts.set(entry.book, (bookCounts.get(entry.book) || 0) + 1);
  }

  console.log("\nPer-book counts:");
  for (const [book, count] of Array.from(bookCounts.entries()).sort(([a], [b]) => a - b)) {
    const chapters = new Set(allEntries.filter((e) => e.book === book).map((e) => e.entry.split(".")[0]));
    console.log(`  Book ${book}: ${count} entries across ${chapters.size} chapters`);
  }

  // Check chapters per book
  for (const [book] of Array.from(bookCounts.entries()).sort(([a], [b]) => a - b)) {
    const chapters = [...new Set(allEntries.filter((e) => e.book === book).map((e) => e.entry.split(".")[0]))];
    console.log(`  Book ${book} chapters: ${chapters.join(", ")}`);
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
    const key = `${e.book}-${e.entry}`;
    if (seen.has(key)) duplicates.push(`${e.book}.${e.entry}`);
    seen.add(key);
  }
  if (duplicates.length > 0) {
    console.error(`\nWARNING: Duplicate entries: ${duplicates.join(", ")}`);
  } else {
    console.log("\nNo duplicates found.");
  }

  // Verify every chapter starts with entry [1]
  const chapterFirstEntries = new Map<string, string>();
  for (const e of allEntries) {
    const chapterKey = `${e.book}-${e.entry.split(".")[0]}`;
    if (!chapterFirstEntries.has(chapterKey)) {
      const entryNum = e.entry.split(".")[1];
      chapterFirstEntries.set(chapterKey, entryNum);
    }
  }
  const nonOneStarts = Array.from(chapterFirstEntries.entries()).filter(([, num]) => num !== "1");
  if (nonOneStarts.length > 0) {
    console.error(`\nWARNING: Chapters not starting with [1]: ${nonOneStarts.map(([k, v]) => `${k} starts with [${v}]`).join(", ")}`);
  } else {
    console.log("All chapters start with [1].");
  }

  // Sample entries
  console.log("\nSample entries:");
  for (const e of allEntries.slice(0, 3)) {
    console.log(`  ${e.book}.${e.entry}: ${e.text.substring(0, 100)}...`);
  }

  // Check ch 2.22 entries (bare text node edge case)
  const ch222Entries = allEntries.filter((e) => e.book === 2 && e.entry.startsWith("22."));
  console.log(`\nChapter 2.22: ${ch222Entries.length} entries`);
  const entry2_22_12 = ch222Entries.find((e) => e.entry === "22.12");
  if (entry2_22_12) {
    console.log(`  2.22.[12]: ${entry2_22_12.text.substring(0, 100)}...`);
  } else {
    console.error("  WARNING: Missing entry 2.22.[12] (bare text node)");
  }

  // Write output
  writeFileSync(OUTPUT_PATH, JSON.stringify(allEntries, null, 2));
  console.log(`\nWritten to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
