"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useWhaleAlerts } from "@/hooks/useWhaleAlerts";
import { useWorldViewStore } from "@/stores/worldview-store";

interface Props {
  viewer: Cesium.Viewer;
}

const LAYER_COLOR = "#00ccff";

export default function WhaleAlertLayer({ viewer }: Props) {
  const { items } = useWhaleAlerts(true);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  useEffect(() => {
    const ds = new Cesium.CustomDataSource("whaleAlerts");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._whaleData) {
          const d = picked.id._whaleData;
          setSelectedEntity({
            id: d.id,
            type: "news",
            name: `${d.symbol} Whale Transfer`,
            details: {
              Symbol: d.symbol,
              Amount: `$${(d.amountUsd / 1e6).toFixed(1)}M`,
              Blockchain: d.blockchain,
              From: d.from?.substring(0, 12) ?? "unknown",
              To: d.to?.substring(0, 12) ?? "unknown",
              Hash: d.hash,
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

    const color = Cesium.Color.fromCssColorString(LAYER_COLOR);

    for (const item of items) {
      const pixelSize = Math.min(12, 6 + Math.log10(item.amountUsd / 1e6));

      const entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(item.longitude, item.latitude),
        point: {
          pixelSize,
          color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
        },
        label: {
          text: `${item.symbol} $${(item.amountUsd / 1e6).toFixed(1)}M`,
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

      (entity as unknown as Record<string, unknown>)._whaleData = item;
    }
  }, [items]);

  return null;
}
