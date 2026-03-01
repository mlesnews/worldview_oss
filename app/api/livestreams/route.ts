import { NextRequest, NextResponse } from "next/server";
import { searchLiveStreams, searchLiveStreamsAtLocation } from "@/lib/api/youtube";

// Global seed cache
let cachedGlobalStreams: Awaited<ReturnType<typeof searchLiveStreams>> = [];
let lastGlobalFetch = 0;
const GLOBAL_CACHE_TTL = 1800_000; // 30 min

// Location-specific cache (keyed by rounded lat,lon)
const locationCache = new Map<string, { streams: Awaited<ReturnType<typeof searchLiveStreamsAtLocation>>; time: number }>();
const LOCATION_CACHE_TTL = 1800_000; // 30 min
const MAX_LOCATION_CACHE = 20;

let isRefreshingGlobal = false;

function refreshGlobalStreamsInBackground(apiKey: string) {
  if (isRefreshingGlobal) return;
  isRefreshingGlobal = true;
  searchLiveStreams(apiKey)
    .then((fresh) => {
      cachedGlobalStreams = fresh;
      lastGlobalFetch = Date.now();
    })
    .catch(() => {})
    .finally(() => { isRefreshingGlobal = false; });
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY || "";

    if (!apiKey) {
      return NextResponse.json([]);
    }

    const now = Date.now();

    // Stale-while-revalidate for global baseline
    if (cachedGlobalStreams.length === 0) {
      // Cold start: block on fetch
      const streams = await searchLiveStreams(apiKey);
      cachedGlobalStreams = streams;
      lastGlobalFetch = now;
    } else if (now - lastGlobalFetch >= GLOBAL_CACHE_TTL) {
      // Stale: return stale, refresh in background
      refreshGlobalStreamsInBackground(apiKey);
    }

    const { searchParams } = request.nextUrl;
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    // If no location, return global only
    if (!lat || !lon) {
      return NextResponse.json(cachedGlobalStreams);
    }

    // Location-specific search — cache by rounded coords
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    if (isNaN(parsedLat) || isNaN(parsedLon) || parsedLat < -90 || parsedLat > 90 || parsedLon < -180 || parsedLon > 180) {
      return NextResponse.json(cachedGlobalStreams);
    }
    const cacheKey = `${parsedLat.toFixed(0)},${parsedLon.toFixed(0)}`;

    let localStreams: Awaited<ReturnType<typeof searchLiveStreamsAtLocation>> = [];
    const cached = locationCache.get(cacheKey);

    if (cached && now - cached.time < LOCATION_CACHE_TTL) {
      localStreams = cached.streams;
    } else {
      localStreams = await searchLiveStreamsAtLocation(apiKey, parsedLat, parsedLon);

      // Evict oldest entries if cache is full
      if (locationCache.size >= MAX_LOCATION_CACHE) {
        let oldestKey = "";
        let oldestTime = Infinity;
        for (const [k, v] of locationCache) {
          if (v.time < oldestTime) {
            oldestTime = v.time;
            oldestKey = k;
          }
        }
        if (oldestKey) locationCache.delete(oldestKey);
      }

      locationCache.set(cacheKey, { streams: localStreams, time: now });
    }

    // Merge global + local, deduped by video ID
    const seen = new Set(cachedGlobalStreams.map((s) => s.videoId));
    const uniqueLocal = localStreams.filter((s) => !seen.has(s.videoId));

    return NextResponse.json([...cachedGlobalStreams, ...uniqueLocal]);
  } catch (error) {
    console.error("Livestreams API error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
