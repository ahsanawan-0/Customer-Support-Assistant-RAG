# Trailhead Assistant — Customer Support Chatbot

A RAG-powered customer support chatbot for **Trailhead Outfitters**, a fictional small e-commerce store selling outdoor apparel and camping gear. Built for the Upwork simulated chatbot project.

It handles the four required support scenarios:

| Scenario | How it works |
| --- | --- |
| 📦 **Order tracking** | Looks up status, tracking, and contents from mock order data |
| ↩️ **Returns & exchanges** | Explains policy (via RAG) and issues a return authorization (RMA) |
| 🧭 **Product recommendations** | Asks a qualifying question, then recommends from the catalog |
| 🙋 **Human handoff** | Detects frustration / out-of-scope requests and escalates to a live agent |

## Architecture

```
Browser (chat UI)  ──►  Express server  ──►  Agent loop (Claude + tool use)
                                                   │
                        ┌──────────────────────────┼───────────────────────────┐
                        ▼              ▼            ▼             ▼              ▼
             search_knowledge_base  lookup_order  search_products  start_return  escalate_to_human
                        │              │            │             │
                   RAG retriever   orders.json  products.json  orders.json
                   (TF-IDF over
                   FAQ + policies)
```

- **Grounded (RAG):** policy/FAQ answers are retrieved from `data/faqs.md` and `data/policies.md` by a lightweight TF-IDF retriever (`src/knowledgeBase.js`) — the model answers only from retrieved passages, so it doesn't invent policies.
- **Tool use:** Claude decides which of five tools to call each turn; the tools run against the mock JSON data (`src/tools.js`).
- **No second API key needed:** retrieval is pure JavaScript, so the only credential required is an Anthropic API key.

## Project structure

```
rag/
├── server.js               Express server + /api/chat endpoint
├── src/
│   ├── agent.js            Claude tool-use loop (the "brain")
│   ├── tools.js            5 tool definitions + handlers
│   ├── knowledgeBase.js    RAG: chunk + TF-IDF retrieve
│   └── systemPrompt.js     Persona + rules
├── data/                   ← swap these for the client's real mock data
│   ├── products.json       14-item outdoor gear catalog
│   ├── orders.json         8 sample orders (various statuses)
│   ├── faqs.md             Shipping / orders / sizing / account FAQs
│   └── policies.md         Returns, shipping, warranty, price-match
├── public/                 Chat UI (HTML/CSS/vanilla JS)
├── DEMO_SCRIPT.md          Ready-to-record 2–3 min demo walkthrough
└── README.md
```

## Setup & run (Windows / macOS / Linux)

**Prerequisites:** Node.js 18+ (tested on Node 24).

```powershell
# 1. Install dependencies
npm install

# 2. Add your Anthropic API key
copy .env.example .env      # (macOS/Linux: cp .env.example .env)
#    then edit .env and paste your key from https://console.anthropic.com/settings/keys

# 3. Start the server
npm start

# 4. Open the chat
#    http://localhost:3000
```

That's it — no build step, no database, no deployment.

## Try these (mock data is real and self-consistent)

- **Track:** "Where is my order **TH100482**?"
- **Track by email:** "Look up orders for **sam.chen@example.com**"
- **Return:** "I want to return the boots from order **TH100333**." (email on file: `priya.patel@example.com`)
- **Policy (RAG):** "How long do I have to return something, and when do I get my refund?"
- **Recommendation:** "Recommend a waterproof jacket for backpacking under $200."
- **Handoff:** "This is ridiculous, I want to talk to a person."

Sample order numbers: `TH100482` (Shipped), `TH100517` (Processing), `TH100333` (Delivered), `TH100210` (Cancelled). See `data/orders.json` for all eight.

## Swapping in the client's real data

The client provides business context, FAQs, and mock data. To use it:

1. Replace `data/products.json` and `data/orders.json` (keep the same field names, or adjust `src/tools.js`).
2. Replace `data/faqs.md` and `data/policies.md` with the client's copy — the RAG index rebuilds automatically on restart. Any markdown with `##`/`###` headings works.
3. Tweak the store name and rules in `src/systemPrompt.js`.

## Tech
- **Model:** Claude Sonnet 5 (`claude-sonnet-5`) via the official `@anthropic-ai/sdk` — configurable in `.env`.
- **Server:** Express (ES modules).
- **Retrieval:** dependency-free TF-IDF cosine similarity (swap for vector embeddings for a larger corpus).
- **Frontend:** vanilla HTML/CSS/JS, no framework, no CDN.

## Notes
- Conversation state is kept in memory per browser tab (fine for a demo; use a store/DB for production).
- No live deployment is required for this project — it runs locally.
- The chat UI shows small "⚙ tool" chips under each answer so you can see the RAG retrieval and tool calls firing — great for the demo video.
