import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("/api/*", cors());

app.get("/", (c) => {
  return c.text("Stoic Sage");
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
