// agent.js
// The core agentic loop: send the conversation to Claude, run any tools it
// calls, feed the results back, and repeat until it produces a final text
// answer. This is the standard Anthropic tool-use loop.

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { toolDefinitions, runTool } from "./tools.js";

const MODEL = process.env.MODEL || "claude-sonnet-5";
const MAX_TOOL_ROUNDS = 6;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Run one assistant turn.
 * @param {Array} history - prior messages in Anthropic format ({role, content}).
 * @param {string} userMessage - the new user message.
 * @returns {Promise<{reply: string, messages: Array, toolTrace: Array}>}
 */
export async function chat(history, userMessage) {
  const messages = [...history, { role: "user", content: userMessage }];
  const toolTrace = []; // for the UI's "what the bot did" panel

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages,
    });

    // Record the assistant's turn (may contain text and/or tool_use blocks).
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "tool_use") {
      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const result = runTool(block.name, block.input);
        toolTrace.push({ tool: block.name, input: block.input, output: result });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: "user", content: toolResults });
      continue; // let the model react to the tool results
    }

    // No tool call -> we have the final answer.
    const reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { reply: reply || "(no response)", messages, toolTrace };
  }

  // Safety valve if the model keeps calling tools.
  return {
    reply:
      "I'm having trouble completing that automatically. Let me connect you with a human agent — our team is available Mon–Fri 8am–6pm MT.",
    messages,
    toolTrace,
  };
}
