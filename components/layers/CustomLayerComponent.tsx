"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useCustomLayers } from "@/hooks/useCustomLayers";
import { useWorldViewStore } from "@/stores/worldview-store";

interface Props {
  viewer: Cesium.Viewer;
}

export default function CustomLayerComponent({ viewer }: Props) {
  const { items } = useCustomLayers(true);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  useEffect(() => {
    const ds = new Cesium.CustomDataSource("customLayers");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._customData) {
          const d = picked.id._customData;
          const details: Record<string, string> = {
            Name: d.name,
            Description: d.description,
          };
          if (d.metadata) {
            for (const [key, value] of Object.entries(d.metadata)) {
              details[key] = String(value);
            }
          }
          setSelectedEntity({
            id: d.id,
            type: "news",
            name: d.name,
            details,
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
      const color = Cesium.Color.fromCssColorString(item.color || "#ffffff");

      const entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(item.longitude, item.latitude),
        point: {
          pixelSize: 6,
          color: color,
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
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            0,
            5e6
          ),
        },
      });

      (entity as unknown as Record<string, unknown>)._customData = item;
    }
  }, [items]);

  return null;
}
