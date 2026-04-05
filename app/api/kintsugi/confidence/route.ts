import { NextResponse } from "next/server";
import type { LuminaConfidencePoint } from "@/types";

let cached: LuminaConfidencePoint[] = [];
let lastFetch = 0;
const CACHE_TTL = 60_000; // 1 min

// Map exchange/token names to approximate geo coords
const EXCHANGE_GEO: Record<string, { lat: number; lon: number; region: string }> = {
  BTC_USDT: { lat: 40.7128, lon: -74.006, region: "New York" },
  ETH_USDT: { lat: 51.5074, lon: -0.1278, region: "London" },
  SOL_USDT: { lat: 37.7749, lon: -122.4194, region: "San Francisco" },
  BNB_USDT: { lat: 1.3521, lon: 103.8198, region: "Singapore" },
  ADA_USDT: { lat: 35.6762, lon: 139.6503, region: "Tokyo" },
  XRP_USDT: { lat: 22.3193, lon: 114.1694, region: "Hong Kong" },
  DOT_USDT: { lat: 47.3769, lon: 8.5417, region: "Zurich" },
  AVAX_USDT: { lat: -33.8688, lon: 151.2093, region: "Sydney" },
  LINK_USDT: { lat: 48.8566, lon: 2.3522, region: "Paris" },
  DOGE_USDT: { lat: 34.0522, lon: -118.2437, region: "Los Angeles" },
};

interface TradingSignal {
  token: string;
  action: string;
  confidence: number;
  reasoning: string;
  timestamp: number;
  market_data_snapshot?: {
    rsi_14?: number;
    macd_signal?: string;
    price?: number;
  };
}

export async function GET() {
  try {
    const now = Date.now();
    if (cached.length > 0 && now - lastFetch < CACHE_TTL) {
      return NextResponse.json(cached);
    }

    const res = await fetch("http://localhost:8001/api/trading/signals", {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json(cached.length > 0 ? cached : [], { status: 200 });
    }

    const data = await res.json();
    const signals: TradingSignal[] = data.signals || [];

    const points: LuminaConfidencePoint[] = signals.map((sig, i) => {
      const geo = EXCHANGE_GEO[sig.token] || {
        lat: 39.8283 + (i * 5),
        lon: -98.5795 + (i * 10),
        region: sig.token,
      };
      const sentiment = sig.action === "BUY" ? sig.confidence : sig.action === "SELL" ? -sig.confidence : 0;

      return {
        id: `lc-${sig.token}-${sig.timestamp}`,
        region: geo.region,
        latitude: geo.lat,
        longitude: geo.lon,
        confidence: Math.round(sig.confidence * 100),
        sentiment: Math.round(sentiment * 100) / 100,
        signalCount: 1,
        timestamp: new Date(sig.timestamp * 1000).toISOString(),
      };
    });

    cached = points;
    lastFetch = now;
    return NextResponse.json(cached);
  } catch (error) {
    console.error("Confidence API error:", error);
    return NextResponse.json(cached.length > 0 ? cached : [], { status: 200 });
  }
}
