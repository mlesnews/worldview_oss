import { NextResponse } from "next/server";
import { fetchEarthquakes } from "@/lib/api/usgs";
import { fetchEonetEvents } from "@/lib/api/eonet";
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
        Math.abs(existing.latitude - event.latitude) < 0.5 &&
        Math.abs(existing.longitude - event.longitude) < 0.5 &&
        Math.abs(
          new Date(existing.date).getTime() - new Date(event.date).getTime()
        ) < 86400000 // within 24h
    );
    if (!isDupe) result.push(event);
  }
  return result;
}

export async function GET() {
  try {
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
