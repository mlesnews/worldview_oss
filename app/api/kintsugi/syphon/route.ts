import { NextResponse } from "next/server";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";
import type { SyphonEvent } from "@/types";

const SYPHON_DIR = "/home/mlesn/my_projects/lumina/data/syphon_intelligence";

let cached: SyphonEvent[] = [];
let lastFetch = 0;
const CACHE_TTL = 120_000; // 2 min

// Map source categories to approximate geo coords
const SOURCE_GEO: Record<string, { lat: number; lon: number }> = {
  crypto: { lat: 40.7128, lon: -74.006 },
  crypto_intel: { lat: 37.7749, lon: -122.4194 },
  ai_research: { lat: 37.4419, lon: -122.143 },
  ai_ecosystem: { lat: 47.6062, lon: -122.3321 },
  ai_tooling: { lat: 37.3861, lon: -122.0839 },
  compusec: { lat: 38.9072, lon: -77.0369 },
  cisa_advisories: { lat: 38.8951, lon: -77.0364 },
  business: { lat: 40.7589, lon: -73.9851 },
  competitive: { lat: 51.5074, lon: -0.1278 },
  anthropic_blog: { lat: 37.7749, lon: -122.4194 },
  claude_ecosystem: { lat: 37.7749, lon: -122.4194 },
  agent_community: { lat: 37.3382, lon: -121.8863 },
};

function getGeo(source: string): { lat: number; lon: number } {
  const base = SOURCE_GEO[source] || { lat: 39.8283, lon: -98.5795 };
  // Jitter so points don't stack
  return {
    lat: base.lat + (Math.random() - 0.5) * 2,
    lon: base.lon + (Math.random() - 0.5) * 2,
  };
}

interface SyphonFile {
  path: string;
  mtime: number;
  source: string;
}

async function collectRecentFiles(): Promise<SyphonFile[]> {
  const files: SyphonFile[] = [];
  try {
    const sources = await readdir(SYPHON_DIR);
    for (const source of sources) {
      const dir = join(SYPHON_DIR, source);
      const s = await stat(dir).catch(() => null);
      if (!s?.isDirectory()) continue;
      const entries = await readdir(dir);
      const jsonFiles = entries.filter((f) => f.endsWith(".json")).sort().reverse().slice(0, 3);
      for (const f of jsonFiles) {
        const fp = join(dir, f);
        const fs = await stat(fp).catch(() => null);
        if (fs) files.push({ path: fp, mtime: fs.mtimeMs, source });
      }
    }
  } catch {
    // dir doesn't exist
  }
  return files.sort((a, b) => b.mtime - a.mtime).slice(0, 50);
}

export async function GET() {
  try {
    const now = Date.now();
    if (cached.length > 0 && now - lastFetch < CACHE_TTL) {
      return NextResponse.json(cached);
    }

    const files = await collectRecentFiles();
    const events: SyphonEvent[] = [];

    for (const file of files) {
      try {
        const raw = await readFile(file.path, "utf-8");
        const data = JSON.parse(raw);
        const geo = getGeo(file.source);

        // Syphon files have various shapes — extract what we can
        const title = data.sweep_id || data.title || file.source;
        const items = data.repos || data.items || data.articles || data.results || [];
        const itemCount = Array.isArray(items) ? items.length : 0;

        events.push({
          id: `syph-${file.source}-${file.mtime}`,
          title: `${file.source}: ${title}`,
          summary: `${itemCount} items collected`,
          source: file.source,
          latitude: geo.lat,
          longitude: geo.lon,
          category: file.source,
          severity: itemCount > 10 ? 8 : itemCount > 5 ? 5 : 3,
          timestamp: new Date(file.mtime).toISOString(),
          url: undefined,
        });
      } catch {
        // skip unparseable files
      }
    }

    cached = events.slice(0, 100);
    lastFetch = now;
    return NextResponse.json(cached);
  } catch (error) {
    console.error("Syphon API error:", error);
    return NextResponse.json([], { status: 200 });
  }
}
