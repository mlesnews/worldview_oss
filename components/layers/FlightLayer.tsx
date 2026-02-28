"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useFlights } from "@/hooks/useFlights";
import { useWorldViewStore } from "@/stores/worldview-store";

interface Props {
  viewer: Cesium.Viewer;
}

export default function FlightLayer({ viewer }: Props) {
  const { flights } = useFlights(true);
  const entityCollectionRef = useRef<Cesium.CustomDataSource | null>(null);
  const setSelectedEntity = useWorldViewStore((s) => s.setSelectedEntity);
  const flyTo = useWorldViewStore((s) => s.flyTo);

  useEffect(() => {
    const ds = new Cesium.CustomDataSource("flights");
    viewer.dataSources.add(ds);
    entityCollectionRef.current = ds;

    // Click handler
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (click: { position: Cesium.Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id?._flightData) {
          const f = picked.id._flightData;
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
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );

    return () => {
      handler.destroy();
      if (entityCollectionRef.current) {
        viewer.dataSources.remove(entityCollectionRef.current, true);
      }
    };
  }, [viewer, setSelectedEntity, flyTo]);

  // Update entities when flight data changes
  useEffect(() => {
    const ds = entityCollectionRef.current;
    if (!ds) return;

    ds.entities.removeAll();

    for (const flight of flights) {
      if (!flight.latitude || !flight.longitude) continue;

      const alt = flight.baroAltitude || flight.geoAltitude || 10000;
      const entity = ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          flight.longitude,
          flight.latitude,
          alt
        ),
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
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            0,
            5e6
          ),
        },
      });

      // Store flight data on entity for click handler
      (entity as unknown as Record<string, unknown>)._flightData = flight;
    }
  }, [flights]);

  return null;
}
