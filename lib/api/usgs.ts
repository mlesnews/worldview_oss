import type { Earthquake } from "@/types";

const USGS_API = "https://earthquake.usgs.gov/earthquakes/feed/v1.0";

export async function fetchEarthquakes(
  period: "hour" | "day" | "week" = "day",
  minMagnitude: "significant" | "4.5" | "2.5" | "1.0" | "all" = "2.5"
): Promise<Earthquake[]> {
  const url = `${USGS_API}/summary/${minMagnitude}_${period}.geojson`;
  const res = await fetch(url, { next: { revalidate: 30 } });

  if (!res.ok) {
    console.error("USGS API error:", res.status);
    return [];
  }

  const data = await res.json();

  if (!data.features) return [];

  return data.features.map(
    (f: {
      id: string;
      properties: Record<string, unknown>;
      geometry: { coordinates: number[] };
    }): Earthquake => ({
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
    })
  );
}
