"use client";

import { useState, useEffect, useRef } from "react";
import type { CryptoMiningNode } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

export function useCryptoMining(enabled: boolean) {
  const [items, setItems] = useState<CryptoMiningNode[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const setCryptoMiningNodes = useWorldViewStore((s) => s.setCryptoMiningNodes);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setCryptoMiningNodes([]);
      return;
    }

    const fetchData = async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      try {
        const res = await fetch("/api/kintsugi/crypto-mining", {
          signal: abortRef.current.signal,
        });
        if (res.ok) {
          const data: CryptoMiningNode[] = await res.json();
          setItems(data);
          setCryptoMiningNodes(data);
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
  }, [enabled, setCryptoMiningNodes]);

  return { items, loading };
}
