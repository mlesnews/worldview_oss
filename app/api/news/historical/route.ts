import { NextRequest, NextResponse } from "next/server";
import { getArticlesByDateRange } from "@/lib/graph/queries";
import {
  HISTORICAL_WINDOW_MS,
  DEFAULT_ARTICLE_LIMIT,
  DEFAULT_HISTORICAL_HOUR,
} from "@/lib/constants";

/**
 * GET /api/news/historical?date=YYYYMMDD&hour=HH
 *
 * Queries JanusGraph for articles within ±30min of the requested time.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const date = searchParams.get("date"); // YYYYMMDD
    const hour = searchParams.get("hour"); // HH (00-23)

    if (!date || date.length !== 8) {
      return NextResponse.json(
        { error: "date parameter required (YYYYMMDD)" },
        { status: 400 }
      );
    }

    const year = date.slice(0, 4);
    const month = date.slice(4, 6);
    const day = date.slice(6, 8);
    const h = hour ? parseInt(hour, 10) : DEFAULT_HISTORICAL_HOUR;
    const clampedHour = Math.max(
      0,
      Math.min(23, isNaN(h) ? DEFAULT_HISTORICAL_HOUR : h)
    );

    // Build center time and ± window
    const centerTime = new Date(
      `${year}-${month}-${day}T${String(clampedHour).padStart(2, "0")}:00:00Z`
    );
    const startMs = centerTime.getTime() - HISTORICAL_WINDOW_MS;
    const endMs = centerTime.getTime() + HISTORICAL_WINDOW_MS;

    const articles = await getArticlesByDateRange(
      startMs,
      endMs,
      DEFAULT_ARTICLE_LIMIT
    );

    return NextResponse.json(articles);
  } catch (error) {
    console.error("Historical news API error:", error);

    // Return empty array if graph is unavailable (graceful degradation)
    return NextResponse.json([], { status: 200 });
  }
}
