"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useWorldViewStore } from "@/stores/worldview-store";

interface GeoResult {
  name: string;
  lat: number;
  lon: number;
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const flyTo = useWorldViewStore((s) => s.flyTo);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: GeoResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
        setActiveIndex(-1);
      }
    } catch {
      setResults([]);
      setOpen(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(value), 400);
  };

  const select = (result: GeoResult) => {
    flyTo(result.lon, result.lat, 100_000);
    setQuery(result.name.split(",")[0]);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      select(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="panel-section relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="SEARCH LOCATION..."
          className="w-full bg-black/70 border border-green-900/50 text-green-400 font-mono text-[10px]
            tracking-wider px-2.5 py-1.5 rounded-sm placeholder:text-green-800/40
            focus:outline-none focus:border-green-500/50 focus:shadow-[0_0_8px_rgba(0,255,0,0.1)]"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-700/40 text-[9px] font-mono">
          {query.length > 0 ? "ESC" : "SRCH"}
        </span>
      </div>

      {open && results.length > 0 && (
        <div className="mt-0.5 bg-black/90 border border-green-900/50 rounded-sm max-h-48 overflow-y-auto absolute left-2.5 right-2.5 z-30">
          {results.map((r, i) => (
            <button
              key={`${r.lat}-${r.lon}`}
              onClick={() => select(r)}
              className={`w-full text-left px-3 py-1.5 font-mono text-[10px] tracking-wide
                border-b border-green-900/20 last:border-b-0 cursor-pointer transition-colors
                ${
                  i === activeIndex
                    ? "bg-green-900/30 text-green-400"
                    : "text-green-600/70 hover:bg-green-900/20 hover:text-green-400"
                }
              `}
            >
              <span className="line-clamp-1">{r.name}</span>
              <span className="text-green-800/40 text-[8px]">
                {r.lat.toFixed(4)}, {r.lon.toFixed(4)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
