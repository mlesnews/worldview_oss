"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useWorldViewStore } from "@/stores/worldview-store";
import type { EntityInfo } from "@/types";

interface Props {
  viewer: Cesium.Viewer;
}

const BOX_W = 260;
const BOX_H = 140;

const TYPE_COLORS: Record<string, string> = {
  flight: "#00ff41",
  satellite: "#00ccff",
  earthquake: "#ffdd00",
  asteroid: "#ff6633",
  disaster: "#ff3300",
  news: "#ffcc00",
  military: "#ff2200",
  livestream: "#ff2222",
  camera: "#00ff41",
};

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

function createInfoBoxImage(entity: EntityInfo): string {
  const c = document.createElement("canvas");
  c.width = BOX_W;
  c.height = BOX_H;
  const ctx = c.getContext("2d")!;
  const accentColor = TYPE_COLORS[entity.type] || "#00ff41";

  // Background
  ctx.fillStyle = "rgba(0, 8, 0, 0.92)";
  ctx.fillRect(0, 0, BOX_W, BOX_H);

  // Border
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, BOX_W - 2, BOX_H - 2);

  // Corner brackets
  const bl = 10;
  ctx.lineWidth = 2;
  ctx.strokeStyle = accentColor;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(2, bl); ctx.lineTo(2, 2); ctx.lineTo(bl, 2);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(BOX_W - bl, 2); ctx.lineTo(BOX_W - 2, 2); ctx.lineTo(BOX_W - 2, bl);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(2, BOX_H - bl); ctx.lineTo(2, BOX_H - 2); ctx.lineTo(bl, BOX_H - 2);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(BOX_W - bl, BOX_H - 2); ctx.lineTo(BOX_W - 2, BOX_H - 2); ctx.lineTo(BOX_W - 2, BOX_H - bl);
  ctx.stroke();

  // Type label
  ctx.font = "bold 10px monospace";
  ctx.fillStyle = accentColor;
  ctx.fillText(entity.type.toUpperCase(), 8, 16);

  // Separator
  ctx.strokeStyle = `${accentColor}55`;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(8, 21);
  ctx.lineTo(BOX_W - 8, 21);
  ctx.stroke();

  // Name (title)
  ctx.font = "bold 10px monospace";
  ctx.fillStyle = "#00ff41";
  const name = truncate(entity.name, 38);
  ctx.fillText(name, 8, 35);

  // Detail rows
  ctx.font = "9px monospace";
  const entries = Object.entries(entity.details).filter(
    ([k]) => k !== "URL" && k !== "VideoID" && k !== "Link"
  );
  let y = 50;
  for (let i = 0; i < Math.min(entries.length, 6); i++) {
    const [key, value] = entries[i];
    const valStr = truncate(String(value), 30);
    ctx.fillStyle = "#00ff4166";
    ctx.fillText(key.toUpperCase(), 8, y);
    ctx.fillStyle = "#00ff41cc";
    const tw = ctx.measureText(valStr).width;
    ctx.fillText(valStr, BOX_W - tw - 8, y);
    y += 13;
  }

  // Coordinates at bottom
  ctx.font = "8px monospace";
  ctx.fillStyle = `${accentColor}88`;
  const coordStr = `${entity.lat.toFixed(4)}, ${entity.lon.toFixed(4)}`;
  ctx.fillText(coordStr, 8, BOX_H - 8);

  return c.toDataURL("image/png");
}

export default function InfoBoxOverlay({ viewer }: Props) {
  const selectedEntity = useWorldViewStore((s) => s.selectedEntity);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);

  // Mount datasource
  useEffect(() => {
    const ds = new Cesium.CustomDataSource("info-box-overlay");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    return () => {
      if (dsRef.current && !viewer.isDestroyed()) {
        viewer.dataSources.remove(dsRef.current, true);
      }
    };
  }, [viewer]);

  // Update info box billboard when selected entity changes
  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;
    ds.entities.removeAll();

    if (!selectedEntity) return;

    const imageUrl = createInfoBoxImage(selectedEntity);
    const alt = selectedEntity.alt ?? 0;

    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(
        selectedEntity.lon,
        selectedEntity.lat,
        alt
      ),
      billboard: {
        image: imageUrl,
        width: BOX_W,
        height: BOX_H,
        pixelOffset: new Cesium.Cartesian2(0, -80),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1_000, 1, 5_000_000, 0.5),
        translucencyByDistance: new Cesium.NearFarScalar(0, 1, 15_000_000, 0),
      },
    });
  }, [selectedEntity]);

  return null;
}
