"use client";

import { useState, useEffect, useRef } from "react";
import type { VcFundingEvent } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

export function useVcFunding(enabled: boolean) {
  const [items, setItems] = useState<VcFundingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const setVcFundingEvents = useWorldViewStore((s) => s.setVcFundingEvents);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setVcFundingEvents([]);
      return;
    }

    const fetchData = async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      try {
        const res = await fetch("/api/kintsugi/vc-funding", {
          signal: abortRef.current.signal,
        });
        if (res.ok) {
          const data: VcFundingEvent[] = await res.json();
          setItems(data);
          setVcFundingEvents(data);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError")
          console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    intervalRef.current = setInterval(fetchData, 600_000);

    return () => {
      abortRef.current?.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, setVcFundingEvents]);

  return { items, loading };
}
