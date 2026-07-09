// tools.js
// Tool definitions (Anthropic tool-use schema) + their handlers.
// The agent decides WHICH tool to call; these functions actually do the work
// against the mock data and the RAG index.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { retrieve } from "./knowledgeBase.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");

const PRODUCTS = JSON.parse(readFileSync(join(DATA_DIR, "products.json"), "utf8"));
const ORDERS = JSON.parse(readFileSync(join(DATA_DIR, "orders.json"), "utf8"));

// ---------------------------------------------------------------------------
// Tool schemas advertised to the model.
// ---------------------------------------------------------------------------
export const toolDefinitions = [
  {
    name: "search_knowledge_base",
    description:
      "Search Trailhead Outfitters' FAQ and policy documents (shipping, returns, exchanges, warranty, sizing, payment, hours). Use this for ANY question about how policies work or general store information. Returns the most relevant passages.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A natural-language search query, e.g. 'how long do returns take'.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "lookup_order",
    description:
      "Look up a customer's order to check status, tracking, or contents. Requires an order number (like TH100482) and/or the email address on the order. If only an email is given, all orders for that email are returned.",
    input_schema: {
      type: "object",
      properties: {
        order_number: { type: "string", description: "Order number, e.g. TH100482." },
        email: { type: "string", description: "Email address on the order." },
      },
    },
  },
  {
    name: "search_products",
    description:
      "Search the product catalog to make recommendations. Filter by free-text query, category, activity, season, price, waterproofing, or stock. Use this for product recommendation requests.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text like 'lightweight rain jacket' or 'tent for two'." },
        activity: {
          type: "string",
          description: "e.g. Backpacking, Day Hiking, Camping, Trail Running, Travel.",
        },
        max_price: { type: "number", description: "Maximum price in USD." },
        waterproof: { type: "boolean", description: "Only return waterproof items when true." },
        in_stock_only: { type: "boolean", description: "Exclude out-of-stock items when true." },
      },
    },
  },
  {
    name: "start_return",
    description:
      "Start a return or exchange for an item on a delivered or shipped order. Verifies the order exists and returns a return authorization (RMA) with next steps. Use 'exchange' when the customer wants a different size/color.",
    input_schema: {
      type: "object",
      properties: {
        order_number: { type: "string", description: "Order number the item belongs to." },
        email: { type: "string", description: "Email on the order, for verification." },
        item_id: { type: "string", description: "Product id of the item to return, e.g. TH-FTW-400." },
        type: { type: "string", enum: ["return", "exchange"], description: "Return for refund, or exchange." },
        reason: { type: "string", description: "Short reason, e.g. 'wrong size', 'defective', 'changed mind'." },
      },
      required: ["order_number", "item_id", "type"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Hand the conversation off to a human support agent. Use when the customer explicitly asks for a human, is frustrated, or the request is outside your ability (billing disputes, warranty claims needing review, complaints, anything you cannot resolve with the other tools).",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why the handoff is needed." },
        summary: { type: "string", description: "A brief summary of the conversation so the agent has context." },
        customer_email: { type: "string", description: "Customer email for follow-up, if known." },
      },
      required: ["reason", "summary"],
    },
  },
];

// ---------------------------------------------------------------------------
// Handlers. Each returns a plain object; the agent loop stringifies it back
// to the model as the tool_result.
// ---------------------------------------------------------------------------

function handleSearchKnowledgeBase({ query }) {
  const results = retrieve(query, 3);
  if (results.length === 0) {
    return { found: false, message: "No relevant policy or FAQ passages found for that query." };
  }
  return {
    found: true,
    passages: results.map((r) => ({ topic: r.heading, source: r.source, content: r.text })),
  };
}

function normalizeOrderNo(s = "") {
  return s.toUpperCase().replace(/\s|#/g, "");
}

function publicOrder(o) {
  return {
    order_number: o.order_number,
    customer_name: o.customer_name,
    order_date: o.order_date,
    status: o.status,
    carrier: o.carrier,
    tracking_number: o.tracking_number,
    estimated_delivery: o.estimated_delivery,
    delivered_date: o.delivered_date || null,
    items: o.items,
    total: o.total,
  };
}

function handleLookupOrder({ order_number, email }) {
  if (!order_number && !email) {
    return { found: false, message: "Please provide an order number or the email used on the order." };
  }
  const wantNo = order_number ? normalizeOrderNo(order_number) : null;
  const wantEmail = email ? email.trim().toLowerCase() : null;

  let matches = ORDERS.filter((o) => {
    const noOk = wantNo ? normalizeOrderNo(o.order_number) === wantNo : true;
    const emailOk = wantEmail ? o.email.toLowerCase() === wantEmail : true;
    return noOk && emailOk;
  });

  if (matches.length === 0) {
    return {
      found: false,
      message:
        "No matching order was found. Double-check the order number (format TH100000) and the email on the order.",
    };
  }
  return { found: true, count: matches.length, orders: matches.map(publicOrder) };
}

function handleSearchProducts({ query, activity, max_price, waterproof, in_stock_only }) {
  let results = PRODUCTS.slice();

  if (in_stock_only) results = results.filter((p) => p.in_stock);
  if (typeof waterproof === "boolean") results = results.filter((p) => p.waterproof === waterproof);
  if (typeof max_price === "number") results = results.filter((p) => p.price <= max_price);
  if (activity) {
    const a = activity.toLowerCase();
    results = results.filter((p) =>
      (p.activity || []).some((x) => x.toLowerCase().includes(a) || a.includes(x.toLowerCase()))
    );
  }
  if (query) {
    const terms = query.toLowerCase().match(/[a-z0-9]+/g) || [];
    const scored = results
      .map((p) => {
        const hay = `${p.name} ${p.category} ${p.description} ${(p.activity || []).join(" ")}`.toLowerCase();
        const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
        return { p, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
    results = scored.map((r) => r.p);
  }

  results = results.slice(0, 5).map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    category: p.category,
    colors: p.colors,
    sizes: p.sizes,
    waterproof: p.waterproof,
    in_stock: p.in_stock,
    rating: p.rating,
    why: p.description,
  }));

  if (results.length === 0) {
    return { count: 0, message: "No products matched those filters. Try loosening the criteria." };
  }
  return { count: results.length, products: results };
}

// A deterministic pseudo-RMA number derived from the order + item, so we don't
// need Math.random() (and repeat lookups stay stable).
function rmaNumber(orderNo, itemId) {
  const base = `${orderNo}${itemId}`;
  let h = 0;
  for (const ch of base) h = (h * 31 + ch.charCodeAt(0)) % 1000000;
  return `RMA-${String(h).padStart(6, "0")}`;
}

function handleStartReturn({ order_number, email, item_id, type, reason }) {
  const order = ORDERS.find((o) => normalizeOrderNo(o.order_number) === normalizeOrderNo(order_number || ""));
  if (!order) {
    return { ok: false, message: "That order number wasn't found. Please confirm it and the email on the order." };
  }
  if (email && order.email.toLowerCase() !== email.trim().toLowerCase()) {
    return { ok: false, message: "The email doesn't match this order. Please verify the email used at checkout." };
  }
  if (!["Delivered", "Shipped"].includes(order.status)) {
    return {
      ok: false,
      message: `This order is currently '${order.status}'. Returns can be started once an order has shipped or been delivered.`,
    };
  }
  const item = order.items.find((i) => i.id.toUpperCase() === (item_id || "").toUpperCase());
  if (!item) {
    return { ok: false, message: `Item ${item_id} isn't on order ${order.order_number}. Items on it: ${order.items.map((i) => `${i.name} (${i.id})`).join(", ")}.` };
  }
  return {
    ok: true,
    rma: rmaNumber(order.order_number, item.id),
    type,
    item: item.name,
    order_number: order.order_number,
    reason: reason || null,
    next_steps: [
      "A prepaid return shipping label will be emailed to you within a few minutes.",
      "Pack the item in its original packaging with tags attached.",
      "Drop it off with the carrier; returns are free within the U.S.",
      type === "exchange"
        ? "Your replacement ships as soon as the returned item is scanned by the carrier."
        : "Your refund is issued 2–3 business days after we receive and inspect the item, then 5–7 business days to appear on your original payment method.",
    ],
  };
}

function handleEscalateToHuman({ reason, summary, customer_email }) {
  // In a real system this would open a ticket / notify a live queue. Here we
  // simulate a successful handoff with an ETA based on published hours.
  const ticketId = `TCK-${normalizeOrderNo(String(summary || "x")).slice(0, 4)}${(reason || "x").length}${(summary || "").length % 97}`;
  return {
    ok: true,
    ticket_id: ticketId,
    handed_off: true,
    reason,
    customer_email: customer_email || null,
    message:
      "Handed off to a human agent. Support hours are Mon–Fri 8am–6pm and Sat 9am–3pm Mountain Time. During hours the wait is typically under 5 minutes; outside hours you'll get an email reply the next business day.",
  };
}

const HANDLERS = {
  search_knowledge_base: handleSearchKnowledgeBase,
  lookup_order: handleLookupOrder,
  search_products: handleSearchProducts,
  start_return: handleStartReturn,
  escalate_to_human: handleEscalateToHuman,
};

export function runTool(name, input) {
  const handler = HANDLERS[name];
  if (!handler) return { error: `Unknown tool: ${name}` };
  try {
    return handler(input || {});
  } catch (err) {
    return { error: `Tool '${name}' failed: ${err.message}` };
  }
}
