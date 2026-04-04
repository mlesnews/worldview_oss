"use client";

import { useState, useEffect } from "react";
import type { ChipFab } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

const STATIC_DATA: ChipFab[] = [
  {
    id: "fab-tsmc-18",
    name: "TSMC Fab 18",
    company: "TSMC",
    latitude: 22.9894,
    longitude: 120.2706,
    processNode: "3nm",
    status: "operational",
  },
  {
    id: "fab-tsmc-arizona",
    name: "TSMC Arizona",
    company: "TSMC",
    latitude: 33.4315,
    longitude: -112.0059,
    processNode: "4nm",
    status: "construction",
    investmentBn: 40,
  },
  {
    id: "fab-intel-52-62",
    name: "Intel Fab 52/62",
    company: "Intel",
    latitude: 33.2271,
    longitude: -111.8413,
    processNode: "Intel 18A",
    status: "construction",
  },
  {
    id: "fab-intel-ohio",
    name: "Intel Ohio",
    company: "Intel",
    latitude: 40.0816,
    longitude: -82.7589,
    processNode: "Intel 18A",
    status: "construction",
    investmentBn: 20,
  },
  {
    id: "fab-samsung-pyeongtaek",
    name: "Samsung Pyeongtaek",
    company: "Samsung",
    latitude: 36.992,
    longitude: 127.1128,
    processNode: "3nm",
    status: "operational",
  },
  {
    id: "fab-samsung-taylor",
    name: "Samsung Taylor TX",
    company: "Samsung",
    latitude: 30.5706,
    longitude: -97.4108,
    processNode: "4nm",
    status: "construction",
    investmentBn: 17,
  },
  {
    id: "fab-gf-malta",
    name: "GlobalFoundries Malta NY",
    company: "GlobalFoundries",
    latitude: 42.9726,
    longitude: -73.7939,
    processNode: "12nm",
    status: "operational",
  },
  {
    id: "fab-tsmc-kumamoto",
    name: "TSMC Japan Kumamoto",
    company: "TSMC",
    latitude: 32.7913,
    longitude: 130.7417,
    processNode: "12nm/28nm",
    status: "construction",
  },
  {
    id: "fab-intel-magdeburg",
    name: "Intel Magdeburg DE",
    company: "Intel",
    latitude: 52.1205,
    longitude: 11.6276,
    processNode: "Intel 18A",
    status: "planned",
    investmentBn: 30,
  },
];

export function useChipFabs(enabled: boolean) {
  const [items] = useState<ChipFab[]>(STATIC_DATA);
  const setChipFabs = useWorldViewStore((s) => s.setChipFabs);

  useEffect(() => {
    if (enabled) setChipFabs(STATIC_DATA);
    else setChipFabs([]);
  }, [enabled, setChipFabs]);

  return { items: enabled ? items : [], loading: false };
}
