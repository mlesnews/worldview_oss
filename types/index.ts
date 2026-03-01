export type ViewMode = 'eo' | 'flir' | 'nightvision' | 'crt';

export type MapStyle = 'dark' | 'terrain' | 'city';

export type LayerKey = 'flights' | 'satellites' | 'disasters' | 'asteroids' | 'weather' | 'cameras' | 'livestreams' | 'news';

export interface LayerState {
  flights: boolean;
  satellites: boolean;
  disasters: boolean;
  asteroids: boolean;
  weather: boolean;
  cameras: boolean;
  livestreams: boolean;
  news: boolean;
}

export interface CursorPosition {
  lat: number;
  lon: number;
  alt: number;
}

export interface EntityInfo {
  id: string;
  type: 'flight' | 'satellite' | 'earthquake' | 'asteroid' | 'camera' | 'disaster' | 'livestream' | 'news';
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
