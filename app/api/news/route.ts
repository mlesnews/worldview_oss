import { NextRequest, NextResponse } from "next/server";
import { fetchGlobalNews, fetchLocalNews } from "@/lib/api/gdelt";
import { fetchRssNews } from "@/lib/api/rss-news";
import { fetchRedditIntel } from "@/lib/api/reddit";
import type { NewsArticle } from "@/types";

// Server-side cache for global news (GDELT + RSS + Reddit merged)
let cachedGlobalNews: NewsArticle[] = [];
let lastGlobalFetch = 0;
const GLOBAL_CACHE_TTL = 900_000; // 15 min

// Location-specific cache
const locationCache = new Map<string, { articles: NewsArticle[]; time: number }>();
const LOCATION_CACHE_TTL = 900_000; // 15 min
const MAX_LOCATION_CACHE = 20;

/** Fetch all global sources in parallel and merge */
async function fetchAllGlobalNews(): Promise<NewsArticle[]> {
  const [gdeltResult, rssResult, redditResult] = await Promise.allSettled([
    fetchGlobalNews(),
    fetchRssNews(),
    fetchRedditIntel(),
  ]);

  const articles: NewsArticle[] = [];

  if (gdeltResult.status === "fulfilled") articles.push(...gdeltResult.value);
  if (rssResult.status === "fulfilled") articles.push(...rssResult.value);
  if (redditResult.status === "fulfilled") articles.push(...redditResult.value);

  // Dedupe by URL
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

/** Background-refresh global news without blocking the response */
function refreshGlobalInBackground() {
  fetchAllGlobalNews().then((fresh) => {
    if (fresh.length > 0) {
      cachedGlobalNews = fresh;
      lastGlobalFetch = Date.now();
    }
  }).catch(() => {});
}

/** Background-refresh local news for a cache key */
function refreshLocalInBackground(lat: number, lon: number, radiusKm: number, cacheKey: string) {
  fetchLocalNews(lat, lon, radiusKm).then((fresh) => {
    locationCache.set(cacheKey, { articles: fresh, time: Date.now() });
  }).catch(() => {});
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const radius = searchParams.get("radius");

    const now = Date.now();
    const globalExpired = now - lastGlobalFetch >= GLOBAL_CACHE_TTL;

    // Stale-while-revalidate for global news
    if (cachedGlobalNews.length === 0) {
      // Cold start: block on fetch (all sources in parallel)
      const fresh = await fetchAllGlobalNews();
      if (fresh.length > 0) {
        cachedGlobalNews = fresh;
        lastGlobalFetch = Date.now();
      }
    } else if (globalExpired) {
      // Stale cache exists: return stale, refresh in background
      refreshGlobalInBackground();
    }

    // If no location, return global only
    if (!lat || !lon) {
      return NextResponse.json(cachedGlobalNews);
    }

    // Location-specific search with cache
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    if (isNaN(parsedLat) || isNaN(parsedLon) || parsedLat < -90 || parsedLat > 90 || parsedLon < -180 || parsedLon > 180) {
      return NextResponse.json(cachedGlobalNews);
    }
    const cacheKey = `${parsedLat.toFixed(0)},${parsedLon.toFixed(0)}`;

    let localArticles: NewsArticle[] = [];
    const cached = locationCache.get(cacheKey);
    const localExpired = !cached || now - cached.time >= LOCATION_CACHE_TTL;

    if (cached) {
      localArticles = cached.articles;
      if (localExpired) {
        // Stale: return stale, refresh in background
        refreshLocalInBackground(parsedLat, parsedLon, radius ? parseFloat(radius) : 250, cacheKey);
      }
    } else {
      // Cold start for this location: fetch local (global already handled above)
      localArticles = await fetchLocalNews(parsedLat, parsedLon, radius ? parseFloat(radius) : 250);

      // Evict oldest if cache full
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

      locationCache.set(cacheKey, { articles: localArticles, time: Date.now() });
    }

    // Dedupe by URL
    const seen = new Set(cachedGlobalNews.map((a) => a.url));
    const uniqueLocal = localArticles.filter((a) => !seen.has(a.url));

    return NextResponse.json([...cachedGlobalNews, ...uniqueLocal]);
  } catch (error) {
    console.error("News API error:", error);
    // Return cached data on error rather than empty
    return NextResponse.json(cachedGlobalNews.length > 0 ? cachedGlobalNews : [], { status: cachedGlobalNews.length > 0 ? 200 : 500 });
  }
}
