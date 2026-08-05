import { describe, expect, it } from "vitest";

import {
  assertReviewDecisionAllowed,
  assertReviewSnapshot,
  planReviewCase,
  type ReviewSnapshot,
} from "./review";

const snapshot = (
  overrides: Partial<ReviewSnapshot> = {},
): ReviewSnapshot => ({
  evidencedState: "known",
  confidence: "high",
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

describe("bounded confidence and hold review policy", () => {
  it("does not open a case for safe non-AI high-confidence evidence", () => {
    expect(planReviewCase(snapshot())).toEqual({ state: "no_case" });
  });

  it("opens blocking cases in deterministic reason order", () => {
    expect(
      planReviewCase(
        snapshot({
          evidencedState: "hold",
          confidence: "unresolved",
          initialReviewState: "needs_more_evidence",
          evidenceCount: 0,
          hasConflict: true,
          holdReason: "hold_alias_conflict",
          containsAiEvidence: true,
        }),
        true,
      ),
    ).toEqual({
      state: "open_case",
      priority: "blocking",
      reasons: [
        "hold_requires_resolution",
        "conflict_requires_resolution",
        "ai_candidate_requires_approval",
        "needs_more_evidence",
        "unresolved_confidence",
        "manual_review_requested",
      ],
    });
  });

  it.each([
    [
      snapshot({ initialReviewState: "needs_more_evidence" }),
      "high",
      ["needs_more_evidence"],
    ],
    [
      snapshot({ confidence: "unresolved" }),
      "high",
      ["unresolved_confidence"],
    ],
    [snapshot({ evidenceCount: 0 }), "high", ["known_without_evidence"]],
    [snapshot({ confidence: "low" }), "normal", ["low_confidence"]],
  ] as const)(
    "assigns the expected non-blocking priority",
    (input, priority, reasons) => {
      expect(planReviewCase(input)).toEqual({
        state: "open_case",
        priority,
        reasons,
      });
    },
  );

  it("opens a manual case without inventing a data-quality defect", () => {
    expect(planReviewCase(snapshot(), true)).toEqual({
      state: "open_case",
      priority: "normal",
      reasons: ["manual_review_requested"],
    });
  });

  it("requires a bounded hold reason only for hold state", () => {
    expect(() =>
      assertReviewSnapshot(
        snapshot({ evidencedState: "hold", holdReason: null }),
      ),
    ).toThrow(/requires a bounded hold reason/iu);
    expect(() =>
      assertReviewSnapshot(snapshot({ holdReason: "hold_unexpected" })),
    ).toThrow(/only a held/iu);
    expect(() =>
      assertReviewSnapshot(
        snapshot({ evidencedState: "hold", holdReason: "Bad reason" }),
      ),
    ).toThrow(/bounded hold reason/iu);
  });

  it("allows approval only for sufficiently evidenced conflict-free snapshots", () => {
    expect(() =>
      assertReviewDecisionAllowed(
        snapshot({ containsAiEvidence: true }),
        "approved",
        "evidence_sufficient",
      ),
    ).not.toThrow();
    expect(() =>
      assertReviewDecisionAllowed(
        snapshot({ evidencedState: "unknown", evidenceCount: 0 }),
        "approved",
        "manual_policy_decision",
      ),
    ).not.toThrow();

    for (const unsafe of [
      snapshot({ evidencedState: "hold", holdReason: "hold_unresolved" }),
      snapshot({ hasConflict: true }),
      snapshot({ confidence: "low" }),
      snapshot({ confidence: "unresolved" }),
      snapshot({ evidenceCount: 0 }),
    ])
      expect(() =>
        assertReviewDecisionAllowed(
          unsafe,
          "approved",
          "evidence_sufficient",
        ),
      ).toThrow();
  });

  it("enforces positive, negative, and evidence-related decision reasons", () => {
    expect(() =>
      assertReviewDecisionAllowed(
        snapshot(),
        "approved",
        "unsupported_claim",
      ),
    ).toThrow(/positive/iu);
    expect(() =>
      assertReviewDecisionAllowed(
        snapshot(),
        "rejected",
        "evidence_sufficient",
      ),
    ).toThrow(/negative/iu);
    expect(() =>
      assertReviewDecisionAllowed(
        snapshot(),
        "needs_more_evidence",
        "incorrect_mapping",
      ),
    ).toThrow(/evidence-related/iu);
  });

  it("rejects invalid evidence counts and version keys", () => {
    expect(() => assertReviewSnapshot(snapshot({ evidenceCount: -1 }))).toThrow(
      /non-negative integer/iu,
    );
    expect(() =>
      assertReviewSnapshot(
        snapshot({
          versionKey: {
            contentVersion: "",
            normalizerVersion: "normalizer-v1",
            registryVersion: "registry-v1",
          },
        }),
      ),
    ).toThrow(/invalid reanalysis version/iu);
  });
});
