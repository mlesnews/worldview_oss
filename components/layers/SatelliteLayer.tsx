"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Cesium from "cesium";
import { useSatellites } from "@/hooks/useSatellites";
import { useWorldViewStore } from "@/stores/worldview-store";
import { getLayerIcon } from "@/lib/layer-icons";
import { parseSatrec, propagateSatrec } from "@/lib/motion/sgp4-propagate";
import {
  ORBITAL_TRACK_POINTS,
  ORBITAL_TRACK_DURATION_S,
} from "@/lib/constants";
import type { Satellite } from "@/types";
import type { SatRec } from "satellite.js";

interface Props {
  viewer: Cesium.Viewer;
}

interface SatEntityState {
  entity: Cesium.Entity;
  nadirEntity: Cesium.Entity;
  footprintEntity: Cesium.Entity;
  trackEntity: Cesium.Entity;
  /** Shared holder — callbacks close over this object, mutate .satrec to update */
  satrecHolder: { satrec: SatRec | null };
  fallbackRef: { current: { lat: number; lon: number; altKm: number } };
  tle1: string;
}

const R_EARTH = 6371; // km

/**
 * Build orbital track positions (polyline points) by propagating
 * SGP4 across a time window centered on `now`.
 */
function buildTrackPositions(
  satrec: SatRec,
  now: Date,
  numPoints: number,
  durationS: number
): Cesium.Cartesian3[] {
  const positions: Cesium.Cartesian3[] = [];
  const halfDur = durationS / 2;
  const step = durationS / (numPoints - 1);
  const startMs = now.getTime() - halfDur * 1000;

  for (let i = 0; i < numPoints; i++) {
    const t = new Date(startMs + i * step * 1000);
    const pos = propagateSatrec(satrec, t);
    if (pos) {
      positions.push(
        Cesium.Cartesian3.fromDegrees(pos.lon, pos.lat, pos.altKm * 1000)
      );
    }
  }
  return positions;
}

export default function SatelliteLayer({ viewer }: Props) {
  const { satellites } = useSatellites(true);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const entityMapRef = useRef<Map<number, SatEntityState>>(new Map());
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  const cyanColor = useRef(Cesium.Color.fromCssColorString("#00ccff")).current;

  /**
   * Create a CallbackPositionProperty that propagates SGP4 for every frame,
   * falling back to a static position if no TLE data.
   */
  const makeSatPositionCallback = useCallback(
    (
      satrecHolder: { satrec: SatRec | null },
      fallbackRef: { current: { lat: number; lon: number; altKm: number } }
    ) => {
      return new Cesium.CallbackPositionProperty(
        ((time?: Cesium.JulianDate, result?: Cesium.Cartesian3) => {
          if (!time) {
            const fb = fallbackRef.current;
            return Cesium.Cartesian3.fromDegrees(fb.lon, fb.lat, fb.altKm * 1000, undefined, result);
          }
          const date = Cesium.JulianDate.toDate(time);
          if (satrecHolder.satrec) {
            const pos = propagateSatrec(satrecHolder.satrec, date);
            if (pos) {
              return Cesium.Cartesian3.fromDegrees(
                pos.lon,
                pos.lat,
                pos.altKm * 1000,
                undefined,
                result
              );
            }
          }
          const fb = fallbackRef.current;
          return Cesium.Cartesian3.fromDegrees(
            fb.lon,
            fb.lat,
            fb.altKm * 1000,
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
    const ds = new Cesium.CustomDataSource("satellites");
    viewer.dataSources.add(ds);
    dsRef.current = ds;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._satData) {
          const s = picked.id._satData as Satellite;
          setSelectedEntity({
            id: String(s.id),
            type: "satellite",
            name: s.name,
            details: {
              "SAT ID": s.id,
              Alt: `${s.altitude.toFixed(1)} KM`,
              Vel: `${s.velocity.toFixed(2)} KM/S`,
              Lat: `${s.latitude.toFixed(4)}°`,
              Lon: `${s.longitude.toFixed(4)}°`,
            },
            lon: s.longitude,
            lat: s.latitude,
            alt: s.altitude * 2 * 1000,
          });
          if (useWorldViewStore.getState().clickToZoom) {
            flyTo(s.longitude, s.latitude, s.altitude * 2 * 1000);
          }
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );

    return () => {
      handler.destroy();
      entityMapRef.current.clear();
      if (dsRef.current) {
        viewer.dataSources.remove(dsRef.current, true);
      }
    };
  }, [viewer, setSelectedEntity, flyTo]);

  // Update satellite entities in-place
  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;

    const prevMap = entityMapRef.current;
    const currentIds = new Set<number>();
    const now = new Date();

    for (const sat of satellites) {
      currentIds.add(sat.id);

      const existing = prevMap.get(sat.id);

      if (existing) {
        // Update: mutate satrecHolder if TLE changed, update fallback
        if (sat.tleLine1 && sat.tleLine1 !== existing.tle1) {
          const newSatrec = parseSatrec(sat.tleLine1, sat.tleLine2!);
          if (newSatrec) {
            existing.satrecHolder.satrec = newSatrec;
            const trackPositions = buildTrackPositions(
              newSatrec,
              now,
              ORBITAL_TRACK_POINTS,
              ORBITAL_TRACK_DURATION_S
            );
            if (existing.trackEntity.polyline) {
              existing.trackEntity.polyline.positions =
                new Cesium.ConstantProperty(trackPositions);
            }
          }
          existing.tle1 = sat.tleLine1;
        }
        existing.fallbackRef.current = {
          lat: sat.latitude,
          lon: sat.longitude,
          altKm: sat.altitude,
        };
        // Update attached data for click info
        (existing.entity as unknown as Record<string, unknown>)._satData = sat;
      } else {
        // Create new satellite entity group
        const satrec =
          sat.tleLine1 && sat.tleLine2
            ? parseSatrec(sat.tleLine1, sat.tleLine2)
            : null;

        const fallbackRef = {
          current: { lat: sat.latitude, lon: sat.longitude, altKm: sat.altitude },
        };

        // We need a shared holder object so the callbacks and state all reference the same satrec
        const satrecHolder = { satrec };

        const positionProp = makeSatPositionCallback(satrecHolder, fallbackRef);

        // Main billboard entity
        const entity = ds.entities.add({
          position: positionProp as unknown as Cesium.PositionProperty,
          billboard: {
            image: getLayerIcon("satellite", "#00ccff"),
            width: 24,
            height: 24,
            color: Cesium.Color.WHITE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(1e5, 2, 1e8, 0.5),
          },
          label: {
            text: sat.name,
            font: "11px monospace",
            fillColor: cyanColor,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(16, -4),
            scaleByDistance: new Cesium.NearFarScalar(1e5, 1, 2e7, 0),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
              0,
              2e7
            ),
          },
        });
        (entity as unknown as Record<string, unknown>)._satData = sat;

        // Nadir line — uses CallbackProperty for dynamic positions
        const nadirEntity = ds.entities.add({
          polyline: {
            positions: new Cesium.CallbackProperty(
              ((time?: Cesium.JulianDate) => {
                let pos: { lat: number; lon: number; altKm: number } | null = null;
                if (time && satrecHolder.satrec) {
                  pos = propagateSatrec(satrecHolder.satrec, Cesium.JulianDate.toDate(time));
                }
                if (!pos) pos = fallbackRef.current;
                return [
                  Cesium.Cartesian3.fromDegrees(
                    pos.lon,
                    pos.lat,
                    pos.altKm * 1000
                  ),
                  Cesium.Cartesian3.fromDegrees(pos.lon, pos.lat, 0),
                ];
              }) as Cesium.CallbackProperty.Callback,
              false
            ) as unknown as Cesium.PositionProperty,
            width: 1,
            material: new Cesium.ColorMaterialProperty(
              cyanColor.withAlpha(0.15)
            ),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
              0,
              2e7
            ),
          },
        });

        // Footprint ellipse — center moves with satellite
        const footprintRadiusKm =
          R_EARTH * Math.acos(R_EARTH / (R_EARTH + sat.altitude));
        const footprintRadiusM = footprintRadiusKm * 1000;

        // Ground position callback (same propagation, but at surface)
        const groundPositionProp = new Cesium.CallbackPositionProperty(
          ((time?: Cesium.JulianDate, result?: Cesium.Cartesian3) => {
            if (!time) {
              const fb = fallbackRef.current;
              return Cesium.Cartesian3.fromDegrees(fb.lon, fb.lat, 0, undefined, result);
            }
            const date = Cesium.JulianDate.toDate(time);
            let pos = satrecHolder.satrec
              ? propagateSatrec(satrecHolder.satrec, date)
              : null;
            if (!pos) pos = fallbackRef.current;
            return Cesium.Cartesian3.fromDegrees(
              pos.lon,
              pos.lat,
              0,
              undefined,
              result
            );
          }) as Cesium.CallbackPositionProperty.Callback,
          false
        );

        const footprintEntity = ds.entities.add({
          position: groundPositionProp as unknown as Cesium.PositionProperty,
          ellipse: {
            semiMajorAxis: new Cesium.ConstantProperty(footprintRadiusM),
            semiMinorAxis: new Cesium.ConstantProperty(footprintRadiusM),
            material: new Cesium.ColorMaterialProperty(
              cyanColor.withAlpha(0.05)
            ),
            outline: true,
            outlineColor: new Cesium.ConstantProperty(
              cyanColor.withAlpha(0.2)
            ),
            outlineWidth: 1,
            height: 0,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
              0,
              2e7
            ),
          },
        });

        // Orbital track polyline (pre-computed, refreshed on each poll)
        let trackPositions: Cesium.Cartesian3[] = [];
        if (satrec) {
          trackPositions = buildTrackPositions(
            satrec,
            now,
            ORBITAL_TRACK_POINTS,
            ORBITAL_TRACK_DURATION_S
          );
        }

        const trackEntity = ds.entities.add({
          polyline: {
            positions: trackPositions,
            width: 1,
            material: new Cesium.ColorMaterialProperty(
              cyanColor.withAlpha(0.2)
            ),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
              0,
              2e7
            ),
          },
        });

        prevMap.set(sat.id, {
          entity,
          nadirEntity,
          footprintEntity,
          trackEntity,
          satrecHolder,
          fallbackRef,
          tle1: sat.tleLine1 || "",
        });
      }
    }

    // Remove satellites no longer in the data set
    for (const [id, state] of prevMap.entries()) {
      if (!currentIds.has(id)) {
        ds.entities.remove(state.entity);
        ds.entities.remove(state.nadirEntity);
        ds.entities.remove(state.footprintEntity);
        ds.entities.remove(state.trackEntity);
        prevMap.delete(id);
      }
    }

    // Refresh orbital tracks for existing sats on each poll
    for (const [id, state] of prevMap.entries()) {
      if (currentIds.has(id) && state.satrecHolder.satrec && state.trackEntity.polyline) {
        const trackPositions = buildTrackPositions(
          state.satrecHolder.satrec,
          now,
          ORBITAL_TRACK_POINTS,
          ORBITAL_TRACK_DURATION_S
        );
        state.trackEntity.polyline.positions = new Cesium.ConstantProperty(
          trackPositions
        );
      }
    }
  }, [satellites, cyanColor, makeSatPositionCallback]);

  return null;
}
