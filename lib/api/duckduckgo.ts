import { search, SafeSearchType } from "duck-duck-scrape";
import type { NewsArticle } from "@/types";

const DEFAULT_QUERY = "world news breaking events";
const MAX_RESULTS = 30;
const DEFAULT_LOCALE = "en-us";

/**
 * Search DuckDuckGo for news articles.
 * Returns results formatted as NewsArticle[] for the news layer.
 *
 * Note: DDG results have no geolocation data. Articles are returned with
 * lat/lon = NaN to signal "no geo". Callers should filter or handle accordingly.
 */
export async function searchNews(
  query: string = DEFAULT_QUERY,
  options?: { region?: string }
): Promise<NewsArticle[]> {
  try {
    const results = await search(query, {
      safeSearch: SafeSearchType.OFF,
      locale: options?.region || DEFAULT_LOCALE,
    });

    if (!results.results || results.results.length === 0) return [];

    return results.results.slice(0, MAX_RESULTS).map((r, i) => ({
      id: `ddg-${Date.now()}-${i}`,
      title: r.title || "Untitled",
      url: r.url,
      source: r.hostname || "DuckDuckGo",
      latitude: NaN, // DDG has no geolocation — NaN signals "no geo data"
      longitude: NaN,
      date: new Date().toISOString(),
      language: "en",
      tone: 0,
      imageUrl: r.icon || undefined,
    }));
  } catch (err) {
    console.error("DuckDuckGo search error:", err);
    return [];
  }
}
