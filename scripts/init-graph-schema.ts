/**
 * Initialize JanusGraph schema for GDELT GKG knowledge graph.
 *
 * Usage: npx tsx scripts/init-graph-schema.ts
 *
 * Requires JanusGraph + Cassandra running (docker compose up -d).
 * Idempotent — safe to run multiple times.
 */

import { submitScript, closeConnection } from "../lib/graph/client";
import { SCHEMA_SCRIPTS } from "../lib/graph/schema";

async function main() {
  console.log("Initializing JanusGraph schema...\n");

  const steps = [
    { name: "Property keys", script: SCHEMA_SCRIPTS.propertyKeys },
    { name: "Vertex labels", script: SCHEMA_SCRIPTS.vertexLabels },
    { name: "Edge labels", script: SCHEMA_SCRIPTS.edgeLabels },
    { name: "Indexes", script: SCHEMA_SCRIPTS.indexes },
  ];

  for (const step of steps) {
    try {
      console.log(`  Creating ${step.name}...`);
      const result = await submitScript(step.script);
      console.log(`  ✓ ${step.name}: ${result}`);
    } catch (err) {
      console.error(`  ✗ ${step.name} failed:`, err);
      process.exit(1);
    }
  }

  console.log("\nSchema initialization complete.");

  await closeConnection();
  process.exit(0);
}

main();
