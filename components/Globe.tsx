"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  initCesium,
  createDarkImageryProvider,
  viewerOptions,
} from "@/lib/cesium-config";
import { useWorldViewStore } from "@/stores/worldview-store";
import FlightLayer from "@/components/layers/FlightLayer";
import SatelliteLayer from "@/components/layers/SatelliteLayer";
import EarthquakeLayer from "@/components/layers/EarthquakeLayer";
import AsteroidLayer from "@/components/layers/AsteroidLayer";
import WeatherLayer from "@/components/layers/WeatherLayer";
import CameraLayer from "@/components/layers/CameraLayer";

export default function Globe() {
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const setCursorPosition = useWorldViewStore((s) => s.setCursorPosition);
  const setViewer = useWorldViewStore((s) => s.setViewer);
  const layers = useWorldViewStore((s) => s.layers);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    initCesium();

    const viewer = new Cesium.Viewer(containerRef.current, {
      ...viewerOptions,
      baseLayer: false,
    });

    // Add dark map tiles
    viewer.imageryLayers.addImageryProvider(createDarkImageryProvider());

    // Dark space background
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#000a00");
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#001200");
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.fog.enabled = false;

    // Green glow on the globe edges for that NV feel
    if (viewer.scene.globe) {
      viewer.scene.globe.enableLighting = false;
    }

    // Set initial camera to show the earth from a nice angle
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-97.7431, 30.2672, 15000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
    });

    viewerRef.current = viewer;
    setViewer(viewer);
    setViewerReady(true);

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
        setViewer(null);
        setViewerReady(false);
      }
    };
  }, [setViewer]);

  // Track mouse position on globe
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!viewerRef.current) return;
      const viewer = viewerRef.current;
      const cartesian = viewer.camera.pickEllipsoid(
        new Cesium.Cartesian2(e.nativeEvent.offsetX, e.nativeEvent.offsetY),
        viewer.scene.globe.ellipsoid
      );
      if (cartesian) {
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        setCursorPosition({
          lat: Cesium.Math.toDegrees(carto.latitude),
          lon: Cesium.Math.toDegrees(carto.longitude),
          alt: viewer.camera.positionCartographic.height,
        });
      }
    },
    [setCursorPosition]
  );

  return (
    <div className="w-full h-full relative">
      <div
        ref={containerRef}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
      />
      {viewerReady && viewerRef.current && (
        <>
          {layers.flights && <FlightLayer viewer={viewerRef.current} />}
          {layers.satellites && <SatelliteLayer viewer={viewerRef.current} />}
          {layers.earthquakes && <EarthquakeLayer viewer={viewerRef.current} />}
          {layers.asteroids && <AsteroidLayer viewer={viewerRef.current} />}
          {layers.weather && <WeatherLayer viewer={viewerRef.current} />}
          {layers.cameras && <CameraLayer viewer={viewerRef.current} />}
        </>
      )}
    </div>
  );
}
