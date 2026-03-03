"use client";

import { useEffect, useRef, useCallback } from "react";
import { useWorldViewStore } from "@/stores/worldview-store";
import type {
  DeploymentAreaClient,
  MissionAgentClientState,
  AgentIntelItemClient,
  ChatMessageClient,
} from "@/types";

/** Agent ID → display name / role mapping */
const AGENT_INFO: Record<string, { name: string; role: string }> = {
  "news-scout": { name: "News Scout", role: "Breaking news & geopolitical events" },
  "military-analyst": { name: "Military Analyst", role: "Conflict & military operations" },
  "disaster-monitor": { name: "Disaster Monitor", role: "Natural disasters & emergencies" },
  "geoint-analyst": { name: "GEOINT Analyst", role: "Geospatial intelligence enrichment" },
};

// ── Module-level SSE singleton ────────────────────────────────────
// Prevents multiple EventSource connections when the hook is used
// from multiple components (MissionControlModal, ChatPanel, MissionHeader).
let globalEventSource: EventSource | null = null;
let sseRefCount = 0;

export function useMissionControl() {
  const mc = useWorldViewStore((s) => s.missionControl);
  const setMissionPhase = useWorldViewStore((s) => s.setMissionPhase);
  const updateAgentState = useWorldViewStore((s) => s.updateAgentState);
  const setAgentStates = useWorldViewStore((s) => s.setAgentStates);
  const addMissionLog = useWorldViewStore((s) => s.addMissionLog);
  const setMissionResults = useWorldViewStore((s) => s.setMissionResults);
  const setMissionOllamaStatus = useWorldViewStore((s) => s.setMissionOllamaStatus);
  const clearMission = useWorldViewStore((s) => s.clearMission);
  const addChatMessage = useWorldViewStore((s) => s.addChatMessage);
  const updateChatMessage = useWorldViewStore((s) => s.updateChatMessage);
  const setChatGenerating = useWorldViewStore((s) => s.setChatGenerating);

  // Check Ollama status on mount
  useEffect(() => {
    if (!mc.missionModalOpen) return;

    const checkStatus = async () => {
      try {
        const res = await fetch("/api/agents/mission");
        if (res.ok) {
          const data = await res.json();
          setMissionOllamaStatus(data.ollamaConnected, data.modelName);

          // If there's an active mission with agents, restore state
          if (data.mission?.agents?.length > 0 && mc.agentStates.length === 0) {
            const states: MissionAgentClientState[] = data.mission.agents.map(
              (a: { agentId: string; status: string; systemPrompt: string; startedAt?: number; completedAt?: number; result?: { data: unknown[] }; error?: string; processingTimeMs?: number }) => ({
                agentId: a.agentId,
                agentName: AGENT_INFO[a.agentId]?.name || a.agentId,
                role: AGENT_INFO[a.agentId]?.role || "",
                status: a.status,
                systemPrompt: a.systemPrompt,
                startedAt: a.startedAt,
                completedAt: a.completedAt,
                itemCount: a.result?.data?.length || 0,
                processingTimeMs: a.completedAt && a.startedAt ? a.completedAt - a.startedAt : 0,
                error: a.error,
              })
            );
            setAgentStates(states);
          }
        }
      } catch {
        setMissionOllamaStatus(false, null);
      }
    };

    checkStatus();
  }, [mc.missionModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Connect SSE when deploying OR when chat is active.
  // Uses a module-level singleton so multiple hook instances share one connection.
  const needsSse = (mc.missionPhase === "deploying" || mc.chatActive) && mc.missionModalOpen;

  useEffect(() => {
    if (!needsSse) {
      return;
    }

    // Increment ref count — only the first caller creates the connection
    sseRefCount++;
    if (sseRefCount > 1) {
      // Connection already exists from another hook instance
      return () => { sseRefCount--; };
    }

    // Close any stale connection
    if (globalEventSource) {
      globalEventSource.close();
      globalEventSource = null;
    }

    const es = new EventSource("/api/agents/mission/stream");
    globalEventSource = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const store = useWorldViewStore.getState();

        switch (data.type) {
          case "log":
            store.addMissionLog({
              id: data.id,
              timestamp: data.timestamp,
              agentId: data.agentId,
              level: data.level,
              message: data.message,
            });
            break;

          case "agent_status": {
            const update: Partial<MissionAgentClientState> = {
              status: data.status,
            };
            if (data.error) update.error = data.error;
            if (data.result) {
              update.itemCount = data.result.data?.length || 0;
              update.processingTimeMs = data.result.processingTimeMs || 0;
              if (data.status === "completed") update.completedAt = Date.now();

              if (data.result.data?.length > 0) {
                const newItems: AgentIntelItemClient[] = data.result.data.map(
                  (item: Record<string, unknown>) => ({
                    id: String(item.id || ""),
                    title: String(item.title || ""),
                    summary: String(item.summary || ""),
                    latitude: Number(item.latitude) || 0,
                    longitude: Number(item.longitude) || 0,
                    category: String(item.category || ""),
                    subcategory: String(item.subcategory || ""),
                    confidence: Number(item.confidence) || 0,
                    sourceUrl: String(item.sourceUrl || ""),
                    timestamp: String(item.timestamp || ""),
                  })
                );
                const existing = store.missionControl.missionResults;
                const existingIds = new Set(existing.map((i) => i.id));
                const uniqueNew = newItems.filter((i) => !existingIds.has(i.id));
                if (uniqueNew.length > 0) {
                  store.setMissionResults([...existing, ...uniqueNew]);
                }
              }
            }
            store.updateAgentState(data.agentId, update);
            break;
          }

          case "phase":
            store.setMissionPhase(data.phase);
            break;

          case "chat_token": {
            const { messageId, token, done } = data;
            if (done) {
              store.updateChatMessage(messageId, { isStreaming: false });
              store.setChatGenerating(false);
            } else {
              const msgs = store.missionControl.chatMessages;
              const existingMsg = msgs.find((m) => m.id === messageId);
              if (existingMsg) {
                store.updateChatMessage(messageId, { content: existingMsg.content + token });
              } else {
                store.addChatMessage({
                  id: messageId,
                  role: "assistant",
                  content: token,
                  timestamp: Date.now(),
                  isStreaming: true,
                });
              }
            }
            break;
          }

          case "chat_action": {
            const { messageId, action, agentId, results } = data;
            const actionId = `${messageId}-action-${agentId}`;
            if (action === "dispatching") {
              store.addChatMessage({
                id: actionId,
                role: "agent_result",
                content: `Dispatching ${agentId}...`,
                timestamp: Date.now(),
                agentId,
                isStreaming: true,
              });
            } else if (action === "completed") {
              const resultItems: AgentIntelItemClient[] = (results || []).map(
                (item: Record<string, unknown>) => ({
                  id: String(item.id || ""),
                  title: String(item.title || ""),
                  summary: String(item.summary || ""),
                  latitude: Number(item.latitude) || 0,
                  longitude: Number(item.longitude) || 0,
                  category: String(item.category || ""),
                  subcategory: String(item.subcategory || ""),
                  confidence: Number(item.confidence) || 0,
                  sourceUrl: String(item.sourceUrl || ""),
                  timestamp: String(item.timestamp || ""),
                })
              );
              store.updateChatMessage(actionId, {
                content: `${agentId}: ${resultItems.length} items found`,
                agentResults: resultItems,
                isStreaming: false,
              });
              if (resultItems.length > 0) {
                const existing = store.missionControl.missionResults;
                const existingIds = new Set(existing.map((i) => i.id));
                const uniqueNew = resultItems.filter((i) => !existingIds.has(i.id));
                if (uniqueNew.length > 0) {
                  store.setMissionResults([...existing, ...uniqueNew]);
                }
              }
            } else if (action === "failed") {
              store.updateChatMessage(actionId, {
                content: `${agentId}: failed to gather intel`,
                isStreaming: false,
              });
            }
            break;
          }

          case "connected":
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      const current = useWorldViewStore.getState().missionControl;
      if (current.missionPhase !== "deploying" && !current.chatActive) {
        es.close();
        globalEventSource = null;
      }
    };

    return () => {
      sseRefCount--;
      if (sseRefCount <= 0) {
        sseRefCount = 0;
        es.close();
        globalEventSource = null;
      }
    };
  }, [needsSse]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── API actions ────────────────────────────────────────────────

  const deploy = useCallback(
    async (area: DeploymentAreaClient, prompts?: Record<string, string>) => {
      // Initialize agent states for UI display
      const agentIds = mc.agentStates
        .filter((a) => a.status !== "skipped")
        .map((a) => a.agentId);

      setMissionPhase("deploying");

      try {
        await fetch("/api/agents/mission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "deploy",
            area,
            agentIds: agentIds.length > 0 ? agentIds : undefined,
            prompts,
          }),
        });
      } catch {
        setMissionPhase("aborted");
      }
    },
    [mc.agentStates, setMissionPhase]
  );

  const abort = useCallback(async () => {
    try {
      await fetch("/api/agents/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "abort" }),
      });
    } catch {
      // ignore
    }
  }, []);

  const pauseAgentAction = useCallback(async (agentId: string) => {
    try {
      await fetch("/api/agents/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause", agentId }),
      });
      updateAgentState(agentId, { status: "paused" });
    } catch {
      // ignore
    }
  }, [updateAgentState]);

  const resumeAgentAction = useCallback(async (agentId: string) => {
    try {
      await fetch("/api/agents/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume", agentId }),
      });
      updateAgentState(agentId, { status: "running" });
    } catch {
      // ignore
    }
  }, [updateAgentState]);

  const cancelAgentAction = useCallback(async (agentId: string) => {
    try {
      await fetch("/api/agents/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", agentId }),
      });
      updateAgentState(agentId, { status: "cancelled" });
    } catch {
      // ignore
    }
  }, [updateAgentState]);

  const skipAgentAction = useCallback(async (agentId: string) => {
    try {
      await fetch("/api/agents/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip", agentId }),
      });
      updateAgentState(agentId, { status: "skipped" });
    } catch {
      // ignore
    }
  }, [updateAgentState]);

  // ── Chat actions ──────────────────────────────────────────────

  const sendChatMessage = useCallback(
    async (message: string) => {
      const area = useWorldViewStore.getState().missionControl.deploymentArea;
      setChatGenerating(true);

      // Optimistic: add user message immediately
      addChatMessage({
        id: `user-${Date.now()}`,
        role: "user",
        content: message,
        timestamp: Date.now(),
      });

      try {
        await fetch("/api/agents/mission/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, deploymentArea: area }),
        });
      } catch {
        setChatGenerating(false);
      }
    },
    [addChatMessage, setChatGenerating]
  );

  const stopChat = useCallback(async () => {
    try {
      await fetch("/api/agents/mission/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "abort" }),
      });
    } catch {
      // ignore
    }
    setChatGenerating(false);
  }, [setChatGenerating]);

  const initAgentStates = useCallback(() => {
    const states: MissionAgentClientState[] = Object.entries(AGENT_INFO).map(
      ([id, info]) => ({
        agentId: id,
        agentName: info.name,
        role: info.role,
        status: "pending" as const,
        systemPrompt: "",
        itemCount: 0,
        processingTimeMs: 0,
      })
    );
    setAgentStates(states);

    // Fetch actual system prompts from server
    fetch("/api/agents/mission")
      .then((r) => r.json())
      .then((data) => {
        if (data.mission?.agents) {
          const updated: MissionAgentClientState[] = data.mission.agents.map(
            (a: { agentId: string; systemPrompt: string; status: string }) => ({
              agentId: a.agentId,
              agentName: AGENT_INFO[a.agentId]?.name || a.agentId,
              role: AGENT_INFO[a.agentId]?.role || "",
              status: a.status || "pending",
              systemPrompt: a.systemPrompt,
              itemCount: 0,
              processingTimeMs: 0,
            })
          );
          setAgentStates(updated);
        }
      })
      .catch(() => {});
  }, [setAgentStates]);

  return {
    missionControl: mc,
    deploy,
    abort,
    pauseAgent: pauseAgentAction,
    resumeAgent: resumeAgentAction,
    cancelAgent: cancelAgentAction,
    skipAgent: skipAgentAction,
    initAgentStates,
    clearMission,
    sendChatMessage,
    stopChat,
  };
}
