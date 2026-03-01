import type { Camera, CityCluster } from "@/types";
import { haversineKm } from "@/lib/utils";

const MERGE_RADIUS_KM = 80;

/**
 * Group cameras by city, compute centroids, then merge nearby clusters
 * (e.g. Caltrans "Alhambra", "Pasadena", "Glendale" → "Los Angeles").
 * Returns ~25-35 clusters depending on data.
 */
export function buildCityClusters(cameras: Camera[]): CityCluster[] {
  // Step 1: Group by city name
  const cityMap = new Map<string, Camera[]>();
  for (const cam of cameras) {
    const key = cam.city;
    if (!cityMap.has(key)) cityMap.set(key, []);
    cityMap.get(key)!.push(cam);
  }

  // Step 2: Build initial clusters with centroid
  let clusters: CityCluster[] = [];
  for (const [city, cams] of cityMap) {
    const centerLat = cams.reduce((s, c) => s + c.latitude, 0) / cams.length;
    const centerLon = cams.reduce((s, c) => s + c.longitude, 0) / cams.length;
    clusters.push({ city, centerLat, centerLon, count: cams.length, cameras: cams });
  }

  // Step 3: Merge nearby clusters (largest absorbs smaller neighbors)
  // Sort descending by count so the largest cluster name wins
  clusters.sort((a, b) => b.count - a.count);

  const merged: CityCluster[] = [];
  const absorbed = new Set<number>();

  for (let i = 0; i < clusters.length; i++) {
    if (absorbed.has(i)) continue;

    const parent = { ...clusters[i], cameras: [...clusters[i].cameras] };

    for (let j = i + 1; j < clusters.length; j++) {
      if (absorbed.has(j)) continue;

      const dist = haversineKm(
        parent.centerLat,
        parent.centerLon,
        clusters[j].centerLat,
        clusters[j].centerLon
      );

      if (dist < MERGE_RADIUS_KM) {
        // Absorb smaller cluster into parent
        parent.cameras.push(...clusters[j].cameras);
        parent.count += clusters[j].count;
        absorbed.add(j);
      }
    }

    // Recompute centroid after merge
    parent.centerLat =
      parent.cameras.reduce((s, c) => s + c.latitude, 0) / parent.cameras.length;
    parent.centerLon =
      parent.cameras.reduce((s, c) => s + c.longitude, 0) / parent.cameras.length;

    merged.push(parent);
  }

  return merged;
}

// Cache cluster icons by count to avoid recreating identical canvases
const clusterIconCache = new Map<number, HTMLCanvasElement>();

/**
 * Orange circle with camera count label, cached by count value.
 */
export function createClusterIcon(count: number): HTMLCanvasElement {
  const cached = clusterIconCache.get(count);
  if (cached) return cached;

  const size = 40;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Outer glow ring
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 102, 0, 0.25)";
  ctx.fill();

  // Solid orange circle
  const innerR = Math.min(16, 10 + Math.log10(count + 1) * 4);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, innerR, 0, Math.PI * 2);
  ctx.fillStyle = "#ff6600";
  ctx.fill();

  // Count text
  ctx.fillStyle = "#000000";
  ctx.font = `bold ${count >= 1000 ? 8 : count >= 100 ? 9 : 10}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(count), size / 2, size / 2);

  clusterIconCache.set(count, canvas);
  return canvas;
}
