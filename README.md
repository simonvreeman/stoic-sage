# Stoic Sage

A personal semantic search engine for *Meditations* by Marcus Aurelius. Search by concept, retrieve exact entries, and get AI-powered explanations grounded in the text.

Built entirely on Cloudflare's free tier: Workers, D1, Vectorize, and Workers AI.

## Setup

```bash
npm install
npx wrangler login
npx wrangler d1 create stoic-sage-db  # Create the D1 database, update wrangler.jsonc with the ID
npm run dev                            # Start local dev server
```

## Usage

Visit [stoic-sage.vreeman.workers.dev](https://stoic-sage.vreeman.workers.dev) to browse the Meditations. The homepage shows a random entry on each load — click "Show me another" for a new one. Use the search box to find entries by concept (e.g., "anger", "death", "purpose").

### API

- `GET /api/search?q=...&topK=5` — semantic search across all entries
- `GET /api/entry/:book/:id` — fetch a specific entry (e.g., `/api/entry/6/26`)
- `GET /api/random` — random entry

## Development

```bash
npm run dev       # Local development server
npm run deploy    # Deploy to Cloudflare Workers
```
