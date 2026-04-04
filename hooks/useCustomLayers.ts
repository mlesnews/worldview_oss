"use client";

import { useState, useEffect, useRef } from "react";
import type { CustomLayer } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

export function useCustomLayers(enabled: boolean) {
  const [items, setItems] = useState<CustomLayer[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const setCustomLayerItems = useWorldViewStore((s) => s.setCustomLayerItems);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setCustomLayerItems([]);
      return;
    }

    const fetchData = async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      try {
        const res = await fetch("/api/kintsugi/custom-layers", {
          signal: abortRef.current.signal,
        });
        if (res.ok) {
          const data: CustomLayer[] = await res.json();
          setItems(data);
          setCustomLayerItems(data);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError")
          console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    intervalRef.current = setInterval(fetchData, 300_000);

    return () => {
      abortRef.current?.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, setCustomLayerItems]);

  return { items, loading };
}
