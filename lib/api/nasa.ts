import type { Asteroid } from "@/types";

export async function fetchAsteroids(
  apiKey: string = "DEMO_KEY"
): Promise<Asteroid[]> {
  const today = new Date().toISOString().split("T")[0];
  const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 300 } });

  if (!res.ok) {
    console.error("NASA NEO API error:", res.status);
    return [];
  }

  const data = await res.json();
  const asteroids: Asteroid[] = [];

  for (const date of Object.keys(data.near_earth_objects || {})) {
    for (const neo of data.near_earth_objects[date]) {
      const approach = neo.close_approach_data?.[0];
      if (!approach) continue;

      asteroids.push({
        id: neo.id,
        name: neo.name,
        estimatedDiameterMin:
          neo.estimated_diameter?.meters?.estimated_diameter_min || 0,
        estimatedDiameterMax:
          neo.estimated_diameter?.meters?.estimated_diameter_max || 0,
        isPotentiallyHazardous: neo.is_potentially_hazardous_asteroid || false,
        closeApproachDate: approach.close_approach_date_full || date,
        relativeVelocity: parseFloat(
          approach.relative_velocity?.kilometers_per_hour || "0"
        ),
        missDistance: parseFloat(
          approach.miss_distance?.kilometers || "0"
        ),
        orbitingBody: approach.orbiting_body || "Earth",
      });
    }
  }

  return asteroids;
}
