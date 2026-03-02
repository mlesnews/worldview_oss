import type { Earthquake } from "@/types";

const USGS_FEED_API = "https://earthquake.usgs.gov/earthquakes/feed/v1.0";
const USGS_QUERY_API = "https://earthquake.usgs.gov/fdsnws/event/1/query";

/**
 * Fetch recent earthquakes from USGS feed (real-time).
 */
export async function fetchEarthquakes(
  period: "hour" | "day" | "week" = "day",
  minMagnitude: "significant" | "4.5" | "2.5" | "1.0" | "all" = "2.5"
): Promise<Earthquake[]> {
  const url = `${USGS_FEED_API}/summary/${minMagnitude}_${period}.geojson`;
  const res = await fetch(url, { next: { revalidate: 30 } });

  if (!res.ok) {
    console.error("USGS API error:", res.status);
    return [];
  }

  const data = await res.json();

  if (!data.features) return [];

  return parseUsgsFeatures(data.features);
}

/**
 * Fetch historical earthquakes from USGS query API.
 * Supports date range filtering.
 */
export async function fetchHistoricalEarthquakes(
  startDate: string, // YYYY-MM-DD
  endDate: string, // YYYY-MM-DD
  minMagnitude: number = 2.5,
  limit: number = 100
): Promise<Earthquake[]> {
  const params = new URLSearchParams({
    format: "geojson",
    starttime: startDate,
    endtime: endDate,
    minmagnitude: String(minMagnitude),
    limit: String(limit),
    orderby: "time",
  });

  const url = `${USGS_QUERY_API}?${params}`;
  const res = await fetch(url, { next: { revalidate: 300 } });

  if (!res.ok) {
    console.error("USGS query API error:", res.status);
    return [];
  }

  const data = await res.json();

  if (!data.features) return [];

  return parseUsgsFeatures(data.features);
}

function parseUsgsFeatures(
  features: {
    id: string;
    properties: Record<string, unknown>;
    geometry: { coordinates: number[] };
  }[]
): Earthquake[] {
  return features.map((f) => ({
    id: f.id,
    magnitude: f.properties.mag as number,
    place: f.properties.place as string,
    time: f.properties.time as number,
    longitude: f.geometry.coordinates[0],
    latitude: f.geometry.coordinates[1],
    depth: f.geometry.coordinates[2],
    tsunami: (f.properties.tsunami as number) > 0,
    alert: (f.properties.alert as string) || null,
    felt: (f.properties.felt as number) || null,
  }));
}
