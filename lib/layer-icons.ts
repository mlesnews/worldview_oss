/**
 * Canvas-drawn icons for globe data layers (32x32, cached as data URLs).
 * Follows the same pattern as lib/military-icons.ts.
 */

const ICON_SIZE = 32;

export type LayerIconType =
  | "airplane"
  | "iss"
  | "satellite"
  | "wildfire"
  | "flood"
  | "storm"
  | "volcano"
  | "ice"
  | "earthquake"
  | "asteroid"
  | "news";

// ---------- Canvas helpers ----------

function createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return [c, ctx];
}

// ---------- Icon drawers (all 32x32) ----------

function drawAirplane(ctx: CanvasRenderingContext2D, color: string) {
  const cx = 16, cy = 16;
  ctx.save();
  ctx.fillStyle = color;
  // Top-down civilian aircraft silhouette (nose pointing up)
  // Fuselage
  ctx.beginPath();
  ctx.moveTo(cx, cy - 13);
  ctx.lineTo(cx + 2, cy - 8);
  ctx.lineTo(cx + 2, cy + 9);
  ctx.lineTo(cx, cy + 13);
  ctx.lineTo(cx - 2, cy + 9);
  ctx.lineTo(cx - 2, cy - 8);
  ctx.closePath();
  ctx.fill();
  // Left wing (swept)
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy - 1);
  ctx.lineTo(cx - 14, cy + 4);
  ctx.lineTo(cx - 12, cy + 6);
  ctx.lineTo(cx - 2, cy + 3);
  ctx.closePath();
  ctx.fill();
  // Right wing (swept)
  ctx.beginPath();
  ctx.moveTo(cx + 2, cy - 1);
  ctx.lineTo(cx + 14, cy + 4);
  ctx.lineTo(cx + 12, cy + 6);
  ctx.lineTo(cx + 2, cy + 3);
  ctx.closePath();
  ctx.fill();
  // Left tail fin
  ctx.beginPath();
  ctx.moveTo(cx - 1, cy + 9);
  ctx.lineTo(cx - 5, cy + 13);
  ctx.lineTo(cx - 4, cy + 11);
  ctx.lineTo(cx - 1, cy + 8);
  ctx.closePath();
  ctx.fill();
  // Right tail fin
  ctx.beginPath();
  ctx.moveTo(cx + 1, cy + 9);
  ctx.lineTo(cx + 5, cy + 13);
  ctx.lineTo(cx + 4, cy + 11);
  ctx.lineTo(cx + 1, cy + 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawISS(ctx: CanvasRenderingContext2D, color: string) {
  const cx = 16, cy = 16;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  // Central module (body)
  ctx.fillRect(cx - 3, cy - 2, 6, 4);
  // Left solar panel array
  ctx.strokeRect(cx - 14, cy - 5, 9, 3);
  ctx.strokeRect(cx - 14, cy + 2, 9, 3);
  // Right solar panel array
  ctx.strokeRect(cx + 5, cy - 5, 9, 3);
  ctx.strokeRect(cx + 5, cy + 2, 9, 3);
  // Truss (horizontal beam connecting panels)
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy);
  ctx.lineTo(cx + 14, cy);
  ctx.stroke();
  // Panel lines (solar cell divisions)
  for (let i = 1; i < 3; i++) {
    const x1 = cx - 14 + i * 3;
    ctx.beginPath();
    ctx.moveTo(x1, cy - 5);
    ctx.lineTo(x1, cy - 2);
    ctx.moveTo(x1, cy + 2);
    ctx.lineTo(x1, cy + 5);
    ctx.stroke();
    const x2 = cx + 5 + i * 3;
    ctx.beginPath();
    ctx.moveTo(x2, cy - 5);
    ctx.lineTo(x2, cy - 2);
    ctx.moveTo(x2, cy + 2);
    ctx.lineTo(x2, cy + 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSatellite(ctx: CanvasRenderingContext2D, color: string) {
  const cx = 16, cy = 16;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  // Rectangular body
  ctx.fillRect(cx - 3, cy - 4, 6, 8);
  // Left solar panel wing
  ctx.strokeRect(cx - 13, cy - 3, 9, 6);
  // Right solar panel wing
  ctx.strokeRect(cx + 4, cy - 3, 9, 6);
  // Panel divider lines
  ctx.lineWidth = 0.8;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 13 + i * 3, cy - 3);
    ctx.lineTo(cx - 13 + i * 3, cy + 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 4 + i * 3, cy - 3);
    ctx.lineTo(cx + 4 + i * 3, cy + 3);
    ctx.stroke();
  }
  // Dish antenna on top
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 4);
  ctx.lineTo(cx, cy - 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy - 9, 3, Math.PI, 2 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawWildfire(ctx: CanvasRenderingContext2D, color: string) {
  const cx = 16, cy = 16;
  ctx.save();
  ctx.fillStyle = color;
  // Flame shape
  ctx.beginPath();
  ctx.moveTo(cx, cy - 13);
  ctx.bezierCurveTo(cx + 2, cy - 8, cx + 8, cy - 6, cx + 7, cy + 2);
  ctx.bezierCurveTo(cx + 6, cy + 8, cx + 4, cy + 11, cx, cy + 12);
  ctx.bezierCurveTo(cx - 4, cy + 11, cx - 6, cy + 8, cx - 7, cy + 2);
  ctx.bezierCurveTo(cx - 8, cy - 6, cx - 2, cy - 8, cx, cy - 13);
  ctx.closePath();
  ctx.fill();
  // Inner flame (brighter)
  ctx.fillStyle = "#ffaa00";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 6);
  ctx.bezierCurveTo(cx + 1, cy - 3, cx + 4, cy - 1, cx + 3, cy + 4);
  ctx.bezierCurveTo(cx + 2, cy + 7, cx + 1, cy + 9, cx, cy + 10);
  ctx.bezierCurveTo(cx - 1, cy + 9, cx - 2, cy + 7, cx - 3, cy + 4);
  ctx.bezierCurveTo(cx - 4, cy - 1, cx - 1, cy - 3, cx, cy - 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFlood(ctx: CanvasRenderingContext2D, color: string) {
  const cx = 16;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  // Three wave crests
  for (let row = 0; row < 3; row++) {
    const y = 8 + row * 7;
    ctx.globalAlpha = 1 - row * 0.25;
    ctx.beginPath();
    ctx.moveTo(cx - 12, y);
    ctx.quadraticCurveTo(cx - 8, y - 5, cx - 4, y);
    ctx.quadraticCurveTo(cx, y + 5, cx + 4, y);
    ctx.quadraticCurveTo(cx + 8, y - 5, cx + 12, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStorm(ctx: CanvasRenderingContext2D, color: string) {
  const cx = 16, cy = 16;
  ctx.save();
  ctx.fillStyle = color;
  // Lightning bolt
  ctx.beginPath();
  ctx.moveTo(cx + 2, cy - 14);
  ctx.lineTo(cx - 4, cy - 1);
  ctx.lineTo(cx, cy - 1);
  ctx.lineTo(cx - 3, cy + 14);
  ctx.lineTo(cx + 5, cy + 1);
  ctx.lineTo(cx + 1, cy + 1);
  ctx.lineTo(cx + 6, cy - 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawVolcano(ctx: CanvasRenderingContext2D, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  // Mountain base
  ctx.beginPath();
  ctx.moveTo(2, 28);
  ctx.lineTo(12, 8);
  ctx.lineTo(16, 10);
  ctx.lineTo(20, 8);
  ctx.lineTo(30, 28);
  ctx.closePath();
  ctx.fill();
  // Eruption plume
  ctx.fillStyle = "#ffaa00";
  ctx.beginPath();
  ctx.moveTo(13, 10);
  ctx.lineTo(16, 2);
  ctx.lineTo(19, 10);
  ctx.closePath();
  ctx.fill();
  // Lava streaks
  ctx.strokeStyle = "#ffaa00";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(14, 10);
  ctx.lineTo(12, 16);
  ctx.moveTo(18, 10);
  ctx.lineTo(20, 16);
  ctx.stroke();
  ctx.restore();
}

function drawIce(ctx: CanvasRenderingContext2D, color: string) {
  const cx = 16, cy = 16;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  // Snowflake: 6 spokes with small branches
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const ex = cx + Math.cos(angle) * 11;
    const ey = cy + Math.sin(angle) * 11;
    ctx.lineTo(ex, ey);
    ctx.stroke();
    // Branch at 60% length
    const bx = cx + Math.cos(angle) * 7;
    const by = cy + Math.sin(angle) * 7;
    for (const dir of [-1, 1]) {
      const ba = angle + (dir * 45 * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(ba) * 3.5, by + Math.sin(ba) * 3.5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawEarthquake(ctx: CanvasRenderingContext2D, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Seismograph zigzag line
  ctx.beginPath();
  ctx.moveTo(2, 16);
  ctx.lineTo(6, 16);
  ctx.lineTo(8, 12);
  ctx.lineTo(10, 20);
  ctx.lineTo(12, 6);
  ctx.lineTo(14, 26);
  ctx.lineTo(16, 4);
  ctx.lineTo(18, 28);
  ctx.lineTo(20, 10);
  ctx.lineTo(22, 20);
  ctx.lineTo(24, 14);
  ctx.lineTo(26, 16);
  ctx.lineTo(30, 16);
  ctx.stroke();
  ctx.restore();
}

function drawAsteroid(ctx: CanvasRenderingContext2D, color: string) {
  const cx = 16, cy = 16;
  ctx.save();
  ctx.fillStyle = color;
  // Irregular rock shape
  ctx.beginPath();
  ctx.moveTo(cx + 2, cy - 9);
  ctx.lineTo(cx + 8, cy - 6);
  ctx.lineTo(cx + 10, cy - 1);
  ctx.lineTo(cx + 8, cy + 5);
  ctx.lineTo(cx + 4, cy + 8);
  ctx.lineTo(cx - 2, cy + 9);
  ctx.lineTo(cx - 7, cy + 5);
  ctx.lineTo(cx - 9, cy);
  ctx.lineTo(cx - 7, cy - 5);
  ctx.lineTo(cx - 3, cy - 8);
  ctx.closePath();
  ctx.fill();
  // Crater detail
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx + 2, cy - 2, 2.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - 3, cy + 3, 1.8, 0, Math.PI * 2);
  ctx.stroke();
  // Trail (motion line)
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy - 6);
  ctx.lineTo(cx - 14, cy - 10);
  ctx.stroke();
  ctx.restore();
}

function drawNews(ctx: CanvasRenderingContext2D, color: string) {
  const cx = 16, cy = 16;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  // Antenna mast
  ctx.beginPath();
  ctx.moveTo(cx, cy + 12);
  ctx.lineTo(cx, cy - 2);
  ctx.stroke();
  // Antenna tip
  ctx.beginPath();
  ctx.arc(cx, cy - 3, 2, 0, Math.PI * 2);
  ctx.fill();
  // Signal arcs (3 concentric)
  ctx.lineWidth = 1.5;
  for (let i = 1; i <= 3; i++) {
    ctx.globalAlpha = 1 - i * 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy - 3, 3 + i * 3, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - 3, 3 + i * 3, Math.PI * 0.25, Math.PI * 0.75);
    ctx.stroke();
  }
  // Base
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy + 12);
  ctx.lineTo(cx + 5, cy + 12);
  ctx.stroke();
  ctx.restore();
}

// ---------- Drawer map ----------

const ICON_DRAWERS: Record<LayerIconType, (ctx: CanvasRenderingContext2D, color: string) => void> = {
  airplane: drawAirplane,
  iss: drawISS,
  satellite: drawSatellite,
  wildfire: drawWildfire,
  flood: drawFlood,
  storm: drawStorm,
  volcano: drawVolcano,
  ice: drawIce,
  earthquake: drawEarthquake,
  asteroid: drawAsteroid,
  news: drawNews,
};

// ---------- Icon cache ----------

const iconCache = new Map<string, string>();

/** Get a data URL for the layer icon (32x32, cached). Cache key is `${type}-${color}`. */
export function getLayerIcon(type: LayerIconType, color: string): string {
  const key = `${type}-${color}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(ICON_SIZE, ICON_SIZE);
  ICON_DRAWERS[type](ctx, color);

  const url = canvas.toDataURL("image/png");
  iconCache.set(key, url);
  return url;
}
