# Stoic Sage

A personal semantic search engine for *Meditations* by Marcus Aurelius, running entirely on Cloudflare's free tier.

## Architecture

All infrastructure runs on Cloudflare:

- **Workers** — API server and frontend, using [Hono](https://hono.dev) as the router
- **D1** — SQLite database storing Meditations entries (book, entry, text)
- **Vectorize** — Vector similarity search for semantic queries (768-dim, cosine)
- **Workers AI** — Embedding model (`@cf/baai/bge-base-en-v1.5`) and LLM for explanations

## Project Structure

```
src/
  index.ts          — Hono app, all API routes
scripts/
  parse-meditations.ts  — HTML parser (one-time, generates data/meditations.json)
  seed-d1.ts            — Seeds D1 from meditations.json
  embed-entries.ts      — Generates embeddings and upserts to Vectorize
data/
  meditations.json      — Parsed entries (499 records)
migrations/
  0001_create_entries.sql — D1 schema
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
| GET | `/api/entry/:book/:id` | Get a specific entry by book (1-12) and entry ID | Live |
| GET | `/api/random` | Random entry (`ORDER BY RANDOM()`) | Live |
| GET | `/api/daily` | Daily entry (date-seeded, consistent within a day) | Live |
| GET | `/api/search?q=...&topK=5` | Semantic search (embed query → Vectorize → D1) | Live |
| POST | `/api/explain` | AI explanation of entries (streamed SSE) | Live |

### Response format

All API routes return JSON. Entry responses have the shape:

```json
{ "book": 6, "entry": "26", "text": "..." }
```

Search responses: `{ "results": [{ "book": 6, "entry": "26", "text": "...", "score": 0.76 }] }`

Explain request: `POST { "query": "...", "entries": [{ "book": 6, "entry": "26", "text": "..." }] }`
Explain response: Server-Sent Events stream (text/event-stream) from `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.

Error responses: `{ "error": "message" }` with appropriate HTTP status (400, 404, 500).

## Bindings

Configured in `wrangler.jsonc`:

- `DB` — D1 database (`stoic-sage-db`)
- `VECTORIZE` — Vectorize index (`meditations-index`, 768-dim, cosine)
- `AI` — Workers AI (embeddings + LLM)

## Source Material

Gregory Hays translation of *Meditations* from vreeman.com/meditations. 12 books, 499 entries total. Entry-level chunking — each entry is one atomic thought, the natural retrieval unit. 11 entries have letter suffixes (e.g., 4.49a) — these are separate thoughts sharing a number in the original text.

### HTML Structure (see `docs/html-structure.md` for full details)

- Each book is a `<section id="bookN">`
- **Book 1** uses `<h3 id="book1-N">` headings per entry, with `<p>` content below
- **Books 2-12** use `<p>` tags with `<strong id="bookN-M">N.M</strong>` as entry markers
- Multi-paragraph entries: continuation `<p>` tags without the strong/anchor prefix
- Special elements within entries: `<blockquote>`, `<ol>`, `<ul>`, `<mark>`, `<em>`, person links
- Parser must use a DOM library (cheerio/linkedom) to handle nested HTML correctly

## Data Model

```
entries (D1):
  id       INTEGER PRIMARY KEY AUTOINCREMENT
  book     INTEGER NOT NULL
  entry    TEXT NOT NULL          -- string to support "49a" suffixes
  text     TEXT NOT NULL
  UNIQUE(book, entry)
```

### Data Pipeline

```bash
npx tsx scripts/parse-meditations.ts   # Fetch HTML → data/meditations.json (499 entries)
npx tsx scripts/seed-d1.ts             # Insert JSON → D1 database
```

### Vectorize Pipeline

```bash
# Requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN env vars
npx tsx scripts/embed-entries.ts       # Embed all entries → Vectorize (499 vectors)
```

- Embedding model: `@cf/baai/bge-base-en-v1.5` (768 dimensions, mean pooling)
- Index: `meditations-index` (cosine similarity)
- Vector IDs: `{book}-{entry}` (e.g., `6-26`, `4-49a`)
- Metadata: `{ book, entry }` stored with each vector
- Batches embeddings in groups of 100, upserts via `wrangler vectorize upsert`

## Frontend

Single-page HTML served inline from Hono's `GET /` route. Features:

- **Daily reflection** — On page load, fetches `/api/daily` for a date-seeded consistent entry
- **"Show me another"** — Fetches `/api/random` for a truly random entry
- **Semantic search** — Search box queries `/api/search`, displays ranked results with scores
- **AI explanations** — "Explain these results" button streams `/api/explain` via SSE
- **Fade-in transitions** — Content area animates on load/update
- **Meta tags** — OG (title, description, type, url), Twitter Card, description meta
- **Favicon** — SVG emoji (🏛️)
- **Footer** — Links to source text (Gregory Hays translation)

## Key Decisions

- **Entry-level chunking** — Meditations is written as atomic thoughts. Entry = retrieval unit.
- **Vector search only (no FTS)** — ~500 entries from one book; hybrid search is over-engineered.
- **Hono router** — Lightweight, TypeScript-native, popular with Workers.
- **Not using AutoRAG** — Need control over chunk boundaries.
- **Date-seeded daily entry** — Hash of `YYYY-MM-DD` string for deterministic, timezone-agnostic daily selection.
