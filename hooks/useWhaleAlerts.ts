"use client";

import { useState, useEffect, useRef } from "react";
import type { WhaleAlert } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

export function useWhaleAlerts(enabled: boolean) {
  const [items, setItems] = useState<WhaleAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const setWhaleAlerts = useWorldViewStore((s) => s.setWhaleAlerts);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setWhaleAlerts([]);
      return;
    }

    const fetchData = async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      try {
        const res = await fetch("/api/kintsugi/whale-alerts", {
          signal: abortRef.current.signal,
        });
        if (res.ok) {
          const data: WhaleAlert[] = await res.json();
          setItems(data);
          setWhaleAlerts(data);
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
    intervalRef.current = setInterval(fetchData, 60_000); // 1 min

    return () => {
      abortRef.current?.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, setWhaleAlerts]);

  return { items, loading };
}
