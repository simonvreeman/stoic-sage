# Meditations HTML Structure Analysis

Source: `https://vreeman.com/meditations/`

## Overall Page Structure

```
<html>
  <head>...</head>
  <body>
    <header>...</header>
    <nav> (table of contents) </nav>
    <main>
      <section id="chronology">   — lines ~1245-1299
      <section id="introduction">  — lines ~1300-1463
      <section id="book1">         — lines 1464-1568
      <section id="book2">         — lines 1569-1611
      ...
      <section id="book12">        — lines 2709-2849
      <section id="notes">         — lines 2850-2986
      <section id="persons">       — lines 2987-3222
    </main>
    <footer>...</footer>
  </body>
</html>
```

**Parser target:** `<section id="book1">` through `<section id="book12">` only. Skip everything before book1 and everything after book12.

## Book Boundaries

Each book is a `<section>` with id `book{N}`:

```html
<section id="book1">
  <h2>...Book 1: Debts and Lessons...</h2>
  ...entries...
</section>
<section id="book2">
  <h2>...Book 2: On the River Gran, Among the Quadi...</h2>
  ...entries...
</section>
```

**Selector:** `section[id^="book"]` where id matches `book\d+` (not `book1-5` etc.)

## Entry Patterns

### Book 1: h3-based entries (unique structure)

Book 1 uses `<h3>` headings for each entry, with the person's name in the heading:

```html
<h3 id="book1-1"><a href="#book1-1">&#35;</a> 1.1 My grandfather Verus <sup><a href="#verus1">i</a></sup></h3>
<p>Character and self-control.</p>

<h3 id="book1-7"><a href="#book1-7">&#35;</a> 1.7 Rusticus <sup><a href="#rusticus">i</a></sup></h3>
<p>The recognition that I needed to train and discipline my character.</p>
<p>Not to be sidetracked by my interest in rhetoric...</p>
<p>...</p>
```

- Entry ID: `id="book1-{N}"` on the `<h3>` tag
- Entry number: text content like `1.1`, `1.7` etc.
- Title includes person name (e.g., "My grandfather Verus")
- Some have `<sup>` footnote links
- Entry text: all `<p>` elements between this `<h3>` and the next `<h3>` or `</section>`
- Multiple `<p>` tags per entry (1.7 has 5 paragraphs, 1.16 has ~25 paragraphs)
- 17 entries total

### Books 2-12: p-based entries with strong ID

Books 2-12 use `<p>` tags with a `<strong>` element containing the entry number:

```html
<p><a href="#book2-1" class="return">&#35;</a> <strong id="book2-1">2.1</strong> When you wake up in the morning...</p>
```

- Entry ID: `id="book{N}-{M}"` on the `<strong>` tag
- Entry number: text content of `<strong>` like `2.1`, `5.20`
- Prefix: `<a href="#book2-1" class="return">&#35;</a>` (anchor link, class="return")
- Entry text: starts after the `<strong>` tag's text content
- **Single-paragraph entries:** Most entries are one `<p>` tag
- **Multi-paragraph entries:** Some entries span multiple `<p>` tags. The continuation paragraphs do NOT have a `<strong>` prefix.

### Multi-paragraph entry detection (Books 2-12)

A `<p>` tag belongs to the current entry if it does NOT start with `<a href="#book... class="return">`. The next entry starts when you see a new `<p>` with that anchor+strong pattern.

Example (entry 2.14 spans multiple paragraphs):
```html
<p><a href="#book2-14" class="return">&#35;</a> <strong id="book2-14">2.14</strong> Even if you're going to live...</p>
<p>Remember two things:</p>
<ol class="roman">
  <li>that everything has always been the same...</li>
  <li>that the longest-lived...</li>
</ol>
```

## Special Elements Within Entries

### Inline elements (common)
- `<mark>` — highlighted/famous passages (sometimes with `title="The Daily Stoic: ..."`)
- `<em>` — emphasis/italics
- `<a href="#person">` — links to Index of Persons (e.g., `<a href="#socrates">Socrates</a>`)
- `<sup><a href="#note">i</a></sup>` — footnote references (Book 1 headings only)
- `&mdash;` — em dashes (very common)
- `&hellip;` — ellipses

### Block elements within entries (rare, 5 total in books)
- `<blockquote>` — 5 occurrences in books (poetry/quotes)
  - Example: `<blockquote><p>Zeus, rain down...<br>On the land...</p></blockquote>`
  - Contains `<br>` for line breaks in poetry
- `<ol class="roman">` — Roman-numeral ordered lists (entries 2.14, 2.16)
- `<ul>` — Unordered lists (entry 2.9)

## Entry Counts Per Book

| Book | Entries |
|------|---------|
| 1    | 17      |
| 2    | 17      |
| 3    | 16      |
| 4    | 51      |
| 5    | 37      |
| 6    | 59      |
| 7    | 75      |
| 8    | 61      |
| 9    | 42      |
| 10   | 38      |
| 11   | 39      |
| 12   | 36      |
| **Total** | **488** |

**Note:** The total is ~488, not ~270 as originally estimated. The project docs estimated ~270 but the actual count is higher.

## Parsing Strategy

### 1. Fetch and parse HTML with a DOM parser (e.g., cheerio/linkedom)

### 2. Extract books
```
For each <section> with id matching /^book(\d+)$/
  → book number = capture group
```

### 3. Extract entries

**Book 1:**
```
For each <h3> with id matching /^book1-(\d+)$/
  → entry number = capture group
  → collect all sibling elements until next <h3> or </section>
  → extract text from <p>, <ul>, <ol>, <blockquote> elements
```

**Books 2-12:**
```
For each <strong> with id matching /^book(\d+)-(\d+)$/
  → book number, entry number = capture groups
  → start text from the parent <p>'s text after the <strong>
  → continue collecting sibling elements until next <p> with class="return" anchor or </section>
  → include <p>, <ul>, <ol>, <blockquote> content
```

### 4. Text cleanup
- Strip HTML tags but preserve paragraph breaks as `\n\n`
- Convert `<li>` to bullet/numbered text
- Convert `<blockquote>` content (keep as quoted text)
- Decode HTML entities (`&mdash;` → —, `&hellip;` → …, etc.)
- Strip the `# ` anchor link prefix from entries
- Strip `<mark>` tags (keep inner text)
- Strip `<em>` tags (keep inner text)
- Strip person links `<a href="#person">` (keep inner text)
- Strip footnote `<sup>` references entirely
