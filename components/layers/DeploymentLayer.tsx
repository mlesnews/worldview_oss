"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Cesium from "cesium";
import { useWorldViewStore } from "@/stores/worldview-store";

interface Props {
  viewer: Cesium.Viewer;
}

/** Haversine distance in km between two lat/lon points */
function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface DragState {
  active: boolean;
  type: "move" | "resize" | null;
}

const GREEN = Cesium.Color.fromCssColorString("#00ff41");
const GREEN_BRIGHT = Cesium.Color.fromCssColorString("#40ff80");

/**
 * DeploymentLayer — handles pin-drop targeting, drag-to-move, and drag-to-resize.
 *
 * In deploymentMode: click globe to place pin (initial placement).
 * In repositionMode: drag pin to move, drag circle edge to resize.
 * Both modes render a center pin + semi-transparent radius circle.
 */
export default function DeploymentLayer({ viewer }: Props) {
  const deploymentMode = useWorldViewStore((s) => s.missionControl.deploymentMode);
  const deploymentArea = useWorldViewStore((s) => s.missionControl.deploymentArea);
  const repositionMode = useWorldViewStore((s) => s.missionControl.repositionMode);
  const missionPhase = useWorldViewStore((s) => s.missionControl.missionPhase);
  const setDeploymentArea = useWorldViewStore((s) => s.setDeploymentArea);
  const openMissionModal = useWorldViewStore((s) => s.openMissionModal);

  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const handlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null);
  const pinRef = useRef<Cesium.Entity | null>(null);
  const circleRef = useRef<Cesium.Entity | null>(null);
  const dragRef = useRef<DragState>({ active: false, type: null });
  // Pending area tracks visual state during reposition (not committed until CONFIRM)
  const pendingAreaRef = useRef<{ lat: number; lon: number; radiusKm: number } | null>(null);

  const isConfiguring = missionPhase === "configuring";

  // ── Mount datasource ────────────────────────────────────────────

  useEffect(() => {
    if (viewer.isDestroyed()) return;
    const ds = new Cesium.CustomDataSource("deployment");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    return () => {
      if (dsRef.current && !viewer.isDestroyed()) {
        viewer.dataSources.remove(dsRef.current, true);
        dsRef.current = null;
      }
    };
  }, [viewer]);

  // ── Camera control helpers ──────────────────────────────────────

  const disableCameraControls = useCallback(() => {
    if (viewer.isDestroyed()) return;
    const c = viewer.scene.screenSpaceCameraController;
    c.enableRotate = false;
    c.enableTranslate = false;
    c.enableZoom = false;
    c.enableTilt = false;
    c.enableLook = false;
  }, [viewer]);

  const enableCameraControls = useCallback(() => {
    if (viewer.isDestroyed()) return;
    const c = viewer.scene.screenSpaceCameraController;
    c.enableRotate = true;
    c.enableTranslate = true;
    c.enableZoom = true;
    c.enableTilt = true;
    c.enableLook = true;
  }, [viewer]);

  // ── Entity update helpers (no React re-render) ──────────────────

  const updatePinPosition = useCallback((lat: number, lon: number, radiusKm: number) => {
    const pin = pinRef.current;
    if (!pin) return;
    const pos = Cesium.Cartesian3.fromDegrees(lon, lat);
    (pin.position as Cesium.ConstantPositionProperty).setValue(pos);
    if (pin.label) {
      (pin.label.text as Cesium.ConstantProperty).setValue(
        `DEPLOY ZONE\n${lat.toFixed(4)}°, ${lon.toFixed(4)}°\n${radiusKm}km`
      );
    }
  }, []);

  const updateCirclePosition = useCallback((lat: number, lon: number) => {
    const circle = circleRef.current;
    if (!circle) return;
    (circle.position as Cesium.ConstantPositionProperty).setValue(
      Cesium.Cartesian3.fromDegrees(lon, lat)
    );
  }, []);

  const updateCircleRadius = useCallback((radiusKm: number) => {
    const circle = circleRef.current;
    if (!circle?.ellipse) return;
    const meters = radiusKm * 1000;
    (circle.ellipse.semiMajorAxis as Cesium.ConstantProperty).setValue(meters);
    (circle.ellipse.semiMinorAxis as Cesium.ConstantProperty).setValue(meters);
  }, []);

  // ── Initial placement click handler ─────────────────────────────

  const handleGlobeClick = useCallback(
    (click: { position: Cesium.Cartesian2 }) => {
      if (!deploymentMode || repositionMode) return;

      const cartesian = viewer.camera.pickEllipsoid(
        click.position,
        viewer.scene.globe.ellipsoid
      );
      if (!cartesian) return;

      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lon = Cesium.Math.toDegrees(carto.longitude);

      const currentRadius =
        useWorldViewStore.getState().missionControl.deploymentArea?.radiusKm || 200;
      setDeploymentArea({ lat, lon, radiusKm: currentRadius });
      openMissionModal();
    },
    [deploymentMode, repositionMode, viewer, setDeploymentArea, openMissionModal]
  );

  // ── Drag handlers ───────────────────────────────────────────────

  const handleLeftDown = useCallback(
    (event: { position: Cesium.Cartesian2 }) => {
      if (!repositionMode || !isConfiguring) return;
      const area = pendingAreaRef.current || deploymentArea;
      if (!area) return;

      // Check if we picked the center pin
      const picked = viewer.scene.pick(event.position);
      if (
        Cesium.defined(picked) &&
        picked.id &&
        (picked.id as Cesium.Entity & { _deploymentRole?: string })._deploymentRole === "center-pin"
      ) {
        dragRef.current = { active: true, type: "move" };
        disableCameraControls();
        viewer.scene.canvas.style.cursor = "grabbing";
        return;
      }

      // Check if we're near the circle edge
      const cartesian = viewer.camera.pickEllipsoid(
        event.position,
        viewer.scene.globe.ellipsoid
      );
      if (!cartesian) return;

      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const clickLat = Cesium.Math.toDegrees(carto.latitude);
      const clickLon = Cesium.Math.toDegrees(carto.longitude);
      const distFromCenter = haversineKm(area.lat, area.lon, clickLat, clickLon);
      const tolerance = Math.max(area.radiusKm * 0.15, 20);

      if (Math.abs(distFromCenter - area.radiusKm) <= tolerance) {
        dragRef.current = { active: true, type: "resize" };
        disableCameraControls();
        viewer.scene.canvas.style.cursor = "ew-resize";
      }
    },
    [repositionMode, isConfiguring, deploymentArea, viewer, disableCameraControls]
  );

  const handleMouseMove = useCallback(
    (event: { endPosition: Cesium.Cartesian2 }) => {
      if (viewer.isDestroyed()) return;
      const drag = dragRef.current;
      const area = pendingAreaRef.current || deploymentArea;

      if (!drag.active || !area) {
        // Hover feedback
        if (!repositionMode || !isConfiguring || !area) return;

        const picked = viewer.scene.pick(event.endPosition);
        if (
          Cesium.defined(picked) &&
          picked.id &&
          (picked.id as Cesium.Entity & { _deploymentRole?: string })._deploymentRole === "center-pin"
        ) {
          viewer.scene.canvas.style.cursor = "grab";
          if (pinRef.current?.point) {
            (pinRef.current.point.color as Cesium.ConstantProperty).setValue(GREEN_BRIGHT);
            (pinRef.current.point.pixelSize as Cesium.ConstantProperty).setValue(14);
          }
          return;
        }

        // Check circle edge hover
        const cartesian = viewer.camera.pickEllipsoid(
          event.endPosition,
          viewer.scene.globe.ellipsoid
        );
        if (cartesian) {
          const carto = Cesium.Cartographic.fromCartesian(cartesian);
          const dist = haversineKm(
            area.lat, area.lon,
            Cesium.Math.toDegrees(carto.latitude),
            Cesium.Math.toDegrees(carto.longitude)
          );
          const tolerance = Math.max(area.radiusKm * 0.15, 20);
          if (Math.abs(dist - area.radiusKm) <= tolerance) {
            viewer.scene.canvas.style.cursor = "ew-resize";
            if (circleRef.current?.ellipse) {
              (circleRef.current.ellipse.outlineColor as Cesium.ConstantProperty).setValue(
                GREEN.withAlpha(0.9)
              );
            }
            return;
          }
        }

        // Reset hover
        viewer.scene.canvas.style.cursor = "default";
        if (pinRef.current?.point) {
          (pinRef.current.point.color as Cesium.ConstantProperty).setValue(GREEN);
          (pinRef.current.point.pixelSize as Cesium.ConstantProperty).setValue(10);
        }
        if (circleRef.current?.ellipse) {
          (circleRef.current.ellipse.outlineColor as Cesium.ConstantProperty).setValue(
            GREEN.withAlpha(0.5)
          );
        }
        return;
      }

      // Active drag
      const cartesian = viewer.camera.pickEllipsoid(
        event.endPosition,
        viewer.scene.globe.ellipsoid
      );
      if (!cartesian) return; // Off globe — freeze at last position

      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lon = Cesium.Math.toDegrees(carto.longitude);

      if (drag.type === "move") {
        const r = area.radiusKm;
        pendingAreaRef.current = { lat, lon, radiusKm: r };
        updatePinPosition(lat, lon, r);
        updateCirclePosition(lat, lon);
      } else if (drag.type === "resize") {
        const newRadius = Math.max(10, Math.min(5000, Math.round(
          haversineKm(area.lat, area.lon, lat, lon)
        )));
        pendingAreaRef.current = { ...area, radiusKm: newRadius };
        updateCircleRadius(newRadius);
        updatePinPosition(area.lat, area.lon, newRadius);
      }
    },
    [
      repositionMode, isConfiguring, deploymentArea, viewer,
      updatePinPosition, updateCirclePosition, updateCircleRadius,
    ]
  );

  const handleLeftUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag.active) return;

    dragRef.current = { active: false, type: null };
    enableCameraControls();

    if (viewer.isDestroyed()) return;
    viewer.scene.canvas.style.cursor = repositionMode ? "default" : "";

    // pendingAreaRef already has the latest position — it will be
    // committed when the user clicks CONFIRM POSITION
  }, [enableCameraControls, viewer, repositionMode]);

  // ── Scroll wheel for radius ─────────────────────────────────────

  const handleWheel = useCallback(
    (delta: number) => {
      if (!repositionMode || !isConfiguring) return;
      const area = pendingAreaRef.current || deploymentArea;
      if (!area) return;

      const factor = delta > 0 ? 0.9 : 1.1;
      const newRadius = Math.max(10, Math.min(5000, Math.round(area.radiusKm * factor)));
      pendingAreaRef.current = { ...area, radiusKm: newRadius };
      updateCircleRadius(newRadius);
      updatePinPosition(area.lat, area.lon, newRadius);
    },
    [repositionMode, isConfiguring, deploymentArea, updateCircleRadius, updatePinPosition]
  );

  // ── Register event handlers ─────────────────────────────────────

  useEffect(() => {
    if (viewer.isDestroyed()) return;

    // Clean up previous handler
    if (handlerRef.current) {
      handlerRef.current.destroy();
      handlerRef.current = null;
    }

    const needsHandler = deploymentMode || (repositionMode && isConfiguring);
    if (!needsHandler) {
      if (!viewer.isDestroyed()) {
        viewer.scene.canvas.style.cursor = "";
      }
      return;
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    // Click to place (initial deployment mode only)
    if (deploymentMode && !repositionMode) {
      handler.setInputAction(handleGlobeClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      viewer.scene.canvas.style.cursor = "crosshair";
    }

    // Drag handlers (reposition mode)
    if (repositionMode && isConfiguring) {
      handler.setInputAction(handleLeftDown, Cesium.ScreenSpaceEventType.LEFT_DOWN);
      handler.setInputAction(handleMouseMove, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      handler.setInputAction(handleLeftUp, Cesium.ScreenSpaceEventType.LEFT_UP);
      handler.setInputAction(handleWheel, Cesium.ScreenSpaceEventType.WHEEL);
    }

    return () => {
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
      if (!viewer.isDestroyed()) {
        viewer.scene.canvas.style.cursor = "";
        enableCameraControls();
      }
    };
  }, [
    deploymentMode, repositionMode, isConfiguring, viewer,
    handleGlobeClick, handleLeftDown, handleMouseMove, handleLeftUp,
    handleWheel, enableCameraControls,
  ]);

  // ── Initialize pending area when entering reposition mode ───────

  useEffect(() => {
    if (repositionMode && deploymentArea) {
      pendingAreaRef.current = { ...deploymentArea };
    }
  }, [repositionMode, deploymentArea]);

  // ── Commit pending area when exiting reposition mode ────────────

  const prevRepositionRef = useRef(false);
  useEffect(() => {
    // Detect transition from repositionMode=true → false
    if (prevRepositionRef.current && !repositionMode) {
      if (pendingAreaRef.current) {
        setDeploymentArea(pendingAreaRef.current);
        pendingAreaRef.current = null;
      }
    }
    prevRepositionRef.current = repositionMode;
  }, [repositionMode, setDeploymentArea]);

  // ── Render entities ─────────────────────────────────────────────

  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;
    ds.entities.removeAll();
    pinRef.current = null;
    circleRef.current = null;

    if (!deploymentArea) return;

    const { lat, lon, radiusKm } = deploymentArea;

    // Center pin
    const pin = ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: {
        pixelSize: 10,
        color: GREEN,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1_000, 1.5, 8_000_000, 0.5),
      },
      label: {
        text: `DEPLOY ZONE\n${lat.toFixed(4)}°, ${lon.toFixed(4)}°\n${radiusKm}km`,
        font: "bold 10px monospace",
        fillColor: GREEN,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -30),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1_000, 1.2, 5_000_000, 0.5),
      },
    });
    (pin as Cesium.Entity & { _deploymentRole?: string })._deploymentRole = "center-pin";
    pinRef.current = pin;

    // Radius circle
    const circle = ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      ellipse: {
        semiMajorAxis: radiusKm * 1000,
        semiMinorAxis: radiusKm * 1000,
        material: GREEN.withAlpha(0.08),
        outline: true,
        outlineColor: GREEN.withAlpha(0.5),
        outlineWidth: 2,
        height: 0,
      },
    });
    (circle as Cesium.Entity & { _deploymentRole?: string })._deploymentRole = "radius-circle";
    circleRef.current = circle;
  }, [deploymentArea]);

  return null;
}
