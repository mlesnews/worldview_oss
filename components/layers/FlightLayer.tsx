"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Cesium from "cesium";
import { useFlights } from "@/hooks/useFlights";
import { useWorldViewStore } from "@/stores/worldview-store";
import { getLayerIcon } from "@/lib/layer-icons";
import { deadReckonPosition, computeBearing } from "@/lib/motion/dead-reckon";
import { HEADING_LERP_FACTOR } from "@/lib/constants";
import type { Flight, FlightMotionState } from "@/types";

interface Props {
  viewer: Cesium.Viewer;
}

interface ISSPosition {
  latitude: number;
  longitude: number;
  altitude: number; // km
  velocity: number; // km/h
}

interface FlightEntityState {
  entity: Cesium.Entity;
  motionRef: { current: FlightMotionState };
  currentHeading: number;
  targetHeading: number;
}

const ISS_ENTITY_ID = "__iss__";

/**
 * Short-angle lerp for headings (handles 359->1 wrap).
 */
function lerpAngleDeg(from: number, to: number, t: number): number {
  let diff = ((to - from + 540) % 360) - 180;
  return ((from + diff * t) + 360) % 360;
}

/**
 * Convert Cesium JulianDate to epoch seconds.
 */
function julianToEpochSec(jd: Cesium.JulianDate): number {
  return Cesium.JulianDate.toDate(jd).getTime() / 1000;
}

export default function FlightLayer({ viewer }: Props) {
  const flightFilters = useWorldViewStore((s) => s.flightFilters);
  const { flights } = useFlights(flightFilters.regular);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const entityMapRef = useRef<Map<string, FlightEntityState>>(new Map());
  const issEntityRef = useRef<FlightEntityState | null>(null);
  const issIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const issPrevPosRef = useRef<{ lat: number; lon: number } | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  // Create a CallbackPositionProperty that reads from a mutable motion ref
  const makePositionCallback = useCallback(
    (motionRef: { current: FlightMotionState }) => {
      return new Cesium.CallbackPositionProperty(
        ((time?: Cesium.JulianDate, result?: Cesium.Cartesian3) => {
          if (!time) {
            const fb = motionRef.current;
            return Cesium.Cartesian3.fromDegrees(fb.lon, fb.lat, fb.alt, undefined, result);
          }
          const sec = julianToEpochSec(time);
          const pos = deadReckonPosition(motionRef.current, sec);
          return Cesium.Cartesian3.fromDegrees(
            pos.lon,
            pos.lat,
            pos.alt,
            undefined,
            result
          );
        }) as Cesium.CallbackPositionProperty.Callback,
        false
      );
    },
    []
  );

  // Mount DataSource + click handler
  useEffect(() => {
    const ds = new Cesium.CustomDataSource("flights");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (!Cesium.defined(picked)) return;

        if (picked.id?._flightData) {
          const f = picked.id._flightData as Flight;
          setSelectedEntity({
            id: f.icao24,
            type: "flight",
            name: f.callsign || f.icao24,
            details: {
              ICAO: f.icao24,
              Country: f.originCountry,
              Alt: f.baroAltitude
                ? `${Math.round(f.baroAltitude * 3.28084)} FT`
                : "N/A",
              Speed: f.velocity
                ? `${Math.round(f.velocity * 1.94384)} KTS`
                : "N/A",
              Track: f.trueTrack ? `${f.trueTrack.toFixed(1)}°` : "N/A",
              VRate: f.verticalRate
                ? `${f.verticalRate.toFixed(1)} m/s`
                : "N/A",
            },
            lon: f.longitude,
            lat: f.latitude,
            alt: 50_000,
          });
          if (useWorldViewStore.getState().clickToZoom) {
            flyTo(f.longitude, f.latitude, 50_000);
          }
        } else if (picked.id?._issData) {
          const iss = picked.id._issData as ISSPosition;
          setSelectedEntity({
            id: "ISS",
            type: "satellite",
            name: "ISS (ZARYA)",
            details: {
              Altitude: `${iss.altitude.toFixed(1)} KM`,
              Velocity: `${iss.velocity.toFixed(0)} KM/H`,
              Lat: iss.latitude.toFixed(4),
              Lon: iss.longitude.toFixed(4),
            },
            lon: iss.longitude,
            lat: iss.latitude,
            alt: iss.altitude * 1000,
          });
          if (useWorldViewStore.getState().clickToZoom) {
            flyTo(iss.longitude, iss.latitude, iss.altitude * 1000 + 500_000);
          }
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );

    return () => {
      handler.destroy();
      entityMapRef.current.clear();
      issEntityRef.current = null;
      if (dsRef.current) {
        viewer.dataSources.remove(dsRef.current, true);
      }
    };
  }, [viewer, setSelectedEntity, flyTo]);

  // Heading lerp tick listener
  useEffect(() => {
    const onTick = () => {
      // Regular flights
      for (const state of entityMapRef.current.values()) {
        if (Math.abs(state.currentHeading - state.targetHeading) < 0.1) continue;
        state.currentHeading = lerpAngleDeg(
          state.currentHeading,
          state.targetHeading,
          HEADING_LERP_FACTOR
        );
        if (state.entity.billboard) {
          state.entity.billboard.rotation = new Cesium.ConstantProperty(
            Cesium.Math.toRadians(-state.currentHeading)
          );
        }
      }
    };

    const removeListener = viewer.clock.onTick.addEventListener(onTick);
    return () => {
      removeListener();
    };
  }, [viewer]);

  // ISS position polling
  useEffect(() => {
    if (!flightFilters.iss) {
      // Remove ISS entity
      const ds = dsRef.current;
      if (ds && issEntityRef.current) {
        ds.entities.remove(issEntityRef.current.entity);
        issEntityRef.current = null;
      }
      issPrevPosRef.current = null;
      return;
    }

    const fetchISS = async () => {
      try {
        const res = await fetch(
          "https://api.wheretheiss.at/v1/satellites/25544",
          { signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) return;
        const data = await res.json();
        const iss: ISSPosition = {
          latitude: data.latitude,
          longitude: data.longitude,
          altitude: data.altitude,
          velocity: data.velocity,
        };

        const nowSec = Date.now() / 1000;
        const altMeters = iss.altitude * 1000;
        // ISS velocity comes in km/h, convert to m/s
        const velocityMs = iss.velocity * (1000 / 3600);

        // Estimate heading from consecutive samples
        let heading = 0;
        if (issPrevPosRef.current) {
          heading = computeBearing(
            issPrevPosRef.current.lat,
            issPrevPosRef.current.lon,
            iss.latitude,
            iss.longitude
          );
        }
        issPrevPosRef.current = { lat: iss.latitude, lon: iss.longitude };

        const motionState: FlightMotionState = {
          lat: iss.latitude,
          lon: iss.longitude,
          alt: altMeters,
          velocity: velocityMs,
          heading,
          verticalRate: 0,
          timestamp: nowSec,
        };

        const ds = dsRef.current;
        if (!ds) return;

        if (issEntityRef.current) {
          // Update existing motion state
          issEntityRef.current.motionRef.current = motionState;
          (issEntityRef.current.entity as unknown as Record<string, unknown>)._issData = iss;
        } else {
          // Create new ISS entity with CallbackPositionProperty
          const motionRef = { current: motionState };
          const entity = ds.entities.add({
            position: makePositionCallback(motionRef) as unknown as Cesium.PositionProperty,
            billboard: {
              image: getLayerIcon("iss", "#ffcc00"),
              width: 28,
              height: 28,
              color: Cesium.Color.WHITE,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              scaleByDistance: new Cesium.NearFarScalar(1e5, 2.0, 2e7, 0.8),
            },
            label: {
              text: "ISS",
              font: "bold 12px monospace",
              fillColor: Cesium.Color.fromCssColorString("#ffcc00"),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(18, -6),
              scaleByDistance: new Cesium.NearFarScalar(1e5, 1, 1e7, 0.3),
            },
          });
          (entity as unknown as Record<string, unknown>)._issData = iss;
          issEntityRef.current = {
            entity,
            motionRef,
            currentHeading: heading,
            targetHeading: heading,
          };
        }
      } catch {
        // Silently fail, keep previous position
      }
    };

    fetchISS();
    issIntervalRef.current = setInterval(fetchISS, 5_000);

    return () => {
      if (issIntervalRef.current) clearInterval(issIntervalRef.current);
    };
  }, [flightFilters.iss, makePositionCallback]);

  // Update regular flight entities in-place
  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;

    const prevMap = entityMapRef.current;
    const currentIds = new Set<string>();
    const nowSec = Date.now() / 1000;

    if (flightFilters.regular) {
      for (const flight of flights) {
        if (!flight.latitude || !flight.longitude) continue;

        const id = flight.icao24;
        currentIds.add(id);
        const alt = flight.baroAltitude || flight.geoAltitude || 10000;
        const heading = flight.trueTrack ?? 0;
        const velocity = flight.velocity ?? 0;
        const verticalRate = flight.verticalRate ?? 0;

        const motionState: FlightMotionState = {
          lat: flight.latitude,
          lon: flight.longitude,
          alt,
          velocity,
          heading,
          verticalRate,
          timestamp: nowSec,
        };

        const iconColor = flight.onGround ? "#1a5c1a" : "#00ff41";

        const existing = prevMap.get(id);
        if (existing) {
          // Mutate the motion ref — CallbackPositionProperty reads from it
          existing.motionRef.current = motionState;
          existing.targetHeading = heading;
          (existing.entity as unknown as Record<string, unknown>)._flightData = flight;
          if (existing.entity.billboard) {
            existing.entity.billboard.image = new Cesium.ConstantProperty(
              getLayerIcon("airplane", iconColor)
            );
          }
          if (existing.entity.label) {
            existing.entity.label.text = new Cesium.ConstantProperty(
              flight.callsign || ""
            );
          }
        } else {
          // Create new entity with CallbackPositionProperty
          const motionRef = { current: motionState };
          const entity = ds.entities.add({
            position: makePositionCallback(motionRef) as unknown as Cesium.PositionProperty,
            billboard: {
              image: getLayerIcon("airplane", iconColor),
              width: 24,
              height: 24,
              rotation: Cesium.Math.toRadians(-heading),
              alignedAxis: Cesium.Cartesian3.UNIT_Z,
              color: Cesium.Color.WHITE,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              scaleByDistance: new Cesium.NearFarScalar(1e3, 1.5, 1e7, 0.5),
            },
            label: {
              text: flight.callsign || "",
              font: "11px monospace",
              fillColor: Cesium.Color.fromCssColorString("#00ff41"),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(16, -4),
              scaleByDistance: new Cesium.NearFarScalar(1e3, 1, 5e6, 0),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
                0,
                5e6
              ),
            },
          });
          (entity as unknown as Record<string, unknown>)._flightData = flight;
          prevMap.set(id, {
            entity,
            motionRef,
            currentHeading: heading,
            targetHeading: heading,
          });
        }
      }
    }

    // Remove entities for flights no longer present
    for (const [id, state] of prevMap.entries()) {
      if (!currentIds.has(id)) {
        ds.entities.remove(state.entity);
        prevMap.delete(id);
      }
    }
  }, [flights, flightFilters.regular, makePositionCallback]);

  return null;
}
