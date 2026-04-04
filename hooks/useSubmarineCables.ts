"use client";

import { useState, useEffect } from "react";
import type { SubmarineCable } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

const STATIC_DATA: SubmarineCable[] = [
  {
    id: "cable-marea",
    name: "MAREA",
    readyForService: "2018",
    lengthKm: 6600,
    owners: "Microsoft/Meta/Telxius",
    landing1: { lat: 36.8529, lon: -75.978, name: "Virginia Beach, VA" },
    landing2: { lat: 43.2627, lon: -2.9253, name: "Bilbao, ES" },
    capacityTbps: 200,
  },
  {
    id: "cable-dunant",
    name: "Dunant",
    readyForService: "2021",
    lengthKm: 6600,
    owners: "Google",
    landing1: { lat: 36.8529, lon: -75.978, name: "Virginia Beach, VA" },
    landing2: {
      lat: 46.72,
      lon: -1.9468,
      name: "Saint-Hilaire-de-Riez, FR",
    },
    capacityTbps: 250,
  },
  {
    id: "cable-faster",
    name: "FASTER",
    readyForService: "2016",
    lengthKm: 11629,
    owners: "Google/KDDI",
    landing1: { lat: 43.119, lon: -124.4081, name: "Bandon, OR" },
    landing2: { lat: 34.9057, lon: 139.9547, name: "Chikura, JP" },
    capacityTbps: 60,
  },
  {
    id: "cable-peace",
    name: "PEACE",
    readyForService: "2022",
    lengthKm: 15000,
    owners: "Hengtong",
    landing1: { lat: 43.2965, lon: 5.3698, name: "Marseille, FR" },
    landing2: { lat: 1.2605, lon: 103.82, name: "Singapore, SG" },
    capacityTbps: 96,
  },
  {
    id: "cable-2africa",
    name: "2Africa",
    readyForService: "2024",
    lengthKm: 45000,
    owners: "Meta",
    landing1: { lat: 50.8306, lon: -4.5531, name: "Bude, UK" },
    landing2: { lat: -33.9249, lon: 18.4241, name: "Cape Town, ZA" },
    capacityTbps: 180,
  },
  {
    id: "cable-grace-hopper",
    name: "Grace Hopper",
    readyForService: "2022",
    lengthKm: 6234,
    owners: "Google",
    landing1: { lat: 40.573, lon: -73.9712, name: "New York, NY" },
    landing2: { lat: 50.8306, lon: -4.5531, name: "Bude, UK" },
    capacityTbps: 340,
  },
  {
    id: "cable-equiano",
    name: "Equiano",
    readyForService: "2023",
    lengthKm: 12000,
    owners: "Google",
    landing1: { lat: 38.7223, lon: -9.1393, name: "Lisbon, PT" },
    landing2: { lat: -33.9249, lon: 18.4241, name: "Cape Town, ZA" },
    capacityTbps: 144,
  },
  {
    id: "cable-jupiter",
    name: "Jupiter",
    readyForService: "2020",
    lengthKm: 14000,
    owners: "Google/Facebook",
    landing1: { lat: 36.8529, lon: -75.978, name: "Virginia Beach, VA" },
    landing2: { lat: 33.4817, lon: 135.745, name: "Maruyama, JP" },
    capacityTbps: 60,
  },
];

export function useSubmarineCables(enabled: boolean) {
  const [items] = useState<SubmarineCable[]>(STATIC_DATA);
  const setSubmarineCables = useWorldViewStore((s) => s.setSubmarineCables);

  useEffect(() => {
    if (enabled) setSubmarineCables(STATIC_DATA);
    else setSubmarineCables([]);
  }, [enabled, setSubmarineCables]);

  return { items: enabled ? items : [], loading: false };
}
