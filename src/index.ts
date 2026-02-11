import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("/api/*", cors());

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stoic Sage — Meditations by Marcus Aurelius</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Georgia, "Times New Roman", serif;
      background: #faf9f6;
      color: #2c2c2c;
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
      color: #6b6b6b;
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
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #fff;
      color: #2c2c2c;
    }

    .search-input:focus {
      outline: none;
      border-color: #8b7355;
    }

    .search-input::placeholder { color: #aaa; }

    .btn {
      padding: 0.6rem 1rem;
      font-family: -apple-system, system-ui, sans-serif;
      font-size: 0.875rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #fff;
      color: #2c2c2c;
      cursor: pointer;
      white-space: nowrap;
    }

    .btn:hover { background: #f0ede8; }

    .entry {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: #fff;
      border: 1px solid #e8e4de;
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
      color: #8b7355;
      font-style: italic;
    }

    .results-heading {
      font-size: 0.85rem;
      color: #6b6b6b;
      margin-bottom: 1rem;
      font-family: -apple-system, system-ui, sans-serif;
    }

    .loading {
      text-align: center;
      color: #aaa;
      padding: 2rem;
      font-style: italic;
    }

    .error {
      text-align: center;
      color: #b44;
      padding: 2rem;
    }

    .actions {
      display: flex;
      justify-content: center;
      margin-bottom: 2rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Stoic Sage</h1>
    <p class="subtitle">Meditations by Marcus Aurelius</p>

    <form class="search-form" id="search-form">
      <input
        class="search-input"
        type="text"
        id="search-input"
        placeholder="Search the Meditations\u2026"
        autocomplete="off"
      >
      <button class="btn" type="submit">Search</button>
    </form>

    <div class="actions">
      <button class="btn" id="random-btn">Show me another</button>
    </div>

    <div id="results"></div>
  </div>

  <script>
    const resultsEl = document.getElementById("results");
    const searchForm = document.getElementById("search-form");
    const searchInput = document.getElementById("search-input");
    const randomBtn = document.getElementById("random-btn");

    function renderEntry(entry) {
      return '<div class="entry">'
        + '<div class="entry-text">' + escapeHtml(entry.text) + '</div>'
        + '<div class="entry-citation">Meditations ' + entry.book + '.' + escapeHtml(String(entry.entry)) + '</div>'
        + '</div>';
    }

    function escapeHtml(str) {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function showLoading() {
      resultsEl.innerHTML = '<div class="loading">Loading\u2026</div>';
    }

    function showError(msg) {
      resultsEl.innerHTML = '<div class="error">' + escapeHtml(msg) + '</div>';
    }

    async function loadRandom() {
      showLoading();
      try {
        const res = await fetch("/api/random");
        if (!res.ok) throw new Error("Failed to load entry");
        const entry = await res.json();
        resultsEl.innerHTML = renderEntry(entry);
      } catch (err) {
        showError(err.message);
      }
    }

    searchForm.addEventListener("submit", function(e) {
      e.preventDefault();
      var q = searchInput.value.trim();
      if (!q) return;
      resultsEl.innerHTML = '<div class="loading">Search coming soon in Phase 2\u2026</div>';
    });

    randomBtn.addEventListener("click", loadRandom);

    loadRandom();
  </script>
</body>
</html>`;

app.get("/", (c) => {
  return c.html(html);
});

app.get("/api/entry/:book/:id", async (c) => {
  const bookParam = c.req.param("book");
  const entryId = c.req.param("id");

  const book = parseInt(bookParam, 10);
  if (isNaN(book) || book < 1 || book > 12) {
    return c.json({ error: "Invalid book number. Must be 1-12." }, 400);
  }

  const row = await c.env.DB.prepare(
    "SELECT book, entry, text FROM entries WHERE book = ? AND entry = ?",
  )
    .bind(book, entryId)
    .first();

  if (!row) {
    return c.json({ error: `Entry ${book}.${entryId} not found.` }, 404);
  }

  return c.json(row);
});

app.get("/api/random", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT book, entry, text FROM entries ORDER BY RANDOM() LIMIT 1",
  ).first();

  if (!row) {
    return c.json({ error: "No entries found." }, 500);
  }

  return c.json(row);
});

export default app;
