import { NextResponse } from "next/server";
import type { CryptoMiningNode } from "@/types";

let cached: CryptoMiningNode[] = [];
let lastFetch = 0;
const CACHE_TTL = 600_000; // 10 min

// Known major mining pools with approximate HQ/operations locations
const MINING_POOLS: CryptoMiningNode[] = [
  { id: "cm-1", name: "Foundry USA", hashrate: "30.2 EH/s", latitude: 40.7128, longitude: -74.006, algorithm: "SHA-256", energySource: "mixed", operator: "Digital Currency Group" },
  { id: "cm-2", name: "AntPool", hashrate: "18.5 EH/s", latitude: 39.9042, longitude: 116.4074, algorithm: "SHA-256", energySource: "hydro/coal", operator: "Bitmain" },
  { id: "cm-3", name: "F2Pool", hashrate: "14.8 EH/s", latitude: 31.2304, longitude: 121.4737, algorithm: "SHA-256", energySource: "mixed", operator: "F2Pool" },
  { id: "cm-4", name: "ViaBTC", hashrate: "12.1 EH/s", latitude: 22.5431, longitude: 114.0579, algorithm: "SHA-256", energySource: "mixed", operator: "ViaBTC" },
  { id: "cm-5", name: "Binance Pool", hashrate: "10.5 EH/s", latitude: 1.3521, longitude: 103.8198, algorithm: "SHA-256", energySource: "mixed", operator: "Binance" },
  { id: "cm-6", name: "MARA Pool", hashrate: "9.8 EH/s", latitude: 25.7617, longitude: -80.1918, algorithm: "SHA-256", energySource: "renewable", operator: "Marathon Digital" },
  { id: "cm-7", name: "Riot Platforms", hashrate: "8.3 EH/s", latitude: 32.7767, longitude: -96.797, algorithm: "SHA-256", energySource: "wind/solar", operator: "Riot Platforms" },
  { id: "cm-8", name: "CleanSpark", hashrate: "6.2 EH/s", latitude: 36.1627, longitude: -86.7816, algorithm: "SHA-256", energySource: "renewable", operator: "CleanSpark" },
  { id: "cm-9", name: "Luxor", hashrate: "5.1 EH/s", latitude: 47.6062, longitude: -122.3321, algorithm: "SHA-256", energySource: "hydro", operator: "Luxor Technology" },
  { id: "cm-10", name: "SBI Crypto", hashrate: "3.4 EH/s", latitude: 35.6762, longitude: 139.6503, algorithm: "SHA-256", energySource: "mixed", operator: "SBI Holdings" },
  { id: "cm-11", name: "Braiins Pool", hashrate: "4.7 EH/s", latitude: 50.0755, longitude: 14.4378, algorithm: "SHA-256", energySource: "nuclear/mixed", operator: "Braiins" },
  { id: "cm-12", name: "BitFuFu", hashrate: "3.9 EH/s", latitude: 1.3521, longitude: 103.8198, algorithm: "SHA-256", energySource: "mixed", operator: "BitFuFu" },
];

interface BlockchainPool {
  name?: string;
  [key: string]: unknown;
}

export async function GET() {
  try {
    const now = Date.now();
    if (cached.length > 0 && now - lastFetch < CACHE_TTL) {
      return NextResponse.json(cached);
    }

    // Try blockchain.info pools endpoint
    try {
      const res = await fetch("https://blockchain.info/pools?timespan=24hours&format=json", {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const pools: Record<string, BlockchainPool | number> = await res.json();
        // Enrich static data with live hashrate percentages
        const totalBlocks = Object.values(pools).reduce(
          (sum: number, v) => sum + (typeof v === "number" ? v : 0),
          0 as number
        );
        if (totalBlocks > 0) {
          const enriched = MINING_POOLS.map((pool) => {
            const liveBlocks = typeof pools[pool.name] === "number" ? (pools[pool.name] as number) : 0;
            const pct = ((liveBlocks / totalBlocks) * 100).toFixed(1);
            return { ...pool, hashrate: liveBlocks > 0 ? `${pct}% (${liveBlocks} blocks/24h)` : pool.hashrate };
          });
          cached = enriched;
          lastFetch = now;
          return NextResponse.json(cached);
        }
      }
    } catch {
      // fall through to static
    }

    cached = MINING_POOLS;
    lastFetch = now;
    return NextResponse.json(cached);
  } catch (error) {
    console.error("Crypto mining API error:", error);
    return NextResponse.json([], { status: 200 });
  }
}
