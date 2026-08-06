import type { Product, Scenario } from "./domain";
import type {
  EffectiveReviewProjection,
  ReviewApplicationTarget,
} from "./review-application";
import type { ReviewSnapshot } from "./review";
import {
  materializeReviewedGraph,
  type ReviewedOverlayOmissionReason,
} from "./reviewed-overlay";

export type ReviewedOverlayBatchInput = Readonly<{
  target: ReviewApplicationTarget;
  snapshot: ReviewSnapshot;
  projection: EffectiveReviewProjection;
}>;

export type ReviewedOverlayBatchReportItem = Readonly<
  | {
      state: "materialized";
      target: ReviewApplicationTarget;
    }
  | {
      state: "omitted";
      reason: ReviewedOverlayOmissionReason;
      target: ReviewApplicationTarget;
    }
>;

export type ReviewedOverlayBatchResult = Readonly<{
  product: Product;
  scenarios: readonly Scenario[];
  report: readonly ReviewedOverlayBatchReportItem[];
}>;

function detach<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => detach(item)) as T;
  if (value && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      copy[key] = detach(nested);
    }
    return copy as T;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

export function reviewTargetIdentity(target: ReviewApplicationTarget): string {
  return [
    target.productId,
    target.entityType,
    target.entityId,
    target.fieldPath,
    target.versionKey.contentVersion,
    target.versionKey.normalizerVersion,
    target.versionKey.registryVersion,
  ].join("\u0000");
}

export function compareReviewTargets(
  left: ReviewApplicationTarget,
  right: ReviewApplicationTarget,
): number {
  return [
    left.entityType.localeCompare(right.entityType),
    left.entityId.localeCompare(right.entityId),
    left.fieldPath.localeCompare(right.fieldPath),
    left.versionKey.contentVersion.localeCompare(
      right.versionKey.contentVersion,
    ),
    left.versionKey.normalizerVersion.localeCompare(
      right.versionKey.normalizerVersion,
    ),
    left.versionKey.registryVersion.localeCompare(
      right.versionKey.registryVersion,
    ),
  ].find((value) => value !== 0) ?? 0;
}

export function composeReviewedOverlayBatch(
  product: Product,
  scenarios: readonly Scenario[],
  inputs: readonly ReviewedOverlayBatchInput[],
): ReviewedOverlayBatchResult {
  const productIds = new Set(inputs.map(({ target }) => target.productId));
  if (
    productIds.size > 1 ||
    (productIds.size === 1 && !productIds.has(product.id))
  ) {
    throw new Error("review overlay batch must target exactly one product graph");
  }

  const identities = new Set<string>();
  for (const { target } of inputs) {
    const identity = reviewTargetIdentity(target);
    if (identities.has(identity)) {
      throw new Error("duplicate exact review target in overlay batch");
    }
    identities.add(identity);
  }

  const ordered = [...inputs].sort((left, right) =>
    compareReviewTargets(left.target, right.target),
  );
  let currentProduct = detach(product);
  let currentScenarios = detach([...scenarios]);
  const report: ReviewedOverlayBatchReportItem[] = [];

  for (const input of ordered) {
    const result = materializeReviewedGraph(
      currentProduct,
      currentScenarios,
      input.snapshot,
      input.projection,
      input.target,
    );
    if (result.state === "materialized") {
      currentProduct = detach(result.product);
      currentScenarios = detach([...result.scenarios]);
      report.push({ state: "materialized", target: detach(input.target) });
    } else {
      report.push({
        state: "omitted",
        reason: result.reason,
        target: detach(input.target),
      });
    }
  }

  return deepFreeze({
    product: currentProduct,
    scenarios: currentScenarios,
    report,
  });
}
