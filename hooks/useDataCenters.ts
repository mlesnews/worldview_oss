"use client";

import { useState, useEffect } from "react";
import type { DataCenter } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

const STATIC_DATA: DataCenter[] = [
  {
    id: "dc-aws-us-east-1",
    name: "US East (N. Virginia)",
    provider: "AWS",
    latitude: 39.0438,
    longitude: -77.4874,
    region: "us-east-1",
  },
  {
    id: "dc-aws-us-west-2",
    name: "US West (Oregon)",
    provider: "AWS",
    latitude: 45.8399,
    longitude: -119.7006,
    region: "us-west-2",
  },
  {
    id: "dc-aws-eu-west-1",
    name: "Europe (Ireland)",
    provider: "AWS",
    latitude: 53.3498,
    longitude: -6.2603,
    region: "eu-west-1",
  },
  {
    id: "dc-aws-ap-southeast-1",
    name: "Asia Pacific (Singapore)",
    provider: "AWS",
    latitude: 1.3521,
    longitude: 103.8198,
    region: "ap-southeast-1",
  },
  {
    id: "dc-azure-east-us",
    name: "East US",
    provider: "Azure",
    latitude: 36.6777,
    longitude: -78.3875,
    region: "eastus",
  },
  {
    id: "dc-azure-west-europe",
    name: "West Europe",
    provider: "Azure",
    latitude: 52.3676,
    longitude: 4.9041,
    region: "westeurope",
  },
  {
    id: "dc-azure-southeast-asia",
    name: "Southeast Asia",
    provider: "Azure",
    latitude: 1.2966,
    longitude: 103.7764,
    region: "southeastasia",
  },
  {
    id: "dc-google-us-central1",
    name: "Council Bluffs, Iowa",
    provider: "Google",
    latitude: 41.2619,
    longitude: -95.8608,
    region: "us-central1",
  },
  {
    id: "dc-google-europe-west1",
    name: "St-Ghislain, Belgium",
    provider: "Google",
    latitude: 50.4475,
    longitude: 3.8188,
    region: "europe-west1",
  },
  {
    id: "dc-google-asia-east1",
    name: "Changhua County, Taiwan",
    provider: "Google",
    latitude: 24.0518,
    longitude: 120.5161,
    region: "asia-east1",
  },
  {
    id: "dc-oracle-us-ashburn-1",
    name: "US East (Ashburn)",
    provider: "Oracle",
    latitude: 39.0438,
    longitude: -77.49,
    region: "us-ashburn-1",
  },
  {
    id: "dc-oracle-uk-london-1",
    name: "UK South (London)",
    provider: "Oracle",
    latitude: 51.5074,
    longitude: -0.1278,
    region: "uk-london-1",
  },
];

export function useDataCenters(enabled: boolean) {
  const [items] = useState<DataCenter[]>(STATIC_DATA);
  const setDataCenters = useWorldViewStore((s) => s.setDataCenters);

  useEffect(() => {
    if (enabled) setDataCenters(STATIC_DATA);
    else setDataCenters([]);
  }, [enabled, setDataCenters]);

  return { items: enabled ? items : [], loading: false };
}
