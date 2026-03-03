import { getOllamaClient, getModelName } from "./ollama-client";
import { emitChatToken, emitChatAction, emitMissionLog } from "./mission-emitter";
import { gatherGeoSearchResults } from "./geo-context";
import { processMicroBatch } from "./micro-agents";
import { AGENTS } from "./agents";
import type { ChatMessage, ChatAction } from "./specialist-types";
import type { DeploymentArea, AgentIntelItem } from "./types";

// ── Constants ────────────────────────────────────────────────────

const MAX_HISTORY = 20;
const MAX_RESULT_ITEMS_IN_CONTEXT = 10;
const NUM_PREDICT = 512;

/** Action block regex: <<ACTION:dispatch|agent=news-scout|focus=optional>> */
const ACTION_REGEX = /<<ACTION:(\w+)\|([^>]+)>>/g;

/** Keywords that suggest the user wants intelligence gathered */
const INTEL_KEYWORDS = [
  "what's happening", "whats happening", "gather", "search",
  "deploy", "intel", "intelligence", "find", "scan", "report",
  "brief me", "briefing", "situation", "sitrep", "status",
];

// ── globalThis singleton (survives Turbopack HMR) ────────────────

const g = globalThis as typeof globalThis & {
  __specialistChat?: {
    messages: ChatMessage[];
    isGenerating: boolean;
    abortController: AbortController | null;
  };
};

function getChatState() {
  if (!g.__specialistChat) {
    g.__specialistChat = {
      messages: [],
      isGenerating: false,
      abortController: null,
    };
  }
  return g.__specialistChat;
}

// ── System prompt builder ────────────────────────────────────────

function buildSystemPrompt(area: DeploymentArea | null, locationName?: string): string {
  const agentList = AGENTS.map(
    (a) => `  - ${a.id}: ${a.name} — ${a.role}`
  ).join("\n");

  const areaInfo = area
    ? `\nDeployment area: ${area.lat.toFixed(4)}°, ${area.lon.toFixed(4)}° (${area.radiusKm}km radius)${locationName ? ` — ${locationName}` : ""}`
    : "\nNo deployment area set. Ask the operator to set one if needed.";

  return `You are the Mission Control Specialist, a senior intelligence orchestrator for WorldView.
You coordinate a team of specialized agents to gather real-time intelligence.

Available agents:
${agentList}

${areaInfo}

When you need to gather intelligence, emit an action block on its own line:
<<ACTION:dispatch|agent=AGENT_ID>>

You may dispatch multiple agents by emitting multiple action blocks.
After receiving results, synthesize them into a concise tactical briefing.
If the user asks something you can answer from existing context or general knowledge, respond directly without dispatching agents.

Keep responses concise and professional. Use short paragraphs.
Do not use markdown headers. Do not repeat the action syntax to the user.`;
}

// ── Action parsing ───────────────────────────────────────────────

function parseActions(text: string): ChatAction[] {
  const actions: ChatAction[] = [];
  let match;
  const regex = new RegExp(ACTION_REGEX.source, "g");
  while ((match = regex.exec(text)) !== null) {
    const type = match[1];
    const paramStr = match[2];
    const params: Record<string, string> = {};
    for (const pair of paramStr.split("|")) {
      const [k, v] = pair.split("=");
      if (k && v) params[k.trim()] = v.trim();
    }
    if (type === "dispatch" && params.agent) {
      const validAgent = AGENTS.find((a) => a.id === params.agent);
      if (validAgent) {
        actions.push({ type: "dispatch", agentId: params.agent, focus: params.focus });
      }
    }
  }
  return actions;
}

/** Detect intent keywords when the model doesn't use action blocks */
function detectIntentFallback(userMessage: string): ChatAction[] {
  const lower = userMessage.toLowerCase();
  if (INTEL_KEYWORDS.some((kw) => lower.includes(kw))) {
    return AGENTS.map((a) => ({ type: "dispatch" as const, agentId: a.id }));
  }
  return [];
}

// ── Agent dispatch (reuses existing pipeline) ────────────────────

async function dispatchAgent(
  agentId: string,
  area: DeploymentArea,
  messageId: string
): Promise<AgentIntelItem[]> {
  emitChatAction(messageId, "dispatching", agentId);
  emitMissionLog(agentId, "info", `Specialist dispatching ${agentId}`);

  try {
    const geoResults = await gatherGeoSearchResults(area);

    // Filter items to this agent's category
    const agent = AGENTS.find((a) => a.id === agentId);
    const categoryMap: Record<string, string> = {
      "news-scout": "news",
      "military-analyst": "military",
      "disaster-monitor": "disasters",
      "geoint-analyst": "geoint",
    };
    const targetCategory = categoryMap[agentId];
    const items = targetCategory
      ? geoResults.items.filter((i) => i.category === targetCategory)
      : geoResults.items;

    if (items.length === 0) {
      emitChatAction(messageId, "completed", agentId, []);
      return [];
    }

    const results: AgentIntelItem[] = [];
    await processMicroBatch(items.slice(0, 8), geoResults.locationName, agentId, (item) => {
      results.push(item);
    });

    emitChatAction(messageId, "completed", agentId, results);
    emitMissionLog(agentId, "success", `${agent?.name || agentId}: ${results.length} items`);
    return results;
  } catch (err) {
    emitChatAction(messageId, "failed", agentId);
    emitMissionLog(agentId, "error", `${agentId} failed: ${(err as Error).message}`);
    return [];
  }
}

// ── Summarize results for LLM context injection ──────────────────

function summarizeResults(agentId: string, results: AgentIntelItem[]): string {
  if (results.length === 0) return `Agent ${agentId}: No relevant items found.`;

  const items = results.slice(0, MAX_RESULT_ITEMS_IN_CONTEXT).map((r) => {
    const loc = r.latitude && r.longitude ? ` (${r.latitude.toFixed(2)}, ${r.longitude.toFixed(2)})` : "";
    return `- ${r.title}${loc}: ${r.summary.slice(0, 120)}`;
  });

  return `Agent ${agentId} found ${results.length} items:\n${items.join("\n")}`;
}

// ── Main chat handler ────────────────────────────────────────────

export async function handleChatMessage(
  userMessage: string,
  deploymentArea: DeploymentArea | null
): Promise<void> {
  const state = getChatState();

  // Abort any running generation
  if (state.isGenerating && state.abortController) {
    state.abortController.abort();
  }

  const client = await getOllamaClient();
  const model = getModelName();
  if (!client || !model) {
    const errorId = `err-${Date.now()}`;
    emitChatToken(errorId, "SPECIALIST OFFLINE — Ollama is not connected. Check that Ollama is running and try again.", true);
    return;
  }

  state.isGenerating = true;
  state.abortController = new AbortController();

  // Add user message
  const userMsg: ChatMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    content: userMessage,
    timestamp: Date.now(),
  };
  state.messages.push(userMsg);

  // Trim history
  while (state.messages.length > MAX_HISTORY) {
    state.messages.shift();
  }

  const messageId = `asst-${Date.now()}`;
  let fullResponse = "";

  try {
    // Build messages for Ollama
    const systemPrompt = buildSystemPrompt(deploymentArea);
    const ollamaMessages = [
      { role: "system" as const, content: systemPrompt },
      ...state.messages
        .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "system")
        .map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
    ];

    // Stream initial response from Ollama
    const response = await client.chat({
      model,
      messages: ollamaMessages,
      stream: true,
      options: { temperature: 0.3, num_predict: NUM_PREDICT },
    });

    // Stream tokens
    for await (const chunk of response) {
      if (state.abortController?.signal.aborted) break;

      const token = chunk.message?.content || "";
      if (token) {
        fullResponse += token;
        emitChatToken(messageId, token, false);
      }
    }

    if (state.abortController?.signal.aborted) {
      emitChatToken(messageId, "", true);
      return;
    }

    // Check for action blocks in the full response
    let actions = parseActions(fullResponse);

    // Fallback: detect intent from the user message if no action blocks
    if (actions.length === 0 && deploymentArea) {
      actions = detectIntentFallback(userMessage);
    }

    // Execute agent dispatches if any
    if (actions.length > 0 && deploymentArea) {
      // Strip action block text from visible response
      const cleanedResponse = fullResponse.replace(/<<ACTION:[^>]+>>/g, "").trim();
      if (cleanedResponse !== fullResponse) {
        fullResponse = cleanedResponse;
      }

      // Dispatch agents sequentially
      const allResults: AgentIntelItem[] = [];
      for (const action of actions) {
        if (state.abortController?.signal.aborted) break;

        const results = await dispatchAgent(action.agentId, deploymentArea, messageId);
        allResults.push(...results);

        // Inject results into conversation for synthesis
        if (results.length > 0) {
          const summary = summarizeResults(action.agentId, results);
          ollamaMessages.push({ role: "assistant", content: fullResponse || "Dispatching agents..." });
          ollamaMessages.push({ role: "system", content: summary });
        }
      }

      // Generate synthesis if we got results
      if (allResults.length > 0 && !state.abortController?.signal.aborted) {
        ollamaMessages.push({
          role: "user",
          content: "Now synthesize the intelligence into a concise tactical briefing. Highlight key findings and threats.",
        });

        emitChatToken(messageId, "\n\n", false);

        const synthesis = await client.chat({
          model,
          messages: ollamaMessages,
          stream: true,
          options: { temperature: 0.3, num_predict: NUM_PREDICT },
        });

        for await (const chunk of synthesis) {
          if (state.abortController?.signal.aborted) break;
          const token = chunk.message?.content || "";
          if (token) {
            fullResponse += token;
            emitChatToken(messageId, token, false);
          }
        }
      }
    }

    // Signal done
    emitChatToken(messageId, "", true);

    // Save assistant message to history
    state.messages.push({
      id: messageId,
      role: "assistant",
      content: fullResponse,
      timestamp: Date.now(),
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    if (!errMsg.includes("aborted")) {
      emitChatToken(messageId, `\n\n[Error: ${errMsg}]`, false);
    }
    emitChatToken(messageId, "", true);
  } finally {
    state.isGenerating = false;
    state.abortController = null;
  }
}

// ── Public API ───────────────────────────────────────────────────

export function getChatHistory(): ChatMessage[] {
  return getChatState().messages;
}

export function clearChatHistory(): void {
  const state = getChatState();
  if (state.isGenerating && state.abortController) {
    state.abortController.abort();
  }
  state.messages = [];
  state.isGenerating = false;
  state.abortController = null;
}

export function abortChat(): void {
  const state = getChatState();
  if (state.abortController) {
    state.abortController.abort();
  }
  state.isGenerating = false;
}

export function isChatGenerating(): boolean {
  return getChatState().isGenerating;
}
