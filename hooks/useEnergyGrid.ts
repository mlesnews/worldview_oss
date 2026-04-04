"use client";

import { useState, useEffect, useRef } from "react";
import type { EnergyGridNode } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

export function useEnergyGrid(enabled: boolean) {
  const [items, setItems] = useState<EnergyGridNode[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const setEnergyGridNodes = useWorldViewStore((s) => s.setEnergyGridNodes);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setEnergyGridNodes([]);
      return;
    }

    const fetchData = async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      try {
        const res = await fetch("/api/kintsugi/energy-grid", {
          signal: abortRef.current.signal,
        });
        if (res.ok) {
          const data: EnergyGridNode[] = await res.json();
          setItems(data);
          setEnergyGridNodes(data);
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
    intervalRef.current = setInterval(fetchData, 600_000); // 10 min

    return () => {
      abortRef.current?.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, setEnergyGridNodes]);

  return { items, loading };
}
