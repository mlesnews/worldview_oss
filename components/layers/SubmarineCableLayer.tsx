"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useSubmarineCables } from "@/hooks/useSubmarineCables";
import { useWorldViewStore } from "@/stores/worldview-store";

interface Props {
  viewer: Cesium.Viewer;
}

const LAYER_COLOR = "#4488ff";

export default function SubmarineCableLayer({ viewer }: Props) {
  const { items } = useSubmarineCables(true);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  useEffect(() => {
    const ds = new Cesium.CustomDataSource("submarineCables");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._cableData) {
          const d = picked.id._cableData;
          setSelectedEntity({
            id: d.id,
            type: "news",
            name: d.name,
            details: {
              Name: d.name,
              "Ready for Service": d.readyForService,
              "Length (km)": d.lengthKm,
              Owners: d.owners,
              "Capacity (Tbps)": d.capacityTbps,
            },
            lon: d.landing1.lon,
            lat: d.landing1.lat,
          });
          flyTo(d.landing1.lon, d.landing1.lat, 500_000);
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

    const color = Cesium.Color.fromCssColorString(LAYER_COLOR);

    for (const item of items) {
      const lon1 = item.landing1.lon;
      const lat1 = item.landing1.lat;
      const lon2 = item.landing2.lon;
      const lat2 = item.landing2.lat;

      // Polyline between landing points
      const lineEntity = ds.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([lon1, lat1, lon2, lat2]),
          width: 2,
          material: color,
          clampToGround: false,
        },
      });
      (lineEntity as unknown as Record<string, unknown>)._cableData = item;

      // Landing point 1 with label
      const point1Entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon1, lat1),
        point: {
          pixelSize: 4,
          color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
        },
        label: {
          text: item.name,
          font: "9px monospace",
          fillColor: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(10, -4),
          scaleByDistance: new Cesium.NearFarScalar(1e4, 1, 5e6, 0),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5e6),
        },
      });
      (point1Entity as unknown as Record<string, unknown>)._cableData = item;

      // Landing point 2 (no label)
      const point2Entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon2, lat2),
        point: {
          pixelSize: 4,
          color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
        },
      });
      (point2Entity as unknown as Record<string, unknown>)._cableData = item;
    }
  }, [items]);

  return null;
}
