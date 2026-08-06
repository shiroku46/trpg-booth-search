import { PGlite } from "@electric-sql/pglite";
import { pgDump } from "@electric-sql/pglite-tools";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import type {
  EvidencedValue,
  Product,
  Scenario,
  ScenarioTags,
} from "../domain";
import { project } from "../publication";
import type { ReviewSnapshot } from "../review";
import type { ReviewApplicationTarget } from "../review-application";
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
import { reviewApplicationEvent } from "./schema";

const clients: PGlite[] = [];
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const SCENARIO_ID = "22222222-2222-4222-8222-222222222222";
const BASE_TIME = "2026-08-06T00:00:00Z";

function known<T>(value: T): EvidencedValue<T> {
  return {
    state: "known",
    value,
    confidence: "high",
    reviewState: "approved",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
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
    edition: known("synthetic-edition"),
    playTimeMinutes: known({ minimumMinutes: 120, maximumMinutes: 180 }),
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

const snapshot = (
  applicationTarget: ReviewApplicationTarget,
  overrides: Partial<ReviewSnapshot> = {},
): ReviewSnapshot => ({
  evidencedState: "known",
  confidence: "high",
  initialReviewState: "unreviewed",
  evidenceCount: 1,
  hasConflict: false,
  holdReason: null,
  containsAiEvidence: true,
  versionKey: { ...applicationTarget.versionKey },
  ...overrides,
});

async function freshDatabase() {
  const client = new PGlite();
  clients.push(client);
  await applyCommittedMigrations(client);
  const { db } = createPersistenceDatabase(client);
  const productRepository = new PostgresProductScenarioRepository(db);
  await productRepository.saveGraph(graph());
  return {
    client,
    db,
    productRepository,
    reviewRepository: new PostgresReviewRepository(db),
    applicationRepository: new PostgresReviewApplicationRepository(db),
  };
}

async function createDecision(
  reviewRepository: PostgresReviewRepository,
  options: {
    caseId: string;
    decisionId: string;
    applicationTarget?: ReviewApplicationTarget;
    decision?: "approved" | "rejected" | "needs_more_evidence";
    reason?:
      | "evidence_sufficient"
      | "unsupported_claim"
      | "evidence_insufficient";
    createdAt?: string;
    decidedAt?: string;
    snapshotOverrides?: Partial<ReviewSnapshot>;
  },
) {
  const applicationTarget = options.applicationTarget ?? target();
  await reviewRepository.openCase({
    id: options.caseId,
    productId: applicationTarget.productId,
    entityType: applicationTarget.entityType,
    entityId: applicationTarget.entityId,
    fieldPath: applicationTarget.fieldPath,
    snapshot: snapshot(applicationTarget, options.snapshotOverrides),
    createdAt: options.createdAt ?? "2026-08-06T00:01:00Z",
  });
  const decisionState = options.decision ?? "approved";
  const reason =
    options.reason ??
    (decisionState === "approved"
      ? "evidence_sufficient"
      : decisionState === "rejected"
        ? "unsupported_claim"
        : "evidence_insufficient");
  await reviewRepository.decide({
    id: options.decisionId,
    caseId: options.caseId,
    decision: decisionState,
    reason,
    decidedAt: options.decidedAt ?? "2026-08-06T00:02:00Z",
  });
  return applicationTarget;
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("Stage 16 immutable review application persistence", () => {
  it.each([
    ["approved", "approved"],
    ["rejected", "rejected"],
    ["needs_more_evidence", "needs_more_evidence"],
  ] as const)(
    "persists %s as the expected effective projection",
    async (decisionState, expectedState) => {
      const { reviewRepository, applicationRepository } = await freshDatabase();
      const index =
        decisionState === "approved"
          ? "1"
          : decisionState === "rejected"
            ? "2"
            : "3";
      const applicationTarget = await createDecision(reviewRepository, {
        caseId: `30000000-0000-4000-8000-00000000000${index}`,
        decisionId: `40000000-0000-4000-8000-00000000000${index}`,
        decision: decisionState,
      });
      await applicationRepository.apply({
        id: `50000000-0000-4000-8000-00000000000${index}`,
        reviewCaseId: `30000000-0000-4000-8000-00000000000${index}`,
        reviewDecisionEventId: `40000000-0000-4000-8000-00000000000${index}`,
        target: applicationTarget,
        appliedAt: "2026-08-06T00:03:00Z",
      });
      const effective =
        await applicationRepository.loadEffectiveProjection(applicationTarget);
      if (expectedState === "approved")
        expect(effective).toMatchObject({ state: "approved" });
      else
        expect(effective).toMatchObject({
          state: "omitted",
          reason: expectedState,
        });
    },
  );

  it("is idempotent for identical application metadata and rejects conflicts", async () => {
    const { db, reviewRepository, applicationRepository } =
      await freshDatabase();
    const applicationTarget = await createDecision(reviewRepository, {
      caseId: "31000000-0000-4000-8000-000000000001",
      decisionId: "41000000-0000-4000-8000-000000000001",
    });
    const input = {
      id: "51000000-0000-4000-8000-000000000001",
      reviewCaseId: "31000000-0000-4000-8000-000000000001",
      reviewDecisionEventId: "41000000-0000-4000-8000-000000000001",
      target: applicationTarget,
      appliedAt: "2026-08-06T00:03:00Z",
    };
    await expect(applicationRepository.apply(input)).resolves.toMatchObject({
      state: "inserted",
    });
    await expect(
      applicationRepository.apply({
        ...input,
        id: "51000000-0000-4000-8000-000000000002",
      }),
    ).resolves.toEqual({
      state: "existing",
      applicationId: input.id,
    });
    await expect(
      applicationRepository.apply({
        ...input,
        id: "51000000-0000-4000-8000-000000000003",
        appliedAt: "2026-08-06T00:04:00Z",
      }),
    ).rejects.toThrow(/identity conflict/iu);
    expect(await db.select().from(reviewApplicationEvent)).toHaveLength(1);
  });

  it("rejects cross-target and stale applications", async () => {
    const { reviewRepository, applicationRepository } = await freshDatabase();
    const applicationTarget = await createDecision(reviewRepository, {
      caseId: "32000000-0000-4000-8000-000000000001",
      decisionId: "42000000-0000-4000-8000-000000000001",
    });
    const base = {
      id: "52000000-0000-4000-8000-000000000001",
      reviewCaseId: "32000000-0000-4000-8000-000000000001",
      reviewDecisionEventId: "42000000-0000-4000-8000-000000000001",
      target: applicationTarget,
      appliedAt: "2026-08-06T00:03:00Z",
    };
    await expect(
      applicationRepository.apply({
        ...base,
        target: target({ fieldPath: "title" }),
      }),
    ).rejects.toThrow(/does not match/iu);
    await expect(
      applicationRepository.apply({
        ...base,
        target: target({
          versionKey: {
            ...applicationTarget.versionKey,
            registryVersion: "registry-v2",
          },
        }),
      }),
    ).rejects.toThrow(/stale/iu);
    await expect(
      applicationRepository.apply({
        ...base,
        target: target({
          productId: "11111111-1111-4111-8111-111111111199",
        }),
      }),
    ).rejects.toThrow(/does not match/iu);
  });

  it("creates independent applications for later versions", async () => {
    const { db, reviewRepository, applicationRepository } =
      await freshDatabase();
    const first = await createDecision(reviewRepository, {
      caseId: "33000000-0000-4000-8000-000000000001",
      decisionId: "43000000-0000-4000-8000-000000000001",
    });
    const secondTarget = target({
      versionKey: {
        contentVersion: "content-v2",
        normalizerVersion: "normalizer-v1",
        registryVersion: "registry-v1",
      },
    });
    const second = await createDecision(reviewRepository, {
      caseId: "33000000-0000-4000-8000-000000000002",
      decisionId: "43000000-0000-4000-8000-000000000002",
      applicationTarget: secondTarget,
      createdAt: "2026-08-06T01:01:00Z",
      decidedAt: "2026-08-06T01:02:00Z",
    });
    await applicationRepository.apply({
      id: "53000000-0000-4000-8000-000000000001",
      reviewCaseId: "33000000-0000-4000-8000-000000000001",
      reviewDecisionEventId: "43000000-0000-4000-8000-000000000001",
      target: first,
      appliedAt: "2026-08-06T00:03:00Z",
    });
    await applicationRepository.apply({
      id: "53000000-0000-4000-8000-000000000002",
      reviewCaseId: "33000000-0000-4000-8000-000000000002",
      reviewDecisionEventId: "43000000-0000-4000-8000-000000000002",
      target: second,
      appliedAt: "2026-08-06T01:03:00Z",
    });
    expect(await db.select().from(reviewApplicationEvent)).toHaveLength(2);
    await expect(
      applicationRepository.loadEffectiveProjection(first),
    ).resolves.toMatchObject({ state: "approved" });
    await expect(
      applicationRepository.loadEffectiveProjection(second),
    ).resolves.toMatchObject({ state: "approved" });
  });

  it("enforces cross-record matching and safe approval in PostgreSQL", async () => {
    const { client, reviewRepository } = await freshDatabase();
    const applicationTarget = await createDecision(reviewRepository, {
      caseId: "34000000-0000-4000-8000-000000000001",
      decisionId: "44000000-0000-4000-8000-000000000001",
    });
    await expect(
      client.exec(`
        INSERT INTO review_application_event (
          id, review_case_id, review_decision_event_id, booth_product_id,
          entity_type, entity_id, field_path, content_version,
          normalizer_version, registry_version, outcome, applied_at
        ) VALUES (
          '54000000-0000-4000-8000-000000000001',
          '34000000-0000-4000-8000-000000000001',
          '44000000-0000-4000-8000-000000000001',
          '${PRODUCT_ID}', 'scenario', '${SCENARIO_ID}', 'title',
          '${applicationTarget.versionKey.contentVersion}',
          '${applicationTarget.versionKey.normalizerVersion}',
          '${applicationTarget.versionKey.registryVersion}',
          'approved', '2026-08-06T00:03:00Z'
        );
      `),
    ).rejects.toThrow();

    await client.exec(`
      INSERT INTO review_case (
        id, booth_product_id, entity_type, entity_id, field_path,
        evidenced_state, confidence, initial_review_state, evidence_count,
        has_conflict, hold_reason, contains_ai_evidence,
        content_version, normalizer_version, registry_version,
        priority, reasons, created_at
      ) VALUES (
        '34000000-0000-4000-8000-000000000002', '${PRODUCT_ID}',
        'scenario', '${SCENARIO_ID}', 'title', 'known', 'low',
        'unreviewed', 1, false, NULL, true, 'content-v1',
        'normalizer-v1', 'registry-v1', 'blocking',
        '["ai_candidate_requires_approval", "low_confidence"]'::jsonb,
        '2026-08-06T00:01:00Z'
      );
      INSERT INTO review_decision_event (
        id, review_case_id, decision, reason, decided_at
      ) VALUES (
        '44000000-0000-4000-8000-000000000002',
        '34000000-0000-4000-8000-000000000002',
        'approved', 'evidence_sufficient', '2026-08-06T00:02:00Z'
      );
    `);
    await expect(
      client.exec(`
        INSERT INTO review_application_event (
          id, review_case_id, review_decision_event_id, booth_product_id,
          entity_type, entity_id, field_path, content_version,
          normalizer_version, registry_version, outcome, applied_at
        ) VALUES (
          '54000000-0000-4000-8000-000000000002',
          '34000000-0000-4000-8000-000000000002',
          '44000000-0000-4000-8000-000000000002',
          '${PRODUCT_ID}', 'scenario', '${SCENARIO_ID}', 'title',
          'content-v1', 'normalizer-v1', 'registry-v1',
          'approved', '2026-08-06T00:03:00Z'
        );
      `),
    ).rejects.toThrow();
  });

  it("enforces append-only application events", async () => {
    const { db, reviewRepository, applicationRepository } =
      await freshDatabase();
    const applicationTarget = await createDecision(reviewRepository, {
      caseId: "35000000-0000-4000-8000-000000000001",
      decisionId: "45000000-0000-4000-8000-000000000001",
    });
    const applicationId = "55000000-0000-4000-8000-000000000001";
    await applicationRepository.apply({
      id: applicationId,
      reviewCaseId: "35000000-0000-4000-8000-000000000001",
      reviewDecisionEventId: "45000000-0000-4000-8000-000000000001",
      target: applicationTarget,
      appliedAt: "2026-08-06T00:03:00Z",
    });
    await expect(
      db
        .update(reviewApplicationEvent)
        .set({ outcome: "excluded_rejected" })
        .where(eq(reviewApplicationEvent.id, applicationId)),
    ).rejects.toThrow();
    await expect(
      db
        .delete(reviewApplicationEvent)
        .where(eq(reviewApplicationEvent.id, applicationId)),
    ).rejects.toThrow();
  });

  it("preserves the exact effective projection through pg_dump and restore", async () => {
    const { client, reviewRepository, applicationRepository } =
      await freshDatabase();
    const applicationTarget = await createDecision(reviewRepository, {
      caseId: "36000000-0000-4000-8000-000000000001",
      decisionId: "46000000-0000-4000-8000-000000000001",
    });
    await applicationRepository.apply({
      id: "56000000-0000-4000-8000-000000000001",
      reviewCaseId: "36000000-0000-4000-8000-000000000001",
      reviewDecisionEventId: "46000000-0000-4000-8000-000000000001",
      target: applicationTarget,
      appliedAt: "2026-08-06T00:03:00Z",
    });

    const dump = await pgDump({ pg: client, args: ["--data-only"] });
    const sql = await dump.text();
    const restoredClient = new PGlite();
    clients.push(restoredClient);
    await applyCommittedMigrations(restoredClient);
    await restoredClient.exec(sql);
    await restoredClient.exec("SET search_path TO public;");
    const restored = new PostgresReviewApplicationRepository(
      createPersistenceDatabase(restoredClient).db,
    );
    await expect(
      restored.loadEffectiveProjection(applicationTarget),
    ).resolves.toMatchObject({
      state: "approved",
      applicationId: "56000000-0000-4000-8000-000000000001",
    });
  });

  it("keeps source/publication data unchanged and stores metadata only", async () => {
    const { db, productRepository, reviewRepository, applicationRepository } =
      await freshDatabase();
    const source = graph();
    const before = project(source.product, source.scenarios[0]!);
    const applicationTarget = await createDecision(reviewRepository, {
      caseId: "37000000-0000-4000-8000-000000000001",
      decisionId: "47000000-0000-4000-8000-000000000001",
    });
    await applicationRepository.apply({
      id: "57000000-0000-4000-8000-000000000001",
      reviewCaseId: "37000000-0000-4000-8000-000000000001",
      reviewDecisionEventId: "47000000-0000-4000-8000-000000000001",
      target: applicationTarget,
      appliedAt: "2026-08-06T00:03:00Z",
    });
    const loaded = await productRepository.loadGraph(PRODUCT_ID);
    expect(loaded).not.toBeNull();
    const after = project(loaded!.product, loaded!.scenarios[0]!);
    expect(after).toEqual(before);
    const serialized = JSON.stringify(
      await db.select().from(reviewApplicationEvent),
    );
    expect(serialized).not.toContain("合成シナリオ");
    expect(serialized).not.toContain("fieldValue");
    expect(serialized).not.toContain("reviewer");
  });
});
