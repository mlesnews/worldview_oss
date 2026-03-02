/**
 * GDELT GKG file downloader.
 *
 * Downloads GKG 2.0 files from the GDELT master file list,
 * extracts them, and returns the raw TSV content.
 */

import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import AdmZip from "adm-zip";
import {
  GDELT_MASTER_LIST_URL,
  GKG_DEFAULT_LOOKBACK_HOURS,
} from "@/lib/constants";

const MASTER_LIST_URL = GDELT_MASTER_LIST_URL;
const CACHE_DIR =
  process.env.GKG_CACHE_DIR || path.join(process.cwd(), "data", "gkg-cache");
const CURSOR_FILE =
  process.env.GKG_CURSOR_PATH ||
  path.join(process.cwd(), "data", "gkg-cursor.json");

interface CursorState {
  lastTimestamp: string; // YYYYMMDDHHMMSS
  lastDownloaded: string; // ISO date
}

/** Ensure cache directory exists */
async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

/** Read cursor state */
export async function readCursor(): Promise<CursorState | null> {
  try {
    const content = await fs.readFile(CURSOR_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/** Write cursor state */
async function writeCursor(state: CursorState): Promise<void> {
  await fs.writeFile(CURSOR_FILE, JSON.stringify(state, null, 2));
}

/**
 * Parse the GDELT master file list to find GKG files.
 * Each line: <size> <hash> <url>
 * GKG files match: YYYYMMDDHHMMSS.gkg.csv.zip
 */
export async function fetchGkgFileList(): Promise<string[]> {
  const res = await fetch(MASTER_LIST_URL);
  if (!res.ok) throw new Error(`Failed to fetch master list: ${res.status}`);

  const text = await res.text();
  const urls: string[] = [];

  for (const line of text.split("\n")) {
    const parts = line.trim().split(" ");
    if (parts.length < 3) continue;
    const url = parts[2];
    if (url.endsWith(".gkg.csv.zip")) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * Extract the GDELT timestamp from a GKG URL.
 * URL format: http://data.gdeltproject.org/gdeltv2/YYYYMMDDHHMMSS.gkg.csv.zip
 */
export function extractTimestamp(url: string): string {
  const filename = url.split("/").pop() || "";
  return filename.replace(".gkg.csv.zip", "");
}

/**
 * Download and decompress a single GKG zip file.
 * Returns the raw TSV content as a string.
 */
export async function downloadGkgFile(url: string): Promise<string> {
  await ensureCacheDir();

  const filename = url.split("/").pop() || "unknown.zip";
  const zipPath = path.join(CACHE_DIR, filename);
  const csvPath = zipPath.replace(".zip", "");

  try {
    // Download zip
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status} for ${url}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(zipPath, buffer);

    // Extract ZIP archive (GDELT uses standard ZIP format)
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    if (entries.length === 0) throw new Error(`Empty ZIP: ${url}`);

    // GKG zips contain a single CSV file
    const content = entries[0].getData().toString("utf-8");

    // Clean up
    await fs.unlink(zipPath).catch(() => {});

    return content;
  } catch (err) {
    // Clean up on failure
    await fs.unlink(zipPath).catch(() => {});
    throw err;
  }
}

/**
 * Get GKG file URLs for a specific date range.
 * GDELT updates every 15 minutes: 96 files per day.
 */
export async function getFilesForDateRange(
  fromDate: string, // YYYYMMDD
  toDate: string // YYYYMMDD
): Promise<string[]> {
  const allUrls = await fetchGkgFileList();

  const fromTs = fromDate + "000000";
  const toTs = toDate + "235959";

  return allUrls.filter((url) => {
    const ts = extractTimestamp(url);
    return ts >= fromTs && ts <= toTs;
  });
}

/**
 * Get GKG file URLs since the last cursor position.
 * If no cursor, returns the last 24h of files.
 */
export async function getNewFiles(): Promise<string[]> {
  const cursor = await readCursor();
  const allUrls = await fetchGkgFileList();

  if (cursor) {
    return allUrls.filter(
      (url) => extractTimestamp(url) > cursor.lastTimestamp
    );
  }

  // No cursor: get last 24h
  const now = new Date();
  const yesterday = new Date(
    now.getTime() - GKG_DEFAULT_LOOKBACK_HOURS * 60 * 60 * 1000
  );
  const fromTs =
    yesterday.toISOString().replace(/[-T:]/g, "").slice(0, 14);

  return allUrls.filter((url) => extractTimestamp(url) >= fromTs);
}

/**
 * Update the cursor to the latest timestamp from a set of URLs.
 */
export async function updateCursor(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  const timestamps = urls.map(extractTimestamp).sort();
  const latest = timestamps[timestamps.length - 1];

  await writeCursor({
    lastTimestamp: latest,
    lastDownloaded: new Date().toISOString(),
  });
}

/** Clean the cache directory */
export async function cleanCache(): Promise<void> {
  if (existsSync(CACHE_DIR)) {
    const files = await fs.readdir(CACHE_DIR);
    for (const file of files) {
      await fs.unlink(path.join(CACHE_DIR, file)).catch(() => {});
    }
  }
}
