"use client";

import { useState, useEffect, useRef } from "react";
import type { MonkeyWerxSitrep } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

export function useMonkeyWerx(enabled: boolean) {
  const [items, setItems] = useState<MonkeyWerxSitrep[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const setMonkeyWerxSitreps = useWorldViewStore(
    (s) => s.setMonkeyWerxSitreps
  );

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setMonkeyWerxSitreps([]);
      return;
    }

    const fetchData = async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      try {
        const res = await fetch("/api/kintsugi/monkeywerx", {
          signal: abortRef.current.signal,
        });
        if (res.ok) {
          const data: MonkeyWerxSitrep[] = await res.json();
          setItems(data);
          setMonkeyWerxSitreps(data);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError")
          console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    intervalRef.current = setInterval(fetchData, 60_000);

    return () => {
      abortRef.current?.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, setMonkeyWerxSitreps]);

  return { items, loading };
}
