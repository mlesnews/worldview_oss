"use client";

import { useState, useEffect } from "react";
import type { GpuSupplyNode } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

const STATIC_DATA: GpuSupplyNode[] = [
  {
    id: "gpu-nvidia-hq",
    name: "NVIDIA HQ",
    type: "manufacturer",
    latitude: 37.3706,
    longitude: -121.9632,
    company: "NVIDIA",
    details: "Santa Clara, CA",
  },
  {
    id: "gpu-tsmc-fab18",
    name: "TSMC Fab 18",
    type: "fab",
    latitude: 22.9894,
    longitude: 120.2706,
    company: "TSMC",
    details: "Tainan, TW",
  },
  {
    id: "gpu-samsung-austin",
    name: "Samsung Austin",
    type: "fab",
    latitude: 30.4068,
    longitude: -97.7219,
    company: "Samsung",
    details: "Austin, TX",
  },
  {
    id: "gpu-sk-hynix-icheon",
    name: "SK Hynix Icheon",
    type: "manufacturer",
    latitude: 37.2796,
    longitude: 127.4431,
    company: "SK Hynix",
    details: "Icheon, South Korea",
  },
  {
    id: "gpu-micron-boise",
    name: "Micron Boise",
    type: "manufacturer",
    latitude: 43.5879,
    longitude: -116.2323,
    company: "Micron",
    details: "Boise, ID",
  },
  {
    id: "gpu-supermicro",
    name: "Supermicro",
    type: "distributor",
    latitude: 37.3576,
    longitude: -121.9166,
    company: "Supermicro",
    details: "San Jose, CA",
  },
  {
    id: "gpu-coreweave-nj",
    name: "CoreWeave NJ",
    type: "datacenter",
    latitude: 40.769,
    longitude: -74.0199,
    company: "CoreWeave",
    details: "Weehawken, NJ",
  },
  {
    id: "gpu-lambda-sf",
    name: "Lambda Labs SF",
    type: "datacenter",
    latitude: 37.7749,
    longitude: -122.4194,
    company: "Lambda",
    details: "San Francisco, CA",
  },
];

export function useGpuSupply(enabled: boolean) {
  const [items] = useState<GpuSupplyNode[]>(STATIC_DATA);
  const setGpuSupplyNodes = useWorldViewStore((s) => s.setGpuSupplyNodes);

  useEffect(() => {
    if (enabled) setGpuSupplyNodes(STATIC_DATA);
    else setGpuSupplyNodes([]);
  }, [enabled, setGpuSupplyNodes]);

  return { items: enabled ? items : [], loading: false };
}
