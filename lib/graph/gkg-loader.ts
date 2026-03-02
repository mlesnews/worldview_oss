/**
 * Load parsed GKG rows into JanusGraph.
 *
 * Uses get-or-create (upsert) pattern for entities to avoid duplicates.
 * Batches writes for performance.
 */

import { getTraversalSource, __, t } from "./client";
import type { GkgRow } from "./gkg-parser";
import {
  GKG_BATCH_SIZE,
  MAX_PERSONS_PER_ARTICLE,
  MAX_ORGS_PER_ARTICLE,
  MAX_LOCATIONS_PER_ARTICLE,
  MAX_THEMES_PER_ARTICLE,
} from "@/lib/constants";

const BATCH_SIZE = GKG_BATCH_SIZE;

interface LoadStats {
  articles: number;
  persons: number;
  organizations: number;
  locations: number;
  themes: number;
  edges: number;
  errors: number;
}

/**
 * Upsert a vertex by label and name property.
 * Returns the vertex traversal for chaining.
 */
async function upsertEntity(
  g: Awaited<ReturnType<typeof getTraversalSource>>,
  label: string,
  name: string,
  extraProps?: Record<string, unknown>
): Promise<unknown> {
  // Build the addV branch with all properties included
  let addVBranch = __.addV(label).property("name", name);
  if (extraProps) {
    for (const [key, value] of Object.entries(extraProps)) {
      if (value !== undefined && value !== null && value !== "") {
        addVBranch = addVBranch.property(key, value);
      }
    }
  }

  const result = await g
    .V()
    .has(label, "name", name)
    .fold()
    .coalesce(__.unfold(), addVBranch)
    .next();
  return result.value;
}

/**
 * Load a batch of GKG rows into JanusGraph.
 */
async function loadBatch(rows: GkgRow[], stats: LoadStats): Promise<void> {
  const g = await getTraversalSource();

  for (const row of rows) {
    try {
      // 1. Upsert article vertex
      const articleResult = await g
        .V()
        .has("article", "gkgRecordId", row.gkgRecordId)
        .fold()
        .coalesce(
          __.unfold(),
          __.addV("article").property("gkgRecordId", row.gkgRecordId)
        )
        .property("date", row.date)
        .property("sourceCommonName", row.sourceCommonName)
        .property("documentUrl", row.documentUrl)
        .property("tone", row.tone.tone)
        .property("sharingImage", row.sharingImage)
        .next();

      const articleVertex = articleResult.value;
      stats.articles++;

      // 2. Upsert persons and create edges
      for (const personName of row.persons.slice(0, MAX_PERSONS_PER_ARTICLE)) {
        // cap at 20 per article
        try {
          await upsertEntity(g, "person", personName);
          await g
            .V()
            .has("article", "gkgRecordId", row.gkgRecordId)
            .as("a")
            .V()
            .has("person", "name", personName)
            .as("p")
            .coalesce(
              __.select("a").outE("mentions_person").where(__.inV().as("p")),
              __.select("a").addE("mentions_person").to(__.select("p"))
            )
            .next();
          stats.persons++;
          stats.edges++;
        } catch {
          stats.errors++;
        }
      }

      // 3. Upsert organizations and create edges
      for (const orgName of row.organizations.slice(0, MAX_ORGS_PER_ARTICLE)) {
        try {
          await upsertEntity(g, "organization", orgName);
          await g
            .V()
            .has("article", "gkgRecordId", row.gkgRecordId)
            .as("a")
            .V()
            .has("organization", "name", orgName)
            .as("o")
            .coalesce(
              __.select("a").outE("mentions_org").where(__.inV().as("o")),
              __.select("a").addE("mentions_org").to(__.select("o"))
            )
            .next();
          stats.organizations++;
          stats.edges++;
        } catch {
          stats.errors++;
        }
      }

      // 4. Upsert locations and create edges
      for (const loc of row.locations.slice(0, MAX_LOCATIONS_PER_ARTICLE)) {
        try {
          await upsertEntity(g, "location", loc.name, {
            lat: loc.lat,
            lon: loc.lon,
            countryCode: loc.countryCode,
            adm1Code: loc.adm1Code,
          });
          await g
            .V()
            .has("article", "gkgRecordId", row.gkgRecordId)
            .as("a")
            .V()
            .has("location", "name", loc.name)
            .as("l")
            .coalesce(
              __.select("a").outE("located_in").where(__.inV().as("l")),
              __.select("a").addE("located_in").to(__.select("l"))
            )
            .next();
          stats.locations++;
          stats.edges++;
        } catch {
          stats.errors++;
        }
      }

      // 5. Upsert themes and create edges
      for (const themeName of row.themes.slice(0, MAX_THEMES_PER_ARTICLE)) {
        try {
          await upsertEntity(g, "theme", themeName);
          await g
            .V()
            .has("article", "gkgRecordId", row.gkgRecordId)
            .as("a")
            .V()
            .has("theme", "name", themeName)
            .as("t")
            .coalesce(
              __.select("a").outE("has_theme").where(__.inV().as("t")),
              __.select("a").addE("has_theme").to(__.select("t"))
            )
            .next();
          stats.themes++;
          stats.edges++;
        } catch {
          stats.errors++;
        }
      }
    } catch (err) {
      console.warn(
        `Failed to load article ${row.gkgRecordId}:`,
        (err as Error).message
      );
      stats.errors++;
    }
  }
}

/**
 * Load all parsed GKG rows into JanusGraph.
 * Processes in batches for performance.
 */
export async function loadGkgRows(rows: GkgRow[]): Promise<LoadStats> {
  const stats: LoadStats = {
    articles: 0,
    persons: 0,
    organizations: 0,
    locations: 0,
    themes: 0,
    edges: 0,
    errors: 0,
  };

  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    console.log(
      `  Batch ${batchNum}/${totalBatches} (${batch.length} rows)...`
    );

    await loadBatch(batch, stats);
  }

  return stats;
}
