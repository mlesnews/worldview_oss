"use client";

import { useState, useEffect, useRef } from "react";
import type { Asteroid } from "@/types";

export function useAsteroids(enabled: boolean) {
  const [asteroids, setAsteroids] = useState<Asteroid[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setAsteroids([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/asteroids");
        if (res.ok) {
          const data = await res.json();
          setAsteroids(data);
        }
      } catch (err) {
        console.error("Asteroid fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    intervalRef.current = setInterval(fetchData, 300_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled]);

  return { asteroids, loading };
}
