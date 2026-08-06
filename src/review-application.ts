import {
  assertReanalysisVersionKey,
  type ReanalysisVersionKey,
} from "./reanalysis";
import {
  assertReviewDecisionAllowed,
  assertReviewSnapshot,
  type ReviewDecision,
  type ReviewDecisionReason,
  type ReviewSnapshot,
} from "./review";

export const REVIEW_APPLICATION_OUTCOMES = [
  "approved",
  "excluded_rejected",
  "excluded_needs_more_evidence",
] as const;
export type ReviewApplicationOutcome =
  (typeof REVIEW_APPLICATION_OUTCOMES)[number];

export type ReviewApplicationEntityType = "booth_product" | "scenario";
export type ReviewApplicationTarget = {
  productId: string;
  entityType: ReviewApplicationEntityType;
  entityId: string;
  fieldPath: string;
  versionKey: ReanalysisVersionKey;
};

export type ReviewApplicationCase = {
  id: string;
  target: ReviewApplicationTarget;
  snapshot: ReviewSnapshot;
};

export type ReviewApplicationDecisionRecord = {
  id: string;
  reviewCaseId: string;
  decision: ReviewDecision;
  reason: ReviewDecisionReason;
  decidedAt: string;
};

export type ReviewApplicationEvent = {
  id: string;
  reviewCaseId: string;
  reviewDecisionEventId: string;
  target: ReviewApplicationTarget;
  outcome: ReviewApplicationOutcome;
  appliedAt: string;
};

export type ReviewApplicationOmissionReason =
  | "unapplied"
  | "target_mismatch"
  | "stale_version"
  | "rejected"
  | "needs_more_evidence";

export type EffectiveReviewProjection =
  | {
      state: "approved";
      applicationId: string;
      reviewCaseId: string;
      reviewDecisionEventId: string;
      target: ReviewApplicationTarget;
    }
  | {
      state: "omitted";
      reason: ReviewApplicationOmissionReason;
      target: ReviewApplicationTarget;
    };

const FIELD_PATH = /^[a-z][a-z0-9_]*(?:[.][a-z][a-z0-9_]*){0,5}$/u;

function copyTarget(target: ReviewApplicationTarget): ReviewApplicationTarget {
  return {
    productId: target.productId,
    entityType: target.entityType,
    entityId: target.entityId,
    fieldPath: target.fieldPath,
    versionKey: { ...target.versionKey },
  };
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>))
      freeze(nested);
  }
  return value;
}

function sameIdentity(
  left: ReviewApplicationTarget,
  right: ReviewApplicationTarget,
): boolean {
  return (
    left.productId === right.productId &&
    left.entityType === right.entityType &&
    left.entityId === right.entityId &&
    left.fieldPath === right.fieldPath
  );
}

function sameVersion(
  left: ReviewApplicationTarget,
  right: ReviewApplicationTarget,
): boolean {
  return (
    left.versionKey.contentVersion === right.versionKey.contentVersion &&
    left.versionKey.normalizerVersion === right.versionKey.normalizerVersion &&
    left.versionKey.registryVersion === right.versionKey.registryVersion
  );
}

export function assertReviewApplicationTarget(
  target: ReviewApplicationTarget,
): void {
  if (
    !target.productId.trim() ||
    !target.entityId.trim() ||
    target.fieldPath.length > 128 ||
    !FIELD_PATH.test(target.fieldPath)
  )
    throw new Error("Review application target is invalid.");
  if (target.entityType !== "booth_product" && target.entityType !== "scenario")
    throw new Error("Review application entity type is invalid.");
  assertReanalysisVersionKey(target.versionKey);
}

export function planReviewDecisionApplication(
  reviewCase: ReviewApplicationCase,
  decision: ReviewApplicationDecisionRecord,
  requestedTarget: ReviewApplicationTarget,
): ReviewApplicationOutcome {
  assertReviewApplicationTarget(reviewCase.target);
  assertReviewApplicationTarget(requestedTarget);
  assertReviewSnapshot(reviewCase.snapshot);
  if (
    !sameVersion(reviewCase.target, {
      ...reviewCase.target,
      versionKey: reviewCase.snapshot.versionKey,
    })
  )
    throw new Error("Review case snapshot version is inconsistent.");
  if (decision.reviewCaseId !== reviewCase.id)
    throw new Error("Review decision does not belong to the review case.");
  if (!sameIdentity(reviewCase.target, requestedTarget))
    throw new Error("Review application target does not match the case.");
  if (!sameVersion(reviewCase.target, requestedTarget))
    throw new Error("Review application version is stale.");

  assertReviewDecisionAllowed(
    reviewCase.snapshot,
    decision.decision,
    decision.reason,
  );
  switch (decision.decision) {
    case "approved":
      return "approved";
    case "rejected":
      return "excluded_rejected";
    case "needs_more_evidence":
      return "excluded_needs_more_evidence";
  }
}

function omitted(
  reason: ReviewApplicationOmissionReason,
  target: ReviewApplicationTarget,
): EffectiveReviewProjection {
  return freeze({ state: "omitted", reason, target: copyTarget(target) });
}

export function projectEffectiveReviewApplication(
  event: ReviewApplicationEvent | null,
  requestedTarget: ReviewApplicationTarget,
): EffectiveReviewProjection {
  assertReviewApplicationTarget(requestedTarget);
  if (!event) return omitted("unapplied", requestedTarget);
  assertReviewApplicationTarget(event.target);
  if (!sameIdentity(event.target, requestedTarget))
    return omitted("target_mismatch", requestedTarget);
  if (!sameVersion(event.target, requestedTarget))
    return omitted("stale_version", requestedTarget);

  switch (event.outcome) {
    case "approved":
      return freeze({
        state: "approved",
        applicationId: event.id,
        reviewCaseId: event.reviewCaseId,
        reviewDecisionEventId: event.reviewDecisionEventId,
        target: copyTarget(requestedTarget),
      });
    case "excluded_rejected":
      return omitted("rejected", requestedTarget);
    case "excluded_needs_more_evidence":
      return omitted("needs_more_evidence", requestedTarget);
    default:
      throw new Error("Stored review application outcome is invalid.");
  }
}
