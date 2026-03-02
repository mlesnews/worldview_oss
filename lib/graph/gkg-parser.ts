/**
 * GDELT GKG 2.0 tab-delimited file parser.
 *
 * GKG 2.0 has 27 columns. We extract the fields needed for the knowledge graph:
 * persons, organizations, locations, themes, tone, and article metadata.
 *
 * Spec: http://data.gdeltproject.org/documentation/GDELT-Global_Knowledge_Graph_Codebook-V2.1.pdf
 */

export interface GkgLocation {
  name: string;
  lat: number;
  lon: number;
  countryCode: string;
  adm1Code: string;
}

export interface GkgTone {
  tone: number;
  posTone: number;
  negTone: number;
  polarity: number;
}

export interface GkgRow {
  gkgRecordId: string;
  date: number; // epoch ms
  sourceCommonName: string;
  documentUrl: string;
  themes: string[];
  locations: GkgLocation[];
  persons: string[];
  organizations: string[];
  tone: GkgTone;
  sharingImage: string;
}

// GKG 2.0 column indexes
const COL = {
  GKGRECORDID: 0,
  DATE: 1,
  SOURCECOMMONNAME: 3,
  DOCUMENTIDENTIFIER: 4,
  V2THEMES: 7,
  V2LOCATIONS: 9,
  V2PERSONS: 11,
  V2ORGANIZATIONS: 13,
  V2TONE: 15,
  SHARINGIMAGE: 21,
} as const;

/**
 * Parse a V2Locations field.
 * Format: Type#Name#CountryCode#ADM1Code#Lat#Lon#FeatureID;...
 */
function parseLocations(field: string): GkgLocation[] {
  if (!field) return [];

  const locations: GkgLocation[] = [];
  const parts = field.split(";");

  for (const part of parts) {
    if (!part.trim()) continue;
    const segments = part.split("#");
    if (segments.length < 6) continue;

    const lat = parseFloat(segments[4]);
    const lon = parseFloat(segments[5]);

    if (isNaN(lat) || isNaN(lon)) continue;
    if (lat === 0 && lon === 0) continue; // skip null island

    locations.push({
      name: segments[1] || "Unknown",
      countryCode: segments[2] || "",
      adm1Code: segments[3] || "",
      lat,
      lon,
    });
  }

  return locations;
}

/**
 * Parse V2Tone CSV field.
 * Format: Tone,PositiveTone,NegativeTone,Polarity,ActivityRefDensity,SelfGroupRefDensity,WordCount
 */
function parseTone(field: string): GkgTone {
  const defaults: GkgTone = { tone: 0, posTone: 0, negTone: 0, polarity: 0 };
  if (!field) return defaults;

  const parts = field.split(",");
  return {
    tone: parseFloat(parts[0]) || 0,
    posTone: parseFloat(parts[1]) || 0,
    negTone: parseFloat(parts[2]) || 0,
    polarity: parseFloat(parts[3]) || 0,
  };
}

/** Split a semicolon-delimited list, filter empties, deduplicate */
function splitField(field: string): string[] {
  if (!field) return [];
  const seen = new Set<string>();
  return field
    .split(";")
    .map((s) => s.trim())
    .filter((s) => {
      if (!s || seen.has(s)) return false;
      seen.add(s);
      return true;
    });
}

/** Parse GDELT date (YYYYMMDDHHMMSS) to epoch ms */
function parseGdeltDate(dateStr: string): number {
  if (!dateStr || dateStr.length < 8) return 0;

  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const hour = dateStr.slice(8, 10) || "00";
  const min = dateStr.slice(10, 12) || "00";
  const sec = dateStr.slice(12, 14) || "00";

  return new Date(
    `${year}-${month}-${day}T${hour}:${min}:${sec}Z`
  ).getTime();
}

/**
 * Parse a single GKG 2.0 tab-delimited row.
 * Returns null for malformed rows.
 */
export function parseGkgRow(line: string): GkgRow | null {
  try {
    const cols = line.split("\t");
    if (cols.length < 22) return null;

    const gkgRecordId = cols[COL.GKGRECORDID];
    if (!gkgRecordId) return null;

    const dateStr = cols[COL.DATE];
    const date = parseGdeltDate(dateStr);
    if (date === 0) return null;

    const documentUrl = cols[COL.DOCUMENTIDENTIFIER];
    if (!documentUrl) return null;

    return {
      gkgRecordId,
      date,
      sourceCommonName: cols[COL.SOURCECOMMONNAME] || "",
      documentUrl,
      themes: splitField(cols[COL.V2THEMES]),
      locations: parseLocations(cols[COL.V2LOCATIONS]),
      persons: splitField(cols[COL.V2PERSONS]),
      organizations: splitField(cols[COL.V2ORGANIZATIONS]),
      tone: parseTone(cols[COL.V2TONE]),
      sharingImage: cols[COL.SHARINGIMAGE] || "",
    };
  } catch (err) {
    console.warn("Malformed GKG row, skipping:", (err as Error).message);
    return null;
  }
}

/**
 * Parse an entire GKG file content (multiple lines).
 * Skips the header line if present.
 */
export function parseGkgFile(content: string): GkgRow[] {
  const lines = content.split(/\r?\n/);
  const rows: GkgRow[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const row = parseGkgRow(line);
    if (row) rows.push(row);
  }

  return rows;
}
