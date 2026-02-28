import * as Cesium from "cesium";

export function initCesium() {
  // Point to our copied static assets
  (window as unknown as Record<string, unknown>).CESIUM_BASE_URL = "/cesium";

  // Disable Cesium Ion (we're using free OSM tiles)
  Cesium.Ion.defaultAccessToken = undefined as unknown as string;
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
