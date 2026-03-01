"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useNews } from "@/hooks/useNews";
import { useWorldViewStore } from "@/stores/worldview-store";

interface Props {
  viewer: Cesium.Viewer;
}

const NEWS_COLOR = "#ffcc00"; // Amber

export default function NewsLayer({ viewer }: Props) {
  const { news } = useNews(true);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  useEffect(() => {
    const ds = new Cesium.CustomDataSource("news");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._newsData) {
          const n = picked.id._newsData;
          setSelectedEntity({
            id: n.id,
            type: "news",
            name: n.title,
            details: {
              Source: n.source,
              Date: new Date(n.date).toUTCString(),
              Tone: n.tone > 0 ? "Positive" : n.tone < -2 ? "Negative" : "Neutral",
              URL: n.url,
            },
            lon: n.longitude,
            lat: n.latitude,
            alt: 500_000,
          });
          flyTo(n.longitude, n.latitude, 500_000);
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

    const color = Cesium.Color.fromCssColorString(NEWS_COLOR);

    for (const article of news) {
      const entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          article.longitude,
          article.latitude
        ),
        point: {
          pixelSize: 5,
          color: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
        },
        label: {
          text: "NEWS",
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

      (entity as unknown as Record<string, unknown>)._newsData = article;
    }
  }, [news]);

  return null;
}
