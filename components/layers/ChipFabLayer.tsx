"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useChipFabs } from "@/hooks/useChipFabs";
import { useWorldViewStore } from "@/stores/worldview-store";

interface Props {
  viewer: Cesium.Viewer;
}

const LAYER_COLOR = "#ff4488";

const STATUS_COLORS: Record<string, string> = {
  operational: "#44ff44",
  construction: "#ffaa00",
  planned: "#888888",
};

export default function ChipFabLayer({ viewer }: Props) {
  const { items } = useChipFabs(true);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  useEffect(() => {
    const ds = new Cesium.CustomDataSource("chipFabs");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._fabData) {
          const d = picked.id._fabData;
          setSelectedEntity({
            id: d.id,
            type: "news",
            name: d.name,
            details: {
              Name: d.name,
              Company: d.company,
              "Process Node": d.processNode,
              Status: d.status,
              Investment: d.investment,
            },
            lon: d.longitude,
            lat: d.latitude,
          });
          flyTo(d.longitude, d.latitude, 500_000);
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

    for (const item of items) {
      const statusColor = STATUS_COLORS[item.status] ?? LAYER_COLOR;
      const color = Cesium.Color.fromCssColorString(statusColor);
      const labelColor = Cesium.Color.fromCssColorString(LAYER_COLOR);

      const entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(item.longitude, item.latitude),
        point: {
          pixelSize: 9,
          color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
        },
        label: {
          text: item.company,
          font: "9px monospace",
          fillColor: labelColor,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(10, -4),
          scaleByDistance: new Cesium.NearFarScalar(1e4, 1, 5e6, 0),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5e6),
        },
      });

      (entity as unknown as Record<string, unknown>)._fabData = item;
    }
  }, [items]);

  return null;
}
