"use client";

import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";

const MicIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const STATUS_LABELS: Record<string, string> = {
  offline: "OFFLINE",
  idle: "VOICE [V]",
  recording: "LISTENING",
  processing: "PROCESSING",
  speaking: "SPEAKING",
};

export default function VoiceButton() {
  const { status, startRecording, stopRecording, stopPlayback } = useVoiceAssistant();

  const onPointerDown = () => {
    if (status === "offline") return;
    if (status === "speaking") {
      stopPlayback();
    }
    startRecording();
  };

  const onPointerUp = () => {
    if (status === "recording") {
      stopRecording();
    }
  };

  const onPointerLeave = () => {
    if (status === "recording") {
      stopRecording();
    }
  };

  const btnClass = [
    "w-10 h-10 rounded-full flex items-center justify-center",
    "border transition-all duration-150 cursor-pointer select-none",
    "font-mono",
    status === "offline" && "border-red-900/50 bg-red-950/20 text-red-700/60",
    status === "idle" && "border-green-900/40 bg-green-900/20 text-green-600/70 hover:border-green-500/50 hover:text-green-400",
    status === "recording" && "border-green-400/80 bg-green-900/30 text-green-300 voice-btn-active",
    status === "processing" && "border-yellow-700/60 bg-yellow-950/20 text-yellow-500/80 animate-pulse",
    status === "speaking" && "border-green-600/50 bg-green-900/20 text-green-400/80 voice-btn-speaking",
  ].filter(Boolean).join(" ");

  const labelClass = [
    "text-[8px] tracking-wider font-mono mt-1",
    status === "offline" && "text-red-800/50",
    status === "idle" && "text-green-800/40",
    status === "recording" && "text-green-400/80",
    status === "processing" && "text-yellow-600/60",
    status === "speaking" && "text-green-500/50",
  ].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col items-center py-1">
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        className={btnClass}
        title={status === "offline" ? "Voice sidecar offline" : "Hold to talk (V)"}
      >
        <MicIcon />
      </button>
      <span className={labelClass}>{STATUS_LABELS[status] ?? "VOICE"}</span>
    </div>
  );
}
