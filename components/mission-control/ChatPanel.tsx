"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useWorldViewStore } from "@/stores/worldview-store";
import { useMissionControl } from "@/hooks/useMissionControl";
import ChatMessage from "./ChatMessage";

export default function ChatPanel() {
  const mc = useWorldViewStore((s) => s.missionControl);
  const clearChat = useWorldViewStore((s) => s.clearChat);
  const { sendChatMessage, stopChat } = useMissionControl();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [mc.chatMessages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || mc.chatGenerating) return;
    sendChatMessage(trimmed);
    setInput("");
  }, [input, mc.chatGenerating, sendChatMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const isOffline = !mc.ollamaConnected;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-green-900/20 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-mono tracking-[0.15em] text-green-500/70">
            SPECIALIST CHAT
          </div>
          {mc.deploymentArea && (
            <div className="text-[7px] font-mono text-green-700/40 mt-0.5">
              ZONE: {mc.deploymentArea.lat.toFixed(4)}°, {mc.deploymentArea.lon.toFixed(4)}° | {mc.deploymentArea.radiusKm}km
            </div>
          )}
        </div>
        {mc.chatMessages.length > 0 && (
          <button
            onClick={() => {
              clearChat();
              fetch("/api/agents/mission/chat", { method: "DELETE" }).catch(() => {});
            }}
            disabled={mc.chatGenerating}
            className="px-2 py-0.5 text-[8px] font-mono tracking-wide border border-green-900/30 text-green-600/50 hover:text-red-400/70 hover:border-red-800/40 cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            CLEAR
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 py-2"
      >
        {mc.chatMessages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-[10px] font-mono text-green-600/40 tracking-wide">
                SPECIALIST READY
              </div>
              <div className="text-[8px] font-mono text-green-700/30 mt-2 max-w-[200px] leading-relaxed">
                Ask about the deployment area or request intelligence gathering.
                The specialist will dispatch agents as needed.
              </div>
            </div>
          </div>
        )}
        {mc.chatMessages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-green-900/20 p-2">
        {isOffline ? (
          <div className="text-[9px] font-mono text-red-500/60 tracking-wide text-center py-2">
            SPECIALIST OFFLINE — OLLAMA NOT CONNECTED
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter message..."
              disabled={mc.chatGenerating}
              className="flex-1 px-2 py-1.5 text-[9px] font-mono text-green-400 bg-green-950/30 border border-green-900/30 focus:border-green-600/50 outline-none placeholder:text-green-800/40 disabled:opacity-50"
            />
            {mc.chatGenerating ? (
              <button
                onClick={stopChat}
                className="px-3 py-1.5 text-[9px] font-mono tracking-wide border border-red-800/50 text-red-400/80 bg-red-950/20 hover:bg-red-900/20 hover:border-red-700/50 cursor-pointer transition-all flex-shrink-0"
              >
                STOP
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className={`px-3 py-1.5 text-[9px] font-mono tracking-wide border transition-all flex-shrink-0 ${
                  input.trim()
                    ? "border-green-500/50 text-green-400 bg-green-950/30 hover:bg-green-900/30 cursor-pointer"
                    : "border-green-900/20 text-green-700/30 cursor-not-allowed"
                }`}
              >
                SEND
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
