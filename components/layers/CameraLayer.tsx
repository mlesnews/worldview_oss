"use client";

import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import { useWorldViewStore } from "@/stores/worldview-store";
import type { Camera } from "@/types";

interface Props {
  viewer: Cesium.Viewer;
}

export default function CameraLayer({ viewer }: Props) {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const openCameraModal = useWorldViewStore((s) => s.openCameraModal);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const res = await fetch("/api/cameras");
        if (res.ok) {
          const data = await res.json();
          setCameras(data);
        }
      } catch (err) {
        console.error("Camera fetch error:", err);
      }
    };
    fetchCameras();
  }, []);

  useEffect(() => {
    const ds = new Cesium.CustomDataSource("cameras");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._cameraData) {
          const cam = picked.id._cameraData as Camera;
          flyTo(cam.longitude, cam.latitude, 2_000);
          openCameraModal(cam.id);
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
  }, [viewer, openCameraModal, flyTo]);

  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;
    ds.entities.removeAll();

    for (const cam of cameras) {
      const entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(cam.longitude, cam.latitude, 50),
        billboard: {
          image: createCameraIcon(),
          width: 20,
          height: 20,
          scaleByDistance: new Cesium.NearFarScalar(1e3, 1.5, 5e5, 0.3),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            0,
            5e5
          ),
        },
        label: {
          text: cam.name,
          font: "9px monospace",
          fillColor: Cesium.Color.fromCssColorString("#ff6600"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(14, -4),
          scaleByDistance: new Cesium.NearFarScalar(1e3, 1, 2e5, 0),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            0,
            2e5
          ),
        },
      });

      (entity as unknown as Record<string, unknown>)._cameraData = cam;
    }
  }, [cameras]);

  return null;
}

function createCameraIcon(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;
  const ctx = canvas.getContext("2d")!;

  // Camera icon shape
  ctx.fillStyle = "#ff6600";
  ctx.strokeStyle = "#ff6600";
  ctx.lineWidth = 1.5;

  // Camera body
  ctx.beginPath();
  ctx.roundRect(4, 8, 12, 10, 1);
  ctx.stroke();

  // Lens
  ctx.beginPath();
  ctx.arc(10, 13, 3, 0, Math.PI * 2);
  ctx.stroke();

  // Recording dot
  ctx.beginPath();
  ctx.arc(10, 13, 1, 0, Math.PI * 2);
  ctx.fill();

  // Flash
  ctx.beginPath();
  ctx.moveTo(16, 8);
  ctx.lineTo(20, 5);
  ctx.lineTo(20, 11);
  ctx.closePath();
  ctx.stroke();

  return canvas;
}
