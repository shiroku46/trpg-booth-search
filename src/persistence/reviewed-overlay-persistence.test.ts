import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
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
import { PostgresReviewedOverlayService } from "./reviewed-overlay-service";
import { scenario as scenarioTable } from "./schema";

const clients: PGlite[] = [];
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const SCENARIO_ID = "22222222-2222-4222-8222-222222222222";
const BASE_TIME = "2026-08-06T00:00:00Z";

function known<T>(
  value: T,
  options: {
    reviewState?: "unreviewed" | "approved";
    method?: "explicit_source" | "ai_candidate";
    confidence?: "high" | "medium";
  } = {},
): EvidencedValue<T> {
  return {
    state: "known",
    value,
    confidence: options.confidence ?? "high",
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

function tags(): ScenarioTags {
  return {
    genre: known(["synthetic"]),
    tone: known(["synthetic"]),
    setting: known(["synthetic"]),
    structure: known(["synthetic"]),
    content: known(["synthetic"]),
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
    edition: known("AI候補版", {
      reviewState: "unreviewed",
      method: "ai_candidate",
    }),
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

const target = (
  overrides: Partial<ReviewApplicationTarget> = {},
): ReviewApplicationTarget => ({
  productId: PRODUCT_ID,
  entityType: "scenario",
  entityId: SCENARIO_ID,
  fieldPath: "edition",
  versionKey: {
    contentVersion: "content-v1",
    normalizerVersion: "normalizer-v1",
    registryVersion: "registry-v1",
  },
  ...overrides,
});

const snapshot = (overrides: Partial<ReviewSnapshot> = {}): ReviewSnapshot => ({
  evidencedState: "known",
  confidence: "high",
  initialReviewState: "unreviewed",
  evidenceCount: 1,
  hasConflict: false,
  holdReason: null,
  containsAiEvidence: true,
  versionKey: { ...target().versionKey },
  ...overrides,
});

async function freshDatabase() {
  const client = new PGlite();
  clients.push(client);
  await applyCommittedMigrations(client);
  const { db } = createPersistenceDatabase(client);
  const graphRepository = new PostgresProductScenarioRepository(db);
  await graphRepository.saveGraph(graph());
  return {
    client,
    db,
    graphRepository,
    reviewRepository: new PostgresReviewRepository(db),
    applicationRepository: new PostgresReviewApplicationRepository(db),
    overlayService: new PostgresReviewedOverlayService(db),
  };
}

async function completeReview(
  reviewRepository: PostgresReviewRepository,
  applicationRepository: PostgresReviewApplicationRepository,
  decision: "approved" | "rejected" | "needs_more_evidence",
) {
  const applicationTarget = target();
  const suffix =
    decision === "approved" ? "1" : decision === "rejected" ? "2" : "3";
  const caseId = `30000000-0000-4000-8000-00000000000${suffix}`;
  const decisionId = `40000000-0000-4000-8000-00000000000${suffix}`;
  await reviewRepository.openCase({
    id: caseId,
    productId: PRODUCT_ID,
    entityType: "scenario",
    entityId: SCENARIO_ID,
    fieldPath: "edition",
    snapshot: snapshot(),
    createdAt: "2026-08-06T00:01:00Z",
  });
  await reviewRepository.decide({
    id: decisionId,
    caseId,
    decision,
    reason:
      decision === "approved"
        ? "evidence_sufficient"
        : decision === "rejected"
          ? "unsupported_claim"
          : "evidence_insufficient",
    decidedAt: "2026-08-06T00:02:00Z",
  });
  await applicationRepository.apply({
    id: `50000000-0000-4000-8000-00000000000${suffix}`,
    reviewCaseId: caseId,
    reviewDecisionEventId: decisionId,
    target: applicationTarget,
    appliedAt: "2026-08-06T00:03:00Z",
  });
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("Stage 17 persistence-backed reviewed overlays", () => {
  it.each([
    ["approved", "approved", true],
    ["rejected", "rejected", false],
    ["needs_more_evidence", "needs_more_evidence", false],
  ] as const)(
    "derives %s without mutating the stored graph",
    async (decision, expectedReviewState, expectedPublish) => {
      const {
        graphRepository,
        reviewRepository,
        applicationRepository,
        overlayService,
      } = await freshDatabase();
      const storedBefore = await graphRepository.loadGraph(PRODUCT_ID);
      expect(storedBefore).not.toBeNull();
      const publicBefore = project(
        storedBefore!.product,
        storedBefore!.scenarios[0]!,
      );
      expect(publicBefore.publish).toBe(false);

      await completeReview(reviewRepository, applicationRepository, decision);
      const overlay = await overlayService.loadReviewedGraph(target());
      expect(overlay).toMatchObject({
        state: "materialized",
        scenarios: [{ edition: { reviewState: expectedReviewState } }],
      });
      if (overlay.state === "materialized") {
        const effective = project(overlay.product, overlay.scenarios[0]!);
        expect(effective.publish).toBe(expectedPublish);
        if (expectedPublish && effective.publish)
          expect(effective.value.edition.state).toBe("known");
      }

      const storedAfter = await graphRepository.loadGraph(PRODUCT_ID);
      expect(storedAfter).toEqual(storedBefore);
      expect(storedAfter!.scenarios[0]!.edition.reviewState).toBe("unreviewed");
    },
  );

  it("keeps unapplied and stale targets omitted", async () => {
    const { overlayService } = await freshDatabase();
    await expect(
      overlayService.loadReviewedGraph(target()),
    ).resolves.toMatchObject({ state: "omitted", reason: "unapplied" });
    await expect(
      overlayService.loadReviewedGraph(
        target({
          versionKey: {
            ...target().versionKey,
            contentVersion: "content-v2",
          },
        }),
      ),
    ).resolves.toMatchObject({ state: "omitted", reason: "unapplied" });
  });

  it("fails closed when stored metadata diverges without a version change", async () => {
    const { db, reviewRepository, applicationRepository, overlayService } =
      await freshDatabase();
    await completeReview(reviewRepository, applicationRepository, "approved");
    const [row] = await db
      .select()
      .from(scenarioTable)
      .where(eq(scenarioTable.id, SCENARIO_ID));
    expect(row?.edition).not.toBeNull();
    await db
      .update(scenarioTable)
      .set({
        edition: {
          ...row!.edition!,
          confidence: "medium",
        },
      })
      .where(eq(scenarioTable.id, SCENARIO_ID));
    await expect(
      overlayService.loadReviewedGraph(target()),
    ).resolves.toMatchObject({ state: "omitted", reason: "metadata_mismatch" });
  });

  it("rejects unstable array-row and unknown field paths", async () => {
    const { overlayService } = await freshDatabase();
    for (const fieldPath of [
      "required_books",
      "compatibility",
      "relationships",
      "unknown_field",
    ])
      await expect(
        overlayService.loadReviewedGraph(target({ fieldPath })),
      ).resolves.toMatchObject({
        state: "omitted",
        reason: "unsupported_field",
      });

    await expect(
      overlayService.loadReviewedGraph(
        target({ fieldPath: "required_books.0" }),
      ),
    ).rejects.toThrow(/target is invalid/iu);
  });
});
