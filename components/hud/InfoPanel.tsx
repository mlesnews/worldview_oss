"use client";

import { useWorldViewStore } from "@/stores/worldview-store";
import { toDMS, formatAlt, toGridRef } from "@/lib/utils";
import Clock from "./Clock";

const VIEW_MODE_LABELS: Record<string, string> = {
  eo: "ELECTRO-OPTICAL",
  flir: "FLIR THERMAL",
  nightvision: "NIGHT VISION",
  crt: "CRT DISPLAY",
};

export default function InfoPanel() {
  const cursorPosition = useWorldViewStore((s) => s.cursorPosition);
  const selectedEntity = useWorldViewStore((s) => s.selectedEntity);
  const viewMode = useWorldViewStore((s) => s.viewMode);

  return (
    <div className="font-mono flex flex-col">
      {/* View Mode + Clock */}
      <div className="panel-section">
        <span className="text-xs font-bold tracking-[0.2em] text-green-400 hud-glow block">
          {VIEW_MODE_LABELS[viewMode]}
        </span>
        <Clock />
        <div className="text-[8px] text-green-600/50 tracking-wider mt-1">
          Washington DC
        </div>
      </div>

      {/* Coordinate Readout */}
      <div className="panel-section">
        <div className="panel-label">POSITION DATA</div>

        {cursorPosition ? (
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[9px] text-green-700/50">GRD</span>
              <span className="text-[10px] text-green-400/80">
                {toGridRef(cursorPosition.lat, cursorPosition.lon)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] text-green-700/50">LAT</span>
              <span className="text-[10px] text-green-400/80">
                {toDMS(cursorPosition.lat, true)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] text-green-700/50">LON</span>
              <span className="text-[10px] text-green-400/80">
                {toDMS(cursorPosition.lon, false)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] text-green-700/50">ALT</span>
              <span className="text-[10px] text-green-400/80">
                {formatAlt(cursorPosition.alt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] text-green-700/50">ESD</span>
              <span className="text-[10px] text-green-400/80">
                {(cursorPosition.lat * 111.32).toFixed(1)}KM W{Math.abs(cursorPosition.lon * 111.32 * Math.cos(cursorPosition.lat * Math.PI / 180)).toFixed(1)}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-green-800/30 text-center py-2">
            AWAITING INPUT
          </div>
        )}
      </div>

      {/* Selected Entity Info */}
      {selectedEntity && (
        <div className="panel-section">
          <div className="panel-label">
            TARGET: {selectedEntity.type.toUpperCase()}
          </div>
          <div className="text-[11px] text-green-400 mb-1 font-bold">
            {selectedEntity.name}
          </div>
          <div className="space-y-1">
            {Object.entries(selectedEntity.details).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-[9px] text-green-700/50 uppercase">
                  {key}
                </span>
                <span className="text-[10px] text-green-400/80">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
