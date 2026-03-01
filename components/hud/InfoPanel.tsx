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
  const openMediaModal = useWorldViewStore((s) => s.openMediaModal);

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
            {Object.entries(selectedEntity.details).map(([key, value]) => {
              // Don't display URL as plain text — we'll show it as a link below
              if (key === "URL") return null;
              if (key === "VideoID") return null;
              return (
                <div key={key} className="flex justify-between">
                  <span className="text-[9px] text-green-700/50 uppercase">
                    {key}
                  </span>
                  <span className="text-[10px] text-green-400/80">{value}</span>
                </div>
              );
            })}
          </div>

          {/* News article link */}
          {selectedEntity.type === "news" && selectedEntity.details.URL && (
            <a
              href={String(selectedEntity.details.URL)}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 px-2 py-1 text-[10px] font-mono tracking-wider text-center
                border border-amber-600/50 text-amber-400 hover:bg-amber-900/20
                hover:border-amber-500/70 transition-all cursor-pointer rounded-sm"
            >
              [OPEN ARTICLE]
            </a>
          )}

          {/* Live stream watch button */}
          {selectedEntity.type === "livestream" && selectedEntity.details.VideoID && (
            <button
              onClick={() =>
                openMediaModal(
                  String(selectedEntity.details.VideoID),
                  selectedEntity.name
                )
              }
              className="w-full mt-2 px-2 py-1 text-[10px] font-mono tracking-wider text-center
                border border-red-600/50 text-red-400 hover:bg-red-900/20
                hover:border-red-500/70 transition-all cursor-pointer rounded-sm"
            >
              [WATCH LIVE]
            </button>
          )}

          {/* Disaster source link */}
          {selectedEntity.type === "disaster" && selectedEntity.details.Link && (
            <a
              href={String(selectedEntity.details.Link)}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 px-2 py-1 text-[10px] font-mono tracking-wider text-center
                border border-green-600/50 text-green-400 hover:bg-green-900/20
                hover:border-green-500/70 transition-all cursor-pointer rounded-sm"
            >
              [VIEW SOURCE]
            </a>
          )}
        </div>
      )}
    </div>
  );
}
