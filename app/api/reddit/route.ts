import { NextResponse } from "next/server";
import { fetchRedditIntel } from "@/lib/api/reddit";
import type { NewsArticle } from "@/types";

// Server-side cache
let cachedArticles: NewsArticle[] = [];
let lastFetch = 0;
const CACHE_TTL = 300_000; // 5 minutes

export async function GET() {
  try {
    const now = Date.now();
    const expired = now - lastFetch >= CACHE_TTL;

    if (cachedArticles.length === 0) {
      // Cold start: block on fetch
      const fresh = await fetchRedditIntel();
      if (fresh.length > 0) {
        cachedArticles = fresh;
        lastFetch = Date.now();
      }
      return NextResponse.json(cachedArticles);
    }

    if (expired) {
      // Stale-while-revalidate: return cached, refresh in background
      fetchRedditIntel()
        .then((fresh) => {
          if (fresh.length > 0) {
            cachedArticles = fresh;
            lastFetch = Date.now();
          }
        })
        .catch(() => {});
    }

    return NextResponse.json(cachedArticles);
  } catch (error) {
    console.error("Reddit API route error:", error);
    // Return cached data on error if available
    return NextResponse.json(
      cachedArticles.length > 0 ? cachedArticles : [],
      { status: cachedArticles.length > 0 ? 200 : 500 }
    );
  }
}
