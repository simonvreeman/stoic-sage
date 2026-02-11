/**
 * Parse Meditations HTML into structured JSON entries.
 *
 * Source: https://vreeman.com/meditations/
 * See docs/html-structure.md for the full HTML structure analysis.
 *
 * Output: data/meditations.json
 * Format: Array of { book: number, entry: string, text: string }
 *
 * Note: entry is a string because some entries have letter suffixes (e.g., "49a").
 *
 * Usage: npx tsx scripts/parse-meditations.ts
 */

import * as cheerio from "cheerio";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface Entry {
  book: number;
  entry: string;
  text: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_URL = "https://vreeman.com/meditations/";
const OUTPUT_PATH = resolve(__dirname, "../data/meditations.json");

/**
 * Extract clean text from a cheerio element.
 * Strips footnotes and navigation anchors but keeps person name links as plain text.
 */
function extractText($: cheerio.CheerioAPI, el: cheerio.Cheerio<cheerio.Element>): string {
  const clone = el.clone();

  // Remove footnote references (<sup> tags)
  clone.find("sup").remove();

  // Remove navigation anchor links (the # return links)
  clone.find("a.return").remove();
  clone.find("a").each(function () {
    if ($(this).text().trim() === "#") {
      $(this).remove();
    }
  });

  return clone.text().trim();
}

/**
 * Extract text from a sequence of sibling elements (p, ul, ol, blockquote).
 * Joins them with double newlines for paragraph separation.
 */
function extractMultiElementText(
  $: cheerio.CheerioAPI,
  elements: cheerio.Cheerio<cheerio.Element>[],
): string {
  const parts: string[] = [];

  for (const el of elements) {
    const tagName = el.prop("tagName")?.toLowerCase();

    if (tagName === "ul" || tagName === "ol") {
      const items: string[] = [];
      el.find("li").each(function () {
        const text = extractText($, $(this));
        if (text) items.push(`- ${text}`);
      });
      if (items.length > 0) parts.push(items.join("\n"));
    } else {
      const text = extractText($, el);
      if (text) parts.push(text);
    }
  }

  return parts.join("\n\n");
}

/**
 * Parse Book 1 entries. Book 1 uses <h3> headings per entry.
 * No letter-suffixed entries in Book 1.
 */
function parseBook1($: cheerio.CheerioAPI, section: cheerio.Cheerio<cheerio.Element>): Entry[] {
  const entries: Entry[] = [];

  section.find("h3").each(function () {
    const h3 = $(this);
    const id = h3.attr("id") || "";
    const match = id.match(/^book1-(\d+)$/);
    if (!match) return;

    const entryId = match[1];

    // Collect all sibling elements until the next h3
    const contentElements: cheerio.Cheerio<cheerio.Element>[] = [];
    let next = h3.next();
    while (next.length > 0 && next.prop("tagName")?.toLowerCase() !== "h3") {
      contentElements.push(next);
      next = next.next();
    }

    const text = extractMultiElementText($, contentElements);
    if (text) {
      entries.push({ book: 1, entry: entryId, text });
    }
  });

  return entries;
}

/**
 * Parse Books 2-12 entries. These use <strong id="bookN-M"> inside <p> tags.
 * Some entries have letter suffixes (e.g., 4.49a).
 */
function parseBook($: cheerio.CheerioAPI, section: cheerio.Cheerio<cheerio.Element>, bookNum: number): Entry[] {
  const entries: Entry[] = [];
  const children = section.children();

  let currentEntry: { entryId: string; elements: cheerio.Cheerio<cheerio.Element>[] } | null = null;

  function flushEntry() {
    if (!currentEntry) return;
    const text = extractMultiElementText($, currentEntry.elements);
    if (text) {
      entries.push({ book: bookNum, entry: currentEntry.entryId, text });
    }
    currentEntry = null;
  }

  children.each(function () {
    const el = $(this);
    const tagName = el.prop("tagName")?.toLowerCase();

    // Skip h2 (book title)
    if (tagName === "h2") return;

    // Check if this <p> starts a new entry
    if (tagName === "p") {
      const strong = el.find(`strong[id^="book${bookNum}-"]`).first();
      if (strong.length > 0) {
        const strongId = strong.attr("id") || "";
        // Match both "book4-49" and "book4-49a"
        const match = strongId.match(/^book\d+-(\d+[a-z]?)$/);
        if (!match) return;

        // Flush previous entry before starting a new one
        flushEntry();

        const entryId = match[1];

        // Strip the entry number prefix (e.g., "4.49a ") from the text
        const strongText = strong.text().trim(); // e.g., "4.49a"

        // Build a clean version of this <p> as a virtual text element
        const pClone = el.clone();
        pClone.find("sup").remove();
        pClone.find("a.return").remove();
        pClone.find(`strong[id="${strongId}"]`).remove();
        pClone.find("a").each(function () {
          if ($(this).text().trim() === "#") {
            $(this).remove();
          }
        });

        let pText = pClone.text().trim();
        // Remove any leading dash that some "a" entries have (e.g., "—It's unfortunate")
        pText = pText.replace(/^—\s*/, "—");

        currentEntry = { entryId, elements: [] };
        if (pText) {
          currentEntry.elements.push(el);
        }
        return;
      }
    }

    // Continuation element (p without strong, or ul, ol, blockquote)
    if (currentEntry) {
      currentEntry.elements.push(el);
    }
  });

  // Flush last entry
  flushEntry();

  return entries;
}

/**
 * Clean up entry text: strip the entry number prefix from the first paragraph.
 */
function cleanEntryText(text: string, book: number, entryId: string): string {
  // Remove entry number prefix like "2.1 " or "4.49a " from the start
  const escaped = entryId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefixPattern = new RegExp(`^${book}\\.${escaped}\\s*`);
  return text.replace(prefixPattern, "").trim();
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
  const allEntries: Entry[] = [];

  for (let bookNum = 1; bookNum <= 12; bookNum++) {
    const section = $(`section#book${bookNum}`);
    if (section.length === 0) {
      console.error(`WARNING: Book ${bookNum} section not found!`);
      continue;
    }

    let entries: Entry[];
    if (bookNum === 1) {
      entries = parseBook1($, section);
    } else {
      entries = parseBook($, section, bookNum);
    }

    // Clean entry text (strip number prefixes)
    entries = entries.map((e) => ({
      ...e,
      text: cleanEntryText(e.text, e.book, e.entry),
    }));

    console.log(`Book ${bookNum}: ${entries.length} entries`);
    allEntries.push(...entries);
  }

  // Validation
  console.log(`\nTotal: ${allEntries.length} entries`);

  const bookCounts = new Map<number, number>();
  for (const entry of allEntries) {
    bookCounts.set(entry.book, (bookCounts.get(entry.book) || 0) + 1);
  }

  console.log("\nEntries per book:");
  for (let b = 1; b <= 12; b++) {
    console.log(`  Book ${b}: ${bookCounts.get(b) || 0}`);
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

  // Write output
  writeFileSync(OUTPUT_PATH, JSON.stringify(allEntries, null, 2));
  console.log(`Written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
