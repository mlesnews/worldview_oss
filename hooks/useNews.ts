"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { NewsArticle } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

export function useNews(enabled: boolean) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const viewport = useWorldViewStore((s) => s.viewport);
  const setNewsArticles = useWorldViewStore((s) => s.setNewsArticles);
  const isLive = useWorldViewStore((s) => s.isLive);
  const simulationDate = useWorldViewStore((s) => s.simulationDate);
  const simulationHour = useWorldViewStore((s) => s.simulationHour);

  // Coarse key (~111km grid) so small pans don't trigger refetches
  const viewportKey = viewport.isZoomedIn
    ? `${viewport.centerLat.toFixed(0)},${viewport.centerLon.toFixed(0)}`
    : "global";

  // Track simulation time changes
  const simKey = isLive
    ? "live"
    : `${simulationDate.toISOString().slice(0, 10)}-${simulationHour}`;

  // Use refs to always have latest values in the fetch callback
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const isLiveRef = useRef(isLive);
  isLiveRef.current = isLive;
  const simDateRef = useRef(simulationDate);
  simDateRef.current = simulationDate;
  const simHourRef = useRef(simulationHour);
  simHourRef.current = simulationHour;

  const fetchData = useCallback(async () => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoading(true);
    try {
      const vp = viewportRef.current;

      if (isLiveRef.current) {
        // Live mode: use the primary /api/news endpoint (GDELT + RSS + Reddit)
        let url = "/api/news";
        if (vp.isZoomedIn) {
          const params = new URLSearchParams({
            lat: String(vp.centerLat),
            lon: String(vp.centerLon),
            radius: String(Math.round(vp.radiusKm)),
          });
          url = `/api/news?${params}`;
        }

        const res = await fetch(url, { signal });
        if (res.ok) {
          const data: NewsArticle[] = await res.json();
          setNews(data);
          setNewsArticles(data);
        }
      } else {
        // Historical mode: query JanusGraph, fall back to empty
        const date = simDateRef.current;
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
        const hour = String(simHourRef.current).padStart(2, "0");
        const url = `/api/news/historical?date=${dateStr}&hour=${hour}`;

        const res = await fetch(url, { signal });
        if (res.ok) {
          const data: NewsArticle[] = await res.json();
          setNews(data);
          setNewsArticles(data);
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("News fetch error:", err);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Zustand actions are stable refs
  }, [setNewsArticles]);

  useEffect(() => {
    if (!enabled) {
      setNews([]);
      setNewsArticles([]);
      return;
    }

    fetchData();

    // Only poll in live mode
    if (isLive) {
      intervalRef.current = setInterval(fetchData, 300_000); // 5 min
    }

    return () => {
      abortRef.current?.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, viewportKey, simKey, fetchData, isLive]);

  return { news, loading };
}
