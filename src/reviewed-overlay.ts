import {
  TAG_CATEGORIES,
  type EvidencedValue,
  type Product,
  type ReviewState,
  type Scenario,
  type TagCategory,
} from "./domain";
import {
  assertReviewApplicationTarget,
  type EffectiveReviewProjection,
  type ReviewApplicationTarget,
} from "./review-application";
import { assertReviewSnapshot, type ReviewSnapshot } from "./review";

export const PRODUCT_REVIEW_FIELD_PATHS = [
  "sales_state",
  "source_publication_date",
  "is_free",
  "all_ages",
  "classification",
] as const;
export const SCENARIO_REVIEW_FIELD_PATHS = [
  "title",
  "player_count",
  "edition",
  "play_time_minutes",
  "modality",
  "tags.genre",
  "tags.tone",
  "tags.setting",
  "tags.structure",
  "tags.content",
] as const;
export const UNSUPPORTED_ARRAY_REVIEW_FIELD_PATHS = [
  "required_books",
  "compatibility",
  "relationships",
] as const;

export type ReviewedOverlayOmissionReason =
  | "unapplied"
  | "target_mismatch"
  | "stale_version"
  | "metadata_mismatch"
  | "malformed"
  | "unsupported_field"
  | "field_missing"
  | "entity_missing";

export type ReviewedEnvelopeResult<E extends EvidencedValue<unknown>> =
  | {
      state: "materialized";
      value: E;
      effectiveReviewState: ReviewState;
      target: ReviewApplicationTarget;
    }
  | {
      state: "omitted";
      reason: ReviewedOverlayOmissionReason;
      target: ReviewApplicationTarget;
    };

export type ReviewedGraphOverlayResult =
  | {
      state: "materialized";
      product: Product;
      scenarios: readonly Scenario[];
      effectiveReviewState: ReviewState;
      target: ReviewApplicationTarget;
    }
  | {
      state: "omitted";
      reason: ReviewedOverlayOmissionReason;
      target: ReviewApplicationTarget;
    };

function detach<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => detach(item)) as T;
  if (value && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    ))
      copy[key] = detach(nested);
    return copy as T;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>))
      deepFreeze(nested);
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

function omitted(
  reason: ReviewedOverlayOmissionReason,
  target: ReviewApplicationTarget,
): ReviewedGraphOverlayResult {
  return deepFreeze({
    state: "omitted",
    reason,
    target: detach(target),
  });
}

function envelopeOmitted<E extends EvidencedValue<unknown>>(
  reason: ReviewedOverlayOmissionReason,
  target: ReviewApplicationTarget,
): ReviewedEnvelopeResult<E> {
  return deepFreeze({
    state: "omitted",
    reason,
    target: detach(target),
  });
}

function metadataMatches(
  source: EvidencedValue<unknown>,
  snapshot: ReviewSnapshot,
): boolean {
  const hasConflict = source.conflictReason !== undefined;
  const holdReason = source.state === "hold" ? source.holdReason : null;
  const containsAiEvidence = source.evidence.some(
    (item) => item.method === "ai_candidate",
  );
  return (
    source.state === snapshot.evidencedState &&
    source.confidence === snapshot.confidence &&
    source.reviewState === snapshot.initialReviewState &&
    source.evidence.length === snapshot.evidenceCount &&
    hasConflict === snapshot.hasConflict &&
    holdReason === snapshot.holdReason &&
    containsAiEvidence === snapshot.containsAiEvidence
  );
}

export function isSupportedReviewField(
  target: ReviewApplicationTarget,
): boolean {
  if (target.entityType === "booth_product")
    return (PRODUCT_REVIEW_FIELD_PATHS as readonly string[]).includes(
      target.fieldPath,
    );
  return (SCENARIO_REVIEW_FIELD_PATHS as readonly string[]).includes(
    target.fieldPath,
  );
}

export function materializeReviewedEnvelope<E extends EvidencedValue<unknown>>(
  source: E,
  snapshot: ReviewSnapshot,
  projection: EffectiveReviewProjection,
  target: ReviewApplicationTarget,
): ReviewedEnvelopeResult<E> {
  try {
    assertReviewApplicationTarget(target);
    assertReviewApplicationTarget(projection.target);
    assertReviewSnapshot(snapshot);
  } catch {
    return envelopeOmitted("malformed", target);
  }

  if (!sameIdentity(projection.target, target))
    return envelopeOmitted("target_mismatch", target);
  if (!sameVersion(projection.target, target))
    return envelopeOmitted("stale_version", target);
  if (
    snapshot.versionKey.contentVersion !== target.versionKey.contentVersion ||
    snapshot.versionKey.normalizerVersion !==
      target.versionKey.normalizerVersion ||
    snapshot.versionKey.registryVersion !== target.versionKey.registryVersion ||
    source.contentVersion !== target.versionKey.contentVersion
  )
    return envelopeOmitted("stale_version", target);
  if (!metadataMatches(source, snapshot))
    return envelopeOmitted("metadata_mismatch", target);

  let effectiveReviewState: ReviewState;
  if (projection.state === "approved") effectiveReviewState = "approved";
  else if (projection.reason === "rejected") effectiveReviewState = "rejected";
  else if (projection.reason === "needs_more_evidence")
    effectiveReviewState = "needs_more_evidence";
  else if (projection.reason === "target_mismatch")
    return envelopeOmitted("target_mismatch", target);
  else if (projection.reason === "stale_version")
    return envelopeOmitted("stale_version", target);
  else if (projection.reason === "unapplied")
    return envelopeOmitted("unapplied", target);
  else return envelopeOmitted("malformed", target);

  const value = detach({
    ...source,
    reviewState: effectiveReviewState,
  }) as E;
  return deepFreeze({
    state: "materialized",
    value,
    effectiveReviewState,
    target: detach(target),
  });
}

export function materializeReviewedGraph(
  product: Product,
  scenarios: readonly Scenario[],
  snapshot: ReviewSnapshot,
  projection: EffectiveReviewProjection,
  target: ReviewApplicationTarget,
): ReviewedGraphOverlayResult {
  try {
    assertReviewApplicationTarget(target);
  } catch {
    return omitted("malformed", target);
  }
  if (!isSupportedReviewField(target))
    return omitted("unsupported_field", target);
  if (product.id !== target.productId) return omitted("entity_missing", target);

  const productCopy = detach(product);
  const scenariosCopy = detach([...scenarios]);

  const apply = <E extends EvidencedValue<unknown>>(
    source: E,
    assign: (value: E) => void,
  ): ReviewedGraphOverlayResult => {
    const result = materializeReviewedEnvelope(
      source,
      snapshot,
      projection,
      target,
    );
    if (result.state === "omitted") return result;
    assign(result.value);
    return deepFreeze({
      state: "materialized",
      product: productCopy,
      scenarios: scenariosCopy,
      effectiveReviewState: result.effectiveReviewState,
      target: detach(target),
    });
  };

  if (target.entityType === "booth_product") {
    if (target.entityId !== product.id)
      return omitted("entity_missing", target);
    switch (target.fieldPath) {
      case "sales_state":
        return apply(product.salesState, (value) => {
          productCopy.salesState = value;
        });
      case "source_publication_date":
        return apply(product.sourcePublicationDate, (value) => {
          productCopy.sourcePublicationDate = value;
        });
      case "is_free":
        if (!product.isFree) return omitted("field_missing", target);
        return apply(product.isFree, (value) => {
          productCopy.isFree = value;
        });
      case "all_ages":
        return apply(product.allAges, (value) => {
          productCopy.allAges = value;
        });
      case "classification":
        if (!product.classification) return omitted("field_missing", target);
        return apply(product.classification, (value) => {
          productCopy.classification = value;
        });
      default:
        return omitted("unsupported_field", target);
    }
  }

  const index = scenarios.findIndex(
    (item) =>
      item.id === target.entityId && item.productId === target.productId,
  );
  if (index < 0) return omitted("entity_missing", target);
  const sourceScenario = scenarios[index]!;
  const targetScenario = scenariosCopy[index]!;

  switch (target.fieldPath) {
    case "title":
      return apply(sourceScenario.title, (value) => {
        targetScenario.title = value;
      });
    case "player_count":
      return apply(sourceScenario.playerCount, (value) => {
        targetScenario.playerCount = value;
      });
    case "edition":
      return apply(sourceScenario.edition, (value) => {
        targetScenario.edition = value;
      });
    case "play_time_minutes":
      return apply(sourceScenario.playTimeMinutes, (value) => {
        targetScenario.playTimeMinutes = value;
      });
    case "modality":
      return apply(sourceScenario.modality, (value) => {
        targetScenario.modality = value;
      });
    default: {
      if (!target.fieldPath.startsWith("tags."))
        return omitted("unsupported_field", target);
      const category = target.fieldPath.slice(5) as TagCategory;
      if (!(TAG_CATEGORIES as readonly string[]).includes(category))
        return omitted("unsupported_field", target);
      return apply(sourceScenario.tags[category], (value) => {
        targetScenario.tags[category] = value;
      });
    }
  }
}
