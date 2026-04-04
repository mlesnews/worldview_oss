"use client";

import { useMemo } from "react";
import type { MonkeyWerxSitrep, MilitaryAircraftCategory } from "@/types";
import { useWorldViewStore } from "@/stores/worldview-store";

export function useMilitaryAircraft(enabled: boolean) {
  const sitreps = useWorldViewStore((s) => s.monkeyWerxSitreps);
  const filters = useWorldViewStore((s) => s.militaryAircraftFilters);

  const filtered = useMemo(() => {
    if (!enabled) return [];
    return sitreps.filter((s) => filters[s.category]);
  }, [enabled, sitreps, filters]);

  return { aircraft: filtered, loading: false };
}
