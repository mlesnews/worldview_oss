/**
 * GDELT GKG ingestion script.
 *
 * Modes:
 *   --daily          Fetch last 24h of 15-minute GKG files
 *   --latest         Fetch only the most recent 15-min update
 *   --backfill --from YYYYMMDD --to YYYYMMDD   Bulk historical load
 *
 * Usage:
 *   npx tsx scripts/ingest-gkg.ts --daily
 *   npx tsx scripts/ingest-gkg.ts --latest
 *   npx tsx scripts/ingest-gkg.ts --backfill --from 20260301 --to 20260301
 *
 * Cron (daily at 6:30 AM EST):
 *   30 6 * * * cd /path/to/worldview_oss && npm run ingest-gkg
 */

import {
  getNewFiles,
  getFilesForDateRange,
  downloadGkgFile,
  updateCursor,
  cleanCache,
  extractTimestamp,
  fetchGkgFileList,
} from "../lib/graph/gkg-downloader";
import { parseGkgFile } from "../lib/graph/gkg-parser";
import { loadGkgRows } from "../lib/graph/gkg-loader";
import { closeConnection } from "../lib/graph/client";

function parseArgs(): {
  mode: "daily" | "latest" | "backfill";
  from?: string;
  to?: string;
} {
  const args = process.argv.slice(2);

  if (args.includes("--backfill")) {
    const fromIdx = args.indexOf("--from");
    const toIdx = args.indexOf("--to");
    const from = fromIdx >= 0 ? args[fromIdx + 1] : undefined;
    const to = toIdx >= 0 ? args[toIdx + 1] : undefined;

    if (!from || !to) {
      console.error("--backfill requires --from YYYYMMDD --to YYYYMMDD");
      process.exit(1);
    }

    return { mode: "backfill", from, to };
  }

  if (args.includes("--latest")) {
    return { mode: "latest" };
  }

  return { mode: "daily" };
}

async function ingestFiles(urls: string[]): Promise<void> {
  if (urls.length === 0) {
    console.log("No new GKG files to ingest.");
    return;
  }

  console.log(`Found ${urls.length} GKG files to ingest.\n`);

  let totalArticles = 0;
  let totalPersons = 0;
  let totalOrgs = 0;
  let totalLocations = 0;
  let totalErrors = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const ts = extractTimestamp(url);
    console.log(`[${i + 1}/${urls.length}] Processing ${ts}...`);

    try {
      // Download and decompress
      const content = await downloadGkgFile(url);

      // Parse
      const rows = parseGkgFile(content);
      console.log(`  Parsed ${rows.length} rows`);

      if (rows.length === 0) continue;

      // Load into graph
      const stats = await loadGkgRows(rows);

      totalArticles += stats.articles;
      totalPersons += stats.persons;
      totalOrgs += stats.organizations;
      totalLocations += stats.locations;
      totalErrors += stats.errors;

      console.log(
        `  Loaded: ${stats.articles} articles, ${stats.persons} persons, ` +
          `${stats.organizations} orgs, ${stats.locations} locations, ` +
          `${stats.edges} edges (${stats.errors} errors)`
      );
    } catch (err) {
      console.error(`  Failed to process ${ts}:`, (err as Error).message);
      totalErrors++;
    }
  }

  // Update cursor to latest processed file
  await updateCursor(urls);

  console.log("\n=== Ingestion Summary ===");
  console.log(`Articles:      ${totalArticles}`);
  console.log(`Persons:       ${totalPersons}`);
  console.log(`Organizations: ${totalOrgs}`);
  console.log(`Locations:     ${totalLocations}`);
  console.log(`Errors:        ${totalErrors}`);
}

async function main() {
  const { mode, from, to } = parseArgs();

  console.log(`GDELT GKG Ingestion — mode: ${mode}`);
  console.log("=".repeat(40) + "\n");

  try {
    let urls: string[];

    switch (mode) {
      case "daily":
        console.log("Fetching files since last cursor (or last 24h)...");
        urls = await getNewFiles();
        break;

      case "latest": {
        console.log("Fetching latest GKG file...");
        const allUrls = await fetchGkgFileList();
        urls = allUrls.length > 0 ? [allUrls[allUrls.length - 1]] : [];
        break;
      }

      case "backfill":
        console.log(`Fetching files from ${from} to ${to}...`);
        urls = await getFilesForDateRange(from!, to!);
        break;
    }

    await ingestFiles(urls);
  } catch (err) {
    console.error("Ingestion failed:", err);
    process.exit(1);
  } finally {
    await cleanCache();
    await closeConnection();
  }

  process.exit(0);
}

main();
