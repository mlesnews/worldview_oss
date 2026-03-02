"use client";

import { useState, useEffect, useRef } from "react";
import type { Disaster } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

export function useDisasters(enabled: boolean) {
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const setDisasterEvents = useWorldViewStore((s) => s.setDisasterEvents);
  const isLive = useWorldViewStore((s) => s.isLive);
  const simulationDate = useWorldViewStore((s) => s.simulationDate);

  // Track simulation date changes
  const simKey = isLive
    ? "live"
    : simulationDate.toISOString().slice(0, 10);

  useEffect(() => {
    if (!enabled) {
      setDisasters([]);
      setDisasterEvents([]);
      return;
    }

    const fetchData = async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      try {
        let url = "/api/disasters";
        if (!isLive) {
          const dateStr = simulationDate
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "");
          url = `/api/disasters?date=${dateStr}`;
        }

        const res = await fetch(url, { signal: abortRef.current.signal });
        if (res.ok) {
          const data = await res.json();
          setDisasters(data);
          setDisasterEvents(data);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Disaster fetch error:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Only poll in live mode
    if (isLive) {
      intervalRef.current = setInterval(fetchData, 300_000); // 5 min
    }

    return () => {
      abortRef.current?.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, simKey, isLive, simulationDate, setDisasterEvents]);

  return { disasters, loading };
}
