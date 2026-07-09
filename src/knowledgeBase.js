// knowledgeBase.js
// A small, dependency-free RAG retriever.
//
// We chunk the markdown knowledge base by heading, build a TF-IDF index over
// the chunks, and retrieve the top-k most relevant chunks for a query using
// cosine similarity. This keeps the project runnable with ONLY an Anthropic
// API key — no separate embeddings service required. For a larger corpus you
// would swap this out for vector embeddings (e.g. Voyage AI) + a vector store,
// but the retrieve() interface would stay the same.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");

const STOPWORDS = new Set(
  ("a an and are as at be but by for from has have how i if in into is it its of on or " +
    "that the their them then there these they this to was what when where which who will " +
    "with you your do does can could would should our we us my me").split(" ")
);

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
    (t) => t.length > 1 && !STOPWORDS.has(t)
  );
}

// Split a markdown document into chunks keyed by their nearest ## / ### heading.
function chunkMarkdown(markdown, source) {
  const lines = markdown.split(/\r?\n/);
  const chunks = [];
  let h2 = "";
  let title = "";
  let buffer = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    if (body) {
      const heading = [h2, title].filter(Boolean).join(" — ");
      chunks.push({ source, heading, text: body });
    }
    buffer = [];
  };

  for (const line of lines) {
    const m2 = line.match(/^##\s+(.*)/);
    const m3 = line.match(/^###\s+(.*)/);
    if (m2) {
      flush();
      h2 = m2[1].trim();
      title = "";
    } else if (m3) {
      flush();
      title = m3[1].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return chunks;
}

class TfIdfIndex {
  constructor(chunks) {
    this.chunks = chunks;
    this.docTokens = chunks.map((c) => tokenize(`${c.heading} ${c.text}`));
    this.df = new Map();
    for (const tokens of this.docTokens) {
      for (const term of new Set(tokens)) {
        this.df.set(term, (this.df.get(term) || 0) + 1);
      }
    }
    this.N = chunks.length;
    this.docVectors = this.docTokens.map((t) => this.vectorize(t));
  }

  idf(term) {
    const df = this.df.get(term) || 0;
    // Smoothed idf so unseen terms don't blow up.
    return Math.log((this.N + 1) / (df + 1)) + 1;
  }

  vectorize(tokens) {
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    const vec = new Map();
    let norm = 0;
    for (const [term, count] of tf) {
      const w = (count / tokens.length) * this.idf(term);
      vec.set(term, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [term, w] of vec) vec.set(term, w / norm);
    return vec;
  }

  similarity(a, b) {
    let dot = 0;
    const [small, large] = a.size < b.size ? [a, b] : [b, a];
    for (const [term, w] of small) {
      const w2 = large.get(term);
      if (w2) dot += w * w2;
    }
    return dot;
  }

  search(query, k = 3) {
    const qVec = this.vectorize(tokenize(query));
    if (qVec.size === 0) return [];
    return this.docVectors
      .map((vec, i) => ({ chunk: this.chunks[i], score: this.similarity(qVec, vec) }))
      .filter((r) => r.score > 0.01)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

let index = null;

export function loadKnowledgeBase() {
  if (index) return index;
  const sources = [
    { file: "faqs.md", label: "FAQ" },
    { file: "policies.md", label: "Policy" },
  ];
  const allChunks = [];
  for (const { file, label } of sources) {
    const md = readFileSync(join(DATA_DIR, file), "utf8");
    allChunks.push(...chunkMarkdown(md, label));
  }
  index = new TfIdfIndex(allChunks);
  console.log(`[kb] indexed ${allChunks.length} knowledge-base chunks`);
  return index;
}

// Public retrieval interface used by the tools layer.
export function retrieve(query, k = 3) {
  const idx = loadKnowledgeBase();
  return idx.search(query, k).map(({ chunk, score }) => ({
    source: chunk.source,
    heading: chunk.heading,
    text: chunk.text,
    score: Number(score.toFixed(3)),
  }));
}
