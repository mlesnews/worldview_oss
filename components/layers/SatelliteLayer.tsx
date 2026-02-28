"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useSatellites } from "@/hooks/useSatellites";
import { useWorldViewStore } from "@/stores/worldview-store";

interface Props {
  viewer: Cesium.Viewer;
}

export default function SatelliteLayer({ viewer }: Props) {
  const { satellites } = useSatellites(true);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  useEffect(() => {
    const ds = new Cesium.CustomDataSource("satellites");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._satData) {
          const s = picked.id._satData;
          setSelectedEntity({
            id: String(s.id),
            type: "satellite",
            name: s.name,
            details: {
              "SAT ID": s.id,
              Alt: `${s.altitude.toFixed(1)} KM`,
              Vel: `${s.velocity.toFixed(2)} KM/S`,
              Lat: `${s.latitude.toFixed(4)}°`,
              Lon: `${s.longitude.toFixed(4)}°`,
            },
            lon: s.longitude,
            lat: s.latitude,
            alt: s.altitude * 2 * 1000,
          });
          flyTo(s.longitude, s.latitude, s.altitude * 2 * 1000);
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

    for (const sat of satellites) {
      const entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          sat.longitude,
          sat.latitude,
          sat.altitude * 1000 // km to meters
        ),
        point: {
          pixelSize: 5,
          color: Cesium.Color.fromCssColorString("#00ccff"),
          outlineColor: Cesium.Color.fromCssColorString("#004466"),
          outlineWidth: 1,
          scaleByDistance: new Cesium.NearFarScalar(1e5, 2, 1e8, 0.5),
        },
        label: {
          text: sat.name,
          font: "9px monospace",
          fillColor: Cesium.Color.fromCssColorString("#00ccff"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(10, -4),
          scaleByDistance: new Cesium.NearFarScalar(1e5, 1, 2e7, 0),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            0,
            2e7
          ),
        },
        path: {
          leadTime: 3600,
          trailTime: 3600,
          width: 1,
          material: new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString("#00ccff").withAlpha(0.2)
          ),
        },
      });

      (entity as unknown as Record<string, unknown>)._satData = sat;
    }
  }, [satellites]);

  return null;
}
