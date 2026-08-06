import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

import type {
  EvidencedValue,
  Product,
  Scenario,
  ScenarioTags,
} from "../domain";
import { project } from "../publication";
import type { ReviewApplicationTarget } from "../review-application";
import type { ReviewSnapshot } from "../review";
import {
  applyCommittedMigrations,
  createPersistenceDatabase,
} from "./database";
import {
  PostgresProductScenarioRepository,
  type StoredGraphInput,
} from "./repository";
import { PostgresReviewApplicationRepository } from "./review-application-repository";
import { PostgresReviewRepository } from "./review-repository";
import { PostgresReviewedOverlayBatchService } from "./reviewed-overlay-batch-service";

const clients: PGlite[] = [];
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const SCENARIO_ID = "22222222-2222-4222-8222-222222222222";
const BASE_TIME = "2026-08-06T00:00:00Z";

function known<T>(
  value: T,
  options: {
    reviewState?: "unreviewed" | "approved";
    method?: "explicit_source" | "ai_candidate";
  } = {},
): EvidencedValue<T> {
  return {
    state: "known",
    value,
    confidence: "high",
    reviewState: options.reviewState ?? "approved",
    evidence: [
      {
        pointer: "synthetic",
        method: options.method ?? "explicit_source",
      },
    ],
    contentVersion: "content-v1",
    checkedAt: BASE_TIME,
  };
}

function candidate<T>(value: T): EvidencedValue<T> {
  return known(value, {
    reviewState: "unreviewed",
    method: "ai_candidate",
  });
}

function tags(): ScenarioTags {
  return {
    genre: candidate<readonly string[]>(["synthetic"]),
    tone: known<readonly string[]>(["synthetic"]),
    setting: known<readonly string[]>(["synthetic"]),
    structure: known<readonly string[]>(["synthetic"]),
    content: known<readonly string[]>(["synthetic"]),
  };
}

function graph(): StoredGraphInput {
  const product: Product = {
    id: PRODUCT_ID,
    canonicalUrl: "https://booth.pm/ja/items/1234567",
    title: "合成商品",
    salesState: known("available"),
    sourcePublicationDate: known("2026-08-01T00:00:00Z"),
    firstSeenAt: BASE_TIME,
    lastCheckedAt: BASE_TIME,
    allAges: known("all_ages_confirmed"),
    classification: {
      ...known("scenario_single"),
      normalizerVersion: "normalizer-v1",
      registryVersion: "registry-v1",
    },
  };
  const scenario: Scenario = {
    id: SCENARIO_ID,
    productId: PRODUCT_ID,
    title: known("合成シナリオ"),
    playerCount: known({ minimumPlayers: 2, maximumPlayers: 4 }),
    edition: candidate("AI候補版"),
    playTimeMinutes: known({
      minimumMinutes: 120,
      maximumMinutes: 180,
    }),
    modality: known("online"),
    tags: tags(),
    requiredBooks: [],
    compatibility: [],
    separationApproved: true,
    relationships: [],
  };
  return {
    product,
    sourceProductId: "1234567",
    contentVersion: "content-v1",
    currentRecordUpdatedAt: BASE_TIME,
    scenarios: [scenario],
    normalizationHistory: [],
  };
}

function target(
  fieldPath: string,
  overrides: Partial<ReviewApplicationTarget> = {},
): ReviewApplicationTarget {
  return {
    productId: PRODUCT_ID,
    entityType: "scenario",
    entityId: SCENARIO_ID,
    fieldPath,
    versionKey: {
      contentVersion: "content-v1",
      normalizerVersion: "normalizer-v1",
      registryVersion: "registry-v1",
    },
    ...overrides,
  };
}

function snapshot(applicationTarget: ReviewApplicationTarget): ReviewSnapshot {
  return {
    evidencedState: "known",
    confidence: "high",
    initialReviewState: "unreviewed",
    evidenceCount: 1,
    hasConflict: false,
    holdReason: null,
    containsAiEvidence: true,
    versionKey: { ...applicationTarget.versionKey },
  };
}

async function freshDatabase() {
  const client = new PGlite();
  clients.push(client);
  await applyCommittedMigrations(client);
  const { db } = createPersistenceDatabase(client);
  const graphRepository = new PostgresProductScenarioRepository(db);
  await graphRepository.saveGraph(graph());
  return {
    graphRepository,
    reviewRepository: new PostgresReviewRepository(db),
    applicationRepository: new PostgresReviewApplicationRepository(db),
    batchService: new PostgresReviewedOverlayBatchService(db),
  };
}

async function approveTarget(
  reviewRepository: PostgresReviewRepository,
  applicationRepository: PostgresReviewApplicationRepository,
  applicationTarget: ReviewApplicationTarget,
  suffix: string,
) {
  const caseId = `30000000-0000-4000-8000-00000000000${suffix}`;
  const decisionId = `40000000-0000-4000-8000-00000000000${suffix}`;
  await reviewRepository.openCase({
    id: caseId,
    productId: PRODUCT_ID,
    entityType: applicationTarget.entityType,
    entityId: applicationTarget.entityId,
    fieldPath: applicationTarget.fieldPath,
    snapshot: snapshot(applicationTarget),
    createdAt: `2026-08-06T00:0${suffix}:00Z`,
  });
  await reviewRepository.decide({
    id: decisionId,
    caseId,
    decision: "approved",
    reason: "evidence_sufficient",
    decidedAt: `2026-08-06T00:1${suffix}:00Z`,
  });
  await applicationRepository.apply({
    id: `50000000-0000-4000-8000-00000000000${suffix}`,
    reviewCaseId: caseId,
    reviewDecisionEventId: decisionId,
    target: applicationTarget,
    appliedAt: `2026-08-06T00:2${suffix}:00Z`,
  });
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("Stage 18 persistence-backed reviewed overlay batches", () => {
  it("resolves exact targets, reports missing cases, and preserves storage", async () => {
    const {
      graphRepository,
      reviewRepository,
      applicationRepository,
      batchService,
    } = await freshDatabase();
    const storedBefore = await graphRepository.loadGraph(PRODUCT_ID);
    expect(storedBefore).not.toBeNull();
    expect(
      project(storedBefore!.product, storedBefore!.scenarios[0]!).publish,
    ).toBe(false);

    const editionTarget = target("edition");
    const genreTarget = target("tags.genre");
    const missingTarget = target("tags.content", {
      versionKey: {
        ...target("tags.content").versionKey,
        contentVersion: "content-v2",
      },
    });
    await approveTarget(
      reviewRepository,
      applicationRepository,
      editionTarget,
      "1",
    );
    await approveTarget(
      reviewRepository,
      applicationRepository,
      genreTarget,
      "2",
    );

    const result = await batchService.loadReviewedGraphBatch([
      genreTarget,
      missingTarget,
      editionTarget,
    ]);
    expect(result).not.toBeNull();
    expect(result!.report).toMatchObject([
      { state: "materialized", target: { fieldPath: "edition" } },
      {
        state: "omitted",
        reason: "unapplied",
        target: { fieldPath: "tags.content" },
      },
      { state: "materialized", target: { fieldPath: "tags.genre" } },
    ]);
    expect(result!.scenarios[0]?.edition.reviewState).toBe("approved");
    expect(result!.scenarios[0]?.tags.genre.reviewState).toBe("approved");
    expect(project(result!.product, result!.scenarios[0]!).publish).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result!.report)).toBe(true);

    const storedAfter = await graphRepository.loadGraph(PRODUCT_ID);
    expect(storedAfter).toEqual(storedBefore);
    expect(storedAfter!.scenarios[0]!.edition.reviewState).toBe("unreviewed");
    expect(storedAfter!.scenarios[0]!.tags.genre.reviewState).toBe(
      "unreviewed",
    );
  });
});
