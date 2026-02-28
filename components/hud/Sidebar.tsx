"use client";

import { useWorldViewStore } from "@/stores/worldview-store";
import type { LayerKey } from "@/types";

interface LayerOption {
  key: LayerKey;
  label: string;
  icon: string;
}

const LAYERS: LayerOption[] = [
  { key: "flights", label: "ISS Flights", icon: "\u2708" },
  { key: "earthquakes", label: "Earthquakes", icon: "\u25C9" },
  { key: "asteroids", label: "Asteroids", icon: "\u2604" },
  { key: "satellites", label: "Space Traffic", icon: "\u25CE" },
  { key: "weather", label: "Weather Radar", icon: "\u2601" },
  { key: "cameras", label: "CCTV Mesh", icon: "\uD83D\uDCF9" },
];

export default function Sidebar() {
  const layers = useWorldViewStore((s) => s.layers);
  const toggleLayer = useWorldViewStore((s) => s.toggleLayer);

  return (
    <div className="panel-section">
      <div className="panel-label">LAYERS</div>
      <div className="flex flex-col gap-1">
        {LAYERS.map((layer) => {
          const active = layers[layer.key];
          return (
            <button
              key={layer.key}
              onClick={() => toggleLayer(layer.key)}
              className={`
                flex items-center gap-2 px-2.5 py-1.5 rounded-sm font-mono text-[10px] tracking-wide
                border transition-all duration-200 cursor-pointer
                ${
                  active
                    ? "bg-green-900/30 border-green-500/50 text-green-400 shadow-[0_0_8px_rgba(0,255,0,0.15)]"
                    : "bg-black/40 border-green-900/30 text-green-700/50 hover:border-green-700/50 hover:text-green-600/70"
                }
              `}
            >
              <span className="text-xs w-4 text-center">{layer.icon}</span>
              <span>{layer.label}</span>
              <span
                className={`ml-auto w-1.5 h-1.5 rounded-full ${
                  active ? "bg-green-400 shadow-[0_0_4px_rgba(0,255,0,0.5)]" : "bg-green-900/30"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
