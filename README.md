# Stoic Sage

A personal semantic search engine for Stoic philosophy. Search *Meditations* by Marcus Aurelius and the *Enchiridion* by Epictetus by concept, retrieve exact entries, and get AI-powered explanations grounded in the text.

Built entirely on Cloudflare's free tier: Workers, D1, Vectorize, and Workers AI.

## Setup

```bash
npm install
npx wrangler login
npx wrangler d1 create stoic-sage-db  # Create the D1 database, update wrangler.jsonc with the ID
npm run dev                            # Start local dev server
```

## Usage

Visit [stoic-sage.vreeman.workers.dev](https://stoic-sage.vreeman.workers.dev) to explore Stoic philosophy. The homepage shows a daily reflection — the same entry for everyone, all day. Click "Show me another" for a random entry. Use the search box to find entries by concept (e.g., "anger", "desire", "virtue"), then click "Explain these results" for an AI-powered explanation grounded in the text. Results come from both the Meditations and the Enchiridion.

### API

- `GET /api/daily` — today's reflection (consistent within a day)
- `GET /api/search?q=...&topK=5` — semantic search across all entries
- `GET /api/entry/:book/:id?source=meditations` — fetch a specific entry (e.g., `/api/entry/6/26`)
- `GET /api/random` — random entry from any source
- `POST /api/explain` — AI explanation of search results (streamed SSE)

## Development

```bash
npm run dev       # Local development server
npm run deploy    # Deploy to Cloudflare Workers
```
