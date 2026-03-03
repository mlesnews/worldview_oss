import type { AgentIntelItem } from "./types";

/** A single message in the specialist conversation */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "agent_result";
  content: string;
  timestamp: number;
  agentId?: string;
  agentResults?: AgentIntelItem[];
  isStreaming?: boolean;
}

/** Parsed action block from the specialist's output */
export interface ChatAction {
  type: "dispatch";
  agentId: string;
  focus?: string;
}
