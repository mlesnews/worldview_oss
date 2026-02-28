"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useEarthquakes } from "@/hooks/useEarthquakes";
import { useWorldViewStore } from "@/stores/worldview-store";

interface Props {
  viewer: Cesium.Viewer;
}

function magnitudeToColor(mag: number): Cesium.Color {
  if (mag >= 7) return Cesium.Color.fromCssColorString("#ff0000");
  if (mag >= 5) return Cesium.Color.fromCssColorString("#ff6600");
  if (mag >= 4) return Cesium.Color.fromCssColorString("#ffaa00");
  if (mag >= 3) return Cesium.Color.fromCssColorString("#ffdd00");
  return Cesium.Color.fromCssColorString("#88ff00");
}

function magnitudeToRadius(mag: number): number {
  return Math.max(5000, Math.pow(2, mag) * 1000);
}

export default function EarthquakeLayer({ viewer }: Props) {
  const { earthquakes } = useEarthquakes(true);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  useEffect(() => {
    const ds = new Cesium.CustomDataSource("earthquakes");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._quakeData) {
          const q = picked.id._quakeData;
          setSelectedEntity({
            id: q.id,
            type: "earthquake",
            name: `M${q.magnitude} - ${q.place}`,
            details: {
              Mag: q.magnitude.toFixed(1),
              Depth: `${q.depth.toFixed(1)} KM`,
              Time: new Date(q.time).toUTCString(),
              Tsunami: q.tsunami ? "YES" : "NO",
              Felt: q.felt ? `${q.felt} reports` : "N/A",
            },
            lon: q.longitude,
            lat: q.latitude,
            alt: 200_000,
          });
          flyTo(q.longitude, q.latitude, 200_000);
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
  }, [viewer, setSelectedEntity, flyTo]);

  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;
    ds.entities.removeAll();

    for (const quake of earthquakes) {
      const color = magnitudeToColor(quake.magnitude);
      const radius = magnitudeToRadius(quake.magnitude);

      // Pulsing circle
      const entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          quake.longitude,
          quake.latitude
        ),
        ellipse: {
          semiMajorAxis: radius,
          semiMinorAxis: radius,
          material: new Cesium.ColorMaterialProperty(color.withAlpha(0.25)),
          outline: true,
          outlineColor: new Cesium.ConstantProperty(color.withAlpha(0.6)),
          outlineWidth: 1,
          height: 0,
        },
        point: {
          pixelSize: Math.max(4, quake.magnitude * 2),
          color: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
        },
        label: {
          text: `M${quake.magnitude.toFixed(1)}`,
          font: "10px monospace",
          fillColor: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(12, -4),
          scaleByDistance: new Cesium.NearFarScalar(1e4, 1, 1e7, 0),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            0,
            1e7
          ),
        },
      });

      (entity as unknown as Record<string, unknown>)._quakeData = quake;
    }
  }, [earthquakes]);

  return null;
}
