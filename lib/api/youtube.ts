import type { LiveStream } from "@/types";
import { haversineKm } from "@/lib/utils";

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3/search";

interface SeedLocation {
  city: string;
  lat: number;
  lon: number;
  radius: string; // e.g. "50km"
}

const SEED_LOCATIONS: SeedLocation[] = [
  // North America
  { city: "New York", lat: 40.7128, lon: -74.006, radius: "50km" },
  { city: "Los Angeles", lat: 34.0522, lon: -118.2437, radius: "50km" },
  { city: "Chicago", lat: 41.8781, lon: -87.6298, radius: "50km" },
  { city: "Houston", lat: 29.7604, lon: -95.3698, radius: "50km" },
  { city: "San Francisco", lat: 37.7749, lon: -122.4194, radius: "30km" },
  { city: "Austin", lat: 30.2672, lon: -97.7431, radius: "30km" },
  { city: "Miami", lat: 25.7617, lon: -80.1918, radius: "40km" },
  { city: "Washington DC", lat: 38.9072, lon: -77.0369, radius: "30km" },
  { city: "Toronto", lat: 43.6532, lon: -79.3832, radius: "40km" },
  { city: "Mexico City", lat: 19.4326, lon: -99.1332, radius: "50km" },
  // Europe
  { city: "London", lat: 51.5074, lon: -0.1278, radius: "50km" },
  { city: "Paris", lat: 48.8566, lon: 2.3522, radius: "30km" },
  { city: "Berlin", lat: 52.52, lon: 13.405, radius: "40km" },
  { city: "Madrid", lat: 40.4168, lon: -3.7038, radius: "40km" },
  { city: "Rome", lat: 41.9028, lon: 12.4964, radius: "30km" },
  { city: "Amsterdam", lat: 52.3676, lon: 4.9041, radius: "30km" },
  { city: "Stockholm", lat: 59.3293, lon: 18.0686, radius: "30km" },
  { city: "Moscow", lat: 55.7558, lon: 37.6173, radius: "50km" },
  { city: "Istanbul", lat: 41.0082, lon: 28.9784, radius: "40km" },
  { city: "Kyiv", lat: 50.4501, lon: 30.5234, radius: "40km" },
  // Middle East
  { city: "Dubai", lat: 25.2048, lon: 55.2708, radius: "30km" },
  { city: "Tel Aviv", lat: 32.0853, lon: 34.7818, radius: "30km" },
  { city: "Riyadh", lat: 24.7136, lon: 46.6753, radius: "40km" },
  { city: "Tehran", lat: 35.6892, lon: 51.389, radius: "40km" },
  { city: "Baghdad", lat: 33.3152, lon: 44.3661, radius: "40km" },
  { city: "Cairo", lat: 30.0444, lon: 31.2357, radius: "40km" },
  // Asia
  { city: "Tokyo", lat: 35.6762, lon: 139.6503, radius: "50km" },
  { city: "Beijing", lat: 39.9042, lon: 116.4074, radius: "50km" },
  { city: "Shanghai", lat: 31.2304, lon: 121.4737, radius: "40km" },
  { city: "Seoul", lat: 37.5665, lon: 126.978, radius: "40km" },
  { city: "Mumbai", lat: 19.076, lon: 72.8777, radius: "40km" },
  { city: "Delhi", lat: 28.7041, lon: 77.1025, radius: "40km" },
  { city: "Bangkok", lat: 13.7563, lon: 100.5018, radius: "40km" },
  { city: "Singapore", lat: 1.3521, lon: 103.8198, radius: "20km" },
  { city: "Jakarta", lat: -6.2088, lon: 106.8456, radius: "40km" },
  { city: "Manila", lat: 14.5995, lon: 120.9842, radius: "30km" },
  { city: "Hong Kong", lat: 22.3193, lon: 114.1694, radius: "20km" },
  { city: "Taipei", lat: 25.033, lon: 121.5654, radius: "30km" },
  // South America
  { city: "São Paulo", lat: -23.5505, lon: -46.6333, radius: "50km" },
  { city: "Buenos Aires", lat: -34.6037, lon: -58.3816, radius: "40km" },
  { city: "Bogotá", lat: 4.711, lon: -74.0721, radius: "30km" },
  { city: "Lima", lat: -12.0464, lon: -77.0428, radius: "30km" },
  { city: "Santiago", lat: -33.4489, lon: -70.6693, radius: "30km" },
  // Africa
  { city: "Lagos", lat: 6.5244, lon: 3.3792, radius: "40km" },
  { city: "Nairobi", lat: -1.2921, lon: 36.8219, radius: "30km" },
  { city: "Johannesburg", lat: -26.2041, lon: 28.0473, radius: "40km" },
  { city: "Cape Town", lat: -33.9249, lon: 18.4241, radius: "30km" },
  // Oceania
  { city: "Sydney", lat: -33.8688, lon: 151.2093, radius: "50km" },
  { city: "Melbourne", lat: -37.8136, lon: 144.9631, radius: "40km" },
  { city: "Auckland", lat: -36.8485, lon: 174.7633, radius: "30km" },
];

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { medium?: { url: string } };
    liveBroadcastContent: string;
  };
}

// Keywords that indicate gaming/non-webcam content
const GAMING_KEYWORDS = /\b(game|gaming|fortnite|minecraft|valorant|gameplay|twitch|let'?s play|playthrough|reaction|unboxing|asmr|mukbang|gta|roblox|apex|warzone|league of legends|dota|csgo|counter.?strike|overwatch|cod |call of duty)\b/i;

/**
 * Search seed locations for live streams (global baseline).
 * Rotates through a subset of locations to conserve quota.
 */
export async function searchLiveStreams(
  apiKey: string
): Promise<LiveStream[]> {
  if (!apiKey) return [];

  const streams: LiveStream[] = [];

  // Search a rotating subset (4 cities per call) to conserve quota
  const hour = new Date().getUTCHours();
  const batchSize = 4;
  const offset = (hour * batchSize) % SEED_LOCATIONS.length;
  const locationsToSearch: SeedLocation[] = [];
  for (let i = 0; i < batchSize; i++) {
    locationsToSearch.push(SEED_LOCATIONS[(offset + i) % SEED_LOCATIONS.length]);
  }

  for (const loc of locationsToSearch) {
    const results = await searchAtLocation(apiKey, loc.lat, loc.lon, loc.radius, loc.city);
    streams.push(...results);
  }

  return streams;
}

/**
 * Search for live streams near a viewport center by finding nearest seed cities.
 * Results are plotted at the city's known coordinates, not the raw viewport center.
 */
export async function searchLiveStreamsAtLocation(
  apiKey: string,
  lat: number,
  lon: number
): Promise<LiveStream[]> {
  if (!apiKey) return [];

  // Find nearest seed cities within 500km
  const citiesWithDist = SEED_LOCATIONS
    .map((loc) => ({ loc, dist: haversineKm(lat, lon, loc.lat, loc.lon) }))
    .filter((c) => c.dist < 500)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 2); // at most 2 nearest cities

  if (citiesWithDist.length > 0) {
    const allStreams: LiveStream[] = [];
    for (const { loc } of citiesWithDist) {
      const results = await searchAtLocation(apiKey, loc.lat, loc.lon, loc.radius, loc.city);
      allStreams.push(...results);
    }
    return allStreams;
  }

  // No seed city within 500km — direct coordinate search with 100km cap
  return searchAtLocation(apiKey, lat, lon, "100km", "Remote");
}

async function searchAtLocation(
  apiKey: string,
  lat: number,
  lon: number,
  radius: string,
  city: string
): Promise<LiveStream[]> {
  try {
    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      eventType: "live",
      location: `${lat},${lon}`,
      locationRadius: radius,
      maxResults: "5",
      q: "webcam OR earthcam OR livecam OR traffic cam OR CCTV OR city cam OR skyline",
      key: apiKey,
    });

    const res = await fetch(`${YOUTUBE_API}?${params}`, {
      next: { revalidate: 1800 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!data.items) return [];

    const streams: LiveStream[] = [];
    for (const item of data.items as YouTubeSearchItem[]) {
      if (item.snippet.liveBroadcastContent !== "live") continue;

      // Filter out gaming/non-webcam content
      if (GAMING_KEYWORDS.test(item.snippet.title) || GAMING_KEYWORDS.test(item.snippet.channelTitle)) {
        continue;
      }

      streams.push({
        id: `yt-${item.id.videoId}`,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        videoId: item.id.videoId,
        latitude: lat + (Math.random() - 0.5) * 0.1,
        longitude: lon + (Math.random() - 0.5) * 0.1,
        thumbnailUrl: item.snippet.thumbnails?.medium?.url || "",
        city,
      });
    }
    return streams;
  } catch (err) {
    console.error(`YouTube search error for ${city}:`, err);
    return [];
  }
}
