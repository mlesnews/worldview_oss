"use client";

import { useState, useEffect, useRef } from "react";
import type { SyphonEvent } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

export function useSyphonIntel(enabled: boolean) {
  const [items, setItems] = useState<SyphonEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const setSyphonEvents = useWorldViewStore((s) => s.setSyphonEvents);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setSyphonEvents([]);
      return;
    }

    const fetchData = async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      try {
        const res = await fetch("/api/kintsugi/syphon", {
          signal: abortRef.current.signal,
        });
        if (res.ok) {
          const data: SyphonEvent[] = await res.json();
          setItems(data);
          setSyphonEvents(data);
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
    intervalRef.current = setInterval(fetchData, 300_000); // 5 min

    return () => {
      abortRef.current?.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, setSyphonEvents]);

  return { items, loading };
}
