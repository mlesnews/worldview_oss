import * as Cesium from "cesium";

export function initCesium() {
  // Point to our copied static assets
  (window as unknown as Record<string, unknown>).CESIUM_BASE_URL = "/cesium";

  // Set Ion token if available (needed for terrain/city map styles)
  const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
  if (ionToken) {
    Cesium.Ion.defaultAccessToken = ionToken;
  } else {
    Cesium.Ion.defaultAccessToken = undefined as unknown as string;
  }
}

/** Dark-themed OpenStreetMap tile provider */
export function createDarkImageryProvider(): Cesium.UrlTemplateImageryProvider {
  return new Cesium.UrlTemplateImageryProvider({
    url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    credit: new Cesium.Credit("CartoDB Dark Matter"),
    minimumLevel: 0,
    maximumLevel: 18,
  });
}

/** Stamen Toner for a stark black/white look (FLIR base) */
export function createTonerImageryProvider(): Cesium.UrlTemplateImageryProvider {
  return new Cesium.UrlTemplateImageryProvider({
    url: "https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png",
    credit: new Cesium.Credit("Stadia Maps / Stamen Toner"),
    minimumLevel: 0,
    maximumLevel: 18,
  });
}

/** Check if Cesium Ion token is available */
export function hasIonToken(): boolean {
  return !!process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
}

/** Satellite aerial imagery via Cesium Ion (requires token) */
export async function createSatelliteImageryProvider(): Promise<Cesium.IonImageryProvider> {
  return Cesium.IonImageryProvider.fromAssetId(2); // Bing Maps Aerial
}

/** Cesium World Terrain (requires Ion token) */
export async function createWorldTerrain(): Promise<Cesium.CesiumTerrainProvider> {
  return Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
    requestVertexNormals: true,
    requestWaterMask: true,
  });
}

/** Dark labels overlay (country names, roads, etc.) — transparent background */
export function createLabelsOverlayProvider(): Cesium.UrlTemplateImageryProvider {
  return new Cesium.UrlTemplateImageryProvider({
    url: "https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
    credit: new Cesium.Credit("CartoDB Labels"),
    minimumLevel: 0,
    maximumLevel: 18,
  });
}

/** OSM 3D Buildings tileset (requires Ion token) */
export async function createOsmBuildings(): Promise<Cesium.Cesium3DTileset> {
  return Cesium.Cesium3DTileset.fromIonAssetId(96188);
}

/** Default viewer options for our intelligence look */
export const viewerOptions: Partial<Cesium.Viewer.ConstructorOptions> = {
  animation: false,
  baseLayerPicker: false,
  fullscreenButton: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  navigationHelpButton: false,
  scene3DOnly: true,
  skyBox: false,
  skyAtmosphere: false,
  contextOptions: {
    webgl: {
      alpha: true,
    },
  },
  requestRenderMode: false,
  maximumRenderTimeChange: Infinity,
};
