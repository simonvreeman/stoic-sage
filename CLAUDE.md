# Stoic Sage

A personal semantic search engine for Stoic philosophy, running entirely on Cloudflare's free tier. Currently indexes *Meditations* by Marcus Aurelius and the *Enchiridion* by Epictetus.

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
  seed-d1.ts              — Seeds D1 from any data JSON file
  embed-entries.ts        — Generates embeddings and upserts to Vectorize
data/
  meditations.json        — Parsed Meditations entries (499 records)
  enchiridion.json        — Parsed Enchiridion entries (84 records)
migrations/
  0001_create_entries.sql  — D1 schema
  0002_add_source_column.sql — Add source column for multi-text support
  0003_rebuild_unique_constraint.sql — UNIQUE(source, book, entry)
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
| GET | `/api/search?q=...&topK=5` | Semantic search across all sources (embed query → Vectorize → D1) | Live |
| POST | `/api/explain` | AI explanation of entries (streamed SSE) | Live |

### Response format

All API routes return JSON. Entry responses have the shape:

```json
{ "source": "meditations", "book": 6, "entry": "26", "text": "..." }
```

Search responses: `{ "results": [{ "source": "meditations", "book": 6, "entry": "26", "text": "...", "score": 0.76 }] }`

Explain request: `POST { "query": "...", "entries": [{ "source": "meditations", "book": 6, "entry": "26", "text": "..." }] }`
Explain response: Server-Sent Events stream (text/event-stream) from `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.

Error responses: `{ "error": "message" }` with appropriate HTTP status (400, 404, 500).

## Bindings

Configured in `wrangler.jsonc`:

- `DB` — D1 database (`stoic-sage-db`)
- `VECTORIZE` — Vectorize index (`meditations-index`, 768-dim, cosine)
- `AI` — Workers AI (embeddings + LLM)

## Source Material

### Meditations — Marcus Aurelius

Gregory Hays translation from vreeman.com/meditations. 12 books, 499 entries total. Entry-level chunking — each entry is one atomic thought, the natural retrieval unit. 11 entries have letter suffixes (e.g., 4.49a) — these are separate thoughts sharing a number in the original text.

#### Meditations HTML Structure (see `docs/html-structure.md` for full details)

- Each book is a `<section id="bookN">`
- **Book 1** uses `<h3 id="book1-N">` headings per entry, with `<p>` content below
- **Books 2-12** use `<p>` tags with `<strong id="bookN-M">N.M</strong>` as entry markers
- Multi-paragraph entries: continuation `<p>` tags without the strong/anchor prefix
- Special elements within entries: `<blockquote>`, `<ol>`, `<ul>`, `<mark>`, `<em>`, person links
- Parser must use a DOM library (cheerio/linkedom) to handle nested HTML correctly

### Enchiridion — Epictetus

Robert Dobbin translation from vreeman.com/discourses/enchiridion. 53 chapters, 84 entries total. Chapters with numbered sub-entries `[N]` are split; chapters without markers are one entry.

#### Enchiridion HTML Structure

- Chapters: `<h2 id="chapter-N">`
- Entries: `<p>` tags between chapter headings, some starting with `[N]` markers
- Some chapters have bare text nodes (not wrapped in `<p>`, e.g., Ch38)
- Footnotes section at end (`<h2 id="fn">`) — excluded from parsing
- Superscript footnote refs (`<sup>`) — stripped during parsing

## Data Model

```
entries (D1):
  id       INTEGER PRIMARY KEY AUTOINCREMENT
  source   TEXT NOT NULL DEFAULT 'meditations'  -- 'meditations' or 'enchiridion'
  book     INTEGER NOT NULL                     -- book (1-12) or chapter (1-53)
  entry    TEXT NOT NULL                         -- string to support "49a" suffixes
  text     TEXT NOT NULL
  UNIQUE(source, book, entry)
```

### Data Pipeline

```bash
npx tsx scripts/parse-meditations.ts           # Fetch HTML → data/meditations.json (499 entries)
npx tsx scripts/parse-enchiridion.ts           # Fetch HTML → data/enchiridion.json (84 entries)
npx tsx scripts/seed-d1.ts data/meditations.json   # Insert → D1 database
npx tsx scripts/seed-d1.ts data/enchiridion.json   # Insert → D1 database
```

### Vectorize Pipeline

```bash
# Requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN env vars
npx tsx scripts/embed-entries.ts data/meditations.json   # Embed → Vectorize (499 vectors)
npx tsx scripts/embed-entries.ts data/enchiridion.json   # Embed → Vectorize (84 vectors)
```

- Embedding model: `@cf/baai/bge-base-en-v1.5` (768 dimensions, mean pooling)
- Index: `meditations-index` (cosine similarity)
- Vector IDs: `{source}-{book}-{entry}` (e.g., `meditations-6-26`, `enchiridion-1-3`)
- Metadata: `{ source, book, entry }` stored with each vector
- Batches embeddings in groups of 100, upserts via `wrangler vectorize upsert`

## Frontend

Single-page HTML served inline from Hono's `GET /` route. Features:

- **Daily reflection** — On page load, fetches `/api/daily` for a date-seeded consistent entry
- **"Show me another"** — Fetches `/api/random` for a truly random entry
- **Semantic search** — Search box queries `/api/search`, displays ranked results with scores
- **AI explanations** — "Explain these results" button streams `/api/explain` via SSE
- **Source attribution** — Citations show "Meditations 6.26" or "Enchiridion 1.3"
- **Fade-in transitions** — Content area animates on load/update
- **Meta tags** — OG (title, description, type, url), Twitter Card, description meta
- **Favicon** — SVG emoji (🏛️)
- **Footer** — Links to both source texts with translator attribution

## Key Decisions

- **Entry-level chunking** — Meditations is written as atomic thoughts. Entry = retrieval unit.
- **Vector search only (no FTS)** — ~583 entries from two books; hybrid search is over-engineered.
- **Hono router** — Lightweight, TypeScript-native, popular with Workers.
- **Not using AutoRAG** — Need control over chunk boundaries.
- **Date-seeded daily entry** — Hash of `YYYY-MM-DD` string for deterministic, timezone-agnostic daily selection.
- **Source column** — `source` field in D1 and vector metadata enables multi-text support without schema changes.
