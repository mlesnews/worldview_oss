"use client";

import { useState } from "react";
import { useWorldViewStore } from "@/stores/worldview-store";

export default function CameraList() {
  const [expanded, setExpanded] = useState(false);
  const cameras = useWorldViewStore((s) => s.cameras);
  const camerasActive = useWorldViewStore((s) => s.layers.cameras);
  const flyTo = useWorldViewStore((s) => s.flyTo);
  const openCameraModal = useWorldViewStore((s) => s.openCameraModal);

  if (!camerasActive) return null;

  // Group cameras by city
  const cities = Array.from(new Set(cameras.map((c) => c.city)));

  return (
    <div className="panel-section">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-sm font-mono text-[10px]
          tracking-wide border bg-black/40 border-orange-900/40 text-orange-400/70
          hover:border-orange-500/50 hover:text-orange-400 transition-all cursor-pointer"
      >
        <span>CCTV FEEDS ({cameras.length})</span>
        <span className="text-[10px]">{expanded ? "[-]" : "[+]"}</span>
      </button>

      {expanded && (
        <div className="mt-0.5 bg-black/80 border border-orange-900/30 rounded-sm max-h-48 overflow-y-auto">
          {cities.map((city) => (
            <div key={city}>
              <div className="px-2.5 py-0.5 text-[8px] font-mono text-orange-600/50 tracking-widest border-b border-orange-900/15 bg-orange-900/10">
                {city.toUpperCase()} ({cameras.filter((c) => c.city === city).length})
              </div>
              {cameras
                .filter((c) => c.city === city)
                .slice(0, 15)
                .map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => {
                      flyTo(cam.longitude, cam.latitude, 2_000);
                      openCameraModal(cam);
                    }}
                    className="w-full text-left px-2.5 py-1 font-mono text-[9px] tracking-wide
                      text-orange-500/60 hover:text-orange-400 hover:bg-orange-900/15
                      border-b border-orange-900/15 last:border-b-0 cursor-pointer
                      transition-colors flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500/40 flex-shrink-0" />
                    <span className="truncate">{cam.name}</span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
