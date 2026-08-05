import { PGlite } from "@electric-sql/pglite";
import { pgDump } from "@electric-sql/pglite-tools";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import {
  INITIAL_REGISTRY,
  type RegistryManifest,
} from "../registry";
import {
  applyCommittedMigrations,
  createPersistenceDatabase,
} from "./database";
import {
  canonicalRegistryJson,
  PostgresRegistrySnapshotRepository,
  registryManifestSha256,
} from "./registry-repository";
import { registrySnapshot } from "./schema";

const clients: PGlite[] = [];
const INSTALLED_AT = "2026-08-06T00:00:00Z";

function manifest(): RegistryManifest {
  return structuredClone(INITIAL_REGISTRY) as RegistryManifest;
}

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .reverse()
        .map(([key, nested]) => [key, reverseObjectKeys(nested)]),
    );
  return value;
}

async function freshDatabase() {
  const client = new PGlite();
  clients.push(client);
  await applyCommittedMigrations(client);
  const { db } = createPersistenceDatabase(client);
  return {
    client,
    db,
    repository: new PostgresRegistrySnapshotRepository(db),
  };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("Stage 13 immutable registry snapshot persistence", () => {
  it("applies committed migrations and round-trips reviewed registry v1 exactly", async () => {
    const { repository } = await freshDatabase();
    const input = manifest();

    const installed = await repository.install(input, INSTALLED_AT);
    const loaded = await repository.load(input.registryVersion);

    expect(installed).toEqual({
      state: "inserted",
      registryVersion: input.registryVersion,
      manifestSha256: registryManifestSha256(input),
    });
    expect(loaded).not.toBeNull();
    expect(loaded?.manifest).toEqual(input);
    expect(loaded).toMatchObject({
      registryVersion: input.registryVersion,
      schemaVersion: input.schemaVersion,
      normalizerVersion: input.normalizerVersion,
      reviewedAt: input.reviewedAt,
      installedAt: INSTALLED_AT,
    });
    expect(loaded?.manifestSha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("uses recursively key-sorted canonical JSON for a deterministic fingerprint", () => {
    const input = manifest();
    const reordered = reverseObjectKeys(input) as RegistryManifest;

    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(input));
    expect(canonicalRegistryJson(reordered)).toBe(canonicalRegistryJson(input));
    expect(registryManifestSha256(reordered)).toBe(registryManifestSha256(input));
  });

  it("treats an identical reinstall as an idempotent no-op", async () => {
    const { db, repository } = await freshDatabase();
    const input = manifest();

    await expect(repository.install(input, INSTALLED_AT)).resolves.toMatchObject({
      state: "inserted",
    });
    await expect(
      repository.install(input, "2026-08-06T02:00:00Z"),
    ).resolves.toMatchObject({ state: "existing" });

    const rows = await db.select().from(registrySnapshot);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.installedAt).toBe(INSTALLED_AT);
    await expect(repository.listVersions()).resolves.toEqual([
      input.registryVersion,
    ]);
  });

  it("rejects reuse of one immutable version for different content", async () => {
    const { repository } = await freshDatabase();
    const input = manifest();
    await repository.install(input, INSTALLED_AT);

    const conflicting = manifest();
    conflicting.aliases[0]!.evidenceLocation = "changed_location";
    await expect(
      repository.install(conflicting, "2026-08-06T03:00:00Z"),
    ).rejects.toThrow(/version conflict/iu);

    const loaded = await repository.load(input.registryVersion);
    expect(loaded?.manifest.aliases[0]?.evidenceLocation).toBe(
      input.aliases[0]?.evidenceLocation,
    );
  });

  it("rejects an invalid registry before any row is written", async () => {
    const { db, repository } = await freshDatabase();
    const invalid = manifest();
    invalid.officialDomains.push("unapproved.example");

    await expect(repository.install(invalid, INSTALLED_AT)).rejects.toThrow(
      /validation failed/iu,
    );
    expect(await db.select().from(registrySnapshot)).toEqual([]);
  });

  it("enforces append-only snapshots at the database boundary", async () => {
    const { db, repository } = await freshDatabase();
    const input = manifest();
    await repository.install(input, INSTALLED_AT);

    await expect(
      db
        .update(registrySnapshot)
        .set({ normalizerVersion: "mutated-normalizer" })
        .where(eq(registrySnapshot.registryVersion, input.registryVersion)),
    ).rejects.toThrow();
    await expect(
      db
        .delete(registrySnapshot)
        .where(eq(registrySnapshot.registryVersion, input.registryVersion)),
    ).rejects.toThrow();
    await expect(repository.load(input.registryVersion)).resolves.not.toBeNull();
  });

  it("returns null for an absent registry version", async () => {
    const { repository } = await freshDatabase();
    await expect(repository.load("registry-2099-01-01.1")).resolves.toBeNull();
  });

  it("fails closed when a structurally valid row carries a false fingerprint", async () => {
    const { db, repository } = await freshDatabase();
    const corrupted = manifest();
    corrupted.registryVersion = "registry-2026-08-06.999";

    await db.insert(registrySnapshot).values({
      registryVersion: corrupted.registryVersion,
      schemaVersion: corrupted.schemaVersion,
      normalizerVersion: corrupted.normalizerVersion,
      reviewedAt: corrupted.reviewedAt,
      manifestSha256: "0".repeat(64),
      manifest: corrupted,
      installedAt: INSTALLED_AT,
    });

    await expect(repository.load(corrupted.registryVersion)).rejects.toThrow(
      /fingerprint verification failed/iu,
    );
  });

  it("returns detached deeply frozen data", async () => {
    const { repository } = await freshDatabase();
    const input = manifest();
    const originalLabel = input.systemFamilies[0]!.labels.ja;
    await repository.install(input, INSTALLED_AT);

    input.systemFamilies[0]!.labels.ja = "caller mutation";
    const loaded = await repository.load(input.registryVersion);

    expect(loaded?.manifest.systemFamilies[0]?.labels.ja).toBe(originalLabel);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded?.manifest)).toBe(true);
    expect(Object.isFrozen(loaded?.manifest.systemFamilies[0]?.labels)).toBe(true);
  });

  it("preserves a verified snapshot through pg_dump and restore", async () => {
    const { client, repository } = await freshDatabase();
    const input = manifest();
    await repository.install(input, INSTALLED_AT);

    const dump = await pgDump({ pg: client, args: ["--data-only"] });
    const sql = await dump.text();
    expect(sql).toContain(input.registryVersion);
    expect(sql).not.toMatch(/[¥￥$€£]/u);

    const restoredClient = new PGlite();
    clients.push(restoredClient);
    await applyCommittedMigrations(restoredClient);
    await restoredClient.exec(sql);
    await restoredClient.exec("SET search_path TO public;");
    const restored = new PostgresRegistrySnapshotRepository(
      createPersistenceDatabase(restoredClient).db,
    );

    const loaded = await restored.load(input.registryVersion);
    expect(loaded?.manifest).toEqual(input);
    expect(loaded?.manifestSha256).toBe(registryManifestSha256(input));
  });
});
