"use client";

import { useEffect, useCallback } from "react";
import { useWorldViewStore } from "@/stores/worldview-store";
import { useMissionControl } from "@/hooks/useMissionControl";
import MissionHeader from "./MissionHeader";
import AgentCardList from "./AgentCardList";
import MissionLog from "./MissionLog";
import MissionResults from "./MissionResults";
import ChatPanel from "./ChatPanel";

export default function MissionControlModal() {
  const isOpen = useWorldViewStore((s) => s.missionControl.missionModalOpen);
  const mc = useWorldViewStore((s) => s.missionControl);
  const closeMissionModal = useWorldViewStore((s) => s.closeMissionModal);
  const updateAgentState = useWorldViewStore((s) => s.updateAgentState);
  const setRepositionMode = useWorldViewStore((s) => s.setRepositionMode);

  const {
    skipAgent,
    pauseAgent,
    resumeAgent,
    cancelAgent,
    initAgentStates,
  } = useMissionControl();

  // Initialize agent states when modal opens
  useEffect(() => {
    if (isOpen && mc.agentStates.length === 0 && mc.deploymentArea) {
      fetch("/api/agents/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "init", area: mc.deploymentArea }),
      })
        .then(() => initAgentStates())
        .catch(() => initAgentStates());
    }
  }, [isOpen, mc.deploymentArea]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key: cancel reposition or close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mc.repositionMode) {
          setRepositionMode(false);
        } else {
          closeMissionModal();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, mc.repositionMode, closeMissionModal, setRepositionMode]);

  const handlePromptChange = useCallback(
    (agentId: string, prompt: string) => {
      updateAgentState(agentId, { systemPrompt: prompt });
      fetch("/api/agents/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_prompt", agentId, prompt }),
      }).catch(() => {});
    },
    [updateAgentState]
  );

  if (!isOpen) return null;

  // Collapsed reposition bar — exposes globe for drag/resize
  if (mc.repositionMode) {
    return (
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#000a00]/95 border border-green-900/40 rounded px-6 py-3 backdrop-blur-sm max-w-2xl w-full">
        <MissionHeader />
        <div className="text-center text-[9px] font-mono text-green-600/50 mt-2 tracking-wide">
          DRAG PIN TO MOVE | DRAG EDGE TO RESIZE | SCROLL TO ADJUST RADIUS
        </div>
        <div className="flex justify-center gap-3 mt-2">
          <button
            onClick={() => setRepositionMode(false)}
            className="px-4 py-1 text-[9px] font-mono tracking-wide border border-yellow-600/50 text-yellow-400 bg-yellow-950/20 hover:bg-yellow-900/20 cursor-pointer transition-all"
          >
            CONFIRM POSITION
          </button>
          <button
            onClick={() => {
              // Discard pending changes by restoring from Zustand (area unchanged)
              setRepositionMode(false);
            }}
            className="px-4 py-1 text-[9px] font-mono tracking-wide border border-green-900/30 text-green-600/50 hover:text-green-500/70 cursor-pointer transition-all"
          >
            CANCEL
          </button>
        </div>
      </div>
    );
  }

  // Full modal
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#000a00]/95 border border-green-900/30">
      {/* Header */}
      <MissionHeader />

      {/* 3-region layout: agents left | right column (switchable) */}
      <div className="flex flex-1 min-h-0">
        {/* Left column: Agent cards (~40%) */}
        <div className="w-[40%] border-r border-green-900/20 flex flex-col min-h-0">
          <AgentCardList
            agents={mc.agentStates}
            missionPhase={mc.missionPhase}
            onSkip={skipAgent}
            onPause={pauseAgent}
            onResume={resumeAgent}
            onCancel={cancelAgent}
            onPromptChange={handlePromptChange}
          />
        </div>

        {/* Right column: Chat or Log+Results */}
        <div className="flex-1 flex flex-col min-h-0">
          {mc.chatActive ? (
            <ChatPanel />
          ) : (
            <>
              {/* Log — top half */}
              <div className="flex-1 border-b border-green-900/20 flex flex-col min-h-0">
                <MissionLog logs={mc.missionLogs} />
              </div>
              {/* Results — bottom half */}
              <div className="flex-1 flex flex-col min-h-0">
                <MissionResults results={mc.missionResults} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
