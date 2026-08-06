import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import type {
  EvidencedValue,
  Product,
  Scenario,
  ScenarioTags,
} from "../domain";
import type { ReviewSnapshot } from "../review";
import {
  applyCommittedMigrations,
  createPersistenceDatabase,
} from "./database";
import {
  PostgresProductScenarioRepository,
  type StoredGraphInput,
} from "./repository";
import { PostgresReviewRepository } from "./review-repository";
import { reviewCase, reviewDecisionEvent } from "./schema";

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

const snapshot = (overrides: Partial<ReviewSnapshot> = {}): ReviewSnapshot => ({
  evidencedState: "known",
  confidence: "low",
  initialReviewState: "unreviewed",
  evidenceCount: 1,
  hasConflict: false,
  holdReason: null,
  containsAiEvidence: false,
  versionKey: {
    contentVersion: "content-v1",
    normalizerVersion: "normalizer-v1",
    registryVersion: "registry-v1",
  },
  ...overrides,
});

async function freshDatabase() {
  const client = new PGlite();
  clients.push(client);
  await applyCommittedMigrations(client);
  const { db } = createPersistenceDatabase(client);
  await new PostgresProductScenarioRepository(db).saveGraph(graph());
  return { client, db, repository: new PostgresReviewRepository(db) };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("Stage 15 immutable local review cases", () => {
  it("opens and loads a bounded case without storing field values or payload text", async () => {
    const { db, repository } = await freshDatabase();
    const input = {
      id: "30000000-0000-4000-8000-000000000001",
      productId: PRODUCT_ID,
      entityType: "scenario" as const,
      entityId: SCENARIO_ID,
      fieldPath: "edition",
      snapshot: snapshot({ containsAiEvidence: true }),
      createdAt: "2026-08-06T00:01:00Z",
    };

    await expect(repository.openCase(input)).resolves.toEqual({
      state: "inserted",
      caseId: input.id,
    });
    const loaded = await repository.loadCase(input.id);
    expect(loaded).toMatchObject({
      target: {
        productId: PRODUCT_ID,
        entityType: "scenario",
        entityId: SCENARIO_ID,
        fieldPath: "edition",
      },
      priority: "blocking",
      reasons: ["ai_candidate_requires_approval", "low_confidence"],
      decision: null,
    });
    const raw = await db.select().from(reviewCase);
    const serialized = JSON.stringify(raw);
    expect(serialized).not.toContain("合成シナリオ");
    expect(serialized).not.toContain("fieldValue");
    expect(serialized).not.toContain("reviewer");
  });

  it("rejects opening a case when the snapshot has no review reason", async () => {
    const { repository } = await freshDatabase();
    await expect(
      repository.openCase({
        id: "30000000-0000-4000-8000-000000000002",
        productId: PRODUCT_ID,
        entityType: "scenario",
        entityId: SCENARIO_ID,
        fieldPath: "edition",
        snapshot: snapshot({ confidence: "high" }),
        createdAt: "2026-08-06T00:01:00Z",
      }),
    ).rejects.toThrow(/not required/iu);
  });

  it("is idempotent for identical metadata and fails closed on identity conflict", async () => {
    const { db, repository } = await freshDatabase();
    const input = {
      id: "31000000-0000-4000-8000-000000000001",
      productId: PRODUCT_ID,
      entityType: "scenario" as const,
      entityId: SCENARIO_ID,
      fieldPath: "edition",
      snapshot: snapshot(),
      createdAt: "2026-08-06T00:01:00Z",
    };
    await repository.openCase(input);
    await expect(
      repository.openCase({
        ...input,
        id: "31000000-0000-4000-8000-000000000002",
      }),
    ).resolves.toEqual({ state: "existing", caseId: input.id });
    await expect(
      repository.openCase({
        ...input,
        id: "31000000-0000-4000-8000-000000000003",
        snapshot: snapshot({ evidenceCount: 2 }),
      }),
    ).rejects.toThrow(/identity conflict/iu);
    expect(await db.select().from(reviewCase)).toHaveLength(1);
  });

  it("allows one final decision, retries it idempotently, and rejects a conflicting decision", async () => {
    const { repository } = await freshDatabase();
    const caseId = "32000000-0000-4000-8000-000000000001";
    await repository.openCase({
      id: caseId,
      productId: PRODUCT_ID,
      entityType: "scenario",
      entityId: SCENARIO_ID,
      fieldPath: "edition",
      snapshot: snapshot({ confidence: "high", containsAiEvidence: true }),
      createdAt: "2026-08-06T00:01:00Z",
    });
    await expect(
      repository.decide({
        id: "42000000-0000-4000-8000-000000000001",
        caseId,
        decision: "approved",
        reason: "evidence_sufficient",
        decidedAt: "2026-08-06T00:02:00Z",
      }),
    ).resolves.toMatchObject({ state: "inserted" });
    await expect(
      repository.decide({
        id: "42000000-0000-4000-8000-000000000002",
        caseId,
        decision: "approved",
        reason: "evidence_sufficient",
        decidedAt: "2026-08-06T00:03:00Z",
      }),
    ).resolves.toEqual({
      state: "existing",
      decisionId: "42000000-0000-4000-8000-000000000001",
    });
    await expect(
      repository.decide({
        id: "42000000-0000-4000-8000-000000000003",
        caseId,
        decision: "rejected",
        reason: "unsupported_claim",
        decidedAt: "2026-08-06T00:03:00Z",
      }),
    ).rejects.toThrow(/different decision/iu);
  });

  it("keeps unsafe snapshots from being approved", async () => {
    const { repository } = await freshDatabase();
    const caseId = "33000000-0000-4000-8000-000000000001";
    await repository.openCase({
      id: caseId,
      productId: PRODUCT_ID,
      entityType: "scenario",
      entityId: SCENARIO_ID,
      fieldPath: "edition",
      snapshot: snapshot({
        evidencedState: "hold",
        confidence: "unresolved",
        holdReason: "hold_alias_conflict",
        hasConflict: true,
      }),
      createdAt: "2026-08-06T00:01:00Z",
    });
    await expect(
      repository.decide({
        id: "43000000-0000-4000-8000-000000000001",
        caseId,
        decision: "approved",
        reason: "manual_policy_decision",
        decidedAt: "2026-08-06T00:02:00Z",
      }),
    ).rejects.toThrow();
    await expect(
      repository.decide({
        id: "43000000-0000-4000-8000-000000000002",
        caseId,
        decision: "needs_more_evidence",
        reason: "evidence_conflict",
        decidedAt: "2026-08-06T00:02:00Z",
      }),
    ).resolves.toMatchObject({ state: "inserted" });
  });

  it("sorts pending cases by blocking, high, normal, time, and ID", async () => {
    const { repository } = await freshDatabase();
    const cases = [
      [
        "34000000-0000-4000-8000-000000000003",
        "tags.genre",
        snapshot({ confidence: "low" }),
      ],
      [
        "34000000-0000-4000-8000-000000000002",
        "edition",
        snapshot({ evidenceCount: 0 }),
      ],
      [
        "34000000-0000-4000-8000-000000000001",
        "title",
        snapshot({ containsAiEvidence: true }),
      ],
    ] as const;
    for (const [id, fieldPath, itemSnapshot] of cases)
      await repository.openCase({
        id,
        productId: PRODUCT_ID,
        entityType: "scenario",
        entityId: SCENARIO_ID,
        fieldPath,
        snapshot: itemSnapshot,
        createdAt: "2026-08-06T00:01:00Z",
      });

    expect((await repository.pendingCases()).map(({ id }) => id)).toEqual([
      "34000000-0000-4000-8000-000000000001",
      "34000000-0000-4000-8000-000000000002",
      "34000000-0000-4000-8000-000000000003",
    ]);
  });

  it("uses a new case for a changed version key and preserves the prior decision", async () => {
    const { db, repository } = await freshDatabase();
    const firstId = "35000000-0000-4000-8000-000000000001";
    await repository.openCase({
      id: firstId,
      productId: PRODUCT_ID,
      entityType: "scenario",
      entityId: SCENARIO_ID,
      fieldPath: "edition",
      snapshot: snapshot(),
      createdAt: "2026-08-06T00:01:00Z",
    });
    await repository.decide({
      id: "45000000-0000-4000-8000-000000000001",
      caseId: firstId,
      decision: "needs_more_evidence",
      reason: "evidence_insufficient",
      decidedAt: "2026-08-06T00:02:00Z",
    });
    const secondId = "35000000-0000-4000-8000-000000000002";
    await repository.openCase({
      id: secondId,
      productId: PRODUCT_ID,
      entityType: "scenario",
      entityId: SCENARIO_ID,
      fieldPath: "edition",
      snapshot: snapshot({
        confidence: "high",
        containsAiEvidence: true,
        versionKey: {
          contentVersion: "content-v2",
          normalizerVersion: "normalizer-v1",
          registryVersion: "registry-v1",
        },
      }),
      createdAt: "2026-08-06T00:03:00Z",
    });
    expect(await db.select().from(reviewCase)).toHaveLength(2);
    expect(await db.select().from(reviewDecisionEvent)).toHaveLength(1);
    expect((await repository.pendingCases()).map(({ id }) => id)).toEqual([
      secondId,
    ]);
  });

  it("rejects invalid field paths, ownership, and stale decisions", async () => {
    const { repository } = await freshDatabase();
    await expect(
      repository.openCase({
        id: "36000000-0000-4000-8000-000000000001",
        productId: PRODUCT_ID,
        entityType: "scenario",
        entityId: SCENARIO_ID,
        fieldPath: "../title",
        snapshot: snapshot(),
        createdAt: "2026-08-06T00:01:00Z",
      }),
    ).rejects.toThrow(/field path/iu);
    await expect(
      repository.openCase({
        id: "36000000-0000-4000-8000-000000000002",
        productId: "99999999-9999-4999-8999-999999999999",
        entityType: "scenario",
        entityId: SCENARIO_ID,
        fieldPath: "title",
        snapshot: snapshot(),
        createdAt: "2026-08-06T00:01:00Z",
      }),
    ).rejects.toThrow(/not owned/iu);
  });

  it("rejects uncontrolled review metadata at the database boundary", async () => {
    const { client } = await freshDatabase();
    const inserts = [
      [
        "39000000-0000-4000-8000-000000000001",
        "unsupported",
        "high",
        "unreviewed",
      ],
      [
        "39000000-0000-4000-8000-000000000002",
        "known",
        "unsupported",
        "unreviewed",
      ],
      ["39000000-0000-4000-8000-000000000003", "known", "high", "approved"],
    ] as const;

    for (const [id, evidencedState, confidence, initialReviewState] of inserts)
      await expect(
        client.exec(`
        INSERT INTO review_case (
          id, booth_product_id, entity_type, entity_id, field_path,
          evidenced_state, confidence, initial_review_state, evidence_count,
          has_conflict, hold_reason, contains_ai_evidence,
          content_version, normalizer_version, registry_version,
          priority, reasons, created_at
        ) VALUES (
          '${id}', '${PRODUCT_ID}', 'scenario', '${SCENARIO_ID}', 'edition',
          '${evidencedState}', '${confidence}', '${initialReviewState}', 1,
          false, NULL, false,
          'content-v1', 'normalizer-v1', 'registry-v1',
          'normal', '["low_confidence"]'::jsonb, '2026-08-06T00:01:00Z'
        );
      `),
      ).rejects.toThrow();
  });

  it("enforces immutable cases and decisions at the database boundary", async () => {
    const { db, repository } = await freshDatabase();
    const caseId = "37000000-0000-4000-8000-000000000001";
    await repository.openCase({
      id: caseId,
      productId: PRODUCT_ID,
      entityType: "scenario",
      entityId: SCENARIO_ID,
      fieldPath: "edition",
      snapshot: snapshot(),
      createdAt: "2026-08-06T00:01:00Z",
    });
    await repository.decide({
      id: "47000000-0000-4000-8000-000000000001",
      caseId,
      decision: "rejected",
      reason: "unsupported_claim",
      decidedAt: "2026-08-06T00:02:00Z",
    });
    await expect(
      db
        .update(reviewCase)
        .set({ priority: "normal" })
        .where(eq(reviewCase.id, caseId)),
    ).rejects.toThrow();
    await expect(
      db.delete(reviewCase).where(eq(reviewCase.id, caseId)),
    ).rejects.toThrow();
    await expect(
      db
        .update(reviewDecisionEvent)
        .set({ reason: "manual_policy_decision" })
        .where(eq(reviewDecisionEvent.reviewCaseId, caseId)),
    ).rejects.toThrow();
    await expect(
      db
        .delete(reviewDecisionEvent)
        .where(eq(reviewDecisionEvent.reviewCaseId, caseId)),
    ).rejects.toThrow();
  });

  it("returns detached deeply frozen case data", async () => {
    const { repository } = await freshDatabase();
    const id = "38000000-0000-4000-8000-000000000001";
    await repository.openCase({
      id,
      productId: PRODUCT_ID,
      entityType: "scenario",
      entityId: SCENARIO_ID,
      fieldPath: "edition",
      snapshot: snapshot(),
      createdAt: "2026-08-06T00:01:00Z",
    });
    const loaded = await repository.loadCase(id);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded?.snapshot)).toBe(true);
    expect(Object.isFrozen(loaded?.reasons)).toBe(true);
  });
});
