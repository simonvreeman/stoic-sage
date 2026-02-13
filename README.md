# Stoic Sage

A personal semantic search engine for Stoic philosophy. Search *Meditations* by Marcus Aurelius, and the *Discourses*, *Enchiridion* and *Fragments* by Epictetus by concept, retrieve exact entries, and get AI-powered explanations grounded in the text.

Built entirely on Cloudflare's free tier: Workers, D1, Vectorize, and Workers AI.

## Setup

```bash
npm install
npx wrangler login
npx wrangler d1 create stoic-sage-db  # Create the D1 database, update wrangler.jsonc with the ID
npm run dev                            # Start local dev server
```

## Usage

Visit [stoicsage.ai](https://stoicsage.ai) to explore Stoic philosophy. The homepage shows a daily reflection — the same entry for everyone, all day. Click "Show me another" for a random entry. Use the search box to find entries by concept (e.g., "anger", "desire", "virtue"), then click "Explain these results" for an AI-powered explanation grounded in the text. Results come from the Meditations, Discourses, Enchiridion, and Fragments. Supports dark mode — automatically follows your system preference.

### API

- `GET /api/daily` — today's reflection (consistent within a day)
- `GET /api/search?q=...&topK=5` — semantic search across all entries
- `GET /api/entry/:book/:id?source=meditations` — fetch a specific entry (e.g., `/api/entry/6/26`)
- `GET /api/random` — random entry from any source
- `POST /api/explain` — AI explanation of search results (streamed SSE)

### Admin API

The admin routes manage the **reflectable** flag on entries. Entries with `reflectable = 0` are excluded from the daily reflection and random endpoints, keeping cryptic fragments and mid-argument dialogue out of the reflection pool. Search and entry lookup are unaffected.

All admin routes require an `API_KEY` secret set on the Worker:

```bash
npx wrangler secret put API_KEY
```

Pass the key in every request as a Bearer token:

```
Authorization: Bearer <your-api-key>
```

#### List entries by reflectable status

```bash
# Show all excluded entries
curl -H "Authorization: Bearer $API_KEY" \
  "https://stoicsage.ai/api/admin/entries?reflectable=false"

# Show all included entries
curl -H "Authorization: Bearer $API_KEY" \
  "https://stoicsage.ai/api/admin/entries?reflectable=true"

# Show all entries (no filter)
curl -H "Authorization: Bearer $API_KEY" \
  "https://stoicsage.ai/api/admin/entries"
```

Response:

```json
{
  "entries": [
    { "source": "meditations", "book": 7, "entry": "12", "text": "Straight, not straightened.", "reflectable": 0 }
  ],
  "count": 32
}
```

#### Exclude an entry from reflections

```bash
curl -X PUT \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reflectable": false}' \
  "https://stoicsage.ai/api/admin/entry/meditations/7/12/reflectable"
```

The URL path is `/api/admin/entry/:source/:book/:entry/reflectable`. Valid sources: `meditations`, `discourses`, `enchiridion`, `fragments`.

#### Re-include an entry

```bash
curl -X PUT \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reflectable": true}' \
  "https://stoicsage.ai/api/admin/entry/meditations/7/12/reflectable"
```

Response:

```json
{ "source": "meditations", "book": 7, "entry": "12", "reflectable": true }
```

#### Bulk reset

To reset all reflectable flags to their scripted defaults, re-run the seed script:

```bash
npx tsx scripts/set-reflectable.ts          # remote
npx tsx scripts/set-reflectable.ts --local  # local
```

This resets every entry to `reflectable = 1`, then re-applies the exclusion rules (short fragments under 10 words and manually listed mid-argument continuations). Any manual toggles made via the admin API will be overwritten.

### Notes

Thematic pages at `/notes/:slug` curate Stoic entries around a specific topic — anxiety, anger, grief, resilience, relationships, daily practice, work, control, the four virtues, the evolution of Stoicism, the Stoic mindset, the main goal of Stoicism, leadership, Gen Z, impermanence, Marcus Aurelius on virtue, community, the mind, amor fati, and book recommendations. Each page runs semantic search against Vectorize at request time to find the most relevant passages, renders FAQ structured data (JSON-LD) for SEO, and links to related notes. Some notes pin specific entries to always appear first (e.g., Meditations 3.6 on the Four Stoic Virtues page, where Marcus Aurelius names all four virtues by name).

- `GET /notes` — index of all thematic pages
- `GET /notes/:slug` — individual note (e.g., `/notes/the-four-stoic-virtues`)

## Development

```bash
npm run dev       # Local development server
npm run deploy    # Deploy to Cloudflare Workers
```
