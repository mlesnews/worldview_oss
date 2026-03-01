"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as Cesium from "cesium";
import { useWorldViewStore } from "@/stores/worldview-store";
import { haversineKm } from "@/lib/utils";
import { buildCityClusters, createClusterIcon } from "@/lib/camera-clusters";
import type { Camera, CityCluster } from "@/types";

interface Props {
  viewer: Cesium.Viewer;
}

/* ── Tier thresholds (altitude in meters) ─────────────── */
const GLOBAL_ALT = 2_000_000; // > 2000km → cluster dots only
const REGIONAL_ALT = 200_000; // 200km–2000km → individual dots
// < 200km → LOCAL: individual dots + feed previews

const FEED_WIDTH = 160;
const FEED_HEIGHT = 120;
const FEED_REFRESH_MS = 60_000;
const FEED_VISIBLE_KM = 50;
const VIEWPORT_BUFFER_KM = 200; // buffer to prevent entity thrashing

export default function CameraLayer({ viewer }: Props) {
  const [cameras, setCamerasLocal] = useState<Camera[]>([]);
  const setCameras = useWorldViewStore((s) => s.setCameras);
  const openCameraModal = useWorldViewStore((s) => s.openCameraModal);
  const flyTo = useWorldViewStore((s) => s.flyTo);
  const viewport = useWorldViewStore((s) => s.viewport);

  // Three DataSources for the 3 tiers
  const clusterDsRef = useRef<Cesium.CustomDataSource | null>(null);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const feedDsRef = useRef<Cesium.CustomDataSource | null>(null);

  const feedCanvasCache = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const feedTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map()
  );

  // Track which city clusters are currently rendered as individual entities
  const activeCitiesRef = useRef<Set<string>>(new Set());

  // Computed clusters (memoized on camera data)
  const clusters = useMemo(
    () => (cameras.length > 0 ? buildCityClusters(cameras) : []),
    [cameras]
  );

  // Lookup: city name → cluster
  const clusterMap = useMemo(() => {
    const m = new Map<string, CityCluster>();
    for (const c of clusters) m.set(c.city, c);
    return m;
  }, [clusters]);

  /* ── Fetch cameras once on mount ─────────────────────── */
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const res = await fetch("/api/cameras");
        if (res.ok) {
          const data: Camera[] = await res.json();
          setCamerasLocal(data);
          setCameras(data);
        }
      } catch (err) {
        console.error("Camera fetch error:", err);
      }
    };
    fetchCameras();
  }, [setCameras]);

  /* ── Mount cluster DataSource + click handler ──────── */
  useEffect(() => {
    const ds = new Cesium.CustomDataSource("camera-clusters");
    viewer.dataSources.add(ds);
    clusterDsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._clusterData) {
          const cluster = picked.id._clusterData as CityCluster;
          // Fly to cluster center at 500km altitude → triggers REGIONAL tier
          flyTo(cluster.centerLon, cluster.centerLat, 500_000);
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );

    return () => {
      handler.destroy();
      if (clusterDsRef.current) {
        viewer.dataSources.remove(clusterDsRef.current, true);
      }
    };
  }, [viewer, flyTo]);

  /* ── Mount individual camera DataSource + click handler */
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
          openCameraModal(cam);
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

  /* ── Mount feed preview DataSource + click handler ──── */
  useEffect(() => {
    const ds = new Cesium.CustomDataSource("camera-feeds");
    viewer.dataSources.add(ds);
    feedDsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._cameraFeedData) {
          const cam = picked.id._cameraFeedData as Camera;
          flyTo(cam.longitude, cam.latitude, 2_000);
          openCameraModal(cam);
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );

    return () => {
      handler.destroy();
      for (const timer of feedTimers.current.values()) {
        clearInterval(timer);
      }
      feedTimers.current.clear();
      feedCanvasCache.current.clear();
      if (feedDsRef.current) {
        viewer.dataSources.remove(feedDsRef.current, true);
      }
    };
  }, [viewer, openCameraModal, flyTo]);

  /* ── Populate cluster entities (once when clusters change) */
  useEffect(() => {
    const ds = clusterDsRef.current;
    if (!ds || clusters.length === 0) return;
    ds.entities.removeAll();

    for (const cluster of clusters) {
      const icon = createClusterIcon(cluster.count);
      const entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          cluster.centerLon,
          cluster.centerLat,
          100
        ),
        billboard: {
          image: icon,
          width: 40,
          height: 40,
          scaleByDistance: new Cesium.NearFarScalar(5e5, 1.2, 2e7, 0.5),
          // Only visible at GLOBAL tier (> 2000km)
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            GLOBAL_ALT,
            5e7
          ),
        },
        label: {
          text: cluster.city,
          font: "bold 9px monospace",
          fillColor: Cesium.Color.fromCssColorString("#ff6600"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -26),
          scaleByDistance: new Cesium.NearFarScalar(5e5, 1, 2e7, 0.4),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            GLOBAL_ALT,
            5e7
          ),
        },
      });

      (entity as unknown as Record<string, unknown>)._clusterData = cluster;
    }
  }, [clusters]);

  /* ── Manage individual camera entities based on viewport ── */
  useEffect(() => {
    const ds = dsRef.current;
    if (!ds || clusters.length === 0) return;

    const { centerLat, centerLon, altitude } = viewport;

    // GLOBAL tier: remove all individual entities
    if (altitude > GLOBAL_ALT) {
      if (activeCitiesRef.current.size > 0) {
        ds.entities.removeAll();
        activeCitiesRef.current.clear();
      }
      return;
    }

    // REGIONAL or LOCAL tier: show individual dots for cities in viewport
    const viewRadiusKm = Math.min((altitude * 2.5) / 1000, 20000);

    // Find clusters within viewport radius
    const visibleCities = new Set<string>();
    for (const cluster of clusters) {
      const dist = haversineKm(
        centerLat,
        centerLon,
        cluster.centerLat,
        cluster.centerLon
      );
      if (dist < viewRadiusKm + VIEWPORT_BUFFER_KM) {
        visibleCities.add(cluster.city);
      }
    }

    // Remove entities for cities that left the viewport
    const citiesToRemove: string[] = [];
    for (const city of activeCitiesRef.current) {
      if (!visibleCities.has(city)) {
        citiesToRemove.push(city);
      }
    }

    if (citiesToRemove.length > 0) {
      const entitiesToRemove: Cesium.Entity[] = [];
      const entities = ds.entities.values;
      for (let i = 0; i < entities.length; i++) {
        const cam = (entities[i] as unknown as Record<string, unknown>)
          ._cameraData as Camera | undefined;
        if (cam && citiesToRemove.includes(cam.city)) {
          entitiesToRemove.push(entities[i]);
        }
      }
      for (const e of entitiesToRemove) {
        ds.entities.remove(e);
      }
      for (const city of citiesToRemove) {
        activeCitiesRef.current.delete(city);
      }
    }

    // Add entities for newly visible cities
    const cameraIcon = createCameraIcon();
    for (const city of visibleCities) {
      if (activeCitiesRef.current.has(city)) continue;

      const cluster = clusterMap.get(city);
      if (!cluster) continue;

      for (const cam of cluster.cameras) {
        const entity = ds.entities.add({
          position: Cesium.Cartesian3.fromDegrees(
            cam.longitude,
            cam.latitude,
            50
          ),
          point: {
            pixelSize: 5,
            color: Cesium.Color.fromCssColorString("#ff6600"),
            outlineColor: Cesium.Color.fromCssColorString("#331a00"),
            outlineWidth: 1,
            scaleByDistance: new Cesium.NearFarScalar(1e4, 1.2, 2e6, 0.4),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
              5e5,
              GLOBAL_ALT
            ),
          },
          billboard: {
            image: cameraIcon,
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

      activeCitiesRef.current.add(city);
    }
  }, [viewport, clusters, clusterMap]);

  /* ── Manage feed preview entities based on viewport ──── */
  const loadFeedImage = useCallback(
    (cam: Camera) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = createFeedCanvas(img, cam.name);
        feedCanvasCache.current.set(cam.id, canvas);

        const ds = feedDsRef.current;
        if (!ds) return;
        const entities = ds.entities.values;
        for (let i = 0; i < entities.length; i++) {
          const e = entities[i] as unknown as Record<string, unknown>;
          if ((e._cameraFeedData as Camera)?.id === cam.id) {
            const entity = entities[i];
            if (entity.billboard) {
              (
                entity.billboard.image as unknown as {
                  setValue: (v: HTMLCanvasElement) => void;
                }
              ).setValue(canvas);
            }
            break;
          }
        }
      };
      img.onerror = () => {
        // Keep placeholder on error
      };
      img.src = `/api/cameras/feed?id=${encodeURIComponent(cam.id)}&t=${Date.now()}`;
    },
    []
  );

  useEffect(() => {
    if (cameras.length === 0) return;

    const { centerLat, centerLon, altitude } = viewport;
    const ds = feedDsRef.current;
    if (!ds) return;

    // Only create feed entities at LOCAL tier (< 200km)
    if (altitude > REGIONAL_ALT) {
      // Clear all feed entities and timers when zoomed out
      if (ds.entities.values.length > 0) {
        ds.entities.removeAll();
        for (const timer of feedTimers.current.values()) {
          clearInterval(timer);
        }
        feedTimers.current.clear();
        feedCanvasCache.current.clear();
      }
      return;
    }

    // Find cameras within FEED_VISIBLE_KM
    const nearbyCams = cameras.filter(
      (cam) =>
        haversineKm(centerLat, centerLon, cam.latitude, cam.longitude) <
        FEED_VISIBLE_KM
    );
    const nearbyIds = new Set(nearbyCams.map((c) => c.id));

    // Remove feed entities for cameras no longer nearby
    const entitiesToRemove: Cesium.Entity[] = [];
    const entities = ds.entities.values;
    for (let i = 0; i < entities.length; i++) {
      const cam = (entities[i] as unknown as Record<string, unknown>)
        ._cameraFeedData as Camera | undefined;
      if (cam && !nearbyIds.has(cam.id)) {
        entitiesToRemove.push(entities[i]);
      }
    }
    for (const e of entitiesToRemove) {
      ds.entities.remove(e);
    }

    // Stop timers for cameras no longer in range
    for (const [id, timer] of feedTimers.current.entries()) {
      if (!nearbyIds.has(id)) {
        clearInterval(timer);
        feedTimers.current.delete(id);
      }
    }

    // Track existing feed entity IDs
    const existingFeedIds = new Set<string>();
    for (let i = 0; i < ds.entities.values.length; i++) {
      const cam = (ds.entities.values[i] as unknown as Record<string, unknown>)
        ._cameraFeedData as Camera | undefined;
      if (cam) existingFeedIds.add(cam.id);
    }

    // Create feed entities + start timers for newly visible cameras
    for (const cam of nearbyCams) {
      if (!existingFeedIds.has(cam.id)) {
        const canvas =
          feedCanvasCache.current.get(cam.id) ||
          createFeedPlaceholder(cam.name);
        feedCanvasCache.current.set(cam.id, canvas);

        const entity = ds.entities.add({
          position: Cesium.Cartesian3.fromDegrees(
            cam.longitude,
            cam.latitude,
            80
          ),
          billboard: {
            image: canvas,
            width: FEED_WIDTH,
            height: FEED_HEIGHT,
            pixelOffset: new Cesium.Cartesian2(0, -40),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            translucencyByDistance: new Cesium.NearFarScalar(
              5_000,
              1.0,
              50_000,
              0.0
            ),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
              0,
              50_000
            ),
            scaleByDistance: new Cesium.NearFarScalar(2_000, 1.0, 30_000, 0.3),
          },
        });

        (entity as unknown as Record<string, unknown>)._cameraFeedData = cam;
      }

      // Start image loading + refresh timer if not already running
      if (!feedTimers.current.has(cam.id)) {
        loadFeedImage(cam);
        const timer = setInterval(() => loadFeedImage(cam), FEED_REFRESH_MS);
        feedTimers.current.set(cam.id, timer);
      }
    }
  }, [cameras, viewport, loadFeedImage]);

  return null;
}

/* ── Canvas helpers ──────────────────────────────────────── */

function createCameraIcon(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;
  const ctx = canvas.getContext("2d")!;

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

/** "NO SIGNAL" placeholder with HUD framing */
function createFeedPlaceholder(name: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = FEED_WIDTH;
  canvas.height = FEED_HEIGHT;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgba(0, 10, 0, 0.85)";
  ctx.fillRect(0, 0, FEED_WIDTH, FEED_HEIGHT);

  ctx.strokeStyle = "#00ff41";
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, FEED_WIDTH - 2, FEED_HEIGHT - 2);

  drawCornerBrackets(ctx, FEED_WIDTH, FEED_HEIGHT);

  ctx.fillStyle = "#00ff41";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText("NO SIGNAL", FEED_WIDTH / 2, FEED_HEIGHT / 2 - 4);

  ctx.strokeStyle = "rgba(0, 255, 65, 0.08)";
  ctx.lineWidth = 0.5;
  for (let y = 0; y < FEED_HEIGHT; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(FEED_WIDTH, y);
    ctx.stroke();
  }

  drawNameBar(ctx, name);

  return canvas;
}

/** Composited feed image with HUD overlay */
function createFeedCanvas(
  img: HTMLImageElement,
  name: string
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = FEED_WIDTH;
  canvas.height = FEED_HEIGHT;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(img, 0, 0, FEED_WIDTH, FEED_HEIGHT);

  ctx.fillStyle = "rgba(0, 20, 0, 0.15)";
  ctx.fillRect(0, 0, FEED_WIDTH, FEED_HEIGHT);

  ctx.strokeStyle = "#00ff41";
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, FEED_WIDTH - 2, FEED_HEIGHT - 2);

  drawCornerBrackets(ctx, FEED_WIDTH, FEED_HEIGHT);
  drawNameBar(ctx, name);

  const now = new Date();
  const ts = now.toISOString().substring(11, 19) + "Z";

  ctx.fillStyle = "#ff0000";
  ctx.beginPath();
  ctx.arc(FEED_WIDTH - 10, 10, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#00ff41";
  ctx.font = "7px monospace";
  ctx.textAlign = "right";
  ctx.fillText(ts, FEED_WIDTH - 18, 13);

  return canvas;
}

function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  const len = 10;
  ctx.strokeStyle = "#00ff41";
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(3, 3 + len);
  ctx.lineTo(3, 3);
  ctx.lineTo(3 + len, 3);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w - 3 - len, 3);
  ctx.lineTo(w - 3, 3);
  ctx.lineTo(w - 3, 3 + len);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(3, h - 3 - len);
  ctx.lineTo(3, h - 3);
  ctx.lineTo(3 + len, h - 3);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w - 3 - len, h - 3);
  ctx.lineTo(w - 3, h - 3);
  ctx.lineTo(w - 3, h - 3 - len);
  ctx.stroke();
}

function drawNameBar(ctx: CanvasRenderingContext2D, name: string) {
  const barH = 14;
  const y = FEED_HEIGHT - barH;

  ctx.fillStyle = "rgba(255, 102, 0, 0.7)";
  ctx.fillRect(2, y, FEED_WIDTH - 4, barH - 2);

  ctx.fillStyle = "#000000";
  ctx.font = "bold 8px monospace";
  ctx.textAlign = "left";
  const truncated =
    name.length > 22 ? name.substring(0, 22) + "..." : name;
  ctx.fillText(truncated, 5, y + 10);
}
