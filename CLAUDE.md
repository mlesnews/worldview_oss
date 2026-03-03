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
- **9 data layers**: flights, satellites, disasters, asteroids, weather, cameras, livestreams, news, militaryActions
  - 3 expandable with sub-filters: flights (Regular/ISS), disasters (6 types), militaryActions (5 types)
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
- **Flights, cameras, livestreams, militaryActions** are always live (no historical data available)

## JanusGraph + Cassandra (Knowledge Graph)
- `docker-compose.yml` — Cassandra 4.1.7 + JanusGraph 1.0.0 (ports configurable via env vars)
  - JanusGraph 1.0.0 requires `JANUS_PROPS_TEMPLATE=cql` (NOT `cassandra`)
- `lib/graph/client.ts` — Gremlin client with **3s connection timeout** and **1min backoff** on failure
  - Uses `mimeType: "application/vnd.gremlin-v3.0+json"` (GraphSON) — GraphBinary fails with JanusGraph custom types
  - Uses `gremlin.process.traversal().with_(conn)` (v3.8 API) — NOT `graph.traversal().withRemote(conn)` (v3.6)
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
- RSS feeds: BBC Middle East, BBC World, Al Jazeera, Jerusalem Post, France 24 ME, PressTV Iran
  - Tehran Times removed (307 redirect loop), replaced with PressTV
  - Arab News removed (Cloudflare blocked), replaced with France 24 Middle East

## Military Actions Layer
- `/api/military` — GDELT GEO API with `theme:MILITARY` + conflict keyword queries
- `hooks/useMilitary.ts` — Polls every 5 min, stores in Zustand `militaryActions`
- `components/layers/MilitaryLayer.tsx` — Red/orange dots on globe, click for details
- Sub-filters in sidebar: Airstrikes, Missile Strikes, Ground Ops, Naval Ops, Other
- GDELT GEO API returns geocoded locations with mention counts, no auth required
- Category classification uses keyword matching on article titles

## Agent Swarm System (Ollama)
- `lib/agents/` — Agent swarm infrastructure for AI-powered intelligence gathering
- `lib/agents/ollama-client.ts` — Ollama connection with 3s timeout, 1min backoff (same pattern as JanusGraph)
- `lib/agents/agents.ts` — Agent definitions: News Scout, Military Analyst, Disaster Monitor, GEOINT Analyst
- `lib/agents/swarm.ts` — Legacy orchestrator (runs all agents sequentially with big context)
- `/api/agents` — GET for status, POST `{ "action": "run" }` to trigger legacy swarm
- Preferred models: `sam860/lfm2:8b` (5.9GB, fits 12GB VRAM) > `lfm2:24b` > `lfm2:24b-a2b`
  - **Ollama stores model names lowercase** — `sam860/lfm2:8b` not `sam860/LFM2:8b`
  - **Avoid qwen3 on CPU** — thinking mode makes even tiny prompts take 60s+
  - **Avoid `qwen3.5:27b` for tool calling** — broken renderer in Ollama (issue #14493)
- Graceful degradation: app works fully without Ollama, agents just return empty results

## Mission Control (Micro-Agent Pipeline)
- Full-viewport modal (`components/mission-control/`) for geographic agent deployment
- **Pipeline**: Pin-drop → web search → micro-agent LLM extraction → streaming results
- `lib/agents/mission.ts` — Mission executor with pause/resume/cancel per agent
- `lib/agents/micro-agents.ts` — Per-item LLM extraction (~400 char input, 128 token output, 20s timeout)
  - **LLM speed probe** (15s) auto-detects GPU vs CPU at mission start
  - GPU path: LLM extraction at ~150 tok/s (~0.8s per item, ~20s for 24 items)
  - CPU fallback: direct extraction from search data (instant, lower confidence)
- `lib/agents/geo-context.ts` — Web search (DDG) + RSS/USGS fallback for context gathering
  - DDG rate-limits aggressively — RSS fallback (BBC, Al Jazeera, USGS) kicks in automatically
  - Reverse geocodes deployment coords via Nominatim to build location-targeted queries
- `lib/agents/mission-emitter.ts` — EventEmitter singleton (globalThis pattern) bridging executor → SSE
  - Emits: `log`, `agent_status`, `phase`, `chat_token`, `chat_action` event types
- `app/api/agents/mission/route.ts` — REST: deploy, abort, pause, resume, cancel, skip, set_prompt
- `app/api/agents/mission/stream/route.ts` — SSE endpoint for live log/status/chat streaming
- `hooks/useMissionControl.ts` — Client hook: SSE connection, API actions, agent state management
  - **SSE is a module-level singleton** — multiple components call `useMissionControl()` but only one EventSource is created (ref-counted). Without this, tokens stream N times (once per hook instance)
- `components/layers/DeploymentLayer.tsx` — Globe pin + radius circle (CesiumJS entities) + drag/resize
- **globalThis singleton pattern** required for `mission-emitter.ts`, `mission.ts`, and `specialist-chat.ts` — without it, Turbopack creates separate module instances and SSE events never reach the client
- Zustand `missionControl` slice: deploymentMode, deploymentArea, agentStates, missionLogs, missionResults, chatMessages, chatActive, chatGenerating, repositionMode
  - `addMissionLog` and `addChatMessage` deduplicate by ID (SSE reconnects can replay events)

## Specialist Chat (Conversational Agent Orchestrator)
- `lib/agents/specialist-chat.ts` — Server-side orchestrator with ReAct-lite action parsing
  - **globalThis singleton** for conversation history (survives Turbopack HMR)
  - System prompt describes 4 available agents + deployment area context + action block syntax
  - LLM emits `<<ACTION:dispatch|agent=news-scout>>` markers → orchestrator detects, pauses stream, dispatches agent pipeline, injects results, resumes generation for synthesis
  - **Fallback**: if model ignores action syntax, keyword-based intent detection auto-dispatches agents
  - Context budget: ~3000 tokens (20 message history + system prompt + agent results) fits lfm2:8b's 8192 window
- `lib/agents/specialist-types.ts` — `ChatMessage`, `ChatAction` types
- `app/api/agents/mission/chat/route.ts` — POST (message or abort), GET (history), DELETE (clear)
- `components/mission-control/ChatPanel.tsx` — Chat UI with auto-scroll, SEND/STOP/CLEAR buttons
- `components/mission-control/ChatMessage.tsx` — Message renderer with `react-markdown` for HUD-styled markdown
  - Agent result cards show clickable source URLs, category badges, confidence, coordinates
  - Results default to expanded so links are immediately visible
- Toggle: SPECIALIST / LOG VIEW button in `MissionHeader.tsx` switches right panel between chat and log+results
- Chat requires Ollama online — shows "SPECIALIST OFFLINE" when unavailable

## Draggable / Resizable Deployment Zone
- `components/layers/DeploymentLayer.tsx` — Full drag/resize system using `ScreenSpaceEventHandler`
  - **Move**: drag center pin (entity tagged with `_deploymentRole = "center-pin"`)
  - **Resize**: drag circle edge (haversine distance ≈ radius, ±15% tolerance, min 20km)
  - **Scroll wheel**: adjust radius while hovering over zone (0.9x/1.1x per tick, clamped 10-5000km)
  - **Hover feedback**: cursor changes (grab/ew-resize) + entity highlighting (brighter green, larger pin)
  - Camera controls disabled during drag (`screenSpaceCameraController.enableRotate = false` etc.)
  - **Stage-then-confirm**: all adjustments update a local `pendingAreaRef` (visual entity updates only). Zustand `setDeploymentArea()` only called when user clicks CONFIRM POSITION
  - Escape cancels active drag or exits reposition mode
- REPOSITION button in `MissionHeader.tsx` (configuring phase only) → collapses modal to bottom bar
- `MissionControlModal.tsx` collapsed bar: shows coordinates, radius controls, CONFIRM/CANCEL, drag instructions
- CONFIRM commits `pendingAreaRef` to Zustand and restores full modal

## GDELT API — HTTPS vs HTTP
- **HTTPS fails from Node.js** for `data.gdeltproject.org` and `api.gdeltproject.org` with TLS cert mismatch (hosts redirect to Google Cloud Storage which serves `*.storage.googleapis.com` certs)
- **All GDELT URLs must use HTTP** from server-side code — `curl` works with HTTPS but Node.js `fetch` does not
- This affects: `lib/constants.ts` (GKG download URLs), `app/api/military/route.ts`, `lib/agents/swarm.ts`

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
- `getAllCameras()` uses `Promise.allSettled` — one source failure won't block others
- Two reusable generic fetchers:
  - `fetchArcGISCameras()` — for ArcGIS FeatureServer endpoints (WSDOT, IDOT/Travel Midwest)
  - `fetchIteris511Cameras()` — for Iteris 511 DataTables endpoints (NV Roads, FL511)
    - `latLng.geography` can be a string OR object `{ wellKnownText: "POINT (...)" }` — code handles both
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

## Adding New Data Layers
Follow the 6-step pattern (all existing layers follow this):
1. Add types to `types/index.ts` (LayerKey, LayerState, data interface, optional category type)
2. Create data hook in `hooks/` (fetch + poll + AbortController cleanup)
3. Update Zustand store (`stores/worldview-store.ts`) — data array + setter + optional sub-filters
4. Create layer component in `components/layers/` (CustomDataSource + click handler + entities)
5. Add to `components/hud/Sidebar.tsx` (layer toggle + optional expandable sub-filters)
6. Add to `components/Globe.tsx` (conditional render) + `components/hud/DataFeed.tsx` (right panel)

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
1. Add it to the `Promise.allSettled` in `getAllCameras()` (uses allSettled — one failure won't block others)
2. Run `npm run build` — zero errors
3. The clustering system handles everything else automatically (no changes to CameraLayer needed)

## Voice Assistant (Qwen2.5-Omni Sidecar)
- **Python sidecar** in `voice-server/` — FastAPI + Qwen2.5-Omni-7B-GPTQ-Int4
  - `docker compose up voice-server` (preferred) or `voice-server/setup.sh` for local dev
  - Exposes `POST /v1/voice/chat` (audio in → text + audio + tools out), `GET /v1/voice/status`, `POST /v1/voice/interrupt`
  - VRAM: ~10-12GB for GPTQ-Int4 model (fits RTX 5070 Ti 12GB with CPU offload)
  - Model cache persisted in `voice-models` Docker volume (~4GB, downloads once)
  - `start_period: 120s` on healthcheck — model loading takes ~60-90s
- **Next.js proxy routes**: `app/api/voice/route.ts`, `app/api/voice/status/route.ts`, `app/api/voice/interrupt/route.ts`
  - Proxies to `VOICE_SIDECAR_URL` (default `http://127.0.0.1:8790`)
- **Hook**: `hooks/useVoiceAssistant.ts` — recording, API calls, audio playback, V key shortcut
  - Polls `/api/voice/status` every 10s (like ollama-client.ts pattern)
  - `MediaRecorder` with `audio/webm;codecs=opus`, 30s max recording
  - `AudioContext` created on first user gesture (browser autoplay policy)
  - V key: push-to-talk (keydown=start, keyup=stop), skips INPUT/TEXTAREA/contentEditable
- **Tool calls**: Model outputs `<<TOOL:name|param=value>>` markers (same pattern as specialist chat `<<ACTION:...>>`)
  - Parsed by `lib/voice/tools.ts`: `parseToolCalls()`, `stripToolMarkers()`, `executeTool()`
  - Tools: `flyTo`, `deployAgents`, `specialistChat`, `toggleLayer`, `setViewMode`
  - `flyTo` and `deployAgents` geocode via existing `/api/geocode` (Nominatim)
- **Components**: `VoiceButton.tsx` (push-to-talk, 5 visual states), `VoiceGlowOverlay.tsx` (screen edge glow while recording)
  - CSS: `.voice-glow-overlay`, `.voice-btn-active`, `.voice-btn-speaking` in `globals.css`
- **Zustand**: `voiceAssistant` slice with `status`, `sidecarConnected`, `lastExchange`, `error`, `transcript`
- **VRAM sharing with Ollama**: Voice model occupies GPU when active. Ollama's LFM2:8b auto-unloads after 5min timeout. When voice triggers `deployAgents`, speed probe detects CPU-mode Ollama and uses instant CPU fallback
- **Graceful degradation**: App works fully without voice sidecar — VoiceButton shows "OFFLINE" state

## Code Style
- Green-on-black HUD/military aesthetic — use `#000a00` bg, `#00ff41` / green-400/500 text
- Custom CSS classes in `globals.css` (`.panel-section`, `.panel-label`, `.scope-*`, `.hud-glow`, `.timeline-*`, `.calendar-*`, `.voice-*`) alongside Tailwind utilities
- Font: monospace throughout (`font-mono`)
- Text sizes: 8-11px for HUD elements, tracking-wide/wider
