"use client";

import { useWorldViewStore } from "@/stores/worldview-store";

/** SVG filter definitions - render outside overflow:hidden containers */
export function FlirFilterDefs() {
  return (
    <svg className="absolute w-0 h-0" aria-hidden>
      <defs>
        <filter id="flir-filter">
          <feColorMatrix
            type="matrix"
            values="0.3 0.3 0.3 0 0
                    0.1 0.1 0.1 0 0
                    0.8 0.8 0.8 0 0
                    0   0   0   1 0"
          />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0 0 0.2 0.5 0.8 1 1" />
            <feFuncG type="table" tableValues="0 0 0.1 0.2 0.4 0.6 0.2" />
            <feFuncB type="table" tableValues="0.5 0.4 0.3 0.2 0.1 0 0" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}

export default function ViewModeFilter() {
  const viewMode = useWorldViewStore((s) => s.viewMode);

  if (viewMode === "eo") return null;

  return (
    <>
      {/* Main filter overlay - within circular scope */}
      <div
        className={`absolute inset-0 z-[1] pointer-events-none transition-opacity duration-500 ${
          viewMode === "nightvision" ? "view-nightvision" : ""
        } ${viewMode === "flir" ? "view-flir" : ""} ${
          viewMode === "crt" ? "view-crt" : ""
        } ${viewMode === "trading" ? "view-trading" : ""}`}
      />

      {/* CRT scanlines */}
      {viewMode === "crt" && (
        <div className="absolute inset-0 z-[2] pointer-events-none crt-scanlines" />
      )}

      {/* Night vision grain */}
      {viewMode === "nightvision" && (
        <div className="absolute inset-0 z-[2] pointer-events-none nv-grain" />
      )}

      {/* Vignette for all non-EO modes */}
      <div className="absolute inset-0 z-[3] pointer-events-none vignette" />
    </>
  );
}
