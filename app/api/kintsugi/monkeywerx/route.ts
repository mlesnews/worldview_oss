import { NextResponse } from "next/server";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";
import type { MonkeyWerxSitrep } from "@/types";

const SYPHON_DIR = "/home/mlesn/my_projects/lumina/data/syphon_intelligence";

let cached: MonkeyWerxSitrep[] = [];
let lastFetch = 0;
const CACHE_TTL = 300_000; // 5 min

// Aircraft types commonly mentioned in MonkeyWerx SITREPs
const AIRCRAFT_PATTERNS: { pattern: RegExp; type: string; category: MonkeyWerxSitrep["category"] }[] = [
  { pattern: /KC-?135|KC-?10|KC-?46|STRATOTANKER|tanker/i, type: "KC-135", category: "tanker" },
  { pattern: /E-?[36][ABC]|AWACS|JSTARS|RC-?135|RIVET|COBRA|SIGINT|ISR|surveillance/i, type: "RC-135", category: "isr" },
  { pattern: /C-?17|C-?5|C-?130|GLOBEMASTER|GALAXY|HERCULES|transport/i, type: "C-17", category: "transport" },
  { pattern: /F-?[12356][125678]|RAPTOR|LIGHTNING|EAGLE|VIPER|fighter|strike/i, type: "F-35", category: "fighter" },
  { pattern: /UH-?60|CH-?47|MH-?[56]|BLACKHAWK|CHINOOK|OSPREY|V-?22|helo|helicopter/i, type: "UH-60", category: "helo" },
  { pattern: /E-?4[AB]|NIGHTWATCH|LOOKING.?GLASS|DOOMSDAY|NAOC|VC-?25|AIR.?FORCE.?ONE/i, type: "E-4B", category: "special" },
  { pattern: /P-?8|POSEIDON|MQ-?9|REAPER|GLOBAL.?HAWK|RQ-?4|drone/i, type: "MQ-9", category: "isr" },
];

function classifyAircraft(text: string): { type: string; category: MonkeyWerxSitrep["category"] } {
  for (const { pattern, type, category } of AIRCRAFT_PATTERNS) {
    if (pattern.test(text)) return { type, category };
  }
  return { type: "Unknown", category: "other" };
}

// Mock sitrep data for when no syphon transcript is available
const MOCK_SITREP: MonkeyWerxSitrep[] = [
  { id: "mw-1", callsign: "GORDO21", aircraftType: "KC-135", latitude: 32.5, longitude: -86.5, altitude: 28000, heading: 270, category: "tanker", timestamp: new Date().toISOString() },
  { id: "mw-2", callsign: "JAKE11", aircraftType: "RC-135V", latitude: 36.2, longitude: -33.8, altitude: 32000, heading: 45, category: "isr", timestamp: new Date().toISOString() },
  { id: "mw-3", callsign: "RCH884", aircraftType: "C-17", latitude: 49.0, longitude: -2.5, altitude: 35000, heading: 90, category: "transport", timestamp: new Date().toISOString() },
  { id: "mw-4", callsign: "NITE703", aircraftType: "E-4B", latitude: 39.0, longitude: -104.7, altitude: 40000, heading: 180, category: "special", squawk: "0100", timestamp: new Date().toISOString() },
  { id: "mw-5", callsign: "FORTE10", aircraftType: "RQ-4", latitude: 47.5, longitude: 35.0, altitude: 55000, heading: 120, category: "isr", timestamp: new Date().toISOString() },
  { id: "mw-6", callsign: "HOMER31", aircraftType: "P-8A", latitude: 33.0, longitude: 35.5, altitude: 25000, heading: 200, category: "isr", timestamp: new Date().toISOString() },
];

async function findMonkeyWerxTranscript(): Promise<string | null> {
  try {
    // Look for monkeywerx channel in syphon intel
    const possibleDirs = ["monkeywerxus", "monkeywerx", "monkey_werx"];
    for (const dirName of possibleDirs) {
      const dir = join(SYPHON_DIR, dirName);
      const s = await stat(dir).catch(() => null);
      if (!s?.isDirectory()) continue;
      const files = await readdir(dir);
      const latest = files.filter((f) => f.endsWith(".json")).sort().reverse()[0];
      if (latest) {
        return await readFile(join(dir, latest), "utf-8");
      }
    }
  } catch {
    // no transcript found
  }
  return null;
}

export async function GET() {
  try {
    const now = Date.now();
    if (cached.length > 0 && now - lastFetch < CACHE_TTL) {
      return NextResponse.json(cached);
    }

    const transcript = await findMonkeyWerxTranscript();
    if (transcript) {
      try {
        const data = JSON.parse(transcript);
        const text = data.transcript || data.summary || data.content || JSON.stringify(data);
        // Extract callsign-like patterns from transcript
        const callsignRe = /\b([A-Z]{3,8}\d{1,3})\b/g;
        const matches = [...text.matchAll(callsignRe)];
        if (matches.length > 0) {
          const sitreps: MonkeyWerxSitrep[] = matches.slice(0, 20).map((m: RegExpMatchArray, i: number) => {
            const { type, category } = classifyAircraft(text.slice(Math.max(0, (m.index || 0) - 100), (m.index || 0) + 100));
            return {
              id: `mw-live-${i}`,
              callsign: m[1],
              aircraftType: type,
              latitude: 35 + (Math.random() - 0.5) * 30,
              longitude: -50 + (Math.random() - 0.5) * 100,
              altitude: 20000 + Math.random() * 40000,
              heading: Math.random() * 360,
              category,
              timestamp: new Date().toISOString(),
            };
          });
          cached = sitreps;
          lastFetch = now;
          return NextResponse.json(cached);
        }
      } catch {
        // parse failed, fall through
      }
    }

    cached = MOCK_SITREP;
    lastFetch = now;
    return NextResponse.json(cached);
  } catch (error) {
    console.error("MonkeyWerx API error:", error);
    return NextResponse.json([], { status: 200 });
  }
}
