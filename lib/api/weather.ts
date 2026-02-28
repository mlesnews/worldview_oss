/** NWS radar tile URLs for weather overlay */
export interface WeatherRadarInfo {
  tileUrl: string;
  attribution: string;
}

/** Get NWS MRMS radar tile URL (precipitation) */
export function getWeatherRadarTileUrl(): WeatherRadarInfo {
  return {
    tileUrl:
      "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png",
    attribution: "Iowa Environmental Mesonet / NEXRAD",
  };
}

/** Get RainViewer API radar tiles (global coverage, free) */
export async function getRainViewerTileUrl(): Promise<WeatherRadarInfo | null> {
  try {
    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
    if (!res.ok) return null;

    const data = await res.json();
    const latest = data.radar?.past?.[data.radar.past.length - 1];

    if (!latest) return null;

    return {
      tileUrl: `https://tilecache.rainviewer.com${latest.path}/256/{z}/{x}/{y}/4/1_1.png`,
      attribution: "RainViewer",
    };
  } catch {
    return null;
  }
}
