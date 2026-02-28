export type ViewMode = 'eo' | 'flir' | 'nightvision' | 'crt';

export type LayerKey = 'flights' | 'satellites' | 'earthquakes' | 'asteroids' | 'weather' | 'cameras';

export interface LayerState {
  flights: boolean;
  satellites: boolean;
  earthquakes: boolean;
  asteroids: boolean;
  weather: boolean;
  cameras: boolean;
}

export interface CursorPosition {
  lat: number;
  lon: number;
  alt: number;
}

export interface EntityInfo {
  id: string;
  type: 'flight' | 'satellite' | 'earthquake' | 'asteroid' | 'camera';
  name: string;
  details: Record<string, string | number>;
  lon: number;
  lat: number;
  alt?: number;
}

// Flight data from OpenSky Network
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

// Detection result from YOLO
export interface Detection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number]; // x, y, w, h
}
