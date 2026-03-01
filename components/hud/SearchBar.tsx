"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useWorldViewStore } from "@/stores/worldview-store";
import type { Flight } from "@/types";

interface SearchResult {
  name: string;
  lat: number;
  lon: number;
  type: "location" | "flight";
  flightData?: Flight;
}

const FLIGHT_PATTERN = /^[A-Z]{2,3}\d{1,4}$/i;

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const flyTo = useWorldViewStore((s) => s.flyTo);
  const setViewport = useWorldViewStore((s) => s.setViewport);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const trimmed = q.trim();
    const isFlightQuery = FLIGHT_PATTERN.test(trimmed);

    // Run geo + flight searches in parallel
    const promises: Promise<SearchResult[]>[] = [];

    // Always search locations
    promises.push(
      fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data: { name: string; lat: number; lon: number }[]) =>
          data.map((r) => ({ ...r, type: "location" as const }))
        )
        .catch(() => [] as SearchResult[])
    );

    // Also search flights if query looks like a callsign
    if (isFlightQuery) {
      promises.push(
        fetch(`/api/flights?callsign=${encodeURIComponent(trimmed)}`)
          .then((res) => (res.ok ? res.json() : []))
          .then((flights: Flight[]) =>
            flights.map((f) => ({
              name: `${f.callsign || f.icao24} — ${f.originCountry}`,
              lat: f.latitude,
              lon: f.longitude,
              type: "flight" as const,
              flightData: f,
            }))
          )
          .catch(() => [] as SearchResult[])
      );
    }

    const settled = await Promise.all(promises);
    // Flights first, then locations
    const merged = isFlightQuery
      ? [...(settled[1] ?? []), ...settled[0]]
      : settled[0];

    setResults(merged);
    setOpen(merged.length > 0);
    setActiveIndex(-1);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(value), 400);
  };

  const select = (result: SearchResult) => {
    if (result.type === "flight" && result.flightData) {
      const f = result.flightData;
      const alt = 50_000;
      flyTo(f.longitude, f.latitude, alt);
      setViewport({
        centerLat: f.latitude,
        centerLon: f.longitude,
        altitude: alt,
        radiusKm: Math.min((alt * 2.5) / 1000, 20000),
        isZoomedIn: true,
      });
      setSelectedEntity({
        id: f.icao24,
        type: "flight",
        name: f.callsign || f.icao24,
        lon: f.longitude,
        lat: f.latitude,
        alt: f.baroAltitude ?? undefined,
        details: {
          Callsign: f.callsign || "N/A",
          ICAO: f.icao24,
          Country: f.originCountry,
          Altitude: f.baroAltitude != null ? `${Math.round(f.baroAltitude)}m` : "N/A",
          Speed: f.velocity != null ? `${Math.round(f.velocity)}m/s` : "N/A",
          Track: f.trueTrack != null ? `${f.trueTrack.toFixed(1)}°` : "N/A",
          Squawk: f.squawk || "N/A",
        },
      });
    } else {
      const alt = 100_000;
      flyTo(result.lon, result.lat, alt);
      setViewport({
        centerLat: result.lat,
        centerLon: result.lon,
        altitude: alt,
        radiusKm: Math.min((alt * 2.5) / 1000, 20000),
        isZoomedIn: alt < 1_000_000,
      });
    }
    setQuery(result.name.split(",")[0].split(" — ")[0]);
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
          placeholder="SEARCH LOCATION / FLIGHT..."
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
              key={`${r.type}-${r.lat}-${r.lon}-${i}`}
              onClick={() => select(r)}
              className={`w-full text-left px-3 py-1.5 font-mono text-[10px] tracking-wide
                border-b border-green-900/20 last:border-b-0 cursor-pointer transition-colors
                ${
                  i === activeIndex
                    ? "bg-green-900/30 text-green-400"
                    : r.type === "flight"
                    ? "text-green-400/80 hover:bg-green-900/20 hover:text-green-300"
                    : "text-green-600/70 hover:bg-green-900/20 hover:text-green-400"
                }
              `}
            >
              <span className="line-clamp-1">
                {r.type === "flight" ? "\u2708 " : ""}
                {r.name}
              </span>
              <span className="text-green-800/40 text-[8px]">
                {r.type === "flight" ? "FLIGHT" : `${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
