import {
  assertReanalysisVersionKey,
  type ReanalysisVersionKey,
} from "./reanalysis";

export const REVIEW_CASE_REASONS = [
  "hold_requires_resolution",
  "conflict_requires_resolution",
  "ai_candidate_requires_approval",
  "needs_more_evidence",
  "unresolved_confidence",
  "known_without_evidence",
  "low_confidence",
  "manual_review_requested",
] as const;
export type ReviewCaseReason = (typeof REVIEW_CASE_REASONS)[number];

export const REVIEW_PRIORITIES = ["blocking", "high", "normal"] as const;
export type ReviewPriority = (typeof REVIEW_PRIORITIES)[number];

export const REVIEW_DECISIONS = [
  "approved",
  "rejected",
  "needs_more_evidence",
] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const REVIEW_DECISION_REASONS = [
  "evidence_sufficient",
  "evidence_insufficient",
  "evidence_conflict",
  "incorrect_mapping",
  "unsupported_claim",
  "manual_policy_decision",
] as const;
export type ReviewDecisionReason = (typeof REVIEW_DECISION_REASONS)[number];

export type ReviewEvidencedState =
  | "known"
  | "unknown"
  | "hold"
  | "not_applicable";
export type ReviewConfidence = "high" | "medium" | "low" | "unresolved";
export type ReviewInitialState = "unreviewed" | "needs_more_evidence";

export type ReviewSnapshot = {
  evidencedState: ReviewEvidencedState;
  confidence: ReviewConfidence;
  initialReviewState: ReviewInitialState;
  evidenceCount: number;
  hasConflict: boolean;
  holdReason: string | null;
  containsAiEvidence: boolean;
  versionKey: ReanalysisVersionKey;
};

export type ReviewCasePlan =
  | { state: "no_case" }
  | {
      state: "open_case";
      priority: ReviewPriority;
      reasons: readonly ReviewCaseReason[];
    };

const HOLD_REASON = /^[a-z][a-z0-9_:-]{0,127}$/u;

export function assertReviewSnapshot(snapshot: ReviewSnapshot): void {
  assertReanalysisVersionKey(snapshot.versionKey);
  if (!Number.isSafeInteger(snapshot.evidenceCount) || snapshot.evidenceCount < 0)
    throw new Error("Review evidence count must be a non-negative integer.");
  if (snapshot.evidencedState === "hold") {
    if (!snapshot.holdReason || !HOLD_REASON.test(snapshot.holdReason))
      throw new Error("A held review snapshot requires a bounded hold reason.");
  } else if (snapshot.holdReason !== null) {
    throw new Error("Only a held review snapshot may carry a hold reason.");
  }
}

function reviewReasons(
  snapshot: ReviewSnapshot,
  manualReviewRequested: boolean,
): ReviewCaseReason[] {
  const reasons: ReviewCaseReason[] = [];
  if (snapshot.evidencedState === "hold")
    reasons.push("hold_requires_resolution");
  if (snapshot.hasConflict) reasons.push("conflict_requires_resolution");
  if (snapshot.containsAiEvidence)
    reasons.push("ai_candidate_requires_approval");
  if (snapshot.initialReviewState === "needs_more_evidence")
    reasons.push("needs_more_evidence");
  if (snapshot.confidence === "unresolved")
    reasons.push("unresolved_confidence");
  if (snapshot.evidencedState === "known" && snapshot.evidenceCount === 0)
    reasons.push("known_without_evidence");
  if (snapshot.confidence === "low") reasons.push("low_confidence");
  if (manualReviewRequested) reasons.push("manual_review_requested");
  return reasons;
}

function priorityFor(reasons: readonly ReviewCaseReason[]): ReviewPriority {
  if (
    reasons.some((reason) =>
      [
        "hold_requires_resolution",
        "conflict_requires_resolution",
        "ai_candidate_requires_approval",
      ].includes(reason),
    )
  )
    return "blocking";
  if (
    reasons.some((reason) =>
      [
        "needs_more_evidence",
        "unresolved_confidence",
        "known_without_evidence",
      ].includes(reason),
    )
  )
    return "high";
  return "normal";
}

export function planReviewCase(
  snapshot: ReviewSnapshot,
  manualReviewRequested = false,
): ReviewCasePlan {
  assertReviewSnapshot(snapshot);
  const reasons = reviewReasons(snapshot, manualReviewRequested);
  if (reasons.length === 0) return { state: "no_case" };
  return {
    state: "open_case",
    priority: priorityFor(reasons),
    reasons: Object.freeze(reasons),
  };
}

export function assertReviewDecisionAllowed(
  snapshot: ReviewSnapshot,
  decision: ReviewDecision,
  reason: ReviewDecisionReason,
): void {
  assertReviewSnapshot(snapshot);
  if (!REVIEW_DECISIONS.includes(decision))
    throw new Error("Unsupported review decision.");
  if (!REVIEW_DECISION_REASONS.includes(reason))
    throw new Error("Unsupported review decision reason.");

  if (decision === "approved") {
    if (reason !== "evidence_sufficient" && reason !== "manual_policy_decision")
      throw new Error("Approval requires a positive decision reason.");
    if (snapshot.evidencedState === "hold")
      throw new Error("A held value cannot be approved without a new review case.");
    if (snapshot.hasConflict)
      throw new Error("A conflicted value cannot be approved without a new review case.");
    if (snapshot.confidence !== "high" && snapshot.confidence !== "medium")
      throw new Error("Approval requires high or medium confidence.");
    if (snapshot.evidencedState === "known" && snapshot.evidenceCount === 0)
      throw new Error("A known value cannot be approved without evidence.");
  }

  if (
    decision === "needs_more_evidence" &&
    reason !== "evidence_insufficient" &&
    reason !== "evidence_conflict" &&
    reason !== "manual_policy_decision"
  )
    throw new Error("More-evidence decisions require an evidence-related reason.");

  if (
    decision === "rejected" &&
    reason !== "evidence_conflict" &&
    reason !== "incorrect_mapping" &&
    reason !== "unsupported_claim" &&
    reason !== "manual_policy_decision"
  )
    throw new Error("Rejection requires a negative decision reason.");
}
