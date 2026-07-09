# 🎬 Demo Video Script (2–3 minutes)

A tight walkthrough that shows all four required use cases. Record your screen at 1280×720 or higher, with the browser at `http://localhost:3000`. Aim for ~2:30. Speak in a calm, friendly tone.

> Tip: The small **⚙ tool** chips under each bot reply visibly prove the bot is retrieving real data (RAG) and calling tools — call them out on camera; it reads as "this is really working," not scripted.

---

### 0:00 – 0:15 · Intro
> "Hi, this is a customer support chatbot I built for Trailhead Outfitters, a small outdoor apparel and camping gear store. It handles order tracking, returns and exchanges, product recommendations, and handoff to a human — all grounded in the store's real policies and order data. Let me show you."

*(Show the landing screen with the greeting and the suggestion chips.)*

---

### 0:15 – 0:50 · Use case 1 — Order tracking
Type: **`Where is my order TH100482?`**

> "First, order tracking. I'll ask about a specific order."

When it replies, point out:
- The **status (Shipped)**, carrier, tracking number, and estimated delivery.
- The **⚙ lookup_order** chip — "notice it pulled this from the order system, it isn't made up."

Follow up: **`What's in that order?`** — shows it keeps context across turns.

---

### 0:50 – 1:25 · Use case 2 — Returns & exchanges (RAG + action)
Type: **`How long do I have to return something, and when will I get my refund?`**

> "For policy questions it uses retrieval — it searches the store's actual policy documents and answers only from those."

Point out the **⚙ search_knowledge_base** chip (that's the RAG step).

Then start a real return: **`I want to return the boots from order TH100333.`**

> "And it can actually start the return."

Highlight the **RMA number** and the next-steps it returns (**⚙ start_return**).

---

### 1:25 – 2:00 · Use case 3 — Product recommendations
Type: **`Can you recommend a waterproof jacket for backpacking under $200?`**

> "It can also recommend gear from the catalog based on what the customer needs."

Point out that it returns **2–3 relevant products** with a one-line reason each, all within budget and waterproof (**⚙ search_products**). Optionally add: **`Which is lighter?`** to show it reasons over the results.

---

### 2:00 – 2:30 · Use case 4 — Human handoff
Type: **`This isn't working for me, I want to talk to a real person.`**

> "Finally, when someone's frustrated or needs something outside the bot's scope, it hands off to a human."

Point out that it **acknowledges, gives the support hours, and escalates** (**⚙ escalate_to_human**), passing along a summary so the agent has context.

---

### 2:30 · Close
> "That's the Trailhead support assistant — grounded in the store's real data, handling the four core support scenarios, with a clean conversational flow and human handoff when it's needed. Thanks for watching."

---

## Recording checklist
- [ ] `.env` has a valid `ANTHROPIC_API_KEY` and `npm start` is running.
- [ ] Do one practice run — responses take ~1–3s; pause naturally while it "types".
- [ ] Use the **New chat** button to reset between takes.
- [ ] Recommended tools: OBS Studio, ShareX, or the built-in Windows Game Bar (`Win+G`).
- [ ] Keep it under 3 minutes; trim dead air in editing.
- [ ] Optional: briefly show `data/orders.json` or `src/agent.js` at the start to prove it's a real code repo.
