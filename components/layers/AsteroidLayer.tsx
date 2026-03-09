"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useAsteroids } from "@/hooks/useAsteroids";
import { useWorldViewStore } from "@/stores/worldview-store";
import { getLayerIcon } from "@/lib/layer-icons";

interface Props {
  viewer: Cesium.Viewer;
}

export default function AsteroidLayer({ viewer }: Props) {
  const { asteroids } = useAsteroids(true);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  useEffect(() => {
    const ds = new Cesium.CustomDataSource("asteroids");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._neoData) {
          const a = picked.id._neoData;
          const angle = (asteroids.indexOf(a) / asteroids.length) * 360;
          const aLat = Math.sin((angle * Math.PI) / 180) * 60;
          const aLon = Math.cos((angle * Math.PI) / 180) * 180;
          const aAlt = Math.min(a.missDistance, 500000) * 1000;
          setSelectedEntity({
            id: a.id,
            type: "asteroid",
            name: a.name,
            details: {
              "Diameter": `${a.estimatedDiameterMin.toFixed(0)}-${a.estimatedDiameterMax.toFixed(0)} M`,
              "Velocity": `${Math.round(a.relativeVelocity)} KM/H`,
              "Miss Dist": `${Math.round(a.missDistance).toLocaleString()} KM`,
              "Hazardous": a.isPotentiallyHazardous ? "YES" : "NO",
              "Approach": a.closeApproachDate,
            },
            lon: aLon,
            lat: aLat,
            alt: aAlt,
          });
          if (useWorldViewStore.getState().clickToZoom) {
            flyTo(aLon, aLat, aAlt);
          }
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );

    return () => {
      handler.destroy();
      if (dsRef.current) {
        viewer.dataSources.remove(dsRef.current, true);
      }
    };
  }, [viewer, setSelectedEntity, flyTo, asteroids]);

  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;
    ds.entities.removeAll();

    // Asteroids don't have earth lat/lon - display as a list overlay
    // We'll place them in a ring around Earth at high altitude for visual effect
    const count = asteroids.length;
    for (let i = 0; i < count; i++) {
      const asteroid = asteroids[i];
      const angle = (i / count) * 360;
      const lat = Math.sin((angle * Math.PI) / 180) * 60;
      const lon = Math.cos((angle * Math.PI) / 180) * 180;
      const alt = Math.min(asteroid.missDistance, 500000) * 1000; // cap visual altitude

      const colorHex = asteroid.isPotentiallyHazardous ? "#ff3333" : "#ffaa00";
      const color = Cesium.Color.fromCssColorString(colorHex);
      const iconSize = Math.max(18, Math.min(32, asteroid.estimatedDiameterMax / 30));

      const entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
        billboard: {
          image: getLayerIcon("asteroid", colorHex),
          width: iconSize,
          height: iconSize,
          color: Cesium.Color.WHITE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(1e5, 2, 5e8, 0.5),
        },
        label: {
          text: asteroid.name.replace(/[()]/g, ""),
          font: "11px monospace",
          fillColor: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(16, -4),
          scaleByDistance: new Cesium.NearFarScalar(1e5, 1, 5e7, 0),
        },
      });

      (entity as unknown as Record<string, unknown>)._neoData = asteroid;
    }
  }, [asteroids]);

  return null;
}
