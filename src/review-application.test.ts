import { describe, expect, it } from "vitest";

import type { ReviewSnapshot } from "./review";
import {
  planReviewDecisionApplication,
  projectEffectiveReviewApplication,
  type ReviewApplicationCase,
  type ReviewApplicationDecisionRecord,
  type ReviewApplicationEvent,
  type ReviewApplicationTarget,
} from "./review-application";

const target = (
  overrides: Partial<ReviewApplicationTarget> = {},
): ReviewApplicationTarget => ({
  productId: "11111111-1111-4111-8111-111111111111",
  entityType: "scenario",
  entityId: "22222222-2222-4222-8222-222222222222",
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

const reviewCase = (
  applicationTarget: ReviewApplicationTarget = target(),
  overrides: Partial<ReviewApplicationCase> = {},
): ReviewApplicationCase => ({
  id: "30000000-0000-4000-8000-000000000001",
  target: applicationTarget,
  snapshot: snapshot(applicationTarget),
  ...overrides,
});

const decision = (
  overrides: Partial<ReviewApplicationDecisionRecord> = {},
): ReviewApplicationDecisionRecord => ({
  id: "40000000-0000-4000-8000-000000000001",
  reviewCaseId: "30000000-0000-4000-8000-000000000001",
  decision: "approved",
  reason: "evidence_sufficient",
  decidedAt: "2026-08-06T00:02:00Z",
  ...overrides,
});

describe("Stage 16 immutable review-decision application", () => {
  it.each([
    ["approved", "evidence_sufficient", "approved"],
    ["rejected", "unsupported_claim", "excluded_rejected"],
    [
      "needs_more_evidence",
      "evidence_insufficient",
      "excluded_needs_more_evidence",
    ],
  ] as const)(
    "maps %s decisions to the controlled application outcome",
    (decisionState, reason, outcome) => {
      const applicationTarget = target();
      expect(
        planReviewDecisionApplication(
          reviewCase(applicationTarget),
          decision({ decision: decisionState, reason }),
          applicationTarget,
        ),
      ).toBe(outcome);
    },
  );

  it("rejects a decision bound to another case", () => {
    const applicationTarget = target();
    expect(() =>
      planReviewDecisionApplication(
        reviewCase(applicationTarget),
        decision({
          reviewCaseId: "30000000-0000-4000-8000-000000000099",
        }),
        applicationTarget,
      ),
    ).toThrow(/does not belong/iu);
  });

  it.each([
    ["product", { productId: "11111111-1111-4111-8111-111111111199" }],
    ["entity", { entityId: "22222222-2222-4222-8222-222222222299" }],
    ["field", { fieldPath: "title" }],
  ] as const)("rejects a mismatched %s target", (_label, overrides) => {
    const applicationTarget = target();
    expect(() =>
      planReviewDecisionApplication(
        reviewCase(applicationTarget),
        decision(),
        target(overrides),
      ),
    ).toThrow(/does not match/iu);
  });

  it.each([
    ["contentVersion", "content-v2"],
    ["normalizerVersion", "normalizer-v2"],
    ["registryVersion", "registry-v2"],
  ] as const)("rejects a stale %s", (dimension, value) => {
    const applicationTarget = target();
    const stale = target({
      versionKey: { ...applicationTarget.versionKey, [dimension]: value },
    });
    expect(() =>
      planReviewDecisionApplication(
        reviewCase(applicationTarget),
        decision(),
        stale,
      ),
    ).toThrow(/stale/iu);
  });

  it.each([
    { confidence: "low" as const },
    { hasConflict: true },
    {
      evidencedState: "hold" as const,
      holdReason: "hold_alias_conflict",
    },
    { evidenceCount: 0 },
  ])("keeps unsafe approval fail-closed", (unsafe) => {
    const applicationTarget = target();
    const item = reviewCase(applicationTarget, {
      snapshot: snapshot(applicationTarget, unsafe),
    });
    expect(() =>
      planReviewDecisionApplication(item, decision(), applicationTarget),
    ).toThrow();
  });

  it("projects only an exact approved application", () => {
    const applicationTarget = target();
    const event: ReviewApplicationEvent = {
      id: "50000000-0000-4000-8000-000000000001",
      reviewCaseId: reviewCase(applicationTarget).id,
      reviewDecisionEventId: decision().id,
      target: applicationTarget,
      outcome: "approved",
      appliedAt: "2026-08-06T00:03:00Z",
    };
    expect(
      projectEffectiveReviewApplication(event, applicationTarget),
    ).toMatchObject({ state: "approved", applicationId: event.id });
    expect(projectEffectiveReviewApplication(null, applicationTarget)).toEqual({
      state: "omitted",
      reason: "unapplied",
      target: applicationTarget,
    });
    expect(
      projectEffectiveReviewApplication(
        { ...event, outcome: "excluded_rejected" },
        applicationTarget,
      ),
    ).toMatchObject({ state: "omitted", reason: "rejected" });
    expect(
      projectEffectiveReviewApplication(
        { ...event, outcome: "excluded_needs_more_evidence" },
        applicationTarget,
      ),
    ).toMatchObject({
      state: "omitted",
      reason: "needs_more_evidence",
    });
  });

  it("omits mismatched and stale stored applications", () => {
    const applicationTarget = target();
    const event: ReviewApplicationEvent = {
      id: "50000000-0000-4000-8000-000000000001",
      reviewCaseId: reviewCase(applicationTarget).id,
      reviewDecisionEventId: decision().id,
      target: applicationTarget,
      outcome: "approved",
      appliedAt: "2026-08-06T00:03:00Z",
    };
    expect(
      projectEffectiveReviewApplication(event, target({ fieldPath: "title" })),
    ).toMatchObject({ state: "omitted", reason: "target_mismatch" });
    expect(
      projectEffectiveReviewApplication(
        event,
        target({
          versionKey: {
            ...applicationTarget.versionKey,
            contentVersion: "content-v2",
          },
        }),
      ),
    ).toMatchObject({ state: "omitted", reason: "stale_version" });
  });
});
