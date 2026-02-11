import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("/api/*", cors());

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stoic Sage — Meditations &amp; Discourses</title>
  <meta name="description" content="Semantic search through Stoic philosophy. Search the Meditations by Marcus Aurelius, and the Discourses, Enchiridion and Fragments by Epictetus, with AI-powered explanations.">
  <meta property="og:title" content="Stoic Sage">
  <meta property="og:description" content="Semantic search through Stoic philosophy. Meditations by Marcus Aurelius, Discourses, Enchiridion and Fragments by Epictetus. AI-powered explanations.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://stoicsage.ai">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Stoic Sage">
  <meta name="twitter:description" content="Semantic search through Stoic philosophy. Meditations, Discourses, Enchiridion and Fragments.">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏛️</text></svg>">
  <style>
    :root {
      --sans-serif: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", "Liberation Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
      --serif: ui-serif, -apple-system-ui-serif, Palatino, Georgia, Cambria, "Times New Roman", Times, serif;
      --monospace: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Roboto Mono", "Liberation Mono", "Courier New", monospace;

      /* Light theme colors */
      --bg: #faf9f6;
      --text: #2c2c2c;
      --text-muted: #6b6b6b;
      --text-faint: #aaa;
      --accent: #8b7355;
      --border: #ccc;
      --border-light: #e8e4de;
      --surface: #fff;
      --surface-alt: #f5f1eb;
      --surface-alt-border: #e0d9ce;
      --btn-hover: #f0ede8;
      --error: #b44;
      --input-placeholder: #aaa;
    }

    /* Dark theme — follows system preference */
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1a1a1a;
        --text: #e0ddd5;
        --text-muted: #9a968e;
        --text-faint: #6b6760;
        --accent: #c4a67a;
        --border: #3a3835;
        --border-light: #2e2c28;
        --surface: #242220;
        --surface-alt: #2a2826;
        --surface-alt-border: #3a3835;
        --btn-hover: #333028;
        --error: #d66;
        --input-placeholder: #6b6760;
      }
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--serif);
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem;
    }

    .container {
      max-width: 640px;
      width: 100%;
    }

    h1 {
      font-size: 1.75rem;
      font-weight: 400;
      text-align: center;
      margin-bottom: 0.25rem;
      letter-spacing: 0.02em;
    }

    .subtitle {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-bottom: 2rem;
    }

    .search-form {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 2rem;
    }

    .search-input {
      flex: 1;
      padding: 0.6rem 0.9rem;
      font-family: inherit;
      font-size: 1rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--surface);
      color: var(--text);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--accent);
    }

    .search-input::placeholder { color: var(--input-placeholder); }

    .btn {
      padding: 0.6rem 1rem;
      font-family: var(--sans-serif);
      font-size: 0.875rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      white-space: nowrap;
    }

    .btn:hover { background: var(--btn-hover); }

    .entry {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: 6px;
    }

    .entry-text {
      font-size: 1.1rem;
      line-height: 1.7;
      white-space: pre-wrap;
    }

    .entry-citation {
      margin-top: 1rem;
      font-size: 0.85rem;
      color: var(--accent);
      font-style: italic;
    }

    .results-heading {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 1rem;
      font-family: var(--sans-serif);
    }

    .loading {
      text-align: center;
      color: var(--text-faint);
      padding: 2rem;
      font-style: italic;
    }

    .error {
      text-align: center;
      color: var(--error);
      padding: 2rem;
    }

    .actions {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 2rem;
    }

    .explain-box {
      margin-top: 1rem;
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: var(--surface-alt);
      border: 1px solid var(--surface-alt-border);
      border-radius: 6px;
    }

    .explain-label {
      font-family: var(--sans-serif);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent);
      margin-bottom: 0.75rem;
    }

    .explain-text {
      font-size: 1rem;
      line-height: 1.7;
      white-space: pre-wrap;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .daily-label {
      font-family: var(--sans-serif);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent);
      text-align: center;
      margin-bottom: 0.75rem;
    }

    .fade-in {
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    footer {
      margin-top: 3rem;
      text-align: center;
      font-family: var(--sans-serif);
      font-size: 0.75rem;
      color: var(--text-faint);
    }

    footer a { color: var(--accent); text-decoration: none; }
    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Stoic Sage</h1>
    <p class="subtitle">Meditations &amp; Discourses</p>

    <form class="search-form" id="search-form">
      <input
        class="search-input"
        type="text"
        id="search-input"
        placeholder="Search Stoic philosophy\u2026"
        autocomplete="off"
      >
      <button class="btn" type="submit">Search</button>
    </form>

    <div class="actions">
      <button class="btn" id="random-btn">Show me another</button>
    </div>

    <div id="results"></div>

    <footer>
      <a href="https://vreeman.com/meditations">Meditations</a> (Gregory Hays) \u00B7 <a href="https://vreeman.com/discourses/">Discourses</a> \u00B7 <a href="https://vreeman.com/discourses/enchiridion">Enchiridion</a> \u00B7 <a href="https://vreeman.com/discourses/fragments">Fragments</a> (Robert Dobbin)
    </footer>
  </div>

  <script>
    const resultsEl = document.getElementById("results");
    const searchForm = document.getElementById("search-form");
    const searchInput = document.getElementById("search-input");
    const randomBtn = document.getElementById("random-btn");

    var lastQuery = "";
    var lastEntries = [];

    function formatCitation(entry) {
      if (entry.source === "discourses") return "Discourses " + entry.book + '.' + escapeHtml(String(entry.entry));
      if (entry.source === "enchiridion") return "Enchiridion " + entry.book + '.' + escapeHtml(String(entry.entry));
      if (entry.source === "fragments") return "Fragments " + entry.book + '.' + escapeHtml(String(entry.entry));
      return "Meditations " + entry.book + '.' + escapeHtml(String(entry.entry));
    }

    function renderEntry(entry) {
      return '<div class="entry">'
        + '<div class="entry-text">' + escapeHtml(entry.text) + '</div>'
        + '<div class="entry-citation">' + formatCitation(entry) + '</div>'
        + '</div>';
    }

    function escapeHtml(str) {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function showLoading() {
      resultsEl.classList.remove("fade-in");
      resultsEl.innerHTML = '<div class="loading">Loading\u2026</div>';
    }

    function showError(msg) {
      resultsEl.innerHTML = '<div class="error">' + escapeHtml(msg) + '</div>';
    }

    async function loadDaily() {
      showLoading();
      try {
        var res = await fetch("/api/daily");
        if (!res.ok) throw new Error("Failed to load entry");
        var entry = await res.json();
        resultsEl.innerHTML = '<p class="daily-label">Today\\u2019s reflection</p>' + renderEntry(entry);
        resultsEl.classList.add("fade-in");
      } catch (err) {
        showError(err.message);
      }
    }

    async function loadRandom() {
      lastQuery = "";
      lastEntries = [];
      showLoading();
      try {
        var res = await fetch("/api/random");
        if (!res.ok) throw new Error("Failed to load entry");
        var entry = await res.json();
        resultsEl.innerHTML = renderEntry(entry);
        resultsEl.classList.add("fade-in");
      } catch (err) {
        showError(err.message);
      }
    }

    async function doSearch(q) {
      lastQuery = q;
      lastEntries = [];
      showLoading();
      try {
        var res = await fetch("/api/search?q=" + encodeURIComponent(q));
        if (!res.ok) throw new Error("Search failed");
        var data = await res.json();
        if (!data.results || data.results.length === 0) {
          resultsEl.innerHTML = '<div class="loading">No results found.</div>';
          return;
        }
        lastEntries = data.results;
        var heading = '<p class="results-heading">' + data.results.length + ' results for \\u201c' + escapeHtml(q) + '\\u201d</p>';
        var explainBtn = '<div class="actions"><button class="btn" id="explain-btn">Explain these results</button></div>';
        resultsEl.innerHTML = heading + data.results.map(renderEntry).join("") + explainBtn + '<div id="explain-container"></div>';
        resultsEl.classList.add("fade-in");
      } catch (err) {
        showError(err.message);
      }
    }

    async function doExplain() {
      if (!lastQuery || lastEntries.length === 0) return;
      var btn = document.getElementById("explain-btn");
      if (btn) { btn.disabled = true; btn.textContent = "Explaining\u2026"; }
      var container = document.getElementById("explain-container");
      container.innerHTML = '<div class="explain-box"><p class="explain-label">AI Explanation</p><div class="explain-text" id="explain-text">Thinking\u2026</div></div>';
      var explainText = document.getElementById("explain-text");

      try {
        var res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: lastQuery,
            entries: lastEntries.map(function(e) { return { source: e.source, book: e.book, entry: e.entry, text: e.text }; })
          })
        });
        if (!res.ok) throw new Error("Explain failed");

        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var text = "";
        var buffer = "";

        while (true) {
          var chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          var lines = buffer.split("\\n");
          buffer = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line.startsWith("data: ")) continue;
            var payload = line.slice(6);
            if (payload === "[DONE]") continue;
            try {
              var parsed = JSON.parse(payload);
              if (parsed.response) text += parsed.response;
            } catch(e) {}
          }
          explainText.textContent = text || "Thinking\u2026";
        }
        if (!text) explainText.textContent = "No explanation generated.";
      } catch (err) {
        explainText.textContent = "Error: " + err.message;
      }
      if (btn) { btn.disabled = false; btn.textContent = "Explain these results"; }
    }

    resultsEl.addEventListener("click", function(e) {
      if (e.target && e.target.id === "explain-btn") {
        doExplain();
      }
    });

    searchForm.addEventListener("submit", function(e) {
      e.preventDefault();
      var q = searchInput.value.trim();
      if (!q) return;
      doSearch(q);
    });

    randomBtn.addEventListener("click", loadRandom);

    loadDaily();
  </script>
</body>
</html>`;

app.get("/", (c) => {
  return c.html(html);
});

const VALID_SOURCES = ["meditations", "discourses", "enchiridion", "fragments"];

app.get("/api/entry/:book/:id", async (c) => {
  const bookParam = c.req.param("book");
  const entryId = c.req.param("id");
  const source = c.req.query("source") || "meditations";

  if (!VALID_SOURCES.includes(source)) {
    return c.json({ error: `Invalid source. Must be one of: ${VALID_SOURCES.join(", ")}` }, 400);
  }

  const book = parseInt(bookParam, 10);
  if (isNaN(book) || book < 1) {
    return c.json({ error: "Invalid book/chapter number." }, 400);
  }

  const row = await c.env.DB.prepare(
    "SELECT source, book, entry, text FROM entries WHERE source = ? AND book = ? AND entry = ?",
  )
    .bind(source, book, entryId)
    .first();

  if (!row) {
    return c.json({ error: `Entry ${source} ${book}.${entryId} not found.` }, 404);
  }

  return c.json(row);
});

app.get("/api/search", async (c) => {
  const query = c.req.query("q");
  if (!query || !query.trim()) {
    return c.json({ error: "Query parameter 'q' is required." }, 400);
  }

  const topK = Math.min(Math.max(parseInt(c.req.query("topK") || "5", 10) || 5, 1), 20);

  // Embed the query
  const embeddingResult = await c.env.AI.run("@cf/baai/bge-base-en-v1.5", {
    text: [query.trim()],
  });

  const queryVector = embeddingResult.data[0];

  // Search Vectorize
  const vectorResults = await c.env.VECTORIZE.query(queryVector, {
    topK,
    returnMetadata: "all",
  });

  if (!vectorResults.matches || vectorResults.matches.length === 0) {
    return c.json({ results: [] });
  }

  // Fetch full text from D1 for each match
  const results = await Promise.all(
    vectorResults.matches.map(async (match) => {
      const meta = match.metadata as { source: string; book: number; entry: string };
      const source = meta.source || "meditations";
      const row = await c.env.DB.prepare(
        "SELECT source, book, entry, text FROM entries WHERE source = ? AND book = ? AND entry = ?",
      )
        .bind(source, meta.book, meta.entry)
        .first();

      return row
        ? { source: row.source, book: row.book, entry: row.entry, text: row.text, score: match.score }
        : null;
    }),
  );

  // Deduplicate by source+book+entry (old vectors without source prefix may duplicate new ones)
  const seen = new Set<string>();
  const deduped = results.filter((r) => {
    if (!r) return false;
    const key = `${r.source}-${r.book}-${r.entry}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return c.json({ results: deduped });
});

app.post("/api/explain", async (c) => {
  const body = await c.req.json<{
    query: string;
    entries: { source?: string; book: number; entry: string; text: string }[];
  }>();

  if (!body.query || !body.entries || body.entries.length === 0) {
    return c.json(
      { error: "Request body must include 'query' and 'entries'." },
      400,
    );
  }

  const sourceLabels: Record<string, string> = {
    meditations: "Meditations",
    discourses: "Discourses",
    enchiridion: "Enchiridion",
    fragments: "Fragments",
  };

  const entriesContext = body.entries
    .map((e) => {
      const label = sourceLabels[e.source || "meditations"] || "Meditations";
      return `[${label} ${e.book}.${e.entry}] ${e.text}`;
    })
    .join("\n\n");

  const hasMeditations = body.entries.some((e) => !e.source || e.source === "meditations");
  const hasDiscourses = body.entries.some((e) => e.source === "discourses");
  const hasEnchiridion = body.entries.some((e) => e.source === "enchiridion");
  const hasFragments = body.entries.some((e) => e.source === "fragments");
  const authors = [
    hasMeditations ? "Marcus Aurelius (Meditations)" : "",
    hasDiscourses ? "Epictetus (Discourses)" : "",
    hasEnchiridion ? "Epictetus (Enchiridion)" : "",
    hasFragments ? "Epictetus (Fragments)" : "",
  ].filter(Boolean).join(" and ");

  const systemPrompt = `You are Stoic Sage, a concise guide to Stoic philosophy from ${authors}.

RULES:
- ONLY use the entries provided below. Never invent or assume content not present.
- Cite entries by source and number (e.g., "In Meditations 6.26, Marcus writes...", "In Discourses 1.1.1, Epictetus teaches...", "In Enchiridion 1.5, Epictetus says...", or "In Fragments 8, Epictetus states...").
- Quote short phrases directly from the text when relevant.
- Keep your explanation concise: 2-4 short paragraphs.
- Write in plain, modern English.
- Do not add Stoic philosophy beyond what the entries contain.

ENTRIES:
${entriesContext}`;

  const stream = await c.env.AI.run(
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    {
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Explain what the Stoic philosophers say about: ${body.query}`,
        },
      ],
      stream: true,
    },
  );

  return new Response(stream as ReadableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

app.get("/api/daily", async (c) => {
  // Use today's date as a seed for consistent daily entry
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = (hash * 31 + today.charCodeAt(i)) | 0;
  }

  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) as total FROM entries",
  ).first<{ total: number }>();

  const total = count?.total || 1336;
  const offset = ((hash % total) + total) % total;

  const row = await c.env.DB.prepare(
    "SELECT source, book, entry, text FROM entries LIMIT 1 OFFSET ?",
  )
    .bind(offset)
    .first();

  if (!row) {
    return c.json({ error: "No entries found." }, 500);
  }

  c.header("Cache-Control", "public, max-age=3600");
  return c.json(row);
});

app.get("/api/random", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT source, book, entry, text FROM entries ORDER BY RANDOM() LIMIT 1",
  ).first();

  if (!row) {
    return c.json({ error: "No entries found." }, 500);
  }

  c.header("Cache-Control", "no-store");
  return c.json(row);
});

export default app;
