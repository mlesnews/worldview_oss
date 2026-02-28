import { NextResponse } from "next/server";
import { getRainViewerTileUrl, getWeatherRadarTileUrl } from "@/lib/api/weather";

export async function GET() {
  try {
    // Try RainViewer first (global), fall back to NEXRAD (US-only)
    const rainViewer = await getRainViewerTileUrl();
    if (rainViewer) {
      return NextResponse.json(rainViewer);
    }
    return NextResponse.json(getWeatherRadarTileUrl());
  } catch (error) {
    console.error("Weather API error:", error);
    return NextResponse.json(getWeatherRadarTileUrl());
  }
}
