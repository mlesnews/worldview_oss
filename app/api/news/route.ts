import { NextRequest, NextResponse } from "next/server";
import { getArticlesByDateRange, getArticlesByLocation } from "@/lib/graph/queries";
import { fetchRssNews } from "@/lib/api/rss-news";
import { fetchRedditIntel } from "@/lib/api/reddit";
import { NEWS_CACHE_TTL_MS, MAX_LOCATION_CACHE_ENTRIES } from "@/lib/constants";
import type { NewsArticle } from "@/types";

// Server-side cache for global news (graph + RSS + Reddit merged)
let cachedGlobalNews: NewsArticle[] = [];
let lastGlobalFetch = 0;

// Location-specific cache
const locationCache = new Map<string, { articles: NewsArticle[]; time: number }>();

/**
 * Fetch recent articles from JanusGraph (last 4 hours).
 * Falls back to empty array if graph is unavailable.
 */
async function fetchGraphNews(): Promise<NewsArticle[]> {
  try {
    const now = Date.now();
    const fourHoursAgo = now - 4 * 60 * 60 * 1000;
    return await getArticlesByDateRange(fourHoursAgo, now, 100);
  } catch {
    // Graph unavailable (not running, connection refused, etc.)
    return [];
  }
}

/**
 * Fetch location-scoped articles from JanusGraph.
 */
async function fetchGraphLocalNews(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<NewsArticle[]> {
  try {
    const now = Date.now();
    const fourHoursAgo = now - 4 * 60 * 60 * 1000;
    return await getArticlesByLocation(lat, lon, radiusKm, fourHoursAgo, now, 50);
  } catch {
    return [];
  }
}

/** Fetch all global sources in parallel and merge */
async function fetchAllGlobalNews(): Promise<NewsArticle[]> {
  const [graphResult, rssResult, redditResult] = await Promise.allSettled([
    fetchGraphNews(),
    fetchRssNews(),
    fetchRedditIntel(),
  ]);

  const articles: NewsArticle[] = [];

  if (graphResult.status === "fulfilled") articles.push(...graphResult.value);
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
  fetchGraphLocalNews(lat, lon, radiusKm).then((fresh) => {
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
    const globalExpired = now - lastGlobalFetch >= NEWS_CACHE_TTL_MS;

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
    const localExpired = !cached || now - cached.time >= NEWS_CACHE_TTL_MS;

    if (cached) {
      localArticles = cached.articles;
      if (localExpired) {
        refreshLocalInBackground(parsedLat, parsedLon, radius ? parseFloat(radius) : 250, cacheKey);
      }
    } else {
      localArticles = await fetchGraphLocalNews(parsedLat, parsedLon, radius ? parseFloat(radius) : 250);

      // Evict oldest if cache full
      if (locationCache.size >= MAX_LOCATION_CACHE_ENTRIES) {
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
    return NextResponse.json(cachedGlobalNews.length > 0 ? cachedGlobalNews : [], { status: cachedGlobalNews.length > 0 ? 200 : 500 });
  }
}
