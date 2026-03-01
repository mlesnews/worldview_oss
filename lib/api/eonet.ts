import type { Disaster, DisasterCategory } from "@/types";

const EONET_API = "https://eonet.gsfc.nasa.gov/api/v3/events";

// EONET category IDs → our DisasterCategory
const CATEGORY_MAP: Record<string, DisasterCategory> = {
  wildfires: "wildfires",
  volcanoes: "volcanoes",
  severeStorms: "severeStorms",
  floods: "floods",
  seaLakeIce: "ice",
  snow: "ice",
  earthquakes: "earthquakes",
  landslides: "floods", // group with floods
  drought: "wildfires", // group with wildfires
};

interface EonetGeometry {
  date: string;
  type: string;
  coordinates: number[]; // [lon, lat] or [lon, lat, alt]
}

interface EonetEvent {
  id: string;
  title: string;
  categories: { id: string; title: string }[];
  geometry: EonetGeometry[];
  sources: { id: string; url: string }[];
}

export async function fetchEonetEvents(): Promise<Disaster[]> {
  try {
    const res = await fetch(`${EONET_API}?status=open&limit=100`, {
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      console.error("EONET API error:", res.status);
      return [];
    }

    const data = await res.json();
    if (!data.events) return [];

    const disasters: Disaster[] = [];

    for (const event of data.events as EonetEvent[]) {
      const catId = event.categories[0]?.id || "";
      const category = CATEGORY_MAP[catId];
      if (!category) continue;

      // Use the most recent geometry point
      const geo = event.geometry[event.geometry.length - 1];
      if (!geo || !geo.coordinates) continue;

      const [lon, lat] = geo.type === "Point"
        ? geo.coordinates
        : geo.coordinates; // For polygons, EONET still provides centroid as Point

      if (typeof lon !== "number" || typeof lat !== "number") continue;

      disasters.push({
        id: `eonet-${event.id}`,
        title: event.title,
        category,
        latitude: lat,
        longitude: lon,
        date: geo.date,
        source: "eonet",
        link: event.sources[0]?.url,
      });
    }

    return disasters;
  } catch (err) {
    console.error("EONET fetch error:", err);
    return [];
  }
}
