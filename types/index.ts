export type ViewMode = 'eo' | 'flir' | 'nightvision' | 'crt' | 'trading';

export type MapStyle = 'dark' | 'terrain' | 'city';

export type LayerKey = 'flights' | 'satellites' | 'disasters' | 'asteroids' | 'weather' | 'cameras' | 'livestreams' | 'news' | 'militaryActions' | 'dataCenters' | 'whaleAlerts' | 'polymarket' | 'syphonIntel' | 'energyGrid' | 'chipFabs' | 'submarineCables' | 'gpuSupplyChain' | 'cryptoMining' | 'vcFunding' | 'monkeyWerx' | 'militaryAircraft' | 'luminaConfidence' | 'customLayers';

export interface LayerState {
  flights: boolean;
  satellites: boolean;
  disasters: boolean;
  asteroids: boolean;
  weather: boolean;
  cameras: boolean;
  livestreams: boolean;
  news: boolean;
  militaryActions: boolean;
  dataCenters: boolean;
  whaleAlerts: boolean;
  polymarket: boolean;
  syphonIntel: boolean;
  energyGrid: boolean;
  chipFabs: boolean;
  submarineCables: boolean;
  gpuSupplyChain: boolean;
  cryptoMining: boolean;
  vcFunding: boolean;
  monkeyWerx: boolean;
  militaryAircraft: boolean;
  luminaConfidence: boolean;
  customLayers: boolean;
}

export interface CursorPosition {
  lat: number;
  lon: number;
  alt: number;
}

export interface EntityInfo {
  id: string;
  type: 'flight' | 'satellite' | 'earthquake' | 'asteroid' | 'camera' | 'disaster' | 'livestream' | 'news' | 'military';
  name: string;
  details: Record<string, string | number>;
  lon: number;
  lat: number;
  alt?: number;
}

// Flight data (ADS-B Exchange via airplanes.live)
export interface Flight {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number;
  latitude: number;
  baroAltitude: number | null;
  onGround: boolean;
  velocity: number | null;
  trueTrack: number | null;
  verticalRate: number | null;
  geoAltitude: number | null;
  squawk: string | null;
  lastContact: number;
}

// Satellite data (propagated from TLE)
export interface Satellite {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number; // km
  velocity: number; // km/s
  category: string;
}

// Earthquake data from USGS
export interface Earthquake {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  longitude: number;
  latitude: number;
  depth: number; // km
  tsunami: boolean;
  alert: string | null;
  felt: number | null;
}

// Near-Earth Object from NASA
export interface Asteroid {
  id: string;
  name: string;
  estimatedDiameterMin: number; // meters
  estimatedDiameterMax: number; // meters
  isPotentiallyHazardous: boolean;
  closeApproachDate: string;
  relativeVelocity: number; // km/h
  missDistance: number; // km
  orbitingBody: string;
}

// Traffic camera
export interface Camera {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  feedUrl: string;
  city: string;
  active: boolean;
}

// Clustered city group for progressive camera rendering
export interface CityCluster {
  city: string;
  centerLat: number;
  centerLon: number;
  count: number;
  cameras: Camera[];
}

// Detection result from YOLO
export interface Detection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number]; // x, y, w, h
}

// Flight sub-type filters
export type FlightCategory = 'regular' | 'iss';

// Disaster categories for sub-filtering
export type DisasterCategory = 'earthquakes' | 'wildfires' | 'volcanoes' | 'severeStorms' | 'floods' | 'ice';

// Unified disaster event (EONET + USGS merged)
export interface Disaster {
  id: string;
  title: string;
  category: DisasterCategory;
  latitude: number;
  longitude: number;
  date: string; // ISO date
  source: 'eonet' | 'usgs';
  magnitude?: number;
  description?: string;
  link?: string;
}

// YouTube live stream
export interface LiveStream {
  id: string;
  title: string;
  channelTitle: string;
  videoId: string;
  latitude: number;
  longitude: number;
  thumbnailUrl: string;
  viewerCount?: number;
  city: string;
}

// Military action categories for sub-filtering
export type MilitaryCategory = 'airstrikes' | 'groundOps' | 'navalOps' | 'missileStrikes' | 'other';

// Military / conflict event (GDELT Events)
export interface MilitaryAction {
  id: string;
  title: string;
  category: MilitaryCategory;
  latitude: number;
  longitude: number;
  date: string;
  actor1: string;
  actor2: string;
  sourceUrl: string;
  eventCode: string;
  goldsteinScale: number;
  numMentions: number;
  location: string;
}

// Agent swarm result summary (for UI display)
export interface AgentResultSummary {
  agentId: string;
  agentName: string;
  success: boolean;
  itemCount: number;
  processingTimeMs: number;
  error?: string;
}

export interface AgentSwarmState {
  ollamaConnected: boolean;
  modelName: string | null;
  running: boolean;
  lastRun: number;
  totalItems: number;
  agentResults: AgentResultSummary[];
}

// ── Mission Control Client Types ─────────────────────────────────

/** Deployment area on the globe */
export interface DeploymentAreaClient {
  lat: number;
  lon: number;
  radiusKm: number;
}

/** Mission phases */
export type MissionPhaseClient = "configuring" | "deploying" | "completed" | "aborted";

/** Agent status in the UI */
export type MissionAgentStatusClient =
  | "pending"
  | "gathering"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped";

/** Agent card display state */
export interface MissionAgentClientState {
  agentId: string;
  agentName: string;
  role: string;
  status: MissionAgentStatusClient;
  systemPrompt: string;
  startedAt?: number;
  completedAt?: number;
  itemCount: number;
  processingTimeMs: number;
  error?: string;
}

/** Log entry for UI display */
export interface MissionLogClientEntry {
  id: string;
  timestamp: number;
  agentId: string | null;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

/** Intel result item for display */
export interface AgentIntelItemClient {
  id: string;
  title: string;
  summary: string;
  latitude: number;
  longitude: number;
  category: string;
  subcategory?: string;
  confidence: number;
  sourceUrl?: string;
  timestamp: string;
}

/** Chat message for specialist conversation */
export interface ChatMessageClient {
  id: string;
  role: "user" | "assistant" | "system" | "agent_result";
  content: string;
  timestamp: number;
  agentId?: string;
  agentResults?: AgentIntelItemClient[];
  isStreaming?: boolean;
}

/** Full mission control state in Zustand */
export interface MissionControlState {
  deploymentMode: boolean;
  deploymentArea: DeploymentAreaClient | null;
  missionModalOpen: boolean;
  missionPhase: MissionPhaseClient;
  agentStates: MissionAgentClientState[];
  missionLogs: MissionLogClientEntry[];
  missionResults: AgentIntelItemClient[];
  ollamaConnected: boolean;
  modelName: string | null;
  // Specialist chat
  chatMessages: ChatMessageClient[];
  chatActive: boolean;
  chatGenerating: boolean;
  // Reposition mode
  repositionMode: boolean;
}

// ── Kintsugi Layer Types ─────────────────────────────────

export interface DataCenter {
  id: string;
  name: string;
  provider: string; // AWS, Azure, Google, Oracle
  latitude: number;
  longitude: number;
  region: string;
  capacity?: string;
  gpuInfo?: string;
}

export interface WhaleAlert {
  id: string;
  blockchain: string;
  symbol: string;
  amount: number;
  amountUsd: number;
  from: string;
  to: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  transactionHash: string;
}

export interface PolymarketPrediction {
  id: string;
  question: string;
  probability: number;
  volume: number;
  latitude: number;
  longitude: number;
  category: string;
  endDate: string;
  url: string;
}

export interface SyphonEvent {
  id: string;
  title: string;
  summary: string;
  source: string;
  latitude: number;
  longitude: number;
  category: string;
  severity: number;
  timestamp: string;
  url?: string;
}

export interface EnergyGridNode {
  id: string;
  name: string;
  type: 'solar' | 'wind' | 'nuclear' | 'hydro' | 'gas' | 'coal' | 'grid';
  latitude: number;
  longitude: number;
  capacityMw: number;
  currentOutputMw?: number;
  region: string;
}

export interface ChipFab {
  id: string;
  name: string;
  company: string; // TSMC, Intel, Samsung, GlobalFoundries
  latitude: number;
  longitude: number;
  processNode: string; // e.g. "3nm", "5nm"
  status: 'operational' | 'construction' | 'planned';
  investmentBn?: number;
}

export interface SubmarineCable {
  id: string;
  name: string;
  readyForService: string;
  lengthKm: number;
  owners: string;
  landing1: { lat: number; lon: number; name: string };
  landing2: { lat: number; lon: number; name: string };
  capacityTbps?: number;
}

export interface GpuSupplyNode {
  id: string;
  name: string;
  type: 'manufacturer' | 'fab' | 'distributor' | 'datacenter';
  latitude: number;
  longitude: number;
  company: string;
  details?: string;
}

export interface CryptoMiningNode {
  id: string;
  name: string;
  hashrate: string;
  latitude: number;
  longitude: number;
  algorithm: string;
  energySource?: string;
  operator?: string;
}

export interface VcFundingEvent {
  id: string;
  company: string;
  amountUsd: number;
  round: string;
  investors: string;
  latitude: number;
  longitude: number;
  date: string;
  sector: string;
}

export interface MonkeyWerxSitrep {
  id: string;
  callsign: string;
  aircraftType: string;
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  category: 'tanker' | 'isr' | 'transport' | 'fighter' | 'helo' | 'special' | 'other';
  squawk?: string;
  timestamp: string;
}

export type MilitaryAircraftCategory = 'tanker' | 'isr' | 'transport' | 'fighter' | 'helo' | 'special' | 'other';

export interface LuminaConfidencePoint {
  id: string;
  region: string;
  latitude: number;
  longitude: number;
  confidence: number; // 0-100
  sentiment: number; // -1 to 1
  signalCount: number;
  timestamp: string;
}

export interface CustomLayer {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
  color?: string;
  icon?: string;
  metadata?: Record<string, string | number>;
}

// Geo-tagged news article (GDELT)
export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  latitude: number;
  longitude: number;
  date: string;
  language: string;
  tone: number; // GDELT tone score
  imageUrl?: string;
}
