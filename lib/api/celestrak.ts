import type { Satellite } from "@/types";
import * as satellite from "satellite.js";

const TLE_URLS: Record<string, string> = {
  stations: "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle",
  active: "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
  starlink: "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle",
};

interface TLERecord {
  name: string;
  line1: string;
  line2: string;
}

function parseTLEText(text: string): TLERecord[] {
  const lines = text.trim().split("\n").map((l) => l.trim());
  const records: TLERecord[] = [];

  for (let i = 0; i < lines.length - 2; i += 3) {
    if (lines[i + 1]?.startsWith("1 ") && lines[i + 2]?.startsWith("2 ")) {
      records.push({
        name: lines[i],
        line1: lines[i + 1],
        line2: lines[i + 2],
      });
    }
  }

  return records;
}

export async function fetchSatellites(
  group: keyof typeof TLE_URLS = "stations"
): Promise<Satellite[]> {
  const res = await fetch(TLE_URLS[group], { next: { revalidate: 60 } });

  if (!res.ok) {
    console.error("CelesTrak error:", res.status);
    return [];
  }

  const text = await res.text();
  const records = parseTLEText(text);
  const now = new Date();
  const satellites: Satellite[] = [];

  for (const record of records) {
    try {
      const satrec = satellite.twoline2satrec(record.line1, record.line2);
      const posVel = satellite.propagate(satrec, now);

      if (!posVel) continue;
      if (
        !posVel.position ||
        typeof posVel.position === "boolean" ||
        !posVel.velocity ||
        typeof posVel.velocity === "boolean"
      )
        continue;

      const gmst = satellite.gstime(now);
      const geo = satellite.eciToGeodetic(posVel.position, gmst);

      const lat = satellite.degreesLat(geo.latitude);
      const lon = satellite.degreesLong(geo.longitude);
      const alt = geo.height;

      const vel = posVel.velocity;
      const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);

      if (isNaN(lat) || isNaN(lon)) continue;

      satellites.push({
        id: parseInt(satrec.satnum) || satellites.length,
        name: record.name,
        latitude: lat,
        longitude: lon,
        altitude: alt,
        velocity: speed,
        category: group,
        tleLine1: record.line1,
        tleLine2: record.line2,
      });
    } catch {
      // Skip malformed TLE entries
    }
  }

  return satellites;
}
