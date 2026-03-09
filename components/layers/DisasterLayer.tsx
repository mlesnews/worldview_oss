"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useDisasters } from "@/hooks/useDisasters";
import { useWorldViewStore } from "@/stores/worldview-store";
import { getLayerIcon } from "@/lib/layer-icons";
import type { DisasterCategory } from "@/types";
import type { LayerIconType } from "@/lib/layer-icons";

interface Props {
  viewer: Cesium.Viewer;
}

const CATEGORY_COLORS: Record<DisasterCategory, string> = {
  wildfires: "#ff3300",
  volcanoes: "#ff0000",
  severeStorms: "#cc44ff",
  floods: "#3388ff",
  earthquakes: "#ffdd00",
  ice: "#88ddff",
};

const CATEGORY_LABELS: Record<DisasterCategory, string> = {
  wildfires: "FIRE",
  volcanoes: "VOLC",
  severeStorms: "STRM",
  floods: "FLOD",
  earthquakes: "QUAKE",
  ice: "ICE",
};

function categoryToRadius(category: DisasterCategory, magnitude?: number): number {
  if (category === "earthquakes" && magnitude) {
    return Math.max(5000, Math.pow(2, magnitude) * 1000);
  }
  if (category === "wildfires") return 15000;
  if (category === "volcanoes") return 20000;
  if (category === "severeStorms") return 30000;
  if (category === "floods") return 25000;
  return 10000;
}

export default function DisasterLayer({ viewer }: Props) {
  const { disasters } = useDisasters(true);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);
  const disasterFilters = useWorldViewStore((s) => s.disasterFilters);

  useEffect(() => {
    const ds = new Cesium.CustomDataSource("disasters");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._disasterData) {
          const d = picked.id._disasterData;
          setSelectedEntity({
            id: d.id,
            type: "disaster",
            name: d.title,
            details: {
              Category: d.category.toUpperCase(),
              Source: d.source.toUpperCase(),
              Date: new Date(d.date).toUTCString(),
              ...(d.magnitude ? { Magnitude: d.magnitude.toFixed(1) } : {}),
              ...(d.description ? { Info: d.description } : {}),
            },
            lon: d.longitude,
            lat: d.latitude,
            alt: 200_000,
          });
          if (useWorldViewStore.getState().clickToZoom) {
            flyTo(d.longitude, d.latitude, 200_000);
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
  }, [viewer, setSelectedEntity, flyTo]);

  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;
    ds.entities.removeAll();

    const filtered = disasters.filter((d) => disasterFilters[d.category]);

    const CATEGORY_ICON_MAP: Record<DisasterCategory, LayerIconType> = {
      wildfires: "wildfire",
      volcanoes: "volcano",
      severeStorms: "storm",
      floods: "flood",
      earthquakes: "earthquake",
      ice: "ice",
    };

    for (const disaster of filtered) {
      const colorHex = CATEGORY_COLORS[disaster.category];
      const color = Cesium.Color.fromCssColorString(colorHex);
      const radius = categoryToRadius(disaster.category, disaster.magnitude);
      const label = CATEGORY_LABELS[disaster.category];
      const iconType = CATEGORY_ICON_MAP[disaster.category];
      const iconSize = disaster.magnitude
        ? Math.max(20, Math.min(32, disaster.magnitude * 4))
        : 24;

      const entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          disaster.longitude,
          disaster.latitude
        ),
        ellipse: {
          semiMajorAxis: radius,
          semiMinorAxis: radius,
          material: new Cesium.ColorMaterialProperty(color.withAlpha(0.2)),
          outline: true,
          outlineColor: new Cesium.ConstantProperty(color.withAlpha(0.5)),
          outlineWidth: 1,
          height: 0,
        },
        billboard: {
          image: getLayerIcon(iconType, colorHex),
          width: iconSize,
          height: iconSize,
          color: Cesium.Color.WHITE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(1e4, 1.4, 1e7, 0.5),
        },
        label: {
          text: disaster.magnitude
            ? `M${disaster.magnitude.toFixed(1)}`
            : label,
          font: "12px monospace",
          fillColor: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(16, -4),
          scaleByDistance: new Cesium.NearFarScalar(1e4, 1, 1e7, 0),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            0,
            1e7
          ),
        },
      });

      (entity as unknown as Record<string, unknown>)._disasterData = disaster;
    }
  }, [disasters, disasterFilters]);

  return null;
}
