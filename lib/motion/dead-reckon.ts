import type { FlightMotionState } from "@/types";
import { MAX_DEAD_RECKON_SECONDS } from "@/lib/constants";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const EARTH_RADIUS_M = 6_371_000;

/**
 * Great-circle forward projection from a known state.
 * Returns { lat, lon, alt } in degrees/meters.
 */
export function deadReckonPosition(
  base: FlightMotionState,
  currentTimeSec: number
): { lat: number; lon: number; alt: number } {
  const dt = currentTimeSec - base.timestamp;

  // Stale guard — don't extrapolate beyond limit
  if (dt <= 0 || dt > MAX_DEAD_RECKON_SECONDS) {
    return { lat: base.lat, lon: base.lon, alt: base.alt };
  }

  const distM = base.velocity * dt;
  const angularDist = distM / EARTH_RADIUS_M;
  const bearing = base.heading * DEG2RAD;

  const lat1 = base.lat * DEG2RAD;
  const lon1 = base.lon * DEG2RAD;

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAng = Math.sin(angularDist);
  const cosAng = Math.cos(angularDist);

  const lat2 = Math.asin(
    sinLat1 * cosAng + cosLat1 * sinAng * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * sinAng * cosLat1,
      cosAng - sinLat1 * Math.sin(lat2)
    );

  const alt = base.alt + base.verticalRate * dt;

  return {
    lat: lat2 * RAD2DEG,
    lon: lon2 * RAD2DEG,
    alt: Math.max(0, alt),
  };
}

/**
 * Initial bearing from point 1 to point 2 (degrees, 0=N, clockwise).
 * Used to estimate ISS heading from consecutive position samples.
 */
export function computeBearing(
  lat1Deg: number,
  lon1Deg: number,
  lat2Deg: number,
  lon2Deg: number
): number {
  const lat1 = lat1Deg * DEG2RAD;
  const lat2 = lat2Deg * DEG2RAD;
  const dLon = (lon2Deg - lon1Deg) * DEG2RAD;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return ((Math.atan2(y, x) * RAD2DEG) + 360) % 360;
}
