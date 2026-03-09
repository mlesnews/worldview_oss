"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useLiveStreams } from "@/hooks/useLiveStreams";
import { useWorldViewStore } from "@/stores/worldview-store";

interface Props {
  viewer: Cesium.Viewer;
}

const STREAM_COLOR = "#ff2222"; // Red

export default function LiveStreamLayer({ viewer }: Props) {
  const { streams } = useLiveStreams(true);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const openMediaModal = useWorldViewStore((s) => s.openMediaModal);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  useEffect(() => {
    const ds = new Cesium.CustomDataSource("livestreams");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._streamData) {
          const s = picked.id._streamData;
          setSelectedEntity({
            id: s.id,
            type: "livestream",
            name: s.title,
            details: {
              Channel: s.channelTitle,
              City: s.city,
              VideoID: s.videoId,
              ...(s.viewerCount ? { Viewers: s.viewerCount } : {}),
            },
            lon: s.longitude,
            lat: s.latitude,
            alt: 200_000,
          });
          if (useWorldViewStore.getState().clickToZoom) {
            flyTo(s.longitude, s.latitude, 200_000);
          }
          openMediaModal(s.videoId, s.title);
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
  }, [viewer, setSelectedEntity, flyTo, openMediaModal]);

  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;
    ds.entities.removeAll();

    const color = Cesium.Color.fromCssColorString(STREAM_COLOR);

    for (const stream of streams) {
      const entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          stream.longitude,
          stream.latitude,
          100
        ),
        billboard: {
          image: createPlayIcon(),
          width: 18,
          height: 18,
          scaleByDistance: new Cesium.NearFarScalar(1e3, 1.5, 5e5, 0.3),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            0,
            5e6
          ),
        },
        point: {
          pixelSize: 6,
          color: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
        },
        label: {
          text: `LIVE: ${stream.city}`,
          font: "9px monospace",
          fillColor: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(14, -4),
          scaleByDistance: new Cesium.NearFarScalar(1e4, 1, 3e6, 0),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            0,
            3e6
          ),
        },
      });

      (entity as unknown as Record<string, unknown>)._streamData = stream;
    }
  }, [streams]);

  return null;
}

function createPlayIcon(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 20;
  canvas.height = 20;
  const ctx = canvas.getContext("2d")!;

  // Red circle background
  ctx.beginPath();
  ctx.arc(10, 10, 9, 0, Math.PI * 2);
  ctx.fillStyle = "#ff2222";
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.stroke();

  // White play triangle
  ctx.beginPath();
  ctx.moveTo(8, 5);
  ctx.lineTo(8, 15);
  ctx.lineTo(16, 10);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();

  return canvas;
}
