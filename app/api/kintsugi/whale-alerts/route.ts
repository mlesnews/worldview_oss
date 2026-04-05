import { NextResponse } from "next/server";
import type { WhaleAlert } from "@/types";

let cached: WhaleAlert[] = [];
let lastFetch = 0;
const CACHE_TTL = 120_000; // 2 min

// Known exchange locations for geo mapping
const EXCHANGE_LOCATIONS: Record<string, { lat: number; lon: number }> = {
  binance: { lat: 1.3521, lon: 103.8198 },
  coinbase: { lat: 37.7749, lon: -122.4194 },
  kraken: { lat: 37.7749, lon: -122.4194 },
  bitfinex: { lat: 22.3193, lon: 114.1694 },
  huobi: { lat: 1.3521, lon: 103.8198 },
  okx: { lat: 22.3193, lon: 114.1694 },
  gemini: { lat: 40.7128, lon: -74.006 },
  bitstamp: { lat: 46.0569, lon: 14.5058 },
  unknown: { lat: 51.5074, lon: -0.1278 },
};

function getExchangeGeo(address: string): { lat: number; lon: number } {
  const lower = address.toLowerCase();
  for (const [exchange, geo] of Object.entries(EXCHANGE_LOCATIONS)) {
    if (lower.includes(exchange)) return geo;
  }
  return EXCHANGE_LOCATIONS.unknown;
}

// Mock whale alerts since whale-alert.io requires paid key
const MOCK_ALERTS: WhaleAlert[] = [
  { id: "wa-1", blockchain: "bitcoin", symbol: "BTC", amount: 500, amountUsd: 33500000, from: "unknown", to: "binance", latitude: 1.3521, longitude: 103.8198, timestamp: new Date().toISOString(), transactionHash: "0xabc1" },
  { id: "wa-2", blockchain: "ethereum", symbol: "ETH", amount: 15000, amountUsd: 28500000, from: "coinbase", to: "unknown", latitude: 37.7749, longitude: -122.4194, timestamp: new Date().toISOString(), transactionHash: "0xabc2" },
  { id: "wa-3", blockchain: "bitcoin", symbol: "BTC", amount: 1200, amountUsd: 80400000, from: "unknown", to: "kraken", latitude: 37.7749, longitude: -122.3894, timestamp: new Date().toISOString(), transactionHash: "0xabc3" },
  { id: "wa-4", blockchain: "ethereum", symbol: "ETH", amount: 25000, amountUsd: 47500000, from: "bitfinex", to: "unknown", latitude: 22.3193, longitude: 114.1694, timestamp: new Date().toISOString(), transactionHash: "0xabc4" },
  { id: "wa-5", blockchain: "bitcoin", symbol: "BTC", amount: 800, amountUsd: 53600000, from: "gemini", to: "unknown", latitude: 40.7128, longitude: -74.006, timestamp: new Date().toISOString(), transactionHash: "0xabc5" },
  { id: "wa-6", blockchain: "tether", symbol: "USDT", amount: 100000000, amountUsd: 100000000, from: "tether_treasury", to: "binance", latitude: 1.3521, longitude: 103.8198, timestamp: new Date().toISOString(), transactionHash: "0xabc6" },
];

export async function GET() {
  try {
    const now = Date.now();
    if (cached.length > 0 && now - lastFetch < CACHE_TTL) {
      return NextResponse.json(cached);
    }

    // Try whale-alert.io free tier if API key exists
    const apiKey = process.env.WHALE_ALERT_API_KEY;
    if (apiKey) {
      try {
        const since = Math.floor((now - 3600_000) / 1000); // last hour
        const res = await fetch(
          `https://api.whale-alert.io/v1/transactions?api_key=${apiKey}&min_value=1000000&start=${since}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.transactions) {
            const alerts: WhaleAlert[] = data.transactions.map(
              (tx: { id?: string; blockchain?: string; symbol?: string; amount?: number; amount_usd?: number; from?: { owner?: string }; to?: { owner?: string }; hash?: string; timestamp?: number }) => {
                const fromGeo = getExchangeGeo(tx.from?.owner || "unknown");
                const toGeo = getExchangeGeo(tx.to?.owner || "unknown");
                return {
                  id: `wa-${tx.id || tx.hash}`,
                  blockchain: tx.blockchain || "unknown",
                  symbol: tx.symbol || "?",
                  amount: tx.amount || 0,
                  amountUsd: tx.amount_usd || 0,
                  from: tx.from?.owner || "unknown",
                  to: tx.to?.owner || "unknown",
                  latitude: toGeo.lat,
                  longitude: toGeo.lon,
                  timestamp: new Date((tx.timestamp || 0) * 1000).toISOString(),
                  transactionHash: tx.hash || "",
                };
              }
            );
            cached = alerts;
            lastFetch = now;
            return NextResponse.json(cached);
          }
        }
      } catch {
        // fall through to mock
      }
    }

    // Use mock data
    cached = MOCK_ALERTS;
    lastFetch = now;
    return NextResponse.json(cached);
  } catch (error) {
    console.error("Whale alerts API error:", error);
    return NextResponse.json([], { status: 200 });
  }
}
