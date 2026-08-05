import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { persistenceSchema } from "./schema";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(moduleDirectory, "../..");
const migrationDirectory = join(repositoryRoot, "drizzle");

export function createPersistenceDatabase(client: PGlite = new PGlite()) {
  return {
    client,
    db: drizzle({ client, schema: persistenceSchema }),
  };
}

export type PersistenceDatabase = ReturnType<
  typeof createPersistenceDatabase
>["db"];

export async function applyCommittedMigrations(client: PGlite): Promise<void> {
  const migrationNames = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (migrationNames.length === 0)
    throw new Error("No committed Stage 9 SQL migration was found.");

  for (const migrationName of migrationNames) {
    const migration = await readFile(join(migrationDirectory, migrationName), "utf8");
    await client.exec(migration);
  }
}
