"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { LiveStream } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

export function useLiveStreams(enabled: boolean) {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewport = useWorldViewStore((s) => s.viewport);
  const setLiveStreams = useWorldViewStore((s) => s.setLiveStreams);

  // Coarse key (~111km grid) so small pans don't trigger refetches
  const viewportKey = viewport.isZoomedIn
    ? `${viewport.centerLat.toFixed(0)},${viewport.centerLon.toFixed(0)}`
    : "global";

  // Use ref to always have latest viewport in the fetch callback
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const vp = viewportRef.current;
      let url = "/api/livestreams";
      if (vp.isZoomedIn) {
        const params = new URLSearchParams({
          lat: String(vp.centerLat),
          lon: String(vp.centerLon),
        });
        url = `/api/livestreams?${params}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStreams(data);
        setLiveStreams(data);
      }
    } catch (err) {
      console.error("LiveStream fetch error:", err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Zustand actions are stable refs
  }, [setLiveStreams]);

  useEffect(() => {
    if (!enabled) {
      setStreams([]);
      setLiveStreams([]);
      return;
    }

    fetchData();
    intervalRef.current = setInterval(fetchData, 1800_000); // 30 min

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, viewportKey, fetchData]);

  return { streams, loading };
}
