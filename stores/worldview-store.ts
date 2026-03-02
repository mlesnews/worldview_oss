import { create } from 'zustand';
import * as Cesium from 'cesium';
import type { ViewMode, MapStyle, LayerState, LayerKey, CursorPosition, EntityInfo, Camera, FlightCategory, DisasterCategory, NewsArticle, LiveStream, Disaster, Flight } from '@/types';

export interface Viewport {
  centerLat: number;
  centerLon: number;
  altitude: number;
  radiusKm: number;
  isZoomedIn: boolean;
}

interface WorldViewStore {
  layers: LayerState;
  toggleLayer: (layer: LayerKey) => void;

  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  mapStyle: MapStyle;
  setMapStyle: (style: MapStyle) => void;

  cursorPosition: CursorPosition | null;
  setCursorPosition: (pos: CursorPosition | null) => void;

  selectedEntity: EntityInfo | null;
  setSelectedEntity: (entity: EntityInfo | null) => void;

  cameraModalOpen: boolean;
  activeCamera: Camera | null;
  openCameraModal: (camera: Camera) => void;
  closeCameraModal: () => void;

  // Flight sub-type filters
  flightFilters: Record<FlightCategory, boolean>;
  toggleFlightFilter: (category: FlightCategory) => void;

  // Disaster sub-type filters
  disasterFilters: Record<DisasterCategory, boolean>;
  toggleDisasterFilter: (category: DisasterCategory) => void;

  // Media modal (YouTube embeds)
  mediaModalOpen: boolean;
  mediaModalContent: { videoId: string; title: string } | null;
  openMediaModal: (videoId: string, title: string) => void;
  closeMediaModal: () => void;

  // Shared camera data (populated by CameraLayer, read by CameraList)
  cameras: Camera[];
  setCameras: (cameras: Camera[]) => void;

  // Layer data (populated by hooks, read by DataFeed)
  flights: Flight[];
  setFlights: (flights: Flight[]) => void;
  newsArticles: NewsArticle[];
  setNewsArticles: (articles: NewsArticle[]) => void;
  liveStreams: LiveStream[];
  setLiveStreams: (streams: LiveStream[]) => void;
  disasterEvents: Disaster[];
  setDisasterEvents: (events: Disaster[]) => void;

  viewport: Viewport;
  setViewport: (v: Viewport) => void;

  viewer: Cesium.Viewer | null;
  setViewer: (viewer: Cesium.Viewer | null) => void;
  flyTo: (lon: number, lat: number, alt?: number) => void;

  // Timeline / simulation time
  simulationDate: Date;
  simulationHour: number;
  simulationMinute: number;
  calendarOpen: boolean;
  isLive: boolean;
  setSimulationDate: (date: Date) => void;
  setSimulationTime: (hour: number, minute: number) => void;
  setCalendarOpen: (open: boolean) => void;
  resetToLive: () => void;
}

export const useWorldViewStore = create<WorldViewStore>((set, get) => ({
  layers: {
    flights: false,
    satellites: false,
    disasters: false,
    asteroids: false,
    weather: false,
    cameras: false,
    livestreams: false,
    news: false,
  },
  toggleLayer: (layer) =>
    set((state) => ({
      layers: { ...state.layers, [layer]: !state.layers[layer] },
    })),

  viewMode: 'nightvision',
  setViewMode: (mode) => set({ viewMode: mode }),

  mapStyle: 'dark',
  setMapStyle: (style) => set({ mapStyle: style }),

  cursorPosition: null,
  setCursorPosition: (pos) => set({ cursorPosition: pos }),

  selectedEntity: null,
  setSelectedEntity: (entity) => set({ selectedEntity: entity }),

  cameraModalOpen: false,
  activeCamera: null,
  openCameraModal: (camera) =>
    set({ cameraModalOpen: true, activeCamera: camera }),
  closeCameraModal: () =>
    set({ cameraModalOpen: false, activeCamera: null }),

  flightFilters: {
    regular: true,
    iss: true,
  },
  toggleFlightFilter: (category) =>
    set((state) => ({
      flightFilters: {
        ...state.flightFilters,
        [category]: !state.flightFilters[category],
      },
    })),

  disasterFilters: {
    earthquakes: true,
    wildfires: true,
    volcanoes: true,
    severeStorms: true,
    floods: true,
    ice: true,
  },
  toggleDisasterFilter: (category) =>
    set((state) => ({
      disasterFilters: {
        ...state.disasterFilters,
        [category]: !state.disasterFilters[category],
      },
    })),

  mediaModalOpen: false,
  mediaModalContent: null,
  openMediaModal: (videoId, title) =>
    set({ mediaModalOpen: true, mediaModalContent: { videoId, title } }),
  closeMediaModal: () =>
    set({ mediaModalOpen: false, mediaModalContent: null }),

  cameras: [],
  setCameras: (cameras) => set({ cameras }),

  flights: [],
  setFlights: (flights) => set({ flights }),
  newsArticles: [],
  setNewsArticles: (articles) => set({ newsArticles: articles }),
  liveStreams: [],
  setLiveStreams: (streams) => set({ liveStreams: streams }),
  disasterEvents: [],
  setDisasterEvents: (events) => set({ disasterEvents: events }),

  viewport: {
    centerLat: 30.2672,
    centerLon: -97.7431,
    altitude: 15_000_000,
    radiusKm: 20000,
    isZoomedIn: false,
  },
  setViewport: (v) => set({ viewport: v }),

  viewer: null,
  setViewer: (viewer) => set({ viewer }),
  flyTo: (lon, lat, alt = 1_000_000) => {
    const { viewer } = get();
    if (!viewer || viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration: 1.5,
    });
  },

  // Timeline / simulation time
  simulationDate: new Date(),
  simulationHour: new Date().getUTCHours(),
  simulationMinute: new Date().getUTCMinutes(),
  calendarOpen: false,
  isLive: true,

  setSimulationDate: (date) => {
    const { viewer } = get();
    set({
      simulationDate: date,
      isLive: false,
    });
    // Sync CesiumJS clock
    if (viewer && !viewer.isDestroyed()) {
      const { simulationHour, simulationMinute } = get();
      const d = new Date(date);
      d.setUTCHours(simulationHour, simulationMinute, 0, 0);
      viewer.clock.currentTime = Cesium.JulianDate.fromDate(d);
      viewer.clock.shouldAnimate = false;
    }
  },

  setSimulationTime: (hour, minute) => {
    const { viewer, simulationDate } = get();
    set({
      simulationHour: hour,
      simulationMinute: minute,
      isLive: false,
    });
    // Sync CesiumJS clock
    if (viewer && !viewer.isDestroyed()) {
      const d = new Date(simulationDate);
      d.setUTCHours(hour, minute, 0, 0);
      viewer.clock.currentTime = Cesium.JulianDate.fromDate(d);
      viewer.clock.shouldAnimate = false;
    }
  },

  setCalendarOpen: (open) => set({ calendarOpen: open }),

  resetToLive: () => {
    const { viewer } = get();
    const now = new Date();
    set({
      simulationDate: now,
      simulationHour: now.getUTCHours(),
      simulationMinute: now.getUTCMinutes(),
      isLive: true,
      calendarOpen: false,
    });
    // Resume CesiumJS clock
    if (viewer && !viewer.isDestroyed()) {
      viewer.clock.currentTime = Cesium.JulianDate.fromDate(now);
      viewer.clock.shouldAnimate = true;
    }
  },
}));

