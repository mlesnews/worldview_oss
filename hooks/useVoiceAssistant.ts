"use client";

import { useEffect, useRef, useCallback } from "react";
import { useWorldViewStore } from "@/stores/worldview-store";
import { parseToolCalls, stripToolMarkers, executeTool } from "@/lib/voice/tools";
import { VOICE_STATUS_POLL_MS, VOICE_MAX_RECORDING_MS } from "@/lib/constants";
import type { VoiceStatus } from "@/types";

export function useVoiceAssistant() {
  const status = useWorldViewStore((s) => s.voiceAssistant.status);
  const sidecarConnected = useWorldViewStore((s) => s.voiceAssistant.sidecarConnected);
  const setVoiceStatus = useWorldViewStore((s) => s.setVoiceStatus);
  const setVoiceSidecarConnected = useWorldViewStore((s) => s.setVoiceSidecarConnected);
  const setVoiceLastExchange = useWorldViewStore((s) => s.setVoiceLastExchange);
  const setVoiceError = useWorldViewStore((s) => s.setVoiceError);
  const setVoiceTranscript = useWorldViewStore((s) => s.setVoiceTranscript);

  // Store actions for tool execution
  const flyTo = useWorldViewStore((s) => s.flyTo);
  const toggleLayer = useWorldViewStore((s) => s.toggleLayer);
  const setViewMode = useWorldViewStore((s) => s.setViewMode);
  const setDeploymentArea = useWorldViewStore((s) => s.setDeploymentArea);
  const openMissionModal = useWorldViewStore((s) => s.openMissionModal);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const maxRecordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<VoiceStatus>(status);
  statusRef.current = status;

  // ── Health check polling ────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await fetch("/api/voice/status", {
          signal: AbortSignal.timeout(3000),
        });
        const data = await res.json();
        if (mounted) setVoiceSidecarConnected(!!data.connected);
      } catch {
        if (mounted) setVoiceSidecarConnected(false);
      }
    };
    check();
    const interval = setInterval(check, VOICE_STATUS_POLL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setVoiceSidecarConnected]);

  // ── Start recording ─────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!sidecarConnected) return;
    if (statusRef.current === "recording") return;

    // Interrupt playback if speaking
    if (statusRef.current === "speaking") {
      audioSourceRef.current?.stop();
      audioSourceRef.current = null;
    }
    // Abort any in-flight request
    abortRef.current?.abort();

    // Create AudioContext on user gesture (browser autoplay policy)
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Release mic tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (maxRecordingTimerRef.current) {
          clearTimeout(maxRecordingTimerRef.current);
          maxRecordingTimerRef.current = null;
        }
        // Only send if we have audio and weren't aborted
        if (chunksRef.current.length > 0 && statusRef.current !== "idle") {
          sendAudio(new Blob(chunksRef.current, { type: "audio/webm" }));
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // collect chunks every 250ms
      setVoiceStatus("recording");
      setVoiceError(null);

      // Auto-stop after max duration
      maxRecordingTimerRef.current = setTimeout(() => {
        stopRecording();
      }, VOICE_MAX_RECORDING_MS);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Microphone access denied");
      setVoiceStatus("idle");
    }
  }, [sidecarConnected, setVoiceStatus, setVoiceError]);

  // ── Stop recording ──────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ── Send audio to API ───────────────────────────────────────
  const sendAudio = useCallback(
    async (blob: Blob) => {
      setVoiceStatus("processing");
      const controller = new AbortController();
      abortRef.current = controller;

      const startTime = Date.now();
      try {
        const form = new FormData();
        form.append("audio", blob, "recording.webm");

        const res = await fetch("/api/voice", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          setVoiceError(err.error ?? "Request failed");
          setVoiceStatus("idle");
          return;
        }

        const data = await res.json();
        const text: string = data.text ?? "";
        const audioBase64: string | null = data.audioBase64 ?? null;

        // Parse and execute tool calls
        const toolCalls = parseToolCalls(text);
        const displayText = stripToolMarkers(text);
        setVoiceTranscript(displayText);

        // Record exchange
        setVoiceLastExchange({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          userAudioDurationMs: Date.now() - startTime,
          assistantText: displayText,
          toolCalls,
        });

        // Execute tools
        const storeActions = { flyTo, toggleLayer, setViewMode, setDeploymentArea, openMissionModal };
        for (const call of toolCalls) {
          await executeTool(call, storeActions);
        }

        // Play audio response
        if (audioBase64 && audioCtxRef.current) {
          try {
            setVoiceStatus("speaking");
            const raw = atob(audioBase64);
            const buf = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);

            const audioBuffer = await audioCtxRef.current.decodeAudioData(buf.buffer);
            const source = audioCtxRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioCtxRef.current.destination);
            audioSourceRef.current = source;

            source.onended = () => {
              audioSourceRef.current = null;
              if (statusRef.current === "speaking") {
                setVoiceStatus("idle");
              }
            };
            source.start();
          } catch {
            // Audio decode/play failed, fall back to idle
            setVoiceStatus("idle");
          }
        } else {
          setVoiceStatus("idle");
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setVoiceError((err as Error).message ?? "Voice request failed");
        }
        setVoiceStatus("idle");
      }
    },
    [
      setVoiceStatus, setVoiceError, setVoiceTranscript, setVoiceLastExchange,
      flyTo, toggleLayer, setViewMode, setDeploymentArea, openMissionModal,
    ],
  );

  // ── Stop playback ──────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    audioSourceRef.current?.stop();
    audioSourceRef.current = null;
    abortRef.current?.abort();
    if (statusRef.current === "speaking" || statusRef.current === "processing") {
      setVoiceStatus("idle");
    }
    // Notify sidecar to cancel generation
    fetch("/api/voice/interrupt", { method: "POST" }).catch(() => {});
  }, [setVoiceStatus]);

  // ── V key push-to-talk ─────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key !== "v" && e.key !== "V") return;
      // Skip if focused on input elements
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;

      e.preventDefault();
      if (statusRef.current === "speaking") {
        stopPlayback();
      }
      startRecording();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "v" && e.key !== "V") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;

      e.preventDefault();
      if (statusRef.current === "recording") {
        stopRecording();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startRecording, stopRecording, stopPlayback]);

  // ── Cleanup on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      audioSourceRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (maxRecordingTimerRef.current) clearTimeout(maxRecordingTimerRef.current);
    };
  }, []);

  return { status, sidecarConnected, startRecording, stopRecording, stopPlayback };
}
