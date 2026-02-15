import { REFLECTION_WEIGHTS } from "./weighted-random";

export type SearchEnv = {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
};

export type SearchResult = {
  source: string;
  book: number;
  entry: string;
  text: string;
  score: number;
  weightedScore: number;
};

type EntryRow = {
  source: string;
  book: number;
  entry: string;
  text: string;
};

type SemanticCandidate = {
  source: string;
  book: number;
  entry: string;
  score: number;
};

type Citation = {
  source?: string;
  book: number;
  entry: string;
};

type SearchOptions = {
  topK?: number;
  semanticTopK?: number;
  lexicalLimit?: number;
  diversitySoftCap?: number;
};

const SEARCHABLE_SOURCES = [
  "meditations",
  "discourses",
  "enchiridion",
  "fragments",
  "seneca-tranquillity",
  "seneca-shortness",
] as const;

const SEARCHABLE_SOURCE_SET = new Set<string>(SEARCHABLE_SOURCES);

function isSearchableSource(source: string): boolean {
  return SEARCHABLE_SOURCE_SET.has(source);
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "you",
  "your",
]);

const STOIC_EXPANSIONS: Record<string, string[]> = {
  anger: ["rage", "temper", "provocation"],
  anxiety: ["worry", "fear", "unease", "calm"],
  control: ["choice", "judgment", "agency", "dichotomy"],
  courage: ["bravery", "fortitude"],
  death: ["mortality", "memento", "mori"],
  fate: ["amor", "fati", "acceptance"],
  grief: ["loss", "mourning"],
  justice: ["fairness", "duty"],
  resilience: ["adversity", "hardship", "endurance"],
  virtue: ["wisdom", "justice", "courage", "temperance"],
  wisdom: ["judgment", "reason"],
};

function keyFor(source: string, book: number, entry: string): string {
  return `${source}-${book}-${entry}`;
}

function roundScore(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeQuery(normalizedQuery: string): string[] {
  const terms = normalizedQuery
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  return [...new Set(terms)].slice(0, 12);
}

function expandTokens(tokens: string[]): string[] {
  const expanded = new Set<string>();
  for (const token of tokens) {
    const aliases = STOIC_EXPANSIONS[token];
    if (!aliases) continue;
    for (const alias of aliases) {
      if (alias.length >= 3 && !tokens.includes(alias)) {
        expanded.add(alias);
      }
    }
  }
  return [...expanded];
}

function parseCitation(rawQuery: string): Citation | null {
  const pattern =
    /^(?:(meditations|discourses|enchiridion|fragments|seneca-tranquillity|seneca-shortness)\s+)?(\d+)\.(\d+[a-z]?)$/i;
  const match = rawQuery.trim().match(pattern);
  if (!match) return null;
  return {
    source: match[1]?.toLowerCase(),
    book: parseInt(match[2], 10),
    entry: match[3].toLowerCase(),
  };
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = 0;
  while (true) {
    index = haystack.indexOf(needle, index);
    if (index === -1) return count;
    count++;
    index += needle.length;
  }
}

function normalizeScore(value: number, min: number, max: number): number {
  if (max <= 0) return 0;
  if (max === min) return 1;
  return (value - min) / (max - min);
}

function normalizeSemanticScore(value: number, min: number, max: number): number {
  const spread = max - min;
  if (spread <= 0) {
    return Math.max(0, Math.min(value, 1));
  }

  // Prevent tiny score ranges from being stretched to 0..1.
  if (spread < 0.05) {
    if (min >= 0 && max <= 1) {
      return Math.max(0, Math.min(value, 1));
    }
    if (min >= -1 && max <= 1) {
      return Math.max(0, Math.min((value + 1) / 2, 1));
    }
  }

  return Math.max(0, Math.min(normalizeScore(value, min, max), 1));
}

function sourceWeightForSearch(source: string): number {
  const raw = REFLECTION_WEIGHTS.SOURCE_WEIGHTS[source] ?? 1.0;
  // Keep source preference as a tie-breaker, but dampen it so relevance dominates.
  return 1 + (raw - 1) * 0.4;
}

function extractEmbeddingVector(output: {
  data?: number[][];
  request_id?: string;
}): number[] {
  if (output.request_id) {
    throw new Error("Embedding request was queued asynchronously.");
  }
  const vector = output.data?.[0];
  if (!vector || !Array.isArray(vector)) {
    throw new Error("Embedding response did not contain a vector.");
  }
  return vector;
}

async function getQueryEmbedding(env: SearchEnv, query: string): Promise<number[]> {
  const output = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
    text: [query],
  });
  return extractEmbeddingVector(output);
}

async function fetchRowsForRefs(
  db: D1Database,
  refs: { source: string; book: number; entry: string }[],
): Promise<Map<string, EntryRow>> {
  const unique = new Map<string, { source: string; book: number; entry: string }>();
  for (const ref of refs) unique.set(keyFor(ref.source, ref.book, ref.entry), ref);
  const rowsByKey = new Map<string, EntryRow>();

  const refList = [...unique.values()];
  const chunkSize = 40;
  for (let i = 0; i < refList.length; i += chunkSize) {
    const chunk = refList.slice(i, i + chunkSize);
    const where = chunk
      .map(() => "(source = ? AND book = ? AND entry = ?)")
      .join(" OR ");
    const params: Array<string | number> = [];
    for (const ref of chunk) {
      params.push(ref.source, ref.book, ref.entry);
    }

    const result = await db
      .prepare(
        `SELECT source, book, entry, text
         FROM entries
         WHERE ${where}`,
      )
      .bind(...params)
      .all<EntryRow>();

    for (const row of result.results || []) {
      rowsByKey.set(keyFor(row.source, row.book, row.entry), row);
    }
  }

  return rowsByKey;
}

async function fetchCitationRows(
  db: D1Database,
  citation: Citation | null,
): Promise<EntryRow[]> {
  if (!citation) return [];

  if (citation.source) {
    if (!isSearchableSource(citation.source)) return [];
    const row = await db
      .prepare(
        `SELECT source, book, entry, text
         FROM entries
         WHERE source = ? AND book = ? AND entry = ?`,
      )
      .bind(citation.source, citation.book, citation.entry)
      .first<EntryRow>();
    return row ? [row] : [];
  }

  const rows = await db
    .prepare(
      `SELECT source, book, entry, text
       FROM entries
       WHERE book = ? AND entry = ?
         AND source IN (${SEARCHABLE_SOURCES.map(() => "?").join(", ")})`,
    )
    .bind(citation.book, citation.entry, ...SEARCHABLE_SOURCES)
    .all<EntryRow>();
  return rows.results || [];
}

async function fetchLexicalRows(
  db: D1Database,
  terms: string[],
  limit: number,
): Promise<EntryRow[]> {
  if (terms.length === 0) return [];

  const filtered = terms.filter((t) => t.trim().length >= 3).slice(0, 12);
  if (filtered.length === 0) return [];

  // LIKE scans are acceptable at the current corpus size (~1.4k entries).
  const where = filtered.map(() => "lower(text) LIKE ?").join(" OR ");
  const params = filtered.map((t) => `%${t}%`);

  const rows = await db
    .prepare(
      `SELECT source, book, entry, text
       FROM entries
       WHERE (${where})
         AND source IN (${SEARCHABLE_SOURCES.map(() => "?").join(", ")})
       LIMIT ?`,
    )
    .bind(...params, ...SEARCHABLE_SOURCES, limit)
    .all<EntryRow>();

  return rows.results || [];
}

async function fetchSemanticCandidates(
  env: SearchEnv,
  query: string,
  topK: number,
): Promise<SemanticCandidate[]> {
  const queryVector = await getQueryEmbedding(env, query);
  const vectorResults = await env.VECTORIZE.query(queryVector, {
    topK,
    returnMetadata: "all",
  });

  const byKey = new Map<string, SemanticCandidate>();
  for (const match of vectorResults.matches || []) {
    const meta = (match.metadata || {}) as {
      source?: string;
      book?: number | string;
      entry?: string | number;
    };
    const source = meta.source || "meditations";
    if (!isSearchableSource(source)) continue;
    const book =
      typeof meta.book === "number"
        ? meta.book
        : parseInt(String(meta.book ?? ""), 10);
    const entry = String(meta.entry ?? "");
    if (!Number.isFinite(book) || !entry) continue;

    const key = keyFor(source, book, entry);
    const current = byKey.get(key);
    const score = match.score ?? 0;
    if (!current || score > current.score) {
      byKey.set(key, { source, book, entry, score });
    }
  }

  return [...byKey.values()];
}

function lexicalScoreForRow(
  row: EntryRow,
  normalizedQuery: string,
  coreTokens: string[],
  expandedTokens: string[],
  citation: Citation | null,
): number {
  const text = normalizeText(row.text);
  let score = 0;

  if (normalizedQuery && text.includes(normalizedQuery)) {
    score += 1.2;
  }

  if (coreTokens.length > 0) {
    let matched = 0;
    let frequency = 0;
    for (const token of coreTokens) {
      if (text.includes(token)) matched++;
      frequency += Math.min(countOccurrences(text, token), 3);
    }
    score += (matched / coreTokens.length) * 1.2;
    score += Math.min(frequency / (coreTokens.length * 2), 1) * 0.8;
  }

  if (expandedTokens.length > 0) {
    let matchedExpansions = 0;
    for (const token of expandedTokens) {
      if (text.includes(token)) matchedExpansions++;
    }
    score += (matchedExpansions / expandedTokens.length) * 0.25;
  }

  if (
    citation &&
    row.book === citation.book &&
    row.entry.toLowerCase() === citation.entry &&
    (!citation.source || row.source === citation.source)
  ) {
    score += 2.5;
  }

  return score;
}

function isCitationMatchRow(row: EntryRow, citation: Citation | null): boolean {
  if (!citation) return false;
  return (
    row.book === citation.book &&
    row.entry.toLowerCase() === citation.entry &&
    (!citation.source || row.source === citation.source)
  );
}

function isStrongLexicalRescue(
  row: EntryRow,
  normalizedQuery: string,
  coreTokens: string[],
): boolean {
  const text = normalizeText(row.text);
  if (normalizedQuery.length >= 4 && text.includes(normalizedQuery)) {
    return true;
  }
  if (coreTokens.length >= 2) {
    let matches = 0;
    for (const token of coreTokens) {
      if (text.includes(token)) matches++;
    }
    return matches >= Math.min(3, coreTokens.length);
  }
  return false;
}

function diversifyBySource<T extends { source: string }>(
  sorted: T[],
  limit: number,
  softCap: number,
): T[] {
  if (sorted.length <= limit) return sorted;

  const selected: T[] = [];
  const overflow: T[] = [];
  const counts = new Map<string, number>();

  for (const item of sorted) {
    const sourceCount = counts.get(item.source) || 0;
    if (sourceCount < softCap) {
      selected.push(item);
      counts.set(item.source, sourceCount + 1);
    } else {
      overflow.push(item);
    }
  }

  if (selected.length < limit) {
    for (const item of overflow) {
      selected.push(item);
      if (selected.length === limit) break;
    }
  }

  return selected.slice(0, limit);
}

export async function searchEntriesHybrid(
  env: SearchEnv,
  rawQuery: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const topK = Math.min(Math.max(options.topK ?? 5, 1), 20);
  const semanticTopK = Math.min(
    Math.max(options.semanticTopK ?? Math.max(topK * 6, 30), topK),
    80,
  );
  const lexicalLimit = Math.max(options.lexicalLimit ?? 120, topK * 4);
  const diversitySoftCap = Math.max(options.diversitySoftCap ?? 2, 1);

  const normalizedQuery = normalizeText(rawQuery).slice(0, 500);
  const coreTokens = tokenizeQuery(normalizedQuery);
  const expandedTokens = expandTokens(coreTokens);
  const citation = parseCitation(rawQuery);

  const lexicalTerms = [
    normalizedQuery,
    ...coreTokens,
    ...expandedTokens,
  ].filter((term) => term.length >= 3);

  let semanticCandidates: SemanticCandidate[] = [];
  try {
    semanticCandidates = await fetchSemanticCandidates(
      env,
      normalizedQuery || rawQuery.trim(),
      semanticTopK,
    );
  } catch {
    // Keep lexical retrieval as fallback when embedding/vector search fails.
    semanticCandidates = [];
  }

  const semanticRowsByKey = await fetchRowsForRefs(env.DB, semanticCandidates);
  const semanticScoreByKey = new Map<string, number>();
  for (const candidate of semanticCandidates) {
    const key = keyFor(candidate.source, candidate.book, candidate.entry);
    if (!semanticRowsByKey.has(key)) continue;
    const existing = semanticScoreByKey.get(key);
    if (existing == null || candidate.score > existing) {
      semanticScoreByKey.set(key, candidate.score);
    }
  }

  const hasSemanticCandidates = semanticScoreByKey.size > 0;
  const lexicalRescueLimit = hasSemanticCandidates
    ? Math.min(Math.max(topK * 2, 20), 40)
    : lexicalLimit;
  const [lexicalRows, citationRows] = await Promise.all([
    fetchLexicalRows(env.DB, lexicalTerms, lexicalRescueLimit),
    fetchCitationRows(env.DB, citation),
  ]);

  const lexicalScoreByKey = new Map<string, number>();
  const rowByKey = new Map<string, EntryRow>();

  for (const [key, score] of semanticScoreByKey.entries()) {
    const row = semanticRowsByKey.get(key);
    if (row) rowByKey.set(key, row);
    lexicalScoreByKey.set(key, 0);
  }

  // When semantic results exist, lexical signals only rerank semantic candidates.
  for (const row of semanticRowsByKey.values()) {
    const key = keyFor(row.source, row.book, row.entry);
    const score = lexicalScoreForRow(
      row,
      normalizedQuery,
      coreTokens,
      expandedTokens,
      citation,
    );
    lexicalScoreByKey.set(key, score);
    rowByKey.set(key, row);
  }

  // Semantic-first tradeoff:
  // - semantic candidates are always included
  // - lexical-only rows are admitted only for citations or strong exact lexical hits
  // This preserves semantic priority while recovering occasional semantic misses.
  for (const row of [...lexicalRows, ...citationRows]) {
    const key = keyFor(row.source, row.book, row.entry);
    const isSemanticRow = semanticScoreByKey.has(key);
    const isCitationRow = isCitationMatchRow(row, citation);
    if (
      hasSemanticCandidates &&
      !isSemanticRow &&
      !isCitationRow &&
      !isStrongLexicalRescue(row, normalizedQuery, coreTokens)
    ) {
      continue;
    }

    const score = lexicalScoreForRow(
      row,
      normalizedQuery,
      coreTokens,
      expandedTokens,
      citation,
    );
    const current = lexicalScoreByKey.get(key) ?? 0;
    if (score > current) lexicalScoreByKey.set(key, score);
    rowByKey.set(key, row);
  }

  const semanticScores = [...semanticScoreByKey.values()];
  const lexicalScores = [...lexicalScoreByKey.values()];
  const semanticMin = semanticScores.length ? Math.min(...semanticScores) : 0;
  const semanticMax = semanticScores.length ? Math.max(...semanticScores) : 0;
  const lexicalMax = lexicalScores.length ? Math.max(...lexicalScores) : 0;
  const semanticBlend = hasSemanticCandidates ? 0.9 : 0;
  const lexicalBlend = hasSemanticCandidates ? 0.1 : 1;

  const combined = [...rowByKey.entries()].map(([key, row]) => {
    const semanticRaw = semanticScoreByKey.get(key) ?? 0;
    const lexicalRaw = lexicalScoreByKey.get(key) ?? 0;
    const semanticNorm = normalizeSemanticScore(
      semanticRaw,
      semanticMin,
      semanticMax,
    );
    const lexicalNorm = lexicalMax > 0 ? lexicalRaw / lexicalMax : 0;
    const sourceBoost = sourceWeightForSearch(row.source);
    const weightedScore =
      (semanticNorm * semanticBlend + lexicalNorm * lexicalBlend) * sourceBoost;
    return {
      ...row,
      score: semanticRaw,
      weightedScore,
    };
  });

  combined.sort((a, b) => {
    if (b.weightedScore !== a.weightedScore) {
      return b.weightedScore - a.weightedScore;
    }
    return b.score - a.score;
  });

  const diversified = diversifyBySource(combined, topK, diversitySoftCap);
  return diversified.map((item) => ({
    source: item.source,
    book: item.book,
    entry: item.entry,
    text: item.text,
    score: roundScore(item.score),
    weightedScore: roundScore(item.weightedScore),
  }));
}
