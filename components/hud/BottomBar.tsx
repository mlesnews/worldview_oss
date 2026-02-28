"use client";

import { useWorldViewStore } from "@/stores/worldview-store";
import type { ViewMode } from "@/types";

const VIEW_MODES: { key: ViewMode; label: string }[] = [
  { key: "eo", label: "EO" },
  { key: "flir", label: "FLIR" },
  { key: "crt", label: "CRT" },
  { key: "nightvision", label: "NV" },
];

export default function BottomBar() {
  const viewMode = useWorldViewStore((s) => s.viewMode);
  const setViewMode = useWorldViewStore((s) => s.setViewMode);
  const layers = useWorldViewStore((s) => s.layers);

  const activeCount = Object.values(layers).filter(Boolean).length;

  return (
    <div className="panel-section border-t border-green-900/20 flex-shrink-0">
      {/* View Mode Selector */}
      <div className="panel-label">RENDER MODE</div>
      <div className="grid grid-cols-4 gap-0.5 mb-3">
        {VIEW_MODES.map((mode) => (
          <button
            key={mode.key}
            onClick={() => setViewMode(mode.key)}
            className={`
              px-1.5 py-1 font-mono text-[10px] tracking-wider border cursor-pointer
              transition-all duration-150 text-center
              ${
                viewMode === mode.key
                  ? "bg-green-900/40 border-green-500/60 text-green-400 shadow-[0_0_8px_rgba(0,255,0,0.15)]"
                  : "bg-black/40 border-green-900/20 text-green-700/40 hover:text-green-500/60 hover:border-green-800/40"
              }
            `}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(0,255,0,0.6)] animate-pulse" />
        <span className="text-[9px] font-mono text-green-500/80 tracking-wider">
          ONLINE
        </span>
        <span className="text-[9px] font-mono text-green-700/40 mx-0.5">|</span>
        <span className="text-[9px] font-mono text-green-600/50">
          {activeCount} LAYER{activeCount !== 1 ? "S" : ""}
        </span>
      </div>
    </div>
  );
}
