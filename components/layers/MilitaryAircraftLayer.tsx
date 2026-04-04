"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useMilitaryAircraft } from "@/hooks/useMilitaryAircraft";
import { useWorldViewStore } from "@/stores/worldview-store";

interface Props {
  viewer: Cesium.Viewer;
}

const CATEGORY_COLORS: Record<string, string> = {
  tanker: "#4488ff",
  isr: "#ff4488",
  transport: "#44ff88",
  fighter: "#ff4444",
  helo: "#ffaa00",
  special: "#cc44ff",
  other: "#888888",
};

export default function MilitaryAircraftLayer({ viewer }: Props) {
  const { aircraft } = useMilitaryAircraft(true);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  useEffect(() => {
    const ds = new Cesium.CustomDataSource("militaryAircraft");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._milAirData) {
          const d = picked.id._milAirData;
          setSelectedEntity({
            id: d.id,
            type: "military",
            name: d.callsign,
            details: {
              Callsign: d.callsign,
              "Aircraft Type": d.aircraftType,
              Category: d.category,
              Altitude: d.altitude,
              Heading: d.heading,
              Squawk: d.squawk,
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

    for (const item of aircraft) {
      const hex = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.other;
      const color = Cesium.Color.fromCssColorString(hex);

      const entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(item.longitude, item.latitude),
        point: {
          pixelSize: 8,
          color: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
        },
        label: {
          text: item.callsign,
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

      (entity as unknown as Record<string, unknown>)._milAirData = item;
    }
  }, [aircraft]);

  return null;
}
