"use client";

import { useState, useEffect, useRef } from "react";
import type { Flight } from "@/types";

export function useFlights(enabled: boolean) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setFlights([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/flights");
        if (res.ok) {
          const data = await res.json();
          setFlights(data);
        }
      } catch (err) {
        console.error("Flight fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    intervalRef.current = setInterval(fetchData, 15_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled]);

  return { flights, loading };
}
