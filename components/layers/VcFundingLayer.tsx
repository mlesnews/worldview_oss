"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useVcFunding } from "@/hooks/useVcFunding";
import { useWorldViewStore } from "@/stores/worldview-store";

interface Props {
  viewer: Cesium.Viewer;
}

const VC_COLOR = "#88ff44"; // Lime green

export default function VcFundingLayer({ viewer }: Props) {
  const { items } = useVcFunding(true);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  useEffect(() => {
    const ds = new Cesium.CustomDataSource("vcFunding");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._vcData) {
          const d = picked.id._vcData;
          setSelectedEntity({
            id: d.id,
            type: "news",
            name: d.company,
            details: {
              Company: d.company,
              Amount: `$${(d.amountUsd / 1e6).toFixed(1)}M`,
              Round: d.round,
              Investors: d.investors,
              Sector: d.sector,
              Date: d.date,
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

    const color = Cesium.Color.fromCssColorString(VC_COLOR);

    for (const item of items) {
      const entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(item.longitude, item.latitude),
        point: {
          pixelSize: 6 + Math.min(6, Math.log10(item.amountUsd / 1e6)),
          color: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
        },
        label: {
          text: `$${(item.amountUsd / 1e6).toFixed(0)}M`,
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

      (entity as unknown as Record<string, unknown>)._vcData = item;
    }
  }, [items]);

  return null;
}
