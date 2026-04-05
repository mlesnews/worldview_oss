import { NextResponse } from "next/server";
import type { EnergyGridNode } from "@/types";

let cached: EnergyGridNode[] = [];
let lastFetch = 0;
const CACHE_TTL = 600_000; // 10 min

// US EIA RTO regions with approximate coords
const RTO_REGIONS: Record<string, { lat: number; lon: number }> = {
  PJM: { lat: 39.9526, lon: -75.1652 },
  MISO: { lat: 41.8781, lon: -87.6298 },
  ERCOT: { lat: 30.2672, lon: -97.7431 },
  CAISO: { lat: 37.7749, lon: -122.4194 },
  NYISO: { lat: 40.7128, lon: -74.006 },
  ISONE: { lat: 42.3601, lon: -71.0589 },
  SPP: { lat: 35.4676, lon: -97.5164 },
  SWPP: { lat: 37.6872, lon: -97.3301 },
  AECI: { lat: 38.627, lon: -90.1994 },
  FPL: { lat: 25.7617, lon: -80.1918 },
  DUK: { lat: 35.2271, lon: -80.8431 },
  SC: { lat: 34.0007, lon: -81.0348 },
  TVA: { lat: 35.0456, lon: -85.3097 },
  SOCO: { lat: 33.749, lon: -84.388 },
  AEC: { lat: 33.5207, lon: -86.8025 },
};

interface EiaDataPoint {
  period: string;
  respondent: string;
  "respondent-name": string;
  type: string;
  "type-name": string;
  value: number;
}

export async function GET() {
  try {
    const now = Date.now();
    if (cached.length > 0 && now - lastFetch < CACHE_TTL) {
      return NextResponse.json(cached);
    }

    // Try Lumina Kintsugi bridge first
    try {
      const luminaRes = await fetch("http://localhost:8001/api/kintsugi/energy-grid", {
        signal: AbortSignal.timeout(5000),
      });
      if (luminaRes.ok) {
        const luminaData = await luminaRes.json();
        if (Array.isArray(luminaData) && luminaData.length > 0) {
          cached = luminaData;
          lastFetch = now;
          return NextResponse.json(cached);
        }
      }
    } catch {
      // Lumina unavailable, try EIA directly
    }

    try {
      const params = new URLSearchParams({
        frequency: "hourly",
        "data[0]": "value",
        sort: '[{"column":"period","direction":"desc"}]',
        offset: "0",
        length: "50",
      });
      const res = await fetch(
        `https://api.eia.gov/v2/electricity/rto/region-data/data/?${params}`,
        { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "WorldView/1.0" } }
      );

      if (res.ok) {
        const json = await res.json();
        const dataPoints: EiaDataPoint[] = json.response?.data || [];

        const seen = new Set<string>();
        const nodes: EnergyGridNode[] = [];

        for (const dp of dataPoints) {
          const region = dp.respondent;
          if (seen.has(region)) continue;
          seen.add(region);

          const geo = RTO_REGIONS[region];
          if (!geo) continue;

          nodes.push({
            id: `eg-${region}`,
            name: dp["respondent-name"] || region,
            type: "grid",
            latitude: geo.lat,
            longitude: geo.lon,
            capacityMw: dp.value || 0,
            currentOutputMw: dp.value || 0,
            region,
          });
        }

        if (nodes.length > 0) {
          cached = nodes;
          lastFetch = now;
          return NextResponse.json(cached);
        }
      }
    } catch {
      // EIA unavailable, use static fallback
    }

    // Static fallback — major US grid nodes
    const fallback: EnergyGridNode[] = Object.entries(RTO_REGIONS).map(([region, geo]) => ({
      id: `eg-${region}`,
      name: region,
      type: "grid" as const,
      latitude: geo.lat,
      longitude: geo.lon,
      capacityMw: 10000 + Math.random() * 50000,
      region,
    }));

    cached = fallback;
    lastFetch = now;
    return NextResponse.json(cached);
  } catch (error) {
    console.error("Energy grid API error:", error);
    return NextResponse.json([], { status: 200 });
  }
}
