# WorldView OSS

## Critical: Tailwind CSS v4 + Next.js 16 Turbopack
- MUST have `postcss.config.mjs` with `@tailwindcss/postcss` plugin — without it, `@import "tailwindcss"` produces ZERO utility classes (no error, just silently broken)
- MUST pin `tailwindcss@4.0.7` and `@tailwindcss/postcss@4.0.7` — v4.1.18+ crashes Turbopack
- Next.js 16 is Turbopack-only (no `--no-turbopack` flag exists)
- If Tailwind classes aren't working, check postcss.config.mjs first

## Architecture
- 3-column flexbox layout: left panel (220px) | circular globe viewport | right panel (280px)
- Center column is `flex-col`: globe viewport on top, TimelineSlider below
- CesiumJS globe loaded via `next/dynamic` with `ssr: false` — Cesium cannot run server-side
- State: Zustand store at `stores/worldview-store.ts`
- View modes (EO/FLIR/CRT/NV): CSS filters in `components/effects/ViewModeFilter.tsx`
- SVG filter `<defs>` (e.g. FLIR) must be rendered outside `overflow:hidden` containers — use `FlirFilterDefs` export at page level
- Globe is clipped to circle via `.scope-viewport { border-radius: 50%; overflow: hidden }` in globals.css

## Timeline / Historical Data System
- **Timeline slider** beneath the globe viewport: `components/hud/TimelineSlider.tsx` + `CalendarPicker.tsx`
- **Simulation state** in Zustand: `simulationDate`, `simulationHour`, `simulationMinute`, `isLive`
  - Setters (`setSimulationDate`, `setSimulationTime`) sync CesiumJS clock via `Cesium.JulianDate.fromDate()`
  - `resetToLive()` snaps back to current time and resumes CesiumJS clock animation
- **TimelineSlider uses `mounted` state** to suppress hydration mismatch from `Date.now()` drift between SSR and client
- **Data hooks** (`useNews`, `useDisasters`) check `isLive`:
  - Live mode → `/api/news` (graph + RSS + Reddit), `/api/disasters`
  - Historical mode → `/api/news/historical?date=YYYYMMDD&hour=HH`, `/api/disasters?date=YYYYMMDD`
  - Both hooks use `AbortController` to cancel in-flight requests on cleanup
- **Flights, cameras, livestreams** are always live (no historical data available)

## JanusGraph + Cassandra (Knowledge Graph)
- `docker-compose.yml` — Cassandra 4.1.7 + JanusGraph 1.0.0 (ports configurable via env vars)
- `lib/graph/client.ts` — Gremlin client with **3s connection timeout** and **1min backoff** on failure
  - If JanusGraph isn't running, graph queries fail fast and don't retry for 60s — app still works with RSS/Reddit only
- `lib/graph/schema.ts` — Graph schema: article, person, organization, location, theme vertices + relationship edges
- `scripts/init-graph-schema.ts` — Idempotent schema init (`npm run init-schema`)
- `lib/graph/queries.ts` — Query functions: `getArticlesByDateRange`, `getArticlesByLocation`, `getPersonNetwork`, `getThemeTrends`
- `types/gremlin.d.ts` — TypeScript declarations for the `gremlin` package (no `@types/gremlin` available)
  - `Graph` lives in `gremlin.structure`, NOT `gremlin.driver`

## GDELT GKG Ingestion Pipeline
- `lib/graph/gkg-parser.ts` — Parses GDELT GKG 2.0 27-column TSV files (handles `\r\n` line endings)
- `lib/graph/gkg-downloader.ts` — Downloads + extracts ZIP archives via `adm-zip` (NOT gzip — GDELT uses standard ZIP format)
- `lib/graph/gkg-loader.ts` — Batch upserts into JanusGraph with get-or-create (upsert) pattern
- `scripts/ingest-gkg.ts` — CLI: `--daily`, `--latest`, `--backfill --from YYYYMMDD --to YYYYMMDD`
- GDELT URLs use HTTPS (configured in `lib/constants.ts`)
- Cache/cursor paths configurable via `GKG_CACHE_DIR` and `GKG_CURSOR_PATH` env vars

## News Data Flow (NO external GDELT Doc API)
- `/api/news` — Primary endpoint: JanusGraph (last 4h) + RSS + Reddit. **Does NOT call GDELT Doc API** (removed due to chronic timeouts)
- `/api/news/realtime` — Same sources as `/api/news`, plus DDG as supplemental (often rate-limited)
- `/api/news/historical` — JanusGraph only, queries ±30min window around requested time
- `lib/api/duckduckgo.ts` — DDG results have `NaN` lat/lon (no geo data); callers must filter accordingly

## Shared Constants
- `lib/constants.ts` — All configurable values: polling intervals, cache TTLs, GDELT URLs, entity caps, query defaults, dedup thresholds
- When adding new configurable values, add them here instead of using inline magic numbers

## Commands
- `npm run dev` — starts dev server (check output for actual port, often not 3000)
- `npm run build` — production build, use to verify compilation
- `npm run init-schema` — initialize JanusGraph schema (requires `docker compose up -d`)
- `npm run ingest-gkg` — daily GKG ingestion (last 24h or since cursor)
- `npm run ingest-gkg-backfill` — historical backfill (add `-- --from YYYYMMDD --to YYYYMMDD`)
- If dev server won't start: `rm -rf .next` to clear cache and stale lock files

## CCTV Camera Feeds
- Camera data: `lib/api/cameras.ts` — aggregates 3,000+ cameras from 10+ cities via live APIs
- Two reusable generic fetchers:
  - `fetchArcGISCameras()` — for ArcGIS FeatureServer endpoints (WSDOT, IDOT/Travel Midwest)
  - `fetchIteris511Cameras()` — for Iteris 511 DataTables endpoints (NV Roads, FL511)
- City sources: Caltrans (CA), Austin, Houston TranStar, WSDOT (Seattle), IDOT (Chicago), NV Roads (Las Vegas), FL511 (Orlando), NYC DOT, UK Highways, HK Transport
- Houston TranStar is the only hardcoded fallback (no JSON API, only HTML scraping)
- Images proxied through `/api/cameras/feed?id={id}` to avoid CORS — never load external camera URLs directly in `<img>` tags
- Feed proxy passes through actual Content-Type (some sources return PNG, not JPEG)
- Detection overlay (canvas) should only render when the feed image has loaded (`onLoad` → `imgLoaded` state)

## CCTV Clustering (3-tier progressive rendering)
- `lib/camera-clusters.ts` — `buildCityClusters()` groups by city, merges within 80km (Caltrans granular `nearbyPlace` → super-clusters)
- Three tiers by altitude in `components/layers/CameraLayer.tsx`:
  - **GLOBAL** (>2,000km): One cluster dot per city with count label (~25-35 entities)
  - **REGIONAL** (200km–2,000km): Individual camera dots for cities in viewport only
  - **LOCAL** (<200km): Camera dots + feed preview billboards with 60s refresh
- Entities are lazily created/destroyed per viewport — not all 3,000+ at once
- Cluster click → `flyTo(center, 500km)` → seamless tier transition
- Shared camera state in Zustand store (`cameras` / `setCameras`) — CameraLayer fetches, CameraList reads

## Adding New CCTV City Sources

Most US state DOTs use one of two platforms. Check which one before writing any code:

**1. ArcGIS FeatureServer** (used by WSDOT, IDOT, many others)
- Browse `https://services2.arcgis.com/` or the state DOT's GIS portal for a traffic cameras layer
- Test the query endpoint in a browser — append `?where=1=1&outFields=*&f=json&outSR=4326&returnGeometry=true&resultRecordCount=5`
- Identify the field names for camera title and snapshot URL (varies per DOT)
- Add a wrapper that calls `fetchArcGISCameras()` with the endpoint URL, a bounding box, and the field names:
```ts
async function fetchDenverCameras(): Promise<Camera[]> {
  return fetchArcGISCameras({
    url: "https://example.arcgis.com/.../FeatureServer/0/query",
    bbox: [-105.1, 39.6, -104.8, 39.9], // [minLon, minLat, maxLon, maxLat]
    idPrefix: "den",
    city: "Denver",
    nameField: "CameraName",   // inspect the JSON to find these
    imageField: "SnapshotURL",
    limit: 500,
  });
}
```

**2. Iteris 511 platform** (used by NV Roads, FL511, many state 511 sites)
- If the state's 511 site URL looks like `xx511.com` or `xxroads.com`, it's likely Iteris
- Test: `https://{domain}/List/GetData/Cameras?query={"start":0,"length":5,"search":{"value":""}}&lang=en-US`
- Add a wrapper that calls `fetchIteris511Cameras()` with the base URL and a search term (city name, county, or region):
```ts
async function fetchPhoenixCameras(): Promise<Camera[]> {
  return fetchIteris511Cameras({
    baseUrl: "https://az511.com",
    searchTerm: "Maricopa",  // county name works well for filtering
    idPrefix: "phx",
    city: "Phoenix",
    limit: 200,
  });
}
```

**3. Custom API** (Caltrans, Austin Socrata, etc.)
- Write a dedicated fetcher following the existing patterns in `lib/api/cameras.ts`
- Must return `Camera[]` with valid lat/lon and a direct image URL (JPEG or PNG)

**After adding the fetcher:**
1. Add it to the `Promise.all` in `getAllCameras()` and spread into `allCameras`
2. Run `npm run build` — zero errors
3. The clustering system handles everything else automatically (no changes to CameraLayer needed)

## Code Style
- Green-on-black HUD/military aesthetic — use `#000a00` bg, `#00ff41` / green-400/500 text
- Custom CSS classes in `globals.css` (`.panel-section`, `.panel-label`, `.scope-*`, `.hud-glow`, `.timeline-*`, `.calendar-*`) alongside Tailwind utilities
- Font: monospace throughout (`font-mono`)
- Text sizes: 8-11px for HUD elements, tracking-wide/wider
