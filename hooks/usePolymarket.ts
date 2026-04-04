"use client";

import { useState, useEffect, useRef } from "react";
import type { PolymarketPrediction } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

export function usePolymarket(enabled: boolean) {
  const [items, setItems] = useState<PolymarketPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const setPolymarketPredictions = useWorldViewStore(
    (s) => s.setPolymarketPredictions,
  );

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setPolymarketPredictions([]);
      return;
    }

    const fetchData = async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      try {
        const res = await fetch("/api/kintsugi/polymarket", {
          signal: abortRef.current.signal,
        });
        if (res.ok) {
          const data: PolymarketPrediction[] = await res.json();
          setItems(data);
          setPolymarketPredictions(data);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Fetch error:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    intervalRef.current = setInterval(fetchData, 120_000); // 2 min

    return () => {
      abortRef.current?.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, setPolymarketPredictions]);

  return { items, loading };
}
