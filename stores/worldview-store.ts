import { create } from 'zustand';
import * as Cesium from 'cesium';
import type { ViewMode, LayerState, LayerKey, CursorPosition, EntityInfo } from '@/types';

interface WorldViewStore {
  layers: LayerState;
  toggleLayer: (layer: LayerKey) => void;

  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  cursorPosition: CursorPosition | null;
  setCursorPosition: (pos: CursorPosition | null) => void;

  selectedEntity: EntityInfo | null;
  setSelectedEntity: (entity: EntityInfo | null) => void;

  cameraModalOpen: boolean;
  activeCameraId: string | null;
  openCameraModal: (cameraId: string) => void;
  closeCameraModal: () => void;

  viewer: Cesium.Viewer | null;
  setViewer: (viewer: Cesium.Viewer | null) => void;
  flyTo: (lon: number, lat: number, alt?: number) => void;
}

export const useWorldViewStore = create<WorldViewStore>((set, get) => ({
  layers: {
    flights: true,
    satellites: false,
    earthquakes: false,
    asteroids: false,
    weather: false,
    cameras: false,
  },
  toggleLayer: (layer) =>
    set((state) => ({
      layers: { ...state.layers, [layer]: !state.layers[layer] },
    })),

  viewMode: 'nightvision',
  setViewMode: (mode) => set({ viewMode: mode }),

  cursorPosition: null,
  setCursorPosition: (pos) => set({ cursorPosition: pos }),

  selectedEntity: null,
  setSelectedEntity: (entity) => set({ selectedEntity: entity }),

  cameraModalOpen: false,
  activeCameraId: null,
  openCameraModal: (cameraId) =>
    set({ cameraModalOpen: true, activeCameraId: cameraId }),
  closeCameraModal: () =>
    set({ cameraModalOpen: false, activeCameraId: null }),

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
}));
