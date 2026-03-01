import type { NewsArticle } from "@/types";

const GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";
const GDELT_GEO_API = "https://api.gdeltproject.org/api/v2/geo/geo";

// Circuit breaker: after 3 consecutive failures, stop for 2 minutes
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
let isHalfOpen = false;

function isCircuitOpen(): boolean {
  if (consecutiveFailures < 3) return false;
  if (Date.now() >= circuitOpenUntil) {
    // Half-open: allow one probe attempt
    isHalfOpen = true;
    return false;
  }
  return true;
}

function recordSuccess() {
  consecutiveFailures = 0;
  isHalfOpen = false;
}

function recordFailure() {
  if (isHalfOpen) {
    // Half-open probe failed — re-open immediately
    isHalfOpen = false;
    circuitOpenUntil = Date.now() + 120_000;
    console.warn("GDELT circuit breaker half-open probe FAILED — re-opening for 2min");
    return;
  }
  consecutiveFailures++;
  if (consecutiveFailures >= 3) {
    circuitOpenUntil = Date.now() + 120_000; // 2 minutes
    console.warn(`GDELT circuit breaker OPEN — ${consecutiveFailures} consecutive failures, retrying after 2min`);
  }
}

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  socialimage: string;
  domain: string;
  language: string;
  sourcecountry: string;
  tone: number;
}

// Approximate coords + spread for source countries — GDELT returns full country names
// [centerLat, centerLon, latSpread, lonSpread]
const COUNTRY_COORDS: Record<string, [number, number, number, number]> = {
  "United States": [39.8, -98.5, 20, 50],
  "United Kingdom": [54.0, -2.0, 6, 6],
  "India": [22.0, 79.0, 18, 18],
  "Australia": [-27.0, 134.0, 18, 30],
  "Canada": [55.0, -97.0, 18, 45],
  "Germany": [51.2, 10.4, 5, 7],
  "France": [46.2, 2.2, 6, 8],
  "Japan": [36.2, 138.3, 7, 6],
  "Brazil": [-14.2, -51.9, 22, 22],
  "Nigeria": [9.1, 8.7, 6, 6],
  "South Africa": [-30.6, 25.0, 10, 12],
  "Kenya": [-0.02, 37.9, 5, 5],
  "Singapore": [1.35, 103.8, 1, 1],
  "United Arab Emirates": [24.0, 54.0, 2, 3],
  "Israel": [31.5, 34.8, 2, 1],
  "Russia": [58.0, 80.0, 25, 60],
  "China": [35.0, 105.0, 20, 30],
  "South Korea": [36.5, 127.8, 3, 3],
  "Mexico": [23.6, -102.6, 14, 16],
  "Egypt": [27.0, 30.8, 6, 6],
  "Saudi Arabia": [24.0, 44.0, 8, 12],
  "Pakistan": [30.4, 69.3, 8, 8],
  "Turkey": [39.0, 35.2, 5, 10],
  "Indonesia": [-2.0, 118.0, 10, 30],
  "Philippines": [12.9, 121.8, 8, 5],
  "Thailand": [15.9, 100.9, 7, 5],
  "Italy": [42.5, 12.6, 6, 5],
  "Spain": [40.5, -3.7, 6, 8],
  "Poland": [51.9, 19.1, 4, 6],
  "Netherlands": [52.1, 5.3, 2, 2],
  "Sweden": [62.0, 16.0, 8, 8],
  "Norway": [64.0, 12.0, 10, 10],
  "Argentina": [-35.0, -64.0, 18, 12],
  "Chile": [-33.0, -71.0, 18, 5],
  "Colombia": [4.6, -74.3, 8, 6],
  "Ukraine": [49.0, 32.0, 6, 10],
  "Iraq": [33.2, 43.7, 5, 5],
  "Iran": [32.4, 53.7, 10, 12],
  "Afghanistan": [33.9, 67.7, 5, 5],
  "New Zealand": [-41.0, 174.0, 6, 4],
  "Ireland": [53.4, -8.0, 3, 4],
  "Malaysia": [4.2, 101.9, 6, 8],
  "Taiwan": [23.7, 120.9, 2, 2],
  "Hong Kong": [22.3, 114.2, 0.5, 0.5],
  "Ghana": [7.9, -1.0, 4, 3],
  "Bangladesh": [23.7, 90.4, 3, 2],
  "Sri Lanka": [7.9, 80.8, 2, 1],
  "Vietnam": [16.0, 106.0, 8, 4],
  "Peru": [-10.0, -76.0, 10, 6],
  "Denmark": [56.0, 10.0, 2, 3],
  "Finland": [64.0, 26.0, 6, 8],
  "Switzerland": [46.8, 8.2, 2, 2],
  "Austria": [47.5, 14.6, 3, 3],
  "Belgium": [50.8, 4.5, 1, 2],
  "Greece": [39.1, 22.0, 4, 5],
  "Portugal": [39.4, -8.2, 4, 2],
  "Czech Republic": [49.8, 15.5, 2, 3],
  "Romania": [45.9, 24.9, 4, 5],
  "Hungary": [47.2, 19.5, 2, 3],
  "Ethiopia": [9.1, 40.5, 7, 6],
  "Tanzania": [-6.4, 34.9, 6, 5],
  "Uganda": [1.4, 32.3, 3, 3],
  "Zimbabwe": [-19.0, 29.2, 4, 4],
  "Morocco": [31.8, -7.1, 5, 5],
  "Tunisia": [34.0, 9.5, 3, 3],
  "Algeria": [28.0, 1.7, 10, 10],
  "Jamaica": [18.1, -77.3, 1, 1],
  "Trinidad And Tobago": [10.7, -61.2, 0.5, 0.5],
  "Cuba": [21.5, -79.5, 2, 4],
  // Additional Middle East / Central Asia / Africa
  "Syria": [35.0, 38.0, 4, 4],
  "Yemen": [15.5, 48.0, 5, 6],
  "Jordan": [31.2, 36.5, 2, 2],
  "Lebanon": [33.9, 35.8, 1, 1],
  "Kuwait": [29.3, 47.6, 1, 1],
  "Qatar": [25.3, 51.2, 0.5, 0.5],
  "Oman": [21.5, 57.0, 5, 4],
  "Bahrain": [26.0, 50.5, 0.3, 0.3],
  "Libya": [27.0, 17.0, 10, 10],
  "Sudan": [15.5, 32.5, 10, 10],
  "Somalia": [5.2, 46.2, 6, 6],
  "Myanmar": [19.8, 96.0, 8, 6],
  "Nepal": [28.4, 84.1, 3, 4],
  "Cambodia": [12.6, 104.9, 4, 3],
  "Laos": [18.0, 105.0, 5, 4],
  "North Korea": [40.0, 127.0, 3, 3],
  "Uzbekistan": [41.4, 64.6, 5, 8],
  "Kazakhstan": [48.0, 67.0, 12, 20],
  "Turkmenistan": [38.9, 59.6, 4, 6],
  "Georgia": [42.3, 43.4, 2, 3],
  "Armenia": [40.1, 44.5, 1, 1],
  "Azerbaijan": [40.4, 49.9, 2, 3],
  "Senegal": [14.5, -14.4, 4, 4],
  "Ivory Coast": [7.5, -5.5, 4, 4],
  "Cameroon": [6.0, 12.0, 5, 5],
  "Congo": [-1.0, 15.0, 8, 8],
  "Mozambique": [-18.7, 35.5, 10, 6],
  "Angola": [-12.0, 18.5, 10, 8],
  "Venezuela": [7.0, -66.0, 8, 8],
  "Ecuador": [-1.8, -78.2, 4, 3],
  "Bolivia": [-17.0, -65.0, 6, 6],
  "Paraguay": [-23.4, -58.4, 4, 4],
  "Uruguay": [-32.5, -55.8, 3, 3],
  "Panama": [9.0, -79.5, 2, 2],
  "Costa Rica": [10.0, -84.0, 2, 2],
  "Guatemala": [15.5, -90.2, 3, 3],
  "Honduras": [14.6, -87.2, 2, 3],
  "El Salvador": [13.7, -88.9, 1, 1],
  "Dominican Republic": [18.7, -70.2, 1, 2],
  "Haiti": [19.0, -72.3, 1, 1],
  "Serbia": [44.0, 20.9, 3, 3],
  "Croatia": [45.1, 15.2, 2, 3],
  "Bulgaria": [42.7, 25.5, 3, 3],
  "Slovakia": [48.7, 19.7, 2, 2],
  "Slovenia": [46.2, 14.8, 1, 1],
  "Lithuania": [55.2, 24.0, 2, 3],
  "Latvia": [57.0, 25.0, 2, 3],
  "Estonia": [58.6, 25.0, 2, 2],
  "Cyprus": [35.1, 33.4, 1, 1],
  "Malta": [35.9, 14.4, 0.2, 0.2],
  "Iceland": [64.9, -19.0, 4, 6],
  "Luxembourg": [49.8, 6.1, 0.3, 0.3],
};

/**
 * Fetch global headlines from GDELT artlist (always available, no geo filter).
 * Articles get approximate coords from source country.
 */
export async function fetchGlobalNews(): Promise<NewsArticle[]> {
  if (isCircuitOpen()) {
    console.warn("GDELT circuit breaker open — skipping global fetch");
    return [];
  }

  try {
    const params = new URLSearchParams({
      query: "sourcelang:english",
      mode: "ArtList",
      maxrecords: "75",
      format: "json",
      sort: "DateDesc",
      timespan: "24h",
    });

    const res = await fetch(`${GDELT_DOC_API}?${params}`, {
      signal: AbortSignal.timeout(6_000),
      headers: { "User-Agent": "WorldView/1.0" },
    });

    if (!res.ok) {
      console.error("GDELT artlist error:", res.status, await res.text().catch(() => ""));
      recordFailure();
      return [];
    }

    const data = await res.json();
    if (!data.articles) {
      recordSuccess();
      return [];
    }

    const articles: NewsArticle[] = [];

    for (const article of data.articles as GdeltArticle[]) {
      if (!article.title || !article.url) continue;

      // Assign approximate coords based on source country (full name from GDELT)
      const country = article.sourcecountry || "";
      const coords = COUNTRY_COORDS[country];
      if (!coords) continue; // skip if we can't place it on the map

      // Scatter within the country's geographic extent
      const [cLat, cLon, latSpread, lonSpread] = coords;
      const lat = cLat + (Math.random() - 0.5) * latSpread;
      const lon = cLon + (Math.random() - 0.5) * lonSpread;

      articles.push({
        id: `gdelt-${hashCode(article.url)}`,
        title: article.title,
        url: article.url,
        source: article.domain || "Unknown",
        latitude: lat,
        longitude: lon,
        date: formatGdeltDate(article.seendate),
        language: article.language || "English",
        tone: article.tone || 0,
        imageUrl: article.socialimage || undefined,
      });
    }

    recordSuccess();
    return articles;
  } catch (err) {
    console.error("GDELT global news error:", err);
    recordFailure();
    return [];
  }
}

/**
 * Fetch location-specific news using GDELT GEO 2.0 API (PointData + GeoJSON).
 * Returns articles with real lat/lon coordinates, filtered to within radiusKm.
 */
export async function fetchLocalNews(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<NewsArticle[]> {
  if (isCircuitOpen()) {
    console.warn("GDELT circuit breaker open — skipping local fetch");
    return [];
  }

  try {
    const params = new URLSearchParams({
      query: "web",
      mode: "PointData",
      format: "GeoJSON",
      timespan: "24h",
      maxpoints: "50",
      GEORES: "1",
    });

    const res = await fetch(`${GDELT_GEO_API}?${params}`, {
      signal: AbortSignal.timeout(6_000),
      headers: { "User-Agent": "WorldView/1.0" },
    });

    if (!res.ok) {
      console.error("GDELT GEO error:", res.status, await res.text().catch(() => ""));
      recordFailure();
      return [];
    }

    const geojson = await res.json();
    if (!geojson.features || !Array.isArray(geojson.features)) {
      recordSuccess();
      return [];
    }

    const articles: NewsArticle[] = [];
    const cosLat = Math.cos((lat * Math.PI) / 180);

    for (const feature of geojson.features) {
      const coords = feature.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;

      const [fLon, fLat] = coords; // GeoJSON is [lon, lat]

      // Skip error features and null island
      if (fLat === 0 && fLon === 0) continue;
      const name: string = feature.properties?.name || "";
      if (name.startsWith("ERROR")) continue;

      // Filter to features within our radius
      const dLat = (fLat - lat) * 111;
      const dLon = (fLon - lon) * 111 * cosLat;
      const distKm = Math.sqrt(dLat * dLat + dLon * dLon);
      if (distKm > radiusKm) continue;

      const props = feature.properties || {};
      const htmlStr: string = props.html || "";
      const linkMatch = htmlStr.match(/<a href="([^"]+)"[^>]*title="([^"]+)"/);

      const title = linkMatch?.[2] || props.name || "Breaking News";
      const url = linkMatch?.[1] || "";

      articles.push({
        id: `gdelt-geo-${hashCode(url || props.name || String(fLat))}`,
        title,
        url,
        source: props.name || "Local",
        latitude: fLat,
        longitude: fLon,
        date: new Date().toISOString(),
        language: "English",
        tone: 0,
        imageUrl: props.shareimage || undefined,
      });
    }

    recordSuccess();
    return articles;
  } catch (err) {
    console.error("GDELT local news error:", err);
    recordFailure();
    return [];
  }
}

function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function formatGdeltDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  // GDELT dates: "20240115T123000Z" format
  try {
    const cleaned = dateStr.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z");
    return new Date(cleaned).toISOString();
  } catch {
    return new Date().toISOString();
  }
}
