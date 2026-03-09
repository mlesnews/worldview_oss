import * as satellite from "satellite.js";

/**
 * Propagate a TLE to a given Date, returning geodetic position.
 * Returns null if propagation fails (e.g. decayed orbit).
 */
export function propagateTLE(
  tleLine1: string,
  tleLine2: string,
  date: Date
): { lat: number; lon: number; altKm: number } | null {
  try {
    const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    const posVel = satellite.propagate(satrec, date);

    if (
      !posVel ||
      !posVel.position ||
      typeof posVel.position === "boolean"
    ) {
      return null;
    }

    const gmst = satellite.gstime(date);
    const geo = satellite.eciToGeodetic(posVel.position, gmst);

    const lat = satellite.degreesLat(geo.latitude);
    const lon = satellite.degreesLong(geo.longitude);

    if (isNaN(lat) || isNaN(lon)) return null;

    return { lat, lon, altKm: geo.height };
  } catch {
    return null;
  }
}

/**
 * Parse TLE lines into a satrec for repeated propagation.
 * Returns null if TLE is malformed.
 */
export function parseSatrec(
  tleLine1: string,
  tleLine2: string
): satellite.SatRec | null {
  try {
    return satellite.twoline2satrec(tleLine1, tleLine2);
  } catch {
    return null;
  }
}

/**
 * Propagate an already-parsed satrec to a given Date.
 * Avoids re-parsing TLE on every frame.
 */
export function propagateSatrec(
  satrec: satellite.SatRec,
  date: Date
): { lat: number; lon: number; altKm: number } | null {
  try {
    const posVel = satellite.propagate(satrec, date);

    if (
      !posVel ||
      !posVel.position ||
      typeof posVel.position === "boolean"
    ) {
      return null;
    }

    const gmst = satellite.gstime(date);
    const geo = satellite.eciToGeodetic(posVel.position, gmst);

    const lat = satellite.degreesLat(geo.latitude);
    const lon = satellite.degreesLong(geo.longitude);

    if (isNaN(lat) || isNaN(lon)) return null;

    return { lat, lon, altKm: geo.height };
  } catch {
    return null;
  }
}
