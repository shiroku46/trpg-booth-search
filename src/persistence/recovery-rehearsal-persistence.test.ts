import { createHash } from "node:crypto";

import { PGlite } from "@electric-sql/pglite";
import { pgDump } from "@electric-sql/pglite-tools";
import { afterEach, describe, expect, it } from "vitest";

import type {
  EvidencedValue,
  Modality,
  PlayerCountRange,
  PlayTimeRange,
  Product,
  Scenario,
  ScenarioTags,
} from "../domain";
import { CURRENT_PRODUCTION_READINESS } from "../production-readiness";
import {
  createRecoveryRehearsalReport,
  validateRecoveryRehearsalReport,
} from "../recovery-rehearsal";
import {
  applyCommittedMigrations,
  createPersistenceDatabase,
} from "./database";
import {
  PostgresProductScenarioRepository,
  type StoredGraphInput,
} from "./repository";

const clients: PGlite[] = [];
const NOW = "2026-08-07T14:30:00Z";
const TARGET_PRODUCT = "16666666-6666-4666-8666-666666666666";
const TARGET_SCENARIO = "26666666-6666-4666-8666-666666666666";
const SAFE_PRODUCT = "17777777-7777-4777-8777-777777777777";
const SAFE_SCENARIO = "27777777-7777-4777-8777-777777777777";
const TARGET_TITLE = "SYNTHETIC_PURGED_PRODUCT_MARKER";
const TARGET_SCENARIO_TITLE = "SYNTHETIC_PURGED_SCENARIO_MARKER";
const TARGET_RAW_HASH = "c".repeat(64);
const TARGET_NORMALIZED_HASH = "d".repeat(64);
const SAFE_RAW_HASH = "e".repeat(64);

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function known<T>(value: T): EvidencedValue<T> {
  return {
    state: "known",
    value,
    confidence: "high",
    reviewState: "approved",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
    contentVersion: "recovery-rehearsal-v1",
    checkedAt: NOW,
  };
}

function tags(): ScenarioTags {
  return {
    genre: known([]),
    tone: known([]),
    setting: known([]),
    structure: known([]),
    content: known([]),
  };
}

function graph(options: {
  productId: string;
  scenarioId: string;
  sourceProductId: string;
  productTitle: string;
  scenarioTitle: string;
  rawHash: string;
}): StoredGraphInput {
  const sourceUrl = `https://booth.pm/ja/items/${options.sourceProductId}`;
  const product: Product = {
    id: options.productId,
    canonicalUrl: sourceUrl,
    title: options.productTitle,
    salesState: known("available"),
    sourcePublicationDate: known("2026-08-07T00:00:00Z"),
    isFree: known(false),
    firstSeenAt: NOW,
    lastCheckedAt: NOW,
    allAges: known("all_ages_confirmed"),
  };
  const scenario: Scenario = {
    id: options.scenarioId,
    productId: options.productId,
    title: known(options.scenarioTitle),
    playerCount: known<PlayerCountRange>({
      minimumPlayers: 1,
      maximumPlayers: 4,
    }),
    edition: known("synthetic-edition"),
    playTimeMinutes: known<PlayTimeRange>({
      minimumMinutes: 60,
      maximumMinutes: 120,
    }),
    modality: known<Modality>("online"),
    tags: tags(),
    requiredBooks: [],
    compatibility: [],
    separationApproved: true,
    relationships: [],
  };
  return {
    product,
    sourceProductId: options.sourceProductId,
    contentVersion: "recovery-rehearsal-v1",
    currentRecordUpdatedAt: NOW,
    scenarios: [scenario],
    sourceSnapshots: [
      {
        id: options.productId.replace(/^./u, "7"),
        productId: options.productId,
        sourceUrl,
        outcome: "http_200",
        statusCode: 200,
        rawSha256: options.rawHash,
        normalizedSha256:
          options.productId === TARGET_PRODUCT
            ? TARGET_NORMALIZED_HASH
            : "f".repeat(64),
        contentVersion: "recovery-rehearsal-v1",
        parserVersion: "synthetic-recovery-parser-v1",
        checkedAt: NOW,
      },
    ],
    normalizationHistory: [
      {
        id: options.productId.replace(/^./u, "8"),
        productId: options.productId,
        entityType: "scenario",
        entityId: options.scenarioId,
        contentVersion: "recovery-rehearsal-v1",
        normalizerVersion: "synthetic-recovery-normalizer-v1",
        registryVersion: "registry-not-consulted",
        bodyDerivedSha256: options.rawHash,
        decision: { state: "approved", synthetic: true },
        createdAt: NOW,
      },
    ],
  };
}

async function restoredFromDataDump(sql: string) {
  const client = new PGlite();
  clients.push(client);
  await applyCommittedMigrations(client);
  await client.exec(sql);
  await client.exec("SET search_path TO public;");
  return {
    client,
    repository: new PostgresProductScenarioRepository(
      createPersistenceDatabase(client).db,
    ),
  };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("Stage 35 local purge-safe recovery rehearsal", () => {
  it("produces a bounded passed report without resolving the production recovery gate", async () => {
    const sourceClient = new PGlite();
    clients.push(sourceClient);
    await applyCommittedMigrations(sourceClient);
    const sourceRepository = new PostgresProductScenarioRepository(
      createPersistenceDatabase(sourceClient).db,
    );

    await sourceRepository.saveGraph(
      graph({
        productId: TARGET_PRODUCT,
        scenarioId: TARGET_SCENARIO,
        sourceProductId: "300001",
        productTitle: TARGET_TITLE,
        scenarioTitle: TARGET_SCENARIO_TITLE,
        rawHash: TARGET_RAW_HASH,
      }),
    );
    await sourceRepository.saveGraph(
      graph({
        productId: SAFE_PRODUCT,
        scenarioId: SAFE_SCENARIO,
        sourceProductId: "300002",
        productTitle: "SYNTHETIC_SAFE_PRODUCT",
        scenarioTitle: "SYNTHETIC_SAFE_SCENARIO",
        rawHash: SAFE_RAW_HASH,
      }),
    );

    const preDump = await pgDump({ pg: sourceClient, args: ["--data-only"] });
    const preSql = await preDump.text();
    const preRestored = await restoredFromDataDump(preSql);
    const prePurgeRestoreSucceeded =
      (await preRestored.repository.loadGraph(TARGET_PRODUCT)) !== null &&
      (await preRestored.repository.loadGraph(SAFE_PRODUCT)) !== null;

    const purge = await preRestored.repository.purgeForAgeUnknown(
      TARGET_PRODUCT,
      "2026-08-07T14:31:00Z",
    );
    const postDump = await pgDump({
      pg: preRestored.client,
      args: ["--data-only"],
    });
    const postSql = await postDump.text();

    const purgedPayloadAbsent =
      !postSql.includes(TARGET_TITLE) &&
      !postSql.includes(TARGET_SCENARIO_TITLE);
    const purgedHashesAbsent =
      !postSql.includes(TARGET_RAW_HASH) &&
      !postSql.includes(TARGET_NORMALIZED_HASH);

    const postRestored = await restoredFromDataDump(postSql);
    const targetState =
      await postRestored.repository.securityState(TARGET_PRODUCT);
    const postPurgeRestoreSucceeded =
      targetState.tombstones[0]?.purgeState === "completed" &&
      (await postRestored.repository.loadGraph(TARGET_PRODUCT)) === null;
    const unaffectedProductPreserved =
      (await postRestored.repository.loadGraph(SAFE_PRODUCT))?.product.title ===
      "SYNTHETIC_SAFE_PRODUCT";

    const report = createRecoveryRehearsalReport({
      migrationRef: "migrations:through-0005",
      prePurgeDumpSha256: sha256(preSql),
      prePurgeRestoreSucceeded,
      purgeTargetId: TARGET_PRODUCT,
      purgeCounts: {
        snapshotCount: purge.snapshotCount,
        historyCount: purge.historyCount,
        scenarioCount: purge.scenarioCount,
      },
      postPurgeDumpSha256: sha256(postSql),
      postPurgeRestoreSucceeded,
      purgedPayloadAbsent,
      purgedHashesAbsent,
      unaffectedProductPreserved,
    });

    expect(report.result).toBe("passed");
    expect(validateRecoveryRehearsalReport(report)).toEqual(report);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(TARGET_TITLE);
    expect(serialized).not.toContain(TARGET_SCENARIO_TITLE);
    expect(serialized).not.toContain("COPY public");
    expect(serialized).not.toContain("postgres://");

    const backupGate = CURRENT_PRODUCTION_READINESS.gates.find(
      (gate) => gate.id === "backup_restore",
    );
    expect(CURRENT_PRODUCTION_READINESS.ready).toBe(false);
    expect(backupGate).toMatchObject({
      state: "not_evaluated",
      reason: "backup_restore_unresolved",
      evidenceRef: "decision:PD-010",
    });
  }, 20_000);
});
