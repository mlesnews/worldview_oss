"use client";

import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";

interface Props {
  viewer: Cesium.Viewer;
}

export default function WeatherLayer({ viewer }: Props) {
  const layerRef = useRef<Cesium.ImageryLayer | null>(null);
  const [tileUrl, setTileUrl] = useState<string | null>(null);

  // Fetch current radar tile URL
  useEffect(() => {
    const fetchTiles = async () => {
      try {
        const res = await fetch("/api/weather");
        if (res.ok) {
          const data = await res.json();
          setTileUrl(data.tileUrl);
        }
      } catch (err) {
        console.error("Weather tile fetch error:", err);
      }
    };

    fetchTiles();
    const interval = setInterval(fetchTiles, 120_000);
    return () => clearInterval(interval);
  }, []);

  // Add/update imagery layer
  useEffect(() => {
    if (!tileUrl) return;

    // Remove old layer
    if (layerRef.current) {
      viewer.imageryLayers.remove(layerRef.current, true);
      layerRef.current = null;
    }

    const provider = new Cesium.UrlTemplateImageryProvider({
      url: tileUrl,
      minimumLevel: 1,
      maximumLevel: 12,
      credit: new Cesium.Credit("NEXRAD / RainViewer"),
    });

    const layer = viewer.imageryLayers.addImageryProvider(provider);
    layer.alpha = 0.5;
    layer.brightness = 1.3;
    layer.contrast = 1.2;
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        viewer.imageryLayers.remove(layerRef.current, true);
        layerRef.current = null;
      }
    };
  }, [tileUrl, viewer]);

  return null;
}
