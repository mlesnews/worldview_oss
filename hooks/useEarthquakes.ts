"use client";

import { useState, useEffect, useRef } from "react";
import type { Earthquake } from "@/types";

export function useEarthquakes(enabled: boolean) {
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setEarthquakes([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/earthquakes");
        if (res.ok) {
          const data = await res.json();
          setEarthquakes(data);
        }
      } catch (err) {
        console.error("Earthquake fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    intervalRef.current = setInterval(fetchData, 30_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled]);

  return { earthquakes, loading };
}
