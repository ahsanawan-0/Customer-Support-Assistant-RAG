// server.js
// Express server: serves the chat UI and exposes POST /api/chat.
// Conversation state is kept per-session in memory (fine for a demo).

import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chat } from "./src/agent.js";
import { loadKnowledgeBase } from "./src/knowledgeBase.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, "public")));

// In-memory conversation store: sessionId -> messages[]
const sessions = new Map();

app.post("/api/chat", async (req, res) => {
  try {
    const { sessionId = "default", message } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "A 'message' string is required." });
    }
    const history = sessions.get(sessionId) || [];
    const { reply, messages, toolTrace } = await chat(history, message);
    sessions.set(sessionId, messages);
    res.json({ reply, toolTrace });
  } catch (err) {
    console.error("[chat error]", err);
    const hint =
      err.status === 401
        ? "Authentication failed — check ANTHROPIC_API_KEY in your .env file."
        : err.message;
    res.status(500).json({ error: `Something went wrong: ${hint}` });
  }
});

// Reset a conversation (used by the "New chat" button).
app.post("/api/reset", (req, res) => {
  const { sessionId = "default" } = req.body || {};
  sessions.delete(sessionId);
  res.json({ ok: true });
});

app.get("/api/health", (_req, res) => res.json({ ok: true, model: process.env.MODEL || "claude-sonnet-5" }));

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("\n⚠  ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.\n");
}

loadKnowledgeBase(); // warm the RAG index at startup

app.listen(PORT, () => {
  console.log(`\n🏔  Trailhead Assistant running at http://localhost:${PORT}\n`);
});
