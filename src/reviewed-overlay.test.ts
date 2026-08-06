import { describe, expect, it } from "vitest";

import type { EvidencedValue, Product, Scenario } from "./domain";
import type { EffectiveReviewProjection } from "./review-application";
import type { ReviewSnapshot } from "./review";
import {
  isSupportedReviewField,
  materializeReviewedEnvelope,
  materializeReviewedGraph,
} from "./reviewed-overlay";

const target = (overrides = {}) => ({
  productId: "11111111-1111-4111-8111-111111111111",
  entityType: "scenario" as const,
  entityId: "22222222-2222-4222-8222-222222222222",
  fieldPath: "edition",
  versionKey: {
    contentVersion: "content-v1",
    normalizerVersion: "normalizer-v1",
    registryVersion: "registry-v1",
  },
  ...overrides,
});

type KnownOptions = {
  confidence?: "high" | "medium" | "low" | "unresolved";
  reviewState?: "unreviewed" | "approved" | "rejected" | "needs_more_evidence";
  evidence?: EvidencedValue<unknown>["evidence"];
  contentVersion?: string;
  checkedAt?: string;
  conflictReason?: string;
};

const source = <T = string>(
  value: T = "テスト版" as T,
  options: KnownOptions = {},
): EvidencedValue<T> => ({
  state: "known",
  value,
  confidence: options.confidence ?? "high",
  reviewState: options.reviewState ?? "unreviewed",
  evidence: options.evidence ?? [
    { pointer: "synthetic", method: "ai_candidate" },
  ],
  contentVersion: options.contentVersion ?? "content-v1",
  checkedAt: options.checkedAt ?? "2026-08-06T00:00:00Z",
  ...(options.conflictReason === undefined
    ? {}
    : { conflictReason: options.conflictReason }),
});

const unknownSource = (): EvidencedValue<string> => ({
  state: "unknown",
  confidence: "high",
  reviewState: "unreviewed",
  evidence: [{ pointer: "synthetic", method: "ai_candidate" }],
  contentVersion: "content-v1",
  checkedAt: "2026-08-06T00:00:00Z",
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

const projection = (
  state: "approved" | "rejected" | "needs_more_evidence" = "approved",
  targetOverride = target(),
): EffectiveReviewProjection =>
  state === "approved"
    ? {
        state: "approved",
        applicationId: "50000000-0000-4000-8000-000000000001",
        reviewCaseId: "30000000-0000-4000-8000-000000000001",
        reviewDecisionEventId: "40000000-0000-4000-8000-000000000001",
        target: targetOverride,
      }
    : {
        state: "omitted",
        reason: state,
        target: targetOverride,
      };

const product = (): Product => ({
  id: target().productId,
  canonicalUrl: "https://booth.pm/ja/items/1234567",
  title: "合成商品",
  salesState: {
    ...source("available" as const),
    reviewState: "approved",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
  },
  sourcePublicationDate: {
    ...source("2026-08-01T00:00:00Z"),
    reviewState: "approved",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
  },
  firstSeenAt: "2026-08-06T00:00:00Z",
  lastCheckedAt: "2026-08-06T00:00:00Z",
  allAges: {
    ...source("all_ages_confirmed" as const),
    reviewState: "approved",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
  },
});

const scenario = (): Scenario => ({
  id: target().entityId,
  productId: target().productId,
  title: {
    ...source("合成シナリオ"),
    reviewState: "approved",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
  },
  playerCount: {
    ...source({ minimumPlayers: 2, maximumPlayers: 4 }),
    reviewState: "approved",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
  },
  edition: source(),
  playTimeMinutes: {
    ...source({ minimumMinutes: 120, maximumMinutes: 180 }),
    reviewState: "approved",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
  },
  modality: {
    ...source("online" as const),
    reviewState: "approved",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
  },
  tags: {
    genre: {
      ...source<readonly string[]>(["synthetic"]),
      reviewState: "approved",
      evidence: [{ pointer: "synthetic", method: "explicit_source" }],
    },
    tone: {
      ...source<readonly string[]>(["synthetic"]),
      reviewState: "approved",
      evidence: [{ pointer: "synthetic", method: "explicit_source" }],
    },
    setting: {
      ...source<readonly string[]>(["synthetic"]),
      reviewState: "approved",
      evidence: [{ pointer: "synthetic", method: "explicit_source" }],
    },
    structure: {
      ...source<readonly string[]>(["synthetic"]),
      reviewState: "approved",
      evidence: [{ pointer: "synthetic", method: "explicit_source" }],
    },
    content: {
      ...source<readonly string[]>(["synthetic"]),
      reviewState: "approved",
      evidence: [{ pointer: "synthetic", method: "explicit_source" }],
    },
  },
  requiredBooks: [],
  compatibility: [],
  separationApproved: true,
  relationships: [],
});

describe("Stage 17 immutable reviewed overlays", () => {
  it.each([
    ["approved", "approved"],
    ["rejected", "rejected"],
    ["needs_more_evidence", "needs_more_evidence"],
  ] as const)(
    "materializes %s by changing only review state",
    (decision, expected) => {
      const original = source();
      const result = materializeReviewedEnvelope(
        original,
        snapshot(),
        projection(decision),
        target(),
      );
      expect(result).toMatchObject({
        state: "materialized",
        effectiveReviewState: expected,
        value: { reviewState: expected },
      });
      expect(original.reviewState).toBe("unreviewed");
      if (result.state === "materialized") {
        expect(result.value).not.toBe(original);
        expect(result.value.evidence).not.toBe(original.evidence);
        expect(Object.isFrozen(result.value)).toBe(true);
      }
    },
  );

  it.each([
    ["state", unknownSource(), snapshot()],
    ["confidence", source("テスト版", { confidence: "medium" }), snapshot()],
    [
      "review state",
      source("テスト版", { reviewState: "needs_more_evidence" }),
      snapshot(),
    ],
    ["evidence count", source("テスト版", { evidence: [] }), snapshot()],
    [
      "conflict",
      source("テスト版", { conflictReason: "conflict" }),
      snapshot(),
    ],
    [
      "AI evidence",
      source("テスト版", {
        evidence: [{ pointer: "synthetic", method: "explicit_source" }],
      }),
      snapshot(),
    ],
  ] as const)("omits a %s metadata divergence", (_label, value, snap) => {
    expect(
      materializeReviewedEnvelope(
        value as EvidencedValue<string>,
        snap,
        projection(),
        target(),
      ),
    ).toMatchObject({ state: "omitted", reason: "metadata_mismatch" });
  });

  it("omits hold-reason and content-version divergence", () => {
    const held: EvidencedValue<string> = {
      state: "hold",
      holdReason: "hold_alias_conflict",
      confidence: "unresolved",
      reviewState: "needs_more_evidence",
      evidence: [],
      contentVersion: "content-v1",
      checkedAt: "2026-08-06T00:00:00Z",
    };
    const heldSnapshot = snapshot({
      evidencedState: "hold",
      confidence: "unresolved",
      initialReviewState: "needs_more_evidence",
      evidenceCount: 0,
      holdReason: "different_hold",
      containsAiEvidence: false,
    });
    expect(
      materializeReviewedEnvelope(
        held,
        heldSnapshot,
        projection("needs_more_evidence"),
        target(),
      ),
    ).toMatchObject({ state: "omitted", reason: "metadata_mismatch" });
    expect(
      materializeReviewedEnvelope(
        source("テスト版", { contentVersion: "content-v2" }),
        snapshot(),
        projection(),
        target(),
      ),
    ).toMatchObject({ state: "omitted", reason: "stale_version" });
  });

  it("omits target, version, unapplied, and malformed projections", () => {
    expect(
      materializeReviewedEnvelope(
        source(),
        snapshot(),
        projection("approved", target({ fieldPath: "title" })),
        target(),
      ),
    ).toMatchObject({ state: "omitted", reason: "target_mismatch" });
    expect(
      materializeReviewedEnvelope(
        source(),
        snapshot(),
        projection(
          "approved",
          target({
            versionKey: {
              ...target().versionKey,
              registryVersion: "registry-v2",
            },
          }),
        ),
        target(),
      ),
    ).toMatchObject({ state: "omitted", reason: "stale_version" });
    expect(
      materializeReviewedEnvelope(
        source(),
        snapshot(),
        { state: "omitted", reason: "unapplied", target: target() },
        target(),
      ),
    ).toMatchObject({ state: "omitted", reason: "unapplied" });
    expect(
      materializeReviewedEnvelope(
        source(),
        { ...snapshot(), evidenceCount: -1 },
        projection(),
        target(),
      ),
    ).toMatchObject({ state: "omitted", reason: "malformed" });
  });

  it("binds classification source versions to the exact review target", () => {
    const classificationTarget = target({
      entityType: "booth_product",
      entityId: target().productId,
      fieldPath: "classification",
    });
    const exactClassification = {
      ...source("scenario_single" as const),
      normalizerVersion: "normalizer-v1",
      registryVersion: "registry-v1",
    };
    const exactSnapshot = snapshot({
      versionKey: { ...classificationTarget.versionKey },
    });
    expect(
      materializeReviewedEnvelope(
        exactClassification,
        exactSnapshot,
        projection("approved", classificationTarget),
        classificationTarget,
      ),
    ).toMatchObject({ state: "materialized" });

    for (const staleClassification of [
      { ...exactClassification, normalizerVersion: "normalizer-v2" },
      { ...exactClassification, registryVersion: "registry-v2" },
    ])
      expect(
        materializeReviewedEnvelope(
          staleClassification,
          exactSnapshot,
          projection("approved", classificationTarget),
          classificationTarget,
        ),
      ).toMatchObject({ state: "omitted", reason: "metadata_mismatch" });
  });
  it("routes only fixed fields and stable tag categories", () => {
    expect(isSupportedReviewField(target())).toBe(true);
    expect(isSupportedReviewField(target({ fieldPath: "tags.genre" }))).toBe(
      true,
    );
    for (const fieldPath of [
      "required_books",
      "compatibility",
      "relationships",
      "required_books.0",
    ])
      expect(isSupportedReviewField(target({ fieldPath }))).toBe(false);
  });

  it("materializes a detached graph field without changing source graph", () => {
    const originalProduct = product();
    const originalScenario = scenario();
    const result = materializeReviewedGraph(
      originalProduct,
      [originalScenario],
      snapshot(),
      projection(),
      target(),
    );
    expect(result).toMatchObject({
      state: "materialized",
      scenarios: [{ edition: { reviewState: "approved" } }],
    });
    expect(originalScenario.edition.reviewState).toBe("unreviewed");
    if (result.state === "materialized") {
      expect(result.product).not.toBe(originalProduct);
      expect(result.scenarios[0]).not.toBe(originalScenario);
      expect(Object.isFrozen(result.scenarios[0])).toBe(true);
    }
  });

  it("routes tag and optional product fields and fails closed when missing", () => {
    const tagTarget = target({ fieldPath: "tags.genre" });
    const tagSource = scenario();
    tagSource.tags.genre = source<readonly string[]>(["AI tag"]);
    expect(
      materializeReviewedGraph(
        product(),
        [tagSource],
        snapshot(),
        projection("approved", tagTarget),
        tagTarget,
      ),
    ).toMatchObject({
      state: "materialized",
      scenarios: [{ tags: { genre: { reviewState: "approved" } } }],
    });

    const freeTarget = target({
      entityType: "booth_product",
      entityId: target().productId,
      fieldPath: "is_free",
    });
    expect(
      materializeReviewedGraph(
        product(),
        [scenario()],
        snapshot(),
        projection("approved", freeTarget),
        freeTarget,
      ),
    ).toMatchObject({ state: "omitted", reason: "field_missing" });
  });
});
