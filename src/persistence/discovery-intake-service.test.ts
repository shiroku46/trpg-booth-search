import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDiscoveryManifest } from "../discovery-manifest";
import {
  applyCommittedMigrations,
  createPersistenceDatabase,
} from "./database";
import { DiscoveryIntakeService } from "./discovery-intake-service";
import { PostgresDiscoveryManifestRepository } from "./discovery-manifest-repository";
import { boothProduct, reviewCase, scenario } from "./schema";

const clients: PGlite[] = [];
const SOURCE_SHA = "8".repeat(40);
const RAW_SHA = "a".repeat(64);
const INSTALLED_AT = "2026-08-07T14:00:00Z";

function manifest() {
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
  const repository = new PostgresDiscoveryManifestRepository(db);
  return {
    client,
    db,
    repository,
    service: new DiscoveryIntakeService(repository),
  };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("Stage 31 blocked discovery intake", () => {
  it("loads one exact persisted manifest into a deterministic blocked report", async () => {
    const { repository, service } = await freshDatabase();
    const input = manifest();
    await repository.install(input, INSTALLED_AT);

    const report = await service.loadExact(input.fingerprint);

    expect(report).toEqual({
      state: "found",
      manifestFingerprint: input.fingerprint,
      source: {
        sourceSha: SOURCE_SHA,
        parserVersion: "stage28-pilot-v8",
        listingUrl: "https://booth.pm/ja/browse/TRPG?adult=none&type=digital",
        listingRawSha256: RAW_SHA,
      },
      identities: [
        {
          productId: "3",
          canonicalUrl: "https://booth.pm/ja/items/3",
          classificationState: "unclassified",
          ageState: "unknown",
          detailAccessAuthorized: false,
          publicationEligible: false,
        },
        {
          productId: "20",
          canonicalUrl: "https://booth.pm/ja/items/20",
          classificationState: "unclassified",
          ageState: "unknown",
          detailAccessAuthorized: false,
          publicationEligible: false,
        },
      ],
    });
  });

  it("returns an explicit immutable missing report for an absent exact fingerprint", async () => {
    const { service } = await freshDatabase();
    const fingerprint = "f".repeat(64);

    const report = await service.loadExact(fingerprint);

    expect(report).toEqual({
      state: "manifest_not_found",
      manifestFingerprint: fingerprint,
      identities: [],
    });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.identities)).toBe(true);
  });

  it("rejects non-exact lookup identifiers before repository access", async () => {
    const load = vi.fn();
    const service = new DiscoveryIntakeService({ load });

    await expect(service.loadExact("latest")).rejects.toThrow(
      /fingerprint is invalid/iu,
    );
    expect(load).not.toHaveBeenCalled();
  });

  it("never promotes identities into product, scenario, or review state", async () => {
    const { db, repository, service } = await freshDatabase();
    const input = manifest();
    await repository.install(input, INSTALLED_AT);
    await service.loadExact(input.fingerprint);

    expect(await db.select().from(boothProduct)).toEqual([]);
    expect(await db.select().from(scenario)).toEqual([]);
    expect(await db.select().from(reviewCase)).toEqual([]);
  });

  it("returns detached deeply frozen reports without mutating the stored manifest", async () => {
    const { repository, service } = await freshDatabase();
    const input = manifest();
    await repository.install(input, INSTALLED_AT);

    const first = await service.loadExact(input.fingerprint);
    const second = await service.loadExact(input.fingerprint);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.identities)).toBe(true);
    expect(first.identities.every(Object.isFrozen)).toBe(true);

    const stored = await repository.load(input.fingerprint);
    expect(stored?.manifest).toEqual(input);
  });
});
