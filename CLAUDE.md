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
  meditations.json      — Parsed entries (488 records)
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

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Frontend (search + daily entry) |
| GET | `/api/entry/:book/:id` | Get a specific entry |
| GET | `/api/random` | Random entry |
| GET | `/api/search?q=...` | Semantic search (Phase 2) |
| POST | `/api/explain` | AI explanation of entries (Phase 3) |

## Bindings

Configured in `wrangler.jsonc`:

- `DB` — D1 database (`stoic-sage-db`)
- `VECTORIZE` — Vectorize index (`meditations-index`) (Phase 2)
- `AI` — Workers AI (Phase 2)

## Source Material

Gregory Hays translation of *Meditations* from vreeman.com/meditations. 12 books, 488 entries total. Entry-level chunking — each entry is one atomic thought, the natural retrieval unit.

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
  entry    INTEGER NOT NULL
  text     TEXT NOT NULL
  UNIQUE(book, entry)
```

## Key Decisions

- **Entry-level chunking** — Meditations is written as atomic thoughts. Entry = retrieval unit.
- **Vector search only (no FTS)** — ~270 entries from one book; hybrid search is over-engineered.
- **Hono router** — Lightweight, TypeScript-native, popular with Workers.
- **Not using AutoRAG** — Need control over chunk boundaries.
