// app.js — front-end chat logic (vanilla JS, no dependencies).

const chatEl = document.getElementById("chat");
const form = document.getElementById("composer");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const suggestions = document.getElementById("suggestions");
const newChatBtn = document.getElementById("new-chat");

// A stable per-tab session id (no Math.random needed on the server).
const sessionId = "sess-" + Date.now().toString(36) + performance.now().toString(36).replace(".", "");

const GREETING =
  "Hi! 👋 I'm the **Trailhead Assistant**. I can help you **track an order**, " +
  "**start a return or exchange**, **recommend gear**, or connect you with a **human agent**. " +
  "What can I do for you today?";

// ---- tiny + safe markdown renderer (bold, inline code, bullet lists, paragraphs) ----
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
function renderMarkdown(md) {
  const lines = escapeHtml(md).split(/\r?\n/);
  let html = "";
  let inList = false;
  const inline = (t) =>
    t
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  for (const raw of lines) {
    const line = raw.trimEnd();
    const li = line.match(/^\s*[-*]\s+(.*)/);
    if (li) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inline(li[1])}</li>`;
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      if (line.trim()) html += `<p>${inline(line)}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function addMessage(role, text, tools) {
  const row = document.createElement("div");
  row.className = `row ${role}`;
  const avatar = role === "bot" ? "🏔" : "🧍";
  const toolHtml =
    tools && tools.length
      ? `<div class="tools">${tools
          .map(
            (t) =>
              `<span class="tool-chip"><span class="k">⚙ ${t.tool}</span></span>`
          )
          .join("")}</div>`
      : "";
  row.innerHTML = `
    <div class="avatar">${avatar}</div>
    <div>
      <div class="bubble">${role === "bot" ? renderMarkdown(text) : escapeHtml(text)}</div>
      ${toolHtml}
    </div>`;
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
  return row;
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "row bot typing";
  row.innerHTML = `
    <div class="avatar">🏔</div>
    <div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
  return row;
}

async function sendMessage(text) {
  if (!text.trim()) return;
  addMessage("user", text);
  input.value = "";
  setBusy(true);
  const typing = showTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message: text }),
    });
    const data = await res.json();
    typing.remove();
    if (!res.ok) {
      addMessage("bot", `⚠️ ${data.error || "Something went wrong."}`);
    } else {
      addMessage("bot", data.reply, data.toolTrace);
    }
  } catch (err) {
    typing.remove();
    addMessage("bot", "⚠️ I couldn't reach the server. Is it running?");
  } finally {
    setBusy(false);
    input.focus();
  }
}

function setBusy(busy) {
  sendBtn.disabled = busy;
  input.disabled = busy;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage(input.value);
});

suggestions.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-msg]");
  if (btn) sendMessage(btn.dataset.msg);
});

newChatBtn.addEventListener("click", async () => {
  await fetch("/api/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  chatEl.innerHTML = "";
  addMessage("bot", GREETING);
});

// initial greeting
addMessage("bot", GREETING);
input.focus();
