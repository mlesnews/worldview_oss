import { NextRequest, NextResponse } from "next/server";
import { searchNews } from "@/lib/api/duckduckgo";
import { getArticlesByDateRange } from "@/lib/graph/queries";
import { fetchRssNews } from "@/lib/api/rss-news";
import { NEWS_CACHE_TTL_MS } from "@/lib/constants";
import type { NewsArticle } from "@/types";

// Server-side cache (stale-while-revalidate)
let cachedResults: NewsArticle[] = [];
let lastFetch = 0;
const CACHE_TTL = NEWS_CACHE_TTL_MS;

/**
 * Fetch recent news from all available sources.
 * Priority: JanusGraph (GKG data) > RSS > DDG (supplemental, often rate-limited)
 */
async function fetchRealtimeNews(query?: string): Promise<NewsArticle[]> {
  // Fetch from graph (last 4h of ingested GKG data) + RSS + DDG in parallel
  const [graphResult, rssResult, ddgResult] = await Promise.allSettled([
    fetchGraphRecent(),
    fetchRssNews(),
    query ? searchNews(query) : searchNews(),
  ]);

  const articles: NewsArticle[] = [];

  if (graphResult.status === "fulfilled") articles.push(...graphResult.value);
  if (rssResult.status === "fulfilled") articles.push(...rssResult.value);
  if (ddgResult.status === "fulfilled") {
    // Filter DDG articles with no geo data (NaN lat/lon)
    const ddgGeo = ddgResult.value.filter(
      (a) => !isNaN(a.latitude) && !isNaN(a.longitude)
    );
    articles.push(...ddgGeo);
  }

  // Dedupe by URL
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

/** Query JanusGraph for articles from the last 4 hours */
async function fetchGraphRecent(): Promise<NewsArticle[]> {
  try {
    const now = Date.now();
    const fourHoursAgo = now - 4 * 60 * 60 * 1000;
    return await getArticlesByDateRange(fourHoursAgo, now, 100);
  } catch {
    // Graph unavailable — not an error, just means no graph data
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get("q");

    const now = Date.now();

    // Return cached if fresh and no custom query
    if (cachedResults.length > 0 && now - lastFetch < CACHE_TTL && !query) {
      return NextResponse.json(cachedResults);
    }

    const articles = await fetchRealtimeNews(query || undefined);

    if (!query && articles.length > 0) {
      cachedResults = articles;
      lastFetch = now;
    }

    return NextResponse.json(articles);
  } catch (error) {
    console.error("Realtime news API error:", error);
    return NextResponse.json(
      cachedResults.length > 0 ? cachedResults : [],
      { status: cachedResults.length > 0 ? 200 : 500 }
    );
  }
}
