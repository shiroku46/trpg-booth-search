import { PGlite } from "@electric-sql/pglite";
import { pgDump } from "@electric-sql/pglite-tools";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import {
  BOOTH_LISTING_URL,
  STAGE28_PARSER_VERSION,
  createDiscoveryManifest,
  type DiscoveryManifest,
} from "../discovery-manifest";
import {
  applyCommittedMigrations,
  createPersistenceDatabase,
} from "./database";
import { PostgresDiscoveryManifestRepository } from "./discovery-manifest-repository";
import { boothProduct, discoveryManifest, reviewCase, scenario } from "./schema";

const clients: PGlite[] = [];
const INSTALLED_AT = "2026-08-07T13:30:00Z";
const SOURCE_SHA = "8".repeat(40);
const RAW_SHA = "a".repeat(64);

function manifest(): DiscoveryManifest {
  return createDiscoveryManifest({
    sourceSha: SOURCE_SHA,
    listingRawSha256: RAW_SHA,
    entries: [
      { productId: "20", canonicalUrl: "https://booth.pm/ja/items/20" },
      { productId: "3", canonicalUrl: "https://booth.pm/ja/items/3" },
    ],
  });
}

async function freshDatabase() {
  const client = new PGlite();
  clients.push(client);
  await applyCommittedMigrations(client);
  const { db } = createPersistenceDatabase(client);
  return {
    client,
    db,
    repository: new PostgresDiscoveryManifestRepository(db),
  };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("Stage 30 immutable discovery manifest persistence", () => {
  it("installs and loads one validated identity-only manifest exactly", async () => {
    const { repository } = await freshDatabase();
    const input = manifest();

    await expect(repository.install(input, INSTALLED_AT)).resolves.toEqual({
      state: "inserted",
      fingerprint: input.fingerprint,
    });
    const loaded = await repository.load(input.fingerprint);

    expect(loaded?.manifest).toEqual(input);
    expect(loaded).toMatchObject({
      fingerprint: input.fingerprint,
      schemaVersion: 1,
      sourceSha: SOURCE_SHA,
      parserVersion: STAGE28_PARSER_VERSION,
      listingUrl: BOOTH_LISTING_URL,
      listingRawSha256: RAW_SHA,
      installedAt: INSTALLED_AT,
    });
  });

  it("treats identical reinstall as an idempotent no-op", async () => {
    const { db, repository } = await freshDatabase();
    const input = manifest();

    await expect(repository.install(input, INSTALLED_AT)).resolves.toMatchObject({
      state: "inserted",
    });
    await expect(
      repository.install(input, "2026-08-07T14:00:00Z"),
    ).resolves.toMatchObject({ state: "existing" });

    const rows = await db.select().from(discoveryManifest);
    expect(rows).toHaveLength(1);
    expect(new Date(rows[0]!.installedAt).toISOString()).toBe(
      new Date(INSTALLED_AT).toISOString(),
    );
  });

  it("never promotes discovery identities into products, scenarios, or review rows", async () => {
    const { db, repository } = await freshDatabase();
    await repository.install(manifest(), INSTALLED_AT);

    expect(await db.select().from(boothProduct)).toEqual([]);
    expect(await db.select().from(scenario)).toEqual([]);
    expect(await db.select().from(reviewCase)).toEqual([]);
  });

  it("enforces append-only manifests at the database boundary", async () => {
    const { db, repository } = await freshDatabase();
    const input = manifest();
    await repository.install(input, INSTALLED_AT);

    await expect(
      db
        .update(discoveryManifest)
        .set({ sourceSha: "1".repeat(40) })
        .where(eq(discoveryManifest.fingerprint, input.fingerprint)),
    ).rejects.toThrow();
    await expect(
      db
        .delete(discoveryManifest)
        .where(eq(discoveryManifest.fingerprint, input.fingerprint)),
    ).rejects.toThrow();
    await expect(repository.load(input.fingerprint)).resolves.not.toBeNull();
  });

  it("rejects malformed rows at the database boundary", async () => {
    const { db } = await freshDatabase();
    const input = manifest();

    await expect(
      db.insert(discoveryManifest).values({
        fingerprint: input.fingerprint,
        schemaVersion: input.schemaVersion,
        sourceSha: "not-a-sha",
        parserVersion: input.source.parserVersion,
        listingUrl: input.source.listingUrl,
        listingRawSha256: input.source.listingRawSha256,
        manifest: input,
        installedAt: INSTALLED_AT,
      }),
    ).rejects.toThrow();
    expect(await db.select().from(discoveryManifest)).toEqual([]);
  });

  it("fails closed if stored manifest content does not verify its fingerprint", async () => {
    const { db, repository } = await freshDatabase();
    const input = manifest();
    const corrupted = structuredClone(input) as unknown as Record<string, unknown>;
    corrupted.fingerprint = "0".repeat(64);

    await db.insert(discoveryManifest).values({
      fingerprint: "0".repeat(64),
      schemaVersion: input.schemaVersion,
      sourceSha: input.source.sourceSha,
      parserVersion: input.source.parserVersion,
      listingUrl: input.source.listingUrl,
      listingRawSha256: input.source.listingRawSha256,
      manifest: corrupted as unknown as DiscoveryManifest,
      installedAt: INSTALLED_AT,
    });

    await expect(repository.load("0".repeat(64))).rejects.toThrow(
      /fingerprint/iu,
    );
  });

  it("returns detached deeply frozen manifests and validates explicit lookup keys", async () => {
    const { repository } = await freshDatabase();
    const input = manifest();
    await repository.install(input, INSTALLED_AT);

    const loaded = await repository.load(input.fingerprint);
    expect(loaded?.manifest).not.toBe(input);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded?.manifest)).toBe(true);
    expect(Object.isFrozen(loaded?.manifest.entries)).toBe(true);
    expect(Object.isFrozen(loaded?.manifest.entries[0])).toBe(true);
    await expect(repository.load("bad")).rejects.toThrow(/lookup is invalid/iu);
  });

  it("preserves a verified manifest through pg_dump and restore", async () => {
    const { client, repository } = await freshDatabase();
    const input = manifest();
    await repository.install(input, INSTALLED_AT);

    const dump = await pgDump({ pg: client, args: ["--data-only"] });
    const sql = await dump.text();
    expect(sql).toContain(input.fingerprint);
    expect(sql).toContain("https://booth.pm/ja/items/3");
    expect(sql).not.toMatch(/title|description|exact_price/iu);

    const restoredClient = new PGlite();
    clients.push(restoredClient);
    await applyCommittedMigrations(restoredClient);
    await restoredClient.exec(sql);
    await restoredClient.exec("SET search_path TO public;");
    const restored = new PostgresDiscoveryManifestRepository(
      createPersistenceDatabase(restoredClient).db,
    );

    const loaded = await restored.load(input.fingerprint);
    expect(loaded?.manifest).toEqual(input);
    expect(await createPersistenceDatabase(restoredClient).db.select().from(boothProduct)).toEqual([]);
  });
});
