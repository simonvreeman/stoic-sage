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

## Development

```bash
npm run dev       # Local development server
npm run deploy    # Deploy to Cloudflare Workers
```
