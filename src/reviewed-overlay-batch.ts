import type { Product, Scenario } from "./domain";
import {
  assertReviewApplicationTarget,
  type EffectiveReviewProjection,
  type ReviewApplicationTarget,
} from "./review-application";
import type { ReviewSnapshot } from "./review";
import {
  materializeReviewedGraph,
  type ReviewedOverlayOmissionReason,
} from "./reviewed-overlay";

export type ReviewedOverlayBatchInput = Readonly<{
  target: ReviewApplicationTarget;
  snapshot?: ReviewSnapshot;
  projection?: EffectiveReviewProjection;
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

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stableValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function malformedTargetKey(target: ReviewApplicationTarget): string {
  return JSON.stringify(stableValue(target));
}

function isValidTarget(target: ReviewApplicationTarget): boolean {
  try {
    assertReviewApplicationTarget(target);
    return true;
  } catch {
    return false;
  }
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
  return (
    [
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
    ].find((value) => value !== 0) ?? 0
  );
}

/** Compose exact reviewed overlays deterministically, independent of caller order. */
export function composeReviewedOverlayBatch(
  product: Product,
  scenarios: readonly Scenario[],
  inputs: readonly ReviewedOverlayBatchInput[],
): ReviewedOverlayBatchResult {
  const validInputs = inputs.filter(({ target }) => isValidTarget(target));
  const malformedInputs = inputs
    .filter(({ target }) => !isValidTarget(target))
    .sort((left, right) =>
      malformedTargetKey(left.target).localeCompare(
        malformedTargetKey(right.target),
      ),
    );

  const productIds = new Set(validInputs.map(({ target }) => target.productId));
  if (
    productIds.size > 1 ||
    (productIds.size === 1 && !productIds.has(product.id))
  ) {
    throw new Error(
      "review overlay batch must target exactly one product graph",
    );
  }

  const identities = new Set<string>();
  for (const { target } of validInputs) {
    const identity = reviewTargetIdentity(target);
    if (identities.has(identity)) {
      throw new Error("duplicate exact review target in overlay batch");
    }
    identities.add(identity);
  }

  const ordered = [...validInputs].sort((left, right) =>
    compareReviewTargets(left.target, right.target),
  );
  let currentProduct = detach(product);
  let currentScenarios = detach([...scenarios]);
  const report: ReviewedOverlayBatchReportItem[] = [];

  for (const input of ordered) {
    if (!input.snapshot || !input.projection) {
      report.push({
        state: "omitted",
        reason: "unapplied",
        target: detach(input.target),
      });
      continue;
    }

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

  for (const { target } of malformedInputs) {
    report.push({
      state: "omitted",
      reason: "malformed",
      target: detach(target),
    });
  }

  return deepFreeze({
    product: currentProduct,
    scenarios: currentScenarios,
    report,
  });
}
