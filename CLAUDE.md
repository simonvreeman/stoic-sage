# Stoic Sage

A personal semantic search engine for Stoic philosophy, running entirely on Cloudflare's free tier. Currently indexes *Meditations* by Marcus Aurelius, and the *Discourses*, *Enchiridion* and *Fragments* by Epictetus.

## Architecture

All infrastructure runs on Cloudflare:

- **Workers** — API server and frontend, using [Hono](https://hono.dev) as the router
- **D1** — SQLite database storing entries (source, book, entry, text)
- **Vectorize** — Vector similarity search for semantic queries (768-dim, cosine)
- **Workers AI** — Embedding model (`@cf/baai/bge-base-en-v1.5`) and LLM for explanations

## Project Structure

```
src/
  index.ts                — Hono app, all API routes
scripts/
  parse-meditations.ts    — HTML parser for Meditations (generates data/meditations.json)
  parse-enchiridion.ts    — HTML parser for Enchiridion (generates data/enchiridion.json)
  parse-fragments.ts      — HTML parser for Fragments (generates data/fragments.json)
  parse-discourses.ts     — HTML parser for Discourses (generates data/discourses.json)
  seed-d1.ts              — Seeds D1 from any data JSON file
  embed-entries.ts        — Generates embeddings and upserts to Vectorize
data/
  meditations.json        — Parsed Meditations entries (499 records, includes heading and marked fields)
  enchiridion.json        — Parsed Enchiridion entries (84 records)
  fragments.json          — Parsed Fragments entries (31 records)
  discourses.json         — Parsed Discourses entries (722 records)
migrations/
  0001_create_entries.sql  — D1 schema
  0002_add_source_column.sql — Add source column for multi-text support
  0003_rebuild_unique_constraint.sql — UNIQUE(source, book, entry)
  0004_add_marked_heading.sql — Add marked and heading columns
```

## Commands

```bash
npm run dev              # Local dev server (wrangler dev)
npm run deploy           # Deploy to Cloudflare Workers
npm run db:migrate       # Apply D1 migrations (remote)
npm run db:migrate:local # Apply D1 migrations (local)
```

## API Routes

CORS is enabled on all `/api/*` routes via Hono's `cors()` middleware.

| Method | Route | Description | Status |
|--------|-------|-------------|--------|
| GET | `/` | Frontend (daily reflection, search, explain) | Live |
| GET | `/api/entry/:book/:id?source=` | Get a specific entry by source, book/chapter, and entry ID | Live |
| GET | `/api/random` | Random entry from any source | Live |
| GET | `/api/daily` | Daily entry (date-seeded, consistent within a day) | Live |
| GET | `/api/search?q=...&topK=5` | Semantic search across all sources, weighted by source priority | Live |
| POST | `/api/explain` | AI explanation of entries (streamed SSE) | Live |

### Response format

All API routes return JSON. Entry responses have the shape:

```json
{ "source": "meditations", "book": 6, "entry": "26", "text": "..." }
```

Search responses: `{ "results": [{ "source": "meditations", "book": 6, "entry": "26", "text": "...", "score": 0.76, "weightedScore": 0.76 }] }`

Search results are sorted by `weightedScore` (raw cosine similarity × source weight). The `score` field preserves the original unweighted similarity for debugging. Source weights: Meditations 1.0, Discourses 0.85, Enchiridion 0.85, Fragments 0.75. The explain endpoint receives these weighted-sorted entries from the frontend as LLM context.

Explain request: `POST { "query": "...", "entries": [{ "source": "meditations", "book": 6, "entry": "26", "text": "..." }] }`
Explain response: Server-Sent Events stream (text/event-stream) from `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.

Error responses: `{ "error": "message" }` with appropriate HTTP status (400, 404, 500).

## Deployment

- **Live URL** — https://stoicsage.ai (custom domain)
- **Workers URL** — https://stoic-sage.vreeman.workers.dev
- Custom domain configured in `wrangler.jsonc` via `routes` with `custom_domain: true`
- `workers_dev: true` keeps the `.workers.dev` subdomain active alongside the custom domain

## Bindings

Configured in `wrangler.jsonc`:

- `DB` — D1 database (`stoic-sage-db`)
- `VECTORIZE` — Vectorize index (`meditations-index`, 768-dim, cosine)
- `AI` — Workers AI (embeddings + LLM)

## Source Material

### Meditations — Marcus Aurelius

Gregory Hays translation from vreeman.com/meditations. 12 books, 499 entries total. Entry-level chunking — each entry is one atomic thought, the natural retrieval unit. 11 entries have letter suffixes (e.g., 4.49a) — these are separate thoughts sharing a number in the original text.

**Book 1 headings** — Each Book 1 entry is a lesson Marcus attributes to a specific person (e.g., "Rusticus", "My mother"). The parser captures these as a `heading` field in the JSON. 17 entries with headings.

**Marked entries** — The source HTML contains `<mark>` tags highlighting notable/quotable passages. The parser captures this as a `marked: boolean` field. 134 entries are marked across all 12 books. This qualitative signal can be used for boosting in Daily Reflections and search.

#### Meditations HTML Structure (see `docs/html-structure.md` for full details)

- Each book is a `<section id="bookN">`
- **Book 1** uses `<h3 id="book1-N">` headings per entry, with `<p>` content below
- **Books 2-12** use `<p>` tags with `<strong id="bookN-M">N.M</strong>` as entry markers
- Multi-paragraph entries: continuation `<p>` tags without the strong/anchor prefix
- Special elements within entries: `<blockquote>`, `<ol>`, `<ul>`, `<mark>`, `<em>`, person links
- `<mark>` tags highlight notable passages — parser detects these and sets `marked: true`
- Book 1 `<h3>` headings contain person/topic names — parser extracts these into `heading` field
- Parser must use a DOM library (cheerio/linkedom) to handle nested HTML correctly

### Enchiridion — Epictetus

Robert Dobbin translation from vreeman.com/discourses/enchiridion. 53 chapters, 84 entries total. Chapters with numbered sub-entries `[N]` are split; chapters without markers are one entry.

#### Enchiridion HTML Structure

- Chapters: `<h2 id="chapter-N">`
- Entries: `<p>` tags between chapter headings, some starting with `[N]` markers
- Some chapters have bare text nodes (not wrapped in `<p>`, e.g., Ch38)
- Footnotes section at end (`<h2 id="fn">`) — excluded from parsing
- Superscript footnote refs (`<sup>`) — stripped during parsing

### Discourses — Epictetus

Robert Dobbin translation (selected discourses) from vreeman.com/discourses/. 4 books, 64 chapters, 722 entries total. Entry-level chunking using Schenkl paragraph numbers `[N]`. Non-consecutive chapter numbering in Books 2–4 (Dobbin's selection). Entry format: `{chapter}.{N}` (e.g., `"1.1"` for chapter 1, entry [1]).

#### Discourses HTML Structure

- Flat `<main>` element with no sections
- Chapter headings: `<h3 id="book{B}-{C}">` with `<strong>{B}.{C}</strong>` inside
- Entries: `<p>` tags with `[N]` markers at start of text content
- Continuation `<p>` tags (no `[N]`) belong to preceding numbered entry
- Blockquotes (7 total) — continuation content for preceding entry
- `<br>` in poetry/verse — converted to newline
- Edge case: Chapter 2.22 has bare text nodes (`[12]`, `[14]`) directly under `<main>`
- Content between `<h2#book1>` and `<h2#glossary>` (skip intro, glossary, notes)
- Superscript footnote refs (`<sup>`) — stripped during parsing
- Per-book chapters: Book 1 (1–30), Book 2 (1–6, 8, 10–23), Book 3 (3–5, 8, 16, 20, 22–23), Book 4 (1–4, 13)

### Fragments — Epictetus

Robert Dobbin translation from vreeman.com/discourses/fragments. 31 entries (numbered 1–28, plus 10a, 28a, 28b). Letter-suffixed entries are separate fragments sharing a number.

#### Fragments HTML Structure

- All fragments under single `<h2 id="fragments">`
- Content ends at `<h2 id="fn">` (footnotes section)
- Only `<p>` tags in content area (no bare text nodes)
- Fragment detection: regex `/^\d+[a-z]?\.\s/` on paragraph text content
- Continuation `<p>` tags (no number prefix) belong to preceding fragment
- 7 multi-paragraph fragments (1, 9, 10, 13, 23, 28a, 28b)
- Some fragments include bracketed source attributions (e.g., `[from Aulus Gellius, ...]`)
- Superscript footnote refs (`<sup>`) — stripped during parsing

## Data Model

```
entries (D1):
  id       INTEGER PRIMARY KEY AUTOINCREMENT
  source   TEXT NOT NULL DEFAULT 'meditations'  -- 'meditations', 'discourses', 'enchiridion', or 'fragments'
  book     INTEGER NOT NULL                     -- book (1-12 / 1-4), chapter (1-53), or fragment number (1-28)
  entry    TEXT NOT NULL                         -- string to support "49a" suffixes
  text     TEXT NOT NULL
  marked   INTEGER NOT NULL DEFAULT 0           -- 1 if entry contains <mark> highlights in source HTML
  heading  TEXT                                 -- Book 1 Meditations only: person/topic name (e.g., "Rusticus")
  UNIQUE(source, book, entry)
```

### Data Pipeline

```bash
npx tsx scripts/parse-meditations.ts           # Fetch HTML → data/meditations.json (499 entries)
npx tsx scripts/parse-enchiridion.ts           # Fetch HTML → data/enchiridion.json (84 entries)
npx tsx scripts/parse-fragments.ts             # Fetch HTML → data/fragments.json (31 entries)
npx tsx scripts/parse-discourses.ts            # Fetch HTML → data/discourses.json (722 entries)
npx tsx scripts/seed-d1.ts data/meditations.json   # Insert → D1 database
npx tsx scripts/seed-d1.ts data/enchiridion.json   # Insert → D1 database
npx tsx scripts/seed-d1.ts data/fragments.json     # Insert → D1 database
npx tsx scripts/seed-d1.ts data/discourses.json    # Insert → D1 database
```

### Vectorize Pipeline

```bash
# Requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN env vars
npx tsx scripts/embed-entries.ts data/meditations.json   # Embed → Vectorize (499 vectors)
npx tsx scripts/embed-entries.ts data/enchiridion.json   # Embed → Vectorize (84 vectors)
npx tsx scripts/embed-entries.ts data/fragments.json     # Embed → Vectorize (31 vectors)
npx tsx scripts/embed-entries.ts data/discourses.json    # Embed → Vectorize (722 vectors)
```

- Embedding model: `@cf/baai/bge-base-en-v1.5` (768 dimensions, mean pooling)
- Index: `meditations-index` (cosine similarity)
- Vector IDs: `{source}-{book}-{entry}` (e.g., `meditations-6-26`, `enchiridion-1-3`, `fragments-10-10a`, `discourses-1-1.1`)
- Metadata: `{ source, book, entry }` stored with each vector
- Batches embeddings in groups of 100, upserts via `wrangler vectorize upsert`

## Frontend

Single-page HTML served inline from Hono's `GET /` route. Features:

- **Daily reflection** — On page load, fetches `/api/daily` for a date-seeded consistent entry
- **"Show me another"** — Fetches `/api/random` for a truly random entry
- **Semantic search** — Search box queries `/api/search`, displays ranked results with scores
- **AI explanations** — "Explain these results" button streams `/api/explain` via SSE
- **Source attribution** — Citations show "Meditations 6.26", "Discourses 1.1.1", "Enchiridion 1.3", or "Fragments 8"
- **Dark mode** — Follows the user's OS preference via `prefers-color-scheme` media query. All colors defined as CSS custom properties in `:root`, overridden in `@media (prefers-color-scheme: dark)`. No manual toggle — system setting only.
- **Fade-in transitions** — Content area animates on load/update
- **Meta tags** — OG (title, description, type, url), Twitter Card, description meta, `color-scheme` meta
- **Favicon** — SVG emoji (🏛️)
- **Footer** — Links to all source texts with translator attribution

## Key Decisions

- **Entry-level chunking** — Meditations is written as atomic thoughts. Entry = retrieval unit.
- **Vector search only (no FTS)** — ~1336 entries from four texts; hybrid search is over-engineered.
- **Hono router** — Lightweight, TypeScript-native, popular with Workers.
- **Not using AutoRAG** — Need control over chunk boundaries.
- **Date-seeded daily entry** — Hash of `YYYY-MM-DD` string for deterministic, timezone-agnostic daily selection.
- **Source column** — `source` field in D1 and vector metadata enables multi-text support without schema changes.
- **Source priority weighting** — Search results weighted by `SOURCE_WEIGHTS` (Meditations 1.0, Discourses/Enchiridion 0.85, Fragments 0.75). Post-processing step after Vectorize; returns both `score` and `weightedScore`. Tunable via the constant in `src/index.ts`.
- **System-only dark mode** — No manual toggle. Pure CSS via `prefers-color-scheme` media query. Zero JS, zero localStorage. KISS.
