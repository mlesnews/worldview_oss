"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { NewsArticle } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

export function useNews(enabled: boolean) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewport = useWorldViewStore((s) => s.viewport);
  const setNewsArticles = useWorldViewStore((s) => s.setNewsArticles);

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
      let url = "/api/news";
      if (vp.isZoomedIn) {
        const params = new URLSearchParams({
          lat: String(vp.centerLat),
          lon: String(vp.centerLon),
          radius: String(Math.round(vp.radiusKm)),
        });
        url = `/api/news?${params}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setNews(data);
        setNewsArticles(data);
      }
    } catch (err) {
      console.error("News fetch error:", err);
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
    intervalRef.current = setInterval(fetchData, 300_000); // 5 min

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, viewportKey, fetchData]);

  return { news, loading };
}
