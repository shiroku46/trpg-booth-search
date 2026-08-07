import type { PublicScenario } from "./domain";
import { project } from "./publication";
import type {
  ReviewedOverlayBatchReportItem,
  ReviewedOverlayBatchResult,
} from "./reviewed-overlay-batch";

export type ReviewedPublicationIndexInput = Readonly<{
  productId: string;
  graph?: ReviewedOverlayBatchResult;
}>;

export type ReviewedScenarioPublicationReport = Readonly<
  | {
      state: "published";
      scenarioId: string;
    }
  | {
      state: "omitted";
      scenarioId: string;
      reason: string;
    }
>;

export type ReviewedProductPublicationReport = Readonly<
  | {
      state: "projected";
      productId: string;
      targetReport: readonly ReviewedOverlayBatchReportItem[];
      scenarios: readonly ReviewedScenarioPublicationReport[];
    }
  | {
      state: "missing_product" | "malformed_product_id";
      productId: string;
      targetReport: readonly [];
      scenarios: readonly [];
    }
  | {
      state: "product_mismatch";
      productId: string;
      actualProductId: string;
      targetReport: readonly ReviewedOverlayBatchReportItem[];
      scenarios: readonly [];
    }
>;

export type ReviewedPublicationIndexResult = Readonly<{
  rows: readonly PublicScenario[];
  report: readonly ReviewedProductPublicationReport[];
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

export function composeReviewedPublicationIndex(
  inputs: readonly ReviewedPublicationIndexInput[],
): ReviewedPublicationIndexResult {
  const productIds = new Set<string>();
  for (const { productId } of inputs) {
    if (productIds.has(productId)) {
      throw new Error(
        "duplicate product request in reviewed publication index",
      );
    }
    productIds.add(productId);
  }

  const ordered = [...inputs].sort((left, right) =>
    left.productId.localeCompare(right.productId),
  );
  const rows: PublicScenario[] = [];
  const report: ReviewedProductPublicationReport[] = [];

  for (const input of ordered) {
    if (!input.productId.trim()) {
      report.push({
        state: "malformed_product_id",
        productId: input.productId,
        targetReport: [],
        scenarios: [],
      });
      continue;
    }
    if (!input.graph) {
      report.push({
        state: "missing_product",
        productId: input.productId,
        targetReport: [],
        scenarios: [],
      });
      continue;
    }
    if (input.graph.product.id !== input.productId) {
      report.push({
        state: "product_mismatch",
        productId: input.productId,
        actualProductId: input.graph.product.id,
        targetReport: detach(input.graph.report),
        scenarios: [],
      });
      continue;
    }

    const scenarioReport: ReviewedScenarioPublicationReport[] = [];
    const scenarios = [...input.graph.scenarios].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    for (const scenario of scenarios) {
      const decision = project(input.graph.product, scenario);
      if (decision.publish) {
        rows.push(detach(decision.value));
        scenarioReport.push({
          state: "published",
          scenarioId: scenario.id,
        });
      } else {
        scenarioReport.push({
          state: "omitted",
          scenarioId: scenario.id,
          reason: decision.reason,
        });
      }
    }

    report.push({
      state: "projected",
      productId: input.productId,
      targetReport: detach(input.graph.report),
      scenarios: scenarioReport,
    });
  }

  return deepFreeze({ rows, report });
}
