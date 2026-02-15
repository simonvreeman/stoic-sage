import { Hono } from "hono";
import { cors } from "hono/cors";
import { selectDailyEntry, selectRandomEntry } from "./weighted-random";
import { notesApp } from "./notes";
import { searchEntriesHybrid } from "./search";

type Bindings = {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("/api/*", cors());

// Admin auth middleware — checks Authorization: Bearer <API_KEY>
app.use("/api/admin/*", async (c, next) => {
  const apiKey = c.env.API_KEY;
  if (!apiKey) {
    return c.json({ error: "Admin API not configured." }, 503);
  }
  const auth = c.req.header("Authorization");
  if (!auth || auth !== `Bearer ${apiKey}`) {
    return c.json({ error: "Unauthorized." }, 401);
  }
  await next();
});

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stoic Sage — Marcus Aurelius, Seneca &amp; Epictetus</title>
  <meta name="description" content="Semantic search through Stoic philosophy. Search the Meditations by Marcus Aurelius, On the Tranquillity of Mind and On the Shortness of Life by Seneca, and the Discourses, Enchiridion and Fragments by Epictetus, with AI-powered explanations.">
  <meta property="og:title" content="Stoic Sage">
  <meta property="og:description" content="Semantic search through Stoic philosophy. Meditations by Marcus Aurelius, Seneca's essays, Discourses, Enchiridion and Fragments by Epictetus. AI-powered explanations.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://stoicsage.ai">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Stoic Sage">
  <meta name="twitter:description" content="Semantic search through Stoic philosophy. Marcus Aurelius, Seneca and Epictetus.">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏛️</text></svg>">
  <style>
    :root {
      --sans-serif: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", "Liberation Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
      --serif: ui-serif, -apple-system-ui-serif, Palatino, Georgia, Cambria, "Times New Roman", Times, serif;
      --monospace: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Roboto Mono", "Liberation Mono", "Courier New", monospace;

      /* Palette */
      --eigengrau: #16161d;
      --blue-dark: #06c;
      --blue-light: #2997ff;
      --blue-lighter: #6bf;

      /* Light theme colors */
      --bg: #f5f5f7;
      --text: #16161d;
      --text-muted: #6e6e73;
      --text-faint: #86868b;
      --accent: #06c;
      --border: #d2d2d7;
      --border-light: #e5e5ea;
      --surface: #ffffff;
      --surface-alt: #f0f0f5;
      --surface-alt-border: #d2d2d7;
      --btn-hover: #e8e8ed;
      --error: #ff3b30;
      --input-placeholder: #aeaeb2;
      --focus-ring: rgba(0, 102, 204, 0.15);
    }

    /* Dark theme — follows system preference */
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #16161d;
        --text: #f0f0f5;
        --text-muted: #98989d;
        --text-faint: #636366;
        --accent: #2997ff;
        --border: #38383d;
        --border-light: #2c2c31;
        --surface: #1c1c21;
        --surface-alt: #222228;
        --surface-alt-border: #38383d;
        --btn-hover: #2c2c31;
        --error: #ff453a;
        --input-placeholder: #636366;
        --focus-ring: rgba(41, 151, 255, 0.2);
      }
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--sans-serif);
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
      font-weight: 600;
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
      box-shadow: 0 0 0 3px var(--focus-ring);
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
    .btn:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--focus-ring); }

    .entry {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .entry-text {
      font-family: var(--serif);
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
      font-family: var(--serif);
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

    footer a { color: var(--accent); text-decoration: none; transition: color 0.15s ease; }
    footer a:hover { text-decoration: underline; }

    .rating-bar { display: flex; justify-content: center; gap: 0.5rem; margin-top: 1rem; }
    .rating-btn {
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      font-family: var(--sans-serif);
      border: 1px solid var(--border-light);
      border-radius: 4px;
      background: transparent;
      color: var(--text-faint);
      cursor: pointer;
      transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    }
    .rating-btn:hover { color: var(--text-muted); border-color: var(--border); }
    .rating-btn.active { color: var(--accent); border-color: var(--accent); background: var(--focus-ring); }
    .rating-btn:disabled { cursor: default; opacity: 0.6; }
    .rating-btn:disabled:hover { color: var(--text-faint); border-color: var(--border-light); }
    .rating-btn.active:disabled { color: var(--accent); border-color: var(--accent); }
  </style>
</head>
<body>
  <div class="container">
    <h1>Stoic Sage</h1>
    <p class="subtitle">Marcus Aurelius, Seneca &amp; Epictetus</p>

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
      <a href="/notes">Notes</a> \u00B7
      <a href="https://vreeman.com/meditations">Meditations</a> (Gregory Hays) \u00B7 <a href="https://vreeman.com/seneca/on-the-tranquillity-of-mind">On the Tranquillity of Mind</a> \u00B7 <a href="https://vreeman.com/seneca/on-the-shortness-of-life">On the Shortness of Life</a> (Seneca) \u00B7 <a href="https://vreeman.com/discourses/">Discourses</a> \u00B7 <a href="https://vreeman.com/discourses/enchiridion">Enchiridion</a> \u00B7 <a href="https://vreeman.com/discourses/fragments">Fragments</a> (Robert Dobbin)
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
      if (entry.source === "seneca-tranquillity") return "On the Tranquillity of Mind " + entry.book + '.' + escapeHtml(String(entry.entry));
      if (entry.source === "seneca-shortness") return "On the Shortness of Life " + entry.book + '.' + escapeHtml(String(entry.entry));
      if (entry.source === "discourses") return "Discourses " + entry.book + '.' + escapeHtml(String(entry.entry));
      if (entry.source === "enchiridion") return "Enchiridion " + entry.book + '.' + escapeHtml(String(entry.entry));
      if (entry.source === "fragments") return "Fragments " + entry.book + '.' + escapeHtml(String(entry.entry));
      return "Meditations " + entry.book + '.' + escapeHtml(String(entry.entry));
    }

    function renderEntry(entry) {
      var attrs = '';
      if (entry.score != null) attrs += ' data-score="' + entry.score + '"';
      if (entry.weightedScore != null) attrs += ' data-weighted-score="' + entry.weightedScore + '"';
      if (entry.source) attrs += ' data-source="' + escapeHtml(entry.source) + '"';
      return '<div class="entry"' + attrs + '>'
        + '<div class="entry-text">' + escapeHtml(entry.text) + '</div>'
        + '<div class="entry-citation">' + formatCitation(entry) + '</div>'
        + '</div>';
    }

    function renderRatingBar(viewId, existingRating) {
      var labels = { 1: "Didn\\u2019t resonate", 2: "Interesting", 3: "Deeply resonated" };
      var html = '<div class="rating-bar" data-view-id="' + viewId + '">';
      for (var r = 1; r <= 3; r++) {
        var cls = "rating-btn";
        var disabled = "";
        if (existingRating === r) { cls += " active"; disabled = " disabled"; }
        else if (existingRating != null) { disabled = " disabled"; }
        html += '<button class="' + cls + '" data-rating="' + r + '"' + disabled + '>' + labels[r] + '</button>';
      }
      return html + '</div>';
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
        var ratingBar = entry.viewId ? renderRatingBar(entry.viewId, entry.rating) : "";
        resultsEl.innerHTML = '<p class="daily-label">Today\\u2019s reflection</p>' + renderEntry(entry) + ratingBar;
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
        var ratingBar = entry.viewId ? renderRatingBar(entry.viewId, null) : "";
        resultsEl.innerHTML = renderEntry(entry) + ratingBar;
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
        return;
      }
      var btn = e.target && e.target.closest ? e.target.closest(".rating-btn") : null;
      if (btn && !btn.disabled) {
        var bar = btn.closest(".rating-bar");
        var viewId = bar.dataset.viewId;
        var rating = parseInt(btn.dataset.rating);
        var allBtns = bar.querySelectorAll(".rating-btn");
        allBtns.forEach(function(b) { b.disabled = true; });
        btn.classList.add("active");
        fetch("/api/views/" + viewId + "/rating", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: rating })
        }).catch(function() {
          allBtns.forEach(function(b) { b.disabled = false; });
          btn.classList.remove("active");
        });
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

const VALID_SOURCES = ["meditations", "discourses", "enchiridion", "fragments", "seneca-tranquillity", "seneca-shortness"];

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
  const rawQuery = c.req.query("q");
  if (!rawQuery || !rawQuery.trim()) {
    return c.json({ error: "Query parameter 'q' is required." }, 400);
  }

  const topK = Math.min(Math.max(parseInt(c.req.query("topK") || "5", 10) || 5, 1), 20);
  const query = rawQuery.trim().slice(0, 500);
  const results = await searchEntriesHybrid(c.env, query, { topK });
  return c.json({ results });
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

  // Input limits to prevent abuse of LLM context
  const query = body.query.slice(0, 500);
  const entries = body.entries.slice(0, 10);

  const sourceLabels: Record<string, string> = {
    meditations: "Meditations",
    "seneca-tranquillity": "On the Tranquillity of Mind",
    "seneca-shortness": "On the Shortness of Life",
    discourses: "Discourses",
    enchiridion: "Enchiridion",
    fragments: "Fragments",
  };

  const entriesContext = entries
    .map((e) => {
      const label = sourceLabels[e.source || "meditations"] || "Meditations";
      return `[${label} ${e.book}.${e.entry}] ${e.text}`;
    })
    .join("\n\n");

  const hasMeditations = entries.some((e) => !e.source || e.source === "meditations");
  const hasSenecaTranquillity = entries.some((e) => e.source === "seneca-tranquillity");
  const hasSenecaShortness = entries.some((e) => e.source === "seneca-shortness");
  const hasDiscourses = entries.some((e) => e.source === "discourses");
  const hasEnchiridion = entries.some((e) => e.source === "enchiridion");
  const hasFragments = entries.some((e) => e.source === "fragments");
  const authors = [
    hasMeditations ? "Marcus Aurelius (Meditations)" : "",
    hasSenecaTranquillity ? "Seneca (On the Tranquillity of Mind)" : "",
    hasSenecaShortness ? "Seneca (On the Shortness of Life)" : "",
    hasDiscourses ? "Epictetus (Discourses)" : "",
    hasEnchiridion ? "Epictetus (Enchiridion)" : "",
    hasFragments ? "Epictetus (Fragments)" : "",
  ].filter(Boolean).join(" and ");

  const systemPrompt = `You are Stoic Sage, a concise guide to Stoic philosophy from ${authors}.

RULES:
- ONLY use the entries provided below. Never invent or assume content not present.
- Cite entries by source and number (e.g., "In Meditations 6.26, Marcus writes...", "In On the Tranquillity of Mind 2.1, Seneca advises...", "In On the Shortness of Life 1.3, Seneca argues...", "In Discourses 1.1.1, Epictetus teaches...", "In Enchiridion 1.5, Epictetus says...", or "In Fragments 8, Epictetus states...").
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
          content: `Explain what the Stoic philosophers say about: ${query}`,
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
  // Date-seeded hash for deterministic daily selection
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = (hash * 31 + today.charCodeAt(i)) | 0;
  }

  // Query with view stats for spaced repetition weighting
  // Exclude today's views so the seeded selection stays stable all day
  const allEntries = await c.env.DB.prepare(
    `SELECT e.id, e.source, e.marked,
            COUNT(ev.id) as view_count,
            MAX(ev.viewed_at) as last_seen,
            (SELECT AVG(rating) FROM (
              SELECT rating FROM entry_views
              WHERE entry_id = e.id AND rating IS NOT NULL
              ORDER BY viewed_at DESC LIMIT 3
            )) as avg_rating
     FROM entries e
     LEFT JOIN entry_views ev ON e.id = ev.entry_id AND ev.viewed_at < ?
     WHERE e.reflectable = 1
     GROUP BY e.id`,
  )
    .bind(today)
    .all<{
      id: number;
      source: string;
      marked: number;
      view_count: number;
      last_seen: string | null;
      avg_rating: number | null;
    }>();

  if (!allEntries.results || allEntries.results.length === 0) {
    return c.json({ error: "No entries found." }, 500);
  }

  // Weighted random selection using date seed (same entry all day)
  const selectedId = selectDailyEntry(allEntries.results, hash);

  const row = await c.env.DB.prepare(
    "SELECT source, book, entry, text FROM entries WHERE id = ?",
  )
    .bind(selectedId)
    .first();

  if (!row) {
    return c.json({ error: "Entry not found." }, 500);
  }

  // Record view (at most once per day per entry)
  const existingView = await c.env.DB.prepare(
    "SELECT id, rating FROM entry_views WHERE entry_id = ? AND view_type = 'daily' AND viewed_at >= ?",
  )
    .bind(selectedId, today)
    .first<{ id: number; rating: number | null }>();

  let viewId: number;
  let existingRating: number | null = null;

  if (existingView) {
    viewId = existingView.id;
    existingRating = existingView.rating;
  } else {
    const viewResult = await c.env.DB.prepare(
      "INSERT INTO entry_views (entry_id, view_type) VALUES (?, 'daily')",
    )
      .bind(selectedId)
      .run();
    viewId = viewResult.meta.last_row_id as number;
  }

  c.header("Cache-Control", "no-store");
  return c.json({ ...row, viewId, rating: existingRating });
});

app.get("/api/random", async (c) => {
  // Query with view stats for spaced repetition weighting
  const allEntries = await c.env.DB.prepare(
    `SELECT e.id, e.source, e.marked,
            COUNT(ev.id) as view_count,
            MAX(ev.viewed_at) as last_seen,
            (SELECT AVG(rating) FROM (
              SELECT rating FROM entry_views
              WHERE entry_id = e.id AND rating IS NOT NULL
              ORDER BY viewed_at DESC LIMIT 3
            )) as avg_rating
     FROM entries e
     LEFT JOIN entry_views ev ON e.id = ev.entry_id
     WHERE e.reflectable = 1
     GROUP BY e.id`,
  ).all<{
    id: number;
    source: string;
    marked: number;
    view_count: number;
    last_seen: string | null;
    avg_rating: number | null;
  }>();

  if (!allEntries.results || allEntries.results.length === 0) {
    return c.json({ error: "No entries found." }, 500);
  }

  // Weighted random selection (unseeded — different each call)
  const selectedId = selectRandomEntry(allEntries.results);

  const row = await c.env.DB.prepare(
    "SELECT source, book, entry, text FROM entries WHERE id = ?",
  )
    .bind(selectedId)
    .first();

  if (!row) {
    return c.json({ error: "Entry not found." }, 500);
  }

  // Record view
  const viewResult = await c.env.DB.prepare(
    "INSERT INTO entry_views (entry_id, view_type) VALUES (?, 'random')",
  )
    .bind(selectedId)
    .run();
  const viewId = viewResult.meta.last_row_id as number;

  c.header("Cache-Control", "no-store");
  return c.json({ ...row, viewId });
});

// ---------------------------------------------------------------------------
// Rating route (no auth — personal tool)
// ---------------------------------------------------------------------------

app.put("/api/views/:viewId/rating", async (c) => {
  const viewId = parseInt(c.req.param("viewId"), 10);
  if (isNaN(viewId) || viewId < 1) {
    return c.json({ error: "Invalid view ID." }, 400);
  }

  const body = await c.req.json<{ rating: number }>();
  if (![1, 2, 3].includes(body.rating)) {
    return c.json({ error: "Rating must be 1, 2, or 3." }, 400);
  }

  const result = await c.env.DB.prepare(
    "UPDATE entry_views SET rating = ? WHERE id = ?",
  )
    .bind(body.rating, viewId)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "View not found." }, 404);
  }

  return c.json({ viewId, rating: body.rating });
});

// ---------------------------------------------------------------------------
// Admin routes (protected by API_KEY via middleware above)
// ---------------------------------------------------------------------------

app.put("/api/admin/entry/:source/:book/:entry/reflectable", async (c) => {
  const source = c.req.param("source");
  const book = parseInt(c.req.param("book"), 10);
  const entry = c.req.param("entry");

  if (!VALID_SOURCES.includes(source)) {
    return c.json(
      {
        error: `Invalid source. Must be one of: ${VALID_SOURCES.join(", ")}`,
      },
      400,
    );
  }
  if (isNaN(book) || book < 1) {
    return c.json({ error: "Invalid book number." }, 400);
  }

  const body = await c.req.json<{ reflectable: boolean }>();
  if (typeof body.reflectable !== "boolean") {
    return c.json(
      { error: "Body must include 'reflectable' as boolean." },
      400,
    );
  }

  const result = await c.env.DB.prepare(
    "UPDATE entries SET reflectable = ? WHERE source = ? AND book = ? AND entry = ?",
  )
    .bind(body.reflectable ? 1 : 0, source, book, entry)
    .run();

  if (result.meta.changes === 0) {
    return c.json(
      { error: `Entry ${source} ${book}.${entry} not found.` },
      404,
    );
  }

  return c.json({ source, book, entry, reflectable: body.reflectable });
});

app.get("/api/admin/entries", async (c) => {
  const reflectable = c.req.query("reflectable");

  let query = "SELECT source, book, entry, text, reflectable FROM entries";
  if (reflectable === "false") {
    query += " WHERE reflectable = 0";
  } else if (reflectable === "true") {
    query += " WHERE reflectable = 1";
  }
  query += " ORDER BY source, book, entry";

  const rows = await c.env.DB.prepare(query).all();
  return c.json({ entries: rows.results, count: rows.results?.length || 0 });
});

app.get("/api/admin/stats/views", async (c) => {
  const [overview, ratingDist, bySource, topRated, lowRated] =
    await Promise.all([
      c.env.DB.prepare(
        `SELECT
           COUNT(*) as totalViews,
           COUNT(DISTINCT entry_id) as uniqueEntriesSeen,
           (SELECT COUNT(*) FROM entries WHERE reflectable = 1) -
             COUNT(DISTINCT entry_id) as entriesNeverSeen
         FROM entry_views`,
      ).first<{
        totalViews: number;
        uniqueEntriesSeen: number;
        entriesNeverSeen: number;
      }>(),

      c.env.DB.prepare(
        "SELECT rating, COUNT(*) as count FROM entry_views WHERE rating IS NOT NULL GROUP BY rating",
      ).all<{ rating: number; count: number }>(),

      c.env.DB.prepare(
        `SELECT e.source, ROUND(AVG(ev.rating), 2) as avgRating, COUNT(ev.rating) as ratingCount
         FROM entry_views ev
         JOIN entries e ON e.id = ev.entry_id
         WHERE ev.rating IS NOT NULL
         GROUP BY e.source`,
      ).all<{ source: string; avgRating: number; ratingCount: number }>(),

      c.env.DB.prepare(
        `SELECT e.source, e.book, e.entry, ROUND(AVG(ev.rating), 2) as avgRating, COUNT(ev.rating) as ratingCount
         FROM entry_views ev
         JOIN entries e ON e.id = ev.entry_id
         WHERE ev.rating IS NOT NULL
         GROUP BY ev.entry_id
         HAVING ratingCount >= 1
         ORDER BY avgRating DESC, ratingCount DESC
         LIMIT 10`,
      ).all<{
        source: string;
        book: number;
        entry: string;
        avgRating: number;
        ratingCount: number;
      }>(),

      c.env.DB.prepare(
        `SELECT e.source, e.book, e.entry, ROUND(AVG(ev.rating), 2) as avgRating, COUNT(ev.rating) as ratingCount
         FROM entry_views ev
         JOIN entries e ON e.id = ev.entry_id
         WHERE ev.rating IS NOT NULL
         GROUP BY ev.entry_id
         HAVING avgRating <= 1.5 AND ratingCount >= 1
         ORDER BY avgRating ASC
         LIMIT 10`,
      ).all<{
        source: string;
        book: number;
        entry: string;
        avgRating: number;
        ratingCount: number;
      }>(),
    ]);

  const ratingDistribution: Record<string, number> = {};
  for (const row of ratingDist.results || []) {
    ratingDistribution[String(row.rating)] = row.count;
  }

  const avgRatingBySource: Record<string, number> = {};
  for (const row of bySource.results || []) {
    avgRatingBySource[row.source] = row.avgRating;
  }

  return c.json({
    ...overview,
    ratingDistribution,
    avgRatingBySource,
    topRated: topRated.results || [],
    lowRated: lowRated.results || [],
  });
});

// ---------------------------------------------------------------------------
// Notes — thematic pages at /notes/:slug
// ---------------------------------------------------------------------------

app.route("/notes", notesApp);

export default app;
