"use client";

import { useWorldViewStore } from "@/stores/worldview-store";

export default function VoiceGlowOverlay() {
  const status = useWorldViewStore((s) => s.voiceAssistant.status);

  if (status !== "recording") return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40 voice-glow-overlay" />
  );
}
