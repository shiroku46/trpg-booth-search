import { describe, expect, it } from "vitest";

import type { EvidencedValue, Product, Scenario } from "./domain";
import type {
  EffectiveReviewProjection,
  ReviewApplicationTarget,
} from "./review-application";
import type { ReviewSnapshot } from "./review";
import {
  compareReviewTargets,
  composeReviewedOverlayBatch,
  type ReviewedOverlayBatchInput,
} from "./reviewed-overlay-batch";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const SCENARIO_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_SCENARIO_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function known<T>(value: T): EvidencedValue<T> {
  return {
    state: "known",
    value,
    confidence: "high",
    reviewState: "unreviewed",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
    contentVersion: "content-v1",
    checkedAt: "2026-08-06T00:00:00Z",
  };
}

function approved<T>(value: T): EvidencedValue<T> {
  return { ...known(value), reviewState: "approved" };
}

function makeProduct(includeFree = true): Product {
  return {
    id: PRODUCT_ID,
    canonicalUrl: "https://booth.pm/ja/items/1234567",
    title: "合成商品",
    salesState: approved("available" as const),
    sourcePublicationDate: approved("2026-08-01T00:00:00Z"),
    firstSeenAt: "2026-08-06T00:00:00Z",
    lastCheckedAt: "2026-08-06T00:00:00Z",
    allAges: approved("all_ages_confirmed" as const),
    ...(includeFree ? { isFree: known(true) } : {}),
  };
}

function makeScenario(): Scenario {
  return {
    id: SCENARIO_ID,
    productId: PRODUCT_ID,
    title: approved("合成シナリオ"),
    playerCount: approved({ minimumPlayers: 2, maximumPlayers: 4 }),
    edition: known("テスト版"),
    playTimeMinutes: approved({
      minimumMinutes: 120,
      maximumMinutes: 180,
    }),
    modality: approved("online" as const),
    tags: {
      genre: known<readonly string[]>(["synthetic"]),
      tone: approved<readonly string[]>(["synthetic"]),
      setting: approved<readonly string[]>(["synthetic"]),
      structure: approved<readonly string[]>(["synthetic"]),
      content: approved<readonly string[]>(["synthetic"]),
    },
    requiredBooks: [],
    compatibility: [],
    separationApproved: true,
    relationships: [],
  };
}

function scenarioTarget(
  fieldPath = "edition",
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

function productTarget(
  fieldPath = "is_free",
  overrides: Partial<ReviewApplicationTarget> = {},
): ReviewApplicationTarget {
  return {
    productId: PRODUCT_ID,
    entityType: "booth_product",
    entityId: PRODUCT_ID,
    fieldPath,
    versionKey: {
      contentVersion: "content-v1",
      normalizerVersion: "normalizer-v1",
      registryVersion: "registry-v1",
    },
    ...overrides,
  };
}

function snapshotFor(
  value: EvidencedValue<unknown>,
  target: ReviewApplicationTarget,
  overrides: Partial<ReviewSnapshot> = {},
): ReviewSnapshot {
  return {
    evidencedState: value.state,
    confidence: value.confidence,
    initialReviewState: value.reviewState,
    evidenceCount: value.evidence.length,
    hasConflict: value.conflictReason !== undefined,
    holdReason: value.state === "hold" ? value.holdReason : null,
    containsAiEvidence: value.evidence.some(
      (item) => item.method === "ai_candidate",
    ),
    versionKey: { ...target.versionKey },
    ...overrides,
  };
}

function projection(
  target: ReviewApplicationTarget,
  state: "approved" | "rejected" | "needs_more_evidence" = "approved",
  projectedTarget = target,
): EffectiveReviewProjection {
  if (state === "approved") {
    return {
      state: "approved",
      applicationId: "50000000-0000-4000-8000-000000000001",
      reviewCaseId: "30000000-0000-4000-8000-000000000001",
      reviewDecisionEventId: "40000000-0000-4000-8000-000000000001",
      target: projectedTarget,
    };
  }
  return { state: "omitted", reason: state, target: projectedTarget };
}

function input(
  target: ReviewApplicationTarget,
  value: EvidencedValue<unknown>,
  state: "approved" | "rejected" | "needs_more_evidence" = "approved",
): ReviewedOverlayBatchInput {
  return {
    target,
    snapshot: snapshotFor(value, target),
    projection: projection(target, state),
  };
}

describe("Stage 18 deterministic reviewed overlay batches", () => {
  it("returns a detached immutable graph for an empty batch", () => {
    const sourceProduct = makeProduct();
    const sourceScenarios = [makeScenario()];
    const result = composeReviewedOverlayBatch(
      sourceProduct,
      sourceScenarios,
      [],
    );

    expect(result.report).toEqual([]);
    expect(result.product).toEqual(sourceProduct);
    expect(result.product).not.toBe(sourceProduct);
    expect(result.scenarios).not.toBe(sourceScenarios);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.product)).toBe(true);
    expect(Object.isFrozen(result.scenarios[0])).toBe(true);
    expect(Object.isFrozen(result.report)).toBe(true);
  });

  it("uses canonical target order and is independent of caller order", () => {
    const sourceProduct = makeProduct();
    const sourceScenario = makeScenario();
    const freeTarget = productTarget();
    const editionTarget = scenarioTarget();
    const freeInput = input(freeTarget, sourceProduct.isFree!);
    const editionInput = input(editionTarget, sourceScenario.edition);

    expect(compareReviewTargets(freeTarget, editionTarget)).toBeLessThan(0);

    const forward = composeReviewedOverlayBatch(
      sourceProduct,
      [sourceScenario],
      [freeInput, editionInput],
    );
    const reverse = composeReviewedOverlayBatch(
      sourceProduct,
      [sourceScenario],
      [editionInput, freeInput],
    );

    expect(reverse).toEqual(forward);
    expect(forward.report.map((item) => item.target.fieldPath)).toEqual([
      "is_free",
      "edition",
    ]);
    expect(forward.product.isFree?.reviewState).toBe("approved");
    expect(forward.scenarios[0]?.edition.reviewState).toBe("approved");
    expect(sourceProduct.isFree?.reviewState).toBe("unreviewed");
    expect(sourceScenario.edition.reviewState).toBe("unreviewed");
  });

  it("rejects duplicate exact identities and cross-product batches", () => {
    const sourceProduct = makeProduct();
    const sourceScenario = makeScenario();
    const editionInput = input(scenarioTarget(), sourceScenario.edition);

    expect(() =>
      composeReviewedOverlayBatch(sourceProduct, [sourceScenario], [
        editionInput,
        editionInput,
      ]),
    ).toThrow("duplicate exact review target");

    const otherTarget = scenarioTarget("edition", {
      productId: OTHER_PRODUCT_ID,
    });
    expect(() =>
      composeReviewedOverlayBatch(sourceProduct, [sourceScenario], [
        editionInput,
        input(otherTarget, sourceScenario.edition),
      ]),
    ).toThrow("exactly one product graph");
  });

  it("materializes rejected and needs-more-evidence review states", () => {
    const sourceProduct = makeProduct();
    const sourceScenario = makeScenario();
    const editionTarget = scenarioTarget();
    const genreTarget = scenarioTarget("tags.genre");

    const result = composeReviewedOverlayBatch(sourceProduct, [sourceScenario], [
      input(genreTarget, sourceScenario.tags.genre, "needs_more_evidence"),
      input(editionTarget, sourceScenario.edition, "rejected"),
    ]);

    expect(result.report.every((item) => item.state === "materialized")).toBe(
      true,
    );
    expect(result.scenarios[0]?.edition.reviewState).toBe("rejected");
    expect(result.scenarios[0]?.tags.genre.reviewState).toBe(
      "needs_more_evidence",
    );
  });

  it.each([
    [
      "unapplied",
      () => ({ target: scenarioTarget() } as ReviewedOverlayBatchInput),
      () => makeProduct(),
      () => [makeScenario()],
    ],
    [
      "target_mismatch",
      () => {
        const sourceScenario = makeScenario();
        const target = scenarioTarget();
        return {
          target,
          snapshot: snapshotFor(sourceScenario.edition, target),
          projection: projection(
            target,
            "approved",
            scenarioTarget("edition", { entityId: OTHER_SCENARIO_ID }),
          ),
        };
      },
      () => makeProduct(),
      () => [makeScenario()],
    ],
    [
      "stale_version",
      () => {
        const sourceScenario = makeScenario();
        const target = scenarioTarget();
        return {
          target,
          snapshot: snapshotFor(sourceScenario.edition, target),
          projection: projection(target, "approved", {
            ...target,
            versionKey: { ...target.versionKey, contentVersion: "content-v2" },
          }),
        };
      },
      () => makeProduct(),
      () => [makeScenario()],
    ],
    [
      "metadata_mismatch",
      () => {
        const sourceScenario = makeScenario();
        const target = scenarioTarget();
        return {
          target,
          snapshot: snapshotFor(sourceScenario.edition, target, {
            confidence: "medium",
          }),
          projection: projection(target),
        };
      },
      () => makeProduct(),
      () => [makeScenario()],
    ],
    [
      "unsupported_field",
      () => {
        const sourceScenario = makeScenario();
        const target = scenarioTarget("required_books");
        return input(target, sourceScenario.edition);
      },
      () => makeProduct(),
      () => [makeScenario()],
    ],
    [
      "field_missing",
      () => {
        const target = productTarget();
        return input(target, known(true));
      },
      () => makeProduct(false),
      () => [makeScenario()],
    ],
    [
      "entity_missing",
      () => {
        const sourceScenario = makeScenario();
        const target = scenarioTarget("edition", {
          entityId: OTHER_SCENARIO_ID,
        });
        return input(target, sourceScenario.edition);
      },
      () => makeProduct(),
      () => [makeScenario()],
    ],
    [
      "malformed",
      () => ({
        target: { ...scenarioTarget(), productId: "" } as ReviewApplicationTarget,
      }),
      () => makeProduct(),
      () => [makeScenario()],
    ],
  ] as const)(
    "reports %s without mutating the source graph",
    (reason, makeInput, makeGraphProduct, makeGraphScenarios) => {
      const sourceProduct = makeGraphProduct();
      const sourceScenarios = makeGraphScenarios();
      const before = JSON.stringify({ sourceProduct, sourceScenarios });
      const result = composeReviewedOverlayBatch(
        sourceProduct,
        sourceScenarios,
        [makeInput()],
      );

      expect(result.report).toHaveLength(1);
      expect(result.report[0]).toMatchObject({ state: "omitted", reason });
      expect(JSON.stringify({ sourceProduct, sourceScenarios })).toBe(before);
      expect(Object.isFrozen(result.report[0])).toBe(true);
    },
  );
});
