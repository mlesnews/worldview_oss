import type { Flight } from "@/types";

const OPENSKY_API = "https://opensky-network.org/api";

export async function fetchFlights(): Promise<Flight[]> {
  const res = await fetch(`${OPENSKY_API}/states/all`, {
    next: { revalidate: 10 },
  });

  if (!res.ok) {
    console.error("OpenSky API error:", res.status);
    return [];
  }

  const data = await res.json();

  if (!data.states) return [];

  return data.states
    .filter(
      (s: unknown[]) =>
        s[5] != null && s[6] != null && s[5] !== 0 && s[6] !== 0
    )
    .map((s: unknown[]): Flight => ({
      icao24: s[0] as string,
      callsign: ((s[1] as string) || "").trim(),
      originCountry: s[2] as string,
      longitude: s[5] as number,
      latitude: s[6] as number,
      baroAltitude: s[7] as number | null,
      onGround: s[8] as boolean,
      velocity: s[9] as number | null,
      trueTrack: s[10] as number | null,
      verticalRate: s[11] as number | null,
      geoAltitude: s[13] as number | null,
      squawk: s[14] as string | null,
      lastContact: s[4] as number,
    }));
}
