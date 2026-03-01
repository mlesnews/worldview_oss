"use client";

import { useState, useEffect, useRef } from "react";
import type { Disaster } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

export function useDisasters(enabled: boolean) {
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setDisasterEvents = useWorldViewStore((s) => s.setDisasterEvents);

  useEffect(() => {
    if (!enabled) {
      setDisasters([]);
      setDisasterEvents([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/disasters");
        if (res.ok) {
          const data = await res.json();
          setDisasters(data);
          setDisasterEvents(data);
        }
      } catch (err) {
        console.error("Disaster fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    intervalRef.current = setInterval(fetchData, 300_000); // 5 min

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled]);

  return { disasters, loading };
}
