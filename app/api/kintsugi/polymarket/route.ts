import { NextResponse } from "next/server";
import type { PolymarketPrediction } from "@/types";

let cached: PolymarketPrediction[] = [];
let lastFetch = 0;
const CACHE_TTL = 300_000; // 5 min

// Mock predictions with geo coords for major prediction markets
const MOCK_PREDICTIONS: PolymarketPrediction[] = [
  { id: "pm-1", question: "Will Bitcoin exceed $100k by end of 2026?", probability: 0.62, volume: 12500000, latitude: 40.7128, longitude: -74.006, category: "crypto", endDate: "2026-12-31", url: "https://polymarket.com" },
  { id: "pm-2", question: "Will there be a US recession in 2026?", probability: 0.28, volume: 8900000, latitude: 38.9072, longitude: -77.0369, category: "economics", endDate: "2026-12-31", url: "https://polymarket.com" },
  { id: "pm-3", question: "Will AI replace 10% of white-collar jobs by 2027?", probability: 0.45, volume: 5600000, latitude: 37.7749, longitude: -122.4194, category: "technology", endDate: "2027-12-31", url: "https://polymarket.com" },
  { id: "pm-4", question: "Will NATO expand further in 2026?", probability: 0.35, volume: 3200000, latitude: 50.8503, longitude: 4.3517, category: "geopolitics", endDate: "2026-12-31", url: "https://polymarket.com" },
  { id: "pm-5", question: "Will China invade Taiwan by 2027?", probability: 0.08, volume: 15000000, latitude: 25.033, longitude: 121.5654, category: "geopolitics", endDate: "2027-12-31", url: "https://polymarket.com" },
  { id: "pm-6", question: "Will Ethereum flip Bitcoin market cap?", probability: 0.12, volume: 4100000, latitude: 47.3769, longitude: 8.5417, category: "crypto", endDate: "2027-06-30", url: "https://polymarket.com" },
  { id: "pm-7", question: "Will global temperatures rise 1.5°C above pre-industrial?", probability: 0.72, volume: 2800000, latitude: 51.5074, longitude: -0.1278, category: "climate", endDate: "2026-12-31", url: "https://polymarket.com" },
  { id: "pm-8", question: "Will India GDP surpass Japan in 2026?", probability: 0.55, volume: 1900000, latitude: 28.6139, longitude: 77.209, category: "economics", endDate: "2026-12-31", url: "https://polymarket.com" },
];

export async function GET() {
  try {
    const now = Date.now();
    if (cached.length > 0 && now - lastFetch < CACHE_TTL) {
      return NextResponse.json(cached);
    }

    // Try Lumina proxy first
    try {
      const res = await fetch("http://localhost:8001/api/state/polymarket_adapter_state.json", {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.seen_markets && Array.isArray(data.seen_markets)) {
          const predictions: PolymarketPrediction[] = data.seen_markets.map(
            (m: { question?: string; probability?: number; volume?: number; id?: string }, i: number) => ({
              id: `pm-live-${i}`,
              question: m.question || "Unknown market",
              probability: m.probability || 0.5,
              volume: m.volume || 0,
              latitude: 40.7128 + (Math.random() - 0.5) * 20,
              longitude: -74.006 + (Math.random() - 0.5) * 40,
              category: "prediction",
              endDate: "2026-12-31",
              url: `https://polymarket.com/${m.id || ""}`,
            })
          );
          cached = predictions;
          lastFetch = now;
          return NextResponse.json(cached);
        }
      }
    } catch {
      // Lumina unavailable, fall through to mock
    }

    cached = MOCK_PREDICTIONS;
    lastFetch = now;
    return NextResponse.json(cached);
  } catch (error) {
    console.error("Polymarket API error:", error);
    return NextResponse.json([], { status: 200 });
  }
}
