# WorldView OSS

## Critical: Tailwind CSS v4 + Next.js 16 Turbopack
- MUST have `postcss.config.mjs` with `@tailwindcss/postcss` plugin — without it, `@import "tailwindcss"` produces ZERO utility classes (no error, just silently broken)
- MUST pin `tailwindcss@4.0.7` and `@tailwindcss/postcss@4.0.7` — v4.1.18+ crashes Turbopack
- Next.js 16 is Turbopack-only (no `--no-turbopack` flag exists)
- If Tailwind classes aren't working, check postcss.config.mjs first

## Architecture
- 3-column flexbox layout: left panel (220px) | circular globe viewport | right panel (280px)
- CesiumJS globe loaded via `next/dynamic` with `ssr: false` — Cesium cannot run server-side
- State: Zustand store at `stores/worldview-store.ts`
- View modes (EO/FLIR/CRT/NV): CSS filters in `components/effects/ViewModeFilter.tsx`
- SVG filter `<defs>` (e.g. FLIR) must be rendered outside `overflow:hidden` containers — use `FlirFilterDefs` export at page level
- Globe is clipped to circle via `.scope-viewport { border-radius: 50%; overflow: hidden }` in globals.css

## Commands
- `npm run dev` — starts dev server (check output for actual port, often not 3000)
- `npm run build` — production build, use to verify compilation
- If dev server won't start: `rm -rf .next` to clear cache and stale lock files

## CCTV Camera Feeds
- Camera data: `lib/api/cameras.ts` — uses City of Austin Mobility CCTV (`cctv.austinmobility.io/image/{id}.jpg`)
- Images proxied through `/api/cameras/feed?id={id}` to avoid CORS — never load external camera URLs directly in `<img>` tags
- Detection overlay (canvas) should only render when the feed image has loaded (`onLoad` → `imgLoaded` state)
- Data source API: `https://data.austintexas.gov/resource/b4k4-adkb.json` (public, no auth)

## Code Style
- Green-on-black HUD/military aesthetic — use `#000a00` bg, `#00ff41` / green-400/500 text
- Custom CSS classes in `globals.css` (`.panel-section`, `.panel-label`, `.scope-*`, `.hud-glow`) alongside Tailwind utilities
- Font: monospace throughout (`font-mono`)
- Text sizes: 8-11px for HUD elements, tracking-wide/wider
