"use client";

import { useState, useEffect, useRef } from "react";
import type { Satellite } from "@/types";

export function useSatellites(enabled: boolean) {
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSatellites([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/satellites?group=stations");
        if (res.ok) {
          const data = await res.json();
          setSatellites(data);
        }
      } catch (err) {
        console.error("Satellite fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    intervalRef.current = setInterval(fetchData, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled]);

  return { satellites, loading };
}
