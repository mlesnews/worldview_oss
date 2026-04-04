"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useLuminaConfidence } from "@/hooks/useLuminaConfidence";
import { useWorldViewStore } from "@/stores/worldview-store";

interface Props {
  viewer: Cesium.Viewer;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 80) return "#44ff44"; // Green
  if (confidence >= 60) return "#ffaa00"; // Amber
  if (confidence >= 40) return "#ff6600"; // Orange
  return "#ff2200"; // Red
}

export default function LuminaConfidenceLayer({ viewer }: Props) {
  const { items } = useLuminaConfidence(true);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  useEffect(() => {
    const ds = new Cesium.CustomDataSource("luminaConfidence");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._confData) {
          const d = picked.id._confData;
          setSelectedEntity({
            id: d.id,
            type: "news",
            name: d.region,
            details: {
              Region: d.region,
              Confidence: `${d.confidence}%`,
              Sentiment: d.sentiment,
              "Signal Count": d.signalCount,
              Timestamp: d.timestamp,
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
      const color = Cesium.Color.fromCssColorString(
        confidenceColor(item.confidence)
      );

      const entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(item.longitude, item.latitude),
        point: {
          pixelSize: 10,
          color: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
        },
        label: {
          text: `${item.confidence}%`,
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

      (entity as unknown as Record<string, unknown>)._confData = item;
    }
  }, [items]);

  return null;
}
