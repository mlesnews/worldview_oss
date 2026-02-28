"use client";

export default function ScopeOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Crosshair lines */}
        {/* Horizontal */}
        <line
          x1="0" y1="50" x2="42" y2="50"
          stroke="rgba(0,255,65,0.2)" strokeWidth="0.15"
        />
        <line
          x1="58" y1="50" x2="100" y2="50"
          stroke="rgba(0,255,65,0.2)" strokeWidth="0.15"
        />
        {/* Vertical */}
        <line
          x1="50" y1="0" x2="50" y2="42"
          stroke="rgba(0,255,65,0.2)" strokeWidth="0.15"
        />
        <line
          x1="50" y1="58" x2="50" y2="100"
          stroke="rgba(0,255,65,0.2)" strokeWidth="0.15"
        />

        {/* Center dot */}
        <circle
          cx="50" cy="50" r="0.5"
          fill="rgba(0,255,65,0.4)"
        />

        {/* Inner crosshair ticks */}
        <line x1="47" y1="50" x2="49" y2="50" stroke="rgba(0,255,65,0.35)" strokeWidth="0.2" />
        <line x1="51" y1="50" x2="53" y2="50" stroke="rgba(0,255,65,0.35)" strokeWidth="0.2" />
        <line x1="50" y1="47" x2="50" y2="49" stroke="rgba(0,255,65,0.35)" strokeWidth="0.2" />
        <line x1="50" y1="51" x2="50" y2="53" stroke="rgba(0,255,65,0.35)" strokeWidth="0.2" />

        {/* Compass labels */}
        <text x="50" y="7" textAnchor="middle" fill="rgba(0,255,65,0.3)" fontSize="2.5" fontFamily="monospace">N</text>
        <text x="50" y="96" textAnchor="middle" fill="rgba(0,255,65,0.3)" fontSize="2.5" fontFamily="monospace">S</text>
        <text x="5" y="50.8" textAnchor="middle" fill="rgba(0,255,65,0.3)" fontSize="2.5" fontFamily="monospace">W</text>
        <text x="95" y="50.8" textAnchor="middle" fill="rgba(0,255,65,0.3)" fontSize="2.5" fontFamily="monospace">E</text>

        {/* Outer compass tick marks (at cardinal & ordinal positions) */}
        {/* N */}
        <line x1="50" y1="4" x2="50" y2="6.5" stroke="rgba(0,255,65,0.25)" strokeWidth="0.2" />
        {/* S */}
        <line x1="50" y1="93.5" x2="50" y2="96" stroke="rgba(0,255,65,0.25)" strokeWidth="0.2" />
        {/* E */}
        <line x1="93.5" y1="50" x2="96" y2="50" stroke="rgba(0,255,65,0.25)" strokeWidth="0.2" />
        {/* W */}
        <line x1="4" y1="50" x2="6.5" y2="50" stroke="rgba(0,255,65,0.25)" strokeWidth="0.2" />

        {/* NE */}
        <line x1="81.5" y1="18.5" x2="83" y2="17" stroke="rgba(0,255,65,0.15)" strokeWidth="0.15" />
        {/* NW */}
        <line x1="17" y1="17" x2="18.5" y2="18.5" stroke="rgba(0,255,65,0.15)" strokeWidth="0.15" />
        {/* SE */}
        <line x1="81.5" y1="81.5" x2="83" y2="83" stroke="rgba(0,255,65,0.15)" strokeWidth="0.15" />
        {/* SW */}
        <line x1="17" y1="83" x2="18.5" y2="81.5" stroke="rgba(0,255,65,0.15)" strokeWidth="0.15" />

        {/* Range rings */}
        <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(0,255,65,0.06)" strokeWidth="0.15" strokeDasharray="1 2" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(0,255,65,0.06)" strokeWidth="0.15" strokeDasharray="1 2" />

        {/* Vignette (radial gradient inside circle) */}
        <defs>
          <radialGradient id="scope-vignette">
            <stop offset="60%" stopColor="transparent" />
            <stop offset="85%" stopColor="rgba(0,0,0,0.15)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#scope-vignette)" />
      </svg>
    </div>
  );
}
