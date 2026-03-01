"use client";

import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import { useFlights } from "@/hooks/useFlights";
import { useWorldViewStore } from "@/stores/worldview-store";
import type { Flight } from "@/types";

interface Props {
  viewer: Cesium.Viewer;
}

interface ISSPosition {
  latitude: number;
  longitude: number;
  altitude: number; // km
  velocity: number; // km/h
}

const ISS_ENTITY_ID = "__iss__";

export default function FlightLayer({ viewer }: Props) {
  const flightFilters = useWorldViewStore((s) => s.flightFilters);
  const { flights } = useFlights(flightFilters.regular);
  const [issPos, setIssPos] = useState<ISSPosition | null>(null);
  const dsRef = useRef<Cesium.CustomDataSource | null>(null);
  const entityMapRef = useRef<Map<string, Cesium.Entity>>(new Map());
  const issIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);

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
          flyTo(f.longitude, f.latitude, 50_000);
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
          flyTo(iss.longitude, iss.latitude, iss.altitude * 1000 + 500_000);
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

  // ISS position polling
  useEffect(() => {
    if (!flightFilters.iss) {
      setIssPos(null);
      return;
    }

    const fetchISS = async () => {
      try {
        const res = await fetch(
          "https://api.wheretheiss.at/v1/satellites/25544",
          { signal: AbortSignal.timeout(5000) }
        );
        if (res.ok) {
          const data = await res.json();
          setIssPos({
            latitude: data.latitude,
            longitude: data.longitude,
            altitude: data.altitude,
            velocity: data.velocity,
          });
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
  }, [flightFilters.iss]);

  // Update regular flight entities in-place
  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;

    const prevMap = entityMapRef.current;
    const currentIds = new Set<string>();

    // Always keep ISS entity ID in the set so it doesn't get pruned
    if (prevMap.has(ISS_ENTITY_ID)) {
      currentIds.add(ISS_ENTITY_ID);
    }

    if (flightFilters.regular) {
      for (const flight of flights) {
        if (!flight.latitude || !flight.longitude) continue;

        const id = flight.icao24;
        currentIds.add(id);
        const alt = flight.baroAltitude || flight.geoAltitude || 10000;
        const newPos = Cesium.Cartesian3.fromDegrees(
          flight.longitude,
          flight.latitude,
          alt
        );

        const existing = prevMap.get(id);
        if (existing) {
          (existing as unknown as { position: Cesium.ConstantPositionProperty }).position =
            new Cesium.ConstantPositionProperty(newPos);
          (existing as unknown as Record<string, unknown>)._flightData = flight;
          if (existing.label) {
            existing.label.text = new Cesium.ConstantProperty(flight.callsign || "");
          }
        } else {
          const entity = ds.entities.add({
            position: newPos,
            point: {
              pixelSize: flight.onGround ? 3 : 4,
              color: flight.onGround
                ? Cesium.Color.fromCssColorString("#1a5c1a")
                : Cesium.Color.fromCssColorString("#00ff41"),
              outlineColor: Cesium.Color.fromCssColorString("#003300"),
              outlineWidth: 1,
              scaleByDistance: new Cesium.NearFarScalar(1e3, 1.5, 1e7, 0.5),
            },
            label: {
              text: flight.callsign || "",
              font: "9px monospace",
              fillColor: Cesium.Color.fromCssColorString("#00ff41"),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(12, -4),
              scaleByDistance: new Cesium.NearFarScalar(1e3, 1, 5e6, 0),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5e6),
            },
          });
          (entity as unknown as Record<string, unknown>)._flightData = flight;
          prevMap.set(id, entity);
        }
      }
    }

    // Remove entities for flights no longer present (but not ISS)
    for (const [id, entity] of prevMap.entries()) {
      if (!currentIds.has(id) && id !== ISS_ENTITY_ID) {
        ds.entities.remove(entity);
        prevMap.delete(id);
      }
    }
  }, [flights, flightFilters.regular]);

  // Update ISS entity
  useEffect(() => {
    const ds = dsRef.current;
    if (!ds) return;

    const prevMap = entityMapRef.current;

    if (!issPos || !flightFilters.iss) {
      // Remove ISS entity if it exists
      const existing = prevMap.get(ISS_ENTITY_ID);
      if (existing) {
        ds.entities.remove(existing);
        prevMap.delete(ISS_ENTITY_ID);
      }
      return;
    }

    const altMeters = issPos.altitude * 1000;
    const newPos = Cesium.Cartesian3.fromDegrees(
      issPos.longitude,
      issPos.latitude,
      altMeters
    );

    const existing = prevMap.get(ISS_ENTITY_ID);
    if (existing) {
      (existing as unknown as { position: Cesium.ConstantPositionProperty }).position =
        new Cesium.ConstantPositionProperty(newPos);
      (existing as unknown as Record<string, unknown>)._issData = issPos;
    } else {
      const entity = ds.entities.add({
        position: newPos,
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString("#ffcc00"),
          outlineColor: Cesium.Color.fromCssColorString("#ff6600"),
          outlineWidth: 2,
          scaleByDistance: new Cesium.NearFarScalar(1e5, 2.0, 2e7, 0.8),
        },
        label: {
          text: "ISS",
          font: "bold 10px monospace",
          fillColor: Cesium.Color.fromCssColorString("#ffcc00"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(14, -6),
          scaleByDistance: new Cesium.NearFarScalar(1e5, 1, 1e7, 0.3),
        },
      });
      (entity as unknown as Record<string, unknown>)._issData = issPos;
      prevMap.set(ISS_ENTITY_ID, entity);
    }
  }, [issPos, flightFilters.iss]);

  return null;
}
