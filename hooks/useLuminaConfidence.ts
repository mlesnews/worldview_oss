"use client";

import { useState, useEffect, useRef } from "react";
import type { LuminaConfidencePoint } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

export function useLuminaConfidence(enabled: boolean) {
  const [items, setItems] = useState<LuminaConfidencePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const setLuminaConfidencePoints = useWorldViewStore(
    (s) => s.setLuminaConfidencePoints
  );

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLuminaConfidencePoints([]);
      return;
    }

    const fetchData = async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      try {
        const res = await fetch("/api/kintsugi/confidence", {
          signal: abortRef.current.signal,
        });
        if (res.ok) {
          const data: LuminaConfidencePoint[] = await res.json();
          setItems(data);
          setLuminaConfidencePoints(data);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError")
          console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    intervalRef.current = setInterval(fetchData, 300_000);

    return () => {
      abortRef.current?.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, setLuminaConfidencePoints]);

  return { items, loading };
}
