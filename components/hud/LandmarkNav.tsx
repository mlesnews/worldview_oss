"use client";

import { useWorldViewStore } from "@/stores/worldview-store";

const LANDMARKS = [
  { label: "DC", lon: -77.0369, lat: 38.9072 },
  { label: "NYC", lon: -74.006, lat: 40.7128 },
  { label: "LONDON", lon: -0.1276, lat: 51.5074 },
  { label: "MOSCOW", lon: 37.6173, lat: 55.7558 },
  { label: "BEIJING", lon: 116.4074, lat: 39.9042 },
  { label: "TOKYO", lon: 139.6917, lat: 35.6895 },
  { label: "SYDNEY", lon: 151.2093, lat: -33.8688 },
  { label: "CAIRO", lon: 31.2357, lat: 30.0444 },
  { label: "RIYADH", lon: 46.6753, lat: 24.7136 },
  { label: "PYONGYANG", lon: 125.7625, lat: 39.0392 },
] as const;

export default function LandmarkNav() {
  const flyTo = useWorldViewStore((s) => s.flyTo);

  return (
    <div className="panel-section">
      <div className="panel-label">QUICK NAV</div>
      <div className="grid grid-cols-2 gap-0.5">
        {LANDMARKS.map((lm) => (
          <button
            key={lm.label}
            onClick={() => flyTo(lm.lon, lm.lat, 500_000)}
            className="px-2 py-1 font-mono text-[9px] tracking-wider text-green-700/50
              hover:text-green-400 hover:bg-green-900/20 transition-colors cursor-pointer
              border border-green-900/20 rounded-sm text-center"
          >
            {lm.label}
          </button>
        ))}
      </div>
    </div>
  );
}
