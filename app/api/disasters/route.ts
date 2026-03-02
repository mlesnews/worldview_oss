import { NextRequest, NextResponse } from "next/server";
import { fetchEarthquakes, fetchHistoricalEarthquakes } from "@/lib/api/usgs";
import { fetchEonetEvents, fetchHistoricalEonetEvents } from "@/lib/api/eonet";
import { DEDUP_DEGREE_THRESHOLD, DEDUP_TIME_WINDOW_MS } from "@/lib/constants";
import type { Disaster } from "@/types";

// Convert USGS earthquakes to unified Disaster format
function quakesToDisasters(
  quakes: Awaited<ReturnType<typeof fetchEarthquakes>>
): Disaster[] {
  return quakes.map((q) => ({
    id: `usgs-${q.id}`,
    title: `M${q.magnitude.toFixed(1)} - ${q.place}`,
    category: "earthquakes" as const,
    latitude: q.latitude,
    longitude: q.longitude,
    date: new Date(q.time).toISOString(),
    source: "usgs" as const,
    magnitude: q.magnitude,
    description: `Depth: ${q.depth.toFixed(1)}km${q.tsunami ? " | Tsunami warning" : ""}`,
  }));
}

// Deduplicate events that are very close geographically (within ~50km)
function deduplicateByProximity(events: Disaster[]): Disaster[] {
  const result: Disaster[] = [];
  for (const event of events) {
    const isDupe = result.some(
      (existing) =>
        existing.category === event.category &&
        Math.abs(existing.latitude - event.latitude) < DEDUP_DEGREE_THRESHOLD &&
        Math.abs(existing.longitude - event.longitude) < DEDUP_DEGREE_THRESHOLD &&
        Math.abs(
          new Date(existing.date).getTime() - new Date(event.date).getTime()
        ) < DEDUP_TIME_WINDOW_MS
    );
    if (!isDupe) result.push(event);
  }
  return result;
}

/**
 * GET /api/disasters?date=YYYYMMDD
 *
 * Without date param: returns real-time disasters (current behavior).
 * With date param: queries historical data from USGS query API + EONET.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const date = searchParams.get("date"); // YYYYMMDD

    if (date && date.length === 8) {
      // Historical mode
      const year = date.slice(0, 4);
      const month = date.slice(4, 6);
      const day = date.slice(6, 8);
      const startDate = `${year}-${month}-${day}`;

      // Query ±1 day window for historical data
      const startDt = new Date(`${startDate}T00:00:00Z`);
      const endDt = new Date(startDt.getTime() + DEDUP_TIME_WINDOW_MS);
      const endDate = endDt.toISOString().slice(0, 10);

      const [eonetEvents, quakes] = await Promise.all([
        fetchHistoricalEonetEvents(startDate, endDate),
        fetchHistoricalEarthquakes(startDate, endDate),
      ]);

      const usgsDisasters = quakesToDisasters(quakes);
      const merged = [...eonetEvents, ...usgsDisasters];
      const deduped = deduplicateByProximity(merged);

      return NextResponse.json(deduped);
    }

    // Real-time mode (default)
    const [eonetEvents, quakes] = await Promise.all([
      fetchEonetEvents(),
      fetchEarthquakes("day", "2.5"),
    ]);

    const usgsDisasters = quakesToDisasters(quakes);
    const merged = [...eonetEvents, ...usgsDisasters];
    const deduped = deduplicateByProximity(merged);

    return NextResponse.json(deduped);
  } catch (error) {
    console.error("Disasters API error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
