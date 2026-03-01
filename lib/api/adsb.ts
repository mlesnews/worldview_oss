import type { Flight } from "@/types";

/**
 * ADS-B Exchange v2 client — global flight tracking.
 * Replaces OpenSky Network which rate-limits unauthenticated users to ~400 req/day.
 *
 * Uses large-radius (1000nm) point queries distributed across the globe.
 * 1000nm ≈ 1852km radius = ~30° lat x 40° lon coverage per query.
 * Queries run in parallel across multiple providers for speed.
 * All providers share the ADSBx v2 JSON format.
 */

const PROVIDERS = [
  "https://api.airplanes.live/v2",
  "https://api.adsb.lol/v2",
  "https://api.adsb.one/v2",
];

/**
 * Global sample points with 1000nm radius — each covers ~30° lat x 40° lon.
 * Heavy overlap ensures seamless, gap-free worldwide coverage.
 */
const GLOBAL_QUERIES = [
  { lat: 38, lon: -95, r: 1000 },   // North America
  { lat: 50, lon: 10, r: 1000 },    // Europe
  { lat: 30, lon: 70, r: 1000 },    // Middle East + South Asia
  { lat: 35, lon: 125, r: 1000 },   // East Asia
  { lat: -25, lon: 135, r: 1000 },  // Oceania
  { lat: -15, lon: -50, r: 1000 },  // South America
  { lat: 10, lon: 105, r: 1000 },   // SE Asia
  { lat: 60, lon: -50, r: 1000 },   // North Atlantic / Canada
  { lat: 15, lon: 30, r: 1000 },    // Africa / Mediterranean
];

/** ICAO hex prefix → country (common prefixes) */
const ICAO_COUNTRY: Record<string, string> = {
  "a": "United States",
  "c0": "Canada", "c1": "Canada", "c2": "Canada", "c3": "Canada",
  "40": "United Kingdom", "41": "United Kingdom", "42": "United Kingdom",
  "43": "United Kingdom",
  "38": "France", "39": "France", "3a": "France", "3b": "France",
  "3c": "Germany", "3d": "Germany", "3e": "Germany",
  "30": "Italy", "31": "Italy", "32": "Italy", "33": "Italy",
  "34": "Spain", "35": "Spain", "36": "Spain",
  "48": "Netherlands", "49": "Netherlands",
  "4c": "Ireland",
  "44": "Austria",
  "46": "Denmark", "45": "Denmark",
  "47": "Finland",
  "4a": "Switzerland", "4b": "Switzerland",
  "50": "Israel",
  "06": "Mexico",
  "e0": "Brazil", "e1": "Brazil", "e2": "Brazil",
  "70": "Australia", "71": "Australia", "72": "Australia",
  "78": "Japan", "79": "Japan", "7a": "Japan", "7b": "Japan",
  "7c": "Australia", "7d": "Australia",
  "76": "India", "80": "India",
  "89": "South Korea", "88": "Thailand",
  "75": "Singapore",
  "01": "South Africa",
  "0a": "Algeria", "0c": "Egypt",
  "4d": "Turkey", "4e": "Turkey",
  "73": "New Zealand", "74": "New Zealand",
  "8a": "Indonesia", "8b": "Indonesia",
  "c8": "Argentina", "c9": "Argentina",
  "e4": "Chile",
  "0d": "Nigeria",
};

function lookupCountry(hex: string): string {
  const h = hex.toLowerCase();
  return ICAO_COUNTRY[h.slice(0, 2)] ?? ICAO_COUNTRY[h.slice(0, 1)] ?? "Unknown";
}

interface ADSBxAircraft {
  hex: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | "ground";
  alt_geom?: number;
  gs?: number;
  track?: number;
  baro_rate?: number;
  squawk?: string;
  seen?: number;
  now?: number;
  r?: string;
  t?: string;
  category?: string;
}

interface ADSBxResponse {
  ac?: ADSBxAircraft[];
  now?: number;
  msg?: string;
}

const FT_TO_M = 1 / 3.28084;
const KTS_TO_MS = 0.514444;
const FTMIN_TO_MS = 1 / 196.85;

function mapAircraft(ac: ADSBxAircraft, responseNow?: number): Flight | null {
  if (ac.lat == null || ac.lon == null || ac.lat === 0 || ac.lon === 0) return null;

  const isGround = ac.alt_baro === "ground";
  const baroAltFt = typeof ac.alt_baro === "number" ? ac.alt_baro : null;

  return {
    icao24: ac.hex,
    callsign: (ac.flight ?? "").trim(),
    originCountry: lookupCountry(ac.hex),
    latitude: ac.lat,
    longitude: ac.lon,
    baroAltitude: baroAltFt != null ? baroAltFt * FT_TO_M : null,
    onGround: isGround,
    velocity: ac.gs != null ? ac.gs * KTS_TO_MS : null,
    trueTrack: ac.track ?? null,
    verticalRate: ac.baro_rate != null ? ac.baro_rate * FTMIN_TO_MS : null,
    geoAltitude: ac.alt_geom != null ? ac.alt_geom * FT_TO_M : null,
    squawk: ac.squawk ?? null,
    lastContact: responseNow && ac.seen != null ? responseNow - ac.seen : Date.now() / 1000,
  };
}

function dedupeAndMap(responses: ADSBxResponse[]): Flight[] {
  const seen = new Set<string>();
  const flights: Flight[] = [];
  for (const resp of responses) {
    if (!resp?.ac) continue;
    for (const ac of resp.ac) {
      if (seen.has(ac.hex)) continue;
      seen.add(ac.hex);
      const flight = mapAircraft(ac, resp.now);
      if (flight) flights.push(flight);
    }
  }
  return flights;
}

/**
 * Fetch global flights via large-radius point queries in parallel.
 * Round-robins across providers to spread load.
 */
export async function fetchFlights(): Promise<Flight[]> {
  const responses = await Promise.allSettled(
    GLOBAL_QUERIES.map(async (pt, i) => {
      const base = PROVIDERS[i % PROVIDERS.length];
      try {
        const res = await fetch(`${base}/point/${pt.lat}/${pt.lon}/${pt.r}`, {
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) return (await res.json()) as ADSBxResponse;
      } catch { /* skip */ }
      return null;
    })
  );

  const valid = responses
    .filter((r): r is PromiseFulfilledResult<ADSBxResponse | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is ADSBxResponse => v != null);

  return dedupeAndMap(valid);
}

/**
 * Search for a specific flight by callsign.
 */
export async function searchFlightByCallsign(
  callsign: string
): Promise<Flight | null> {
  for (const base of PROVIDERS) {
    try {
      const res = await fetch(
        `${base}/callsign/${encodeURIComponent(callsign.toUpperCase())}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;
      const data: ADSBxResponse = await res.json();
      if (!data.ac?.length) continue;
      return mapAircraft(data.ac[0], data.now);
    } catch {
      // Try next
    }
  }
  return null;
}
