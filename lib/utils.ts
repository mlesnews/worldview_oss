/** Convert decimal degrees to DMS (degrees, minutes, seconds) format */
export function toDMS(decimal: number, isLat: boolean): string {
  const abs = Math.abs(decimal);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = ((mFloat - m) * 60).toFixed(1);
  const dir = isLat ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W');
  return `${d}°${m}'${s}" ${dir}`;
}

/** Format altitude in feet or km */
export function formatAlt(meters: number): string {
  if (meters > 100000) {
    return `${(meters / 1000).toFixed(1)} KM`;
  }
  const feet = meters * 3.28084;
  return `${feet.toFixed(0)} FT`;
}

/** Format velocity in knots */
export function formatSpeed(ms: number): string {
  const knots = ms * 1.94384;
  return `${knots.toFixed(0)} KTS`;
}

/** Get current UTC/Zulu time string */
export function getZuluTime(): string {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19) + 'Z';
}

/** Get formatted date for HUD display */
export function getHudDate(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Format bearing in degrees */
export function formatBearing(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  return `${normalized.toFixed(1)}°`;
}

/** Grid reference from lat/lon (simplified MGRS-style) */
export function toGridRef(lat: number, lon: number): string {
  const latZone = String.fromCharCode(65 + Math.floor((lat + 90) / 8) % 26);
  const lonZone = Math.floor((lon + 180) / 6) + 1;
  return `${lonZone}${latZone}`;
}

/** Format large numbers with commas */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** Meters to feet */
export function metersToFeet(m: number): number {
  return m * 3.28084;
}
