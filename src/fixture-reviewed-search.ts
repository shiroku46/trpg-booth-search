import type { FixtureRepository, Scenario } from "./domain";
import { composeReviewedOverlayBatch } from "./reviewed-overlay-batch";
import {
  composeReviewedPublicationIndex,
  type ReviewedPublicationIndexInput,
  type ReviewedPublicationIndexResult,
} from "./reviewed-publication-index";
import {
  executeReviewedSearch,
  type ReviewedSearchResult,
} from "./reviewed-search";
import { EMPTY_QUERY, type CanonicalSearchQuery } from "./search";

export function buildFixtureReviewedPublicationIndex(
  repo: FixtureRepository,
): ReviewedPublicationIndexResult {
  const products = repo.products();
  const scenarios = repo.scenarios();
  const scenariosByProduct = new Map<string, Scenario[]>();

  for (const scenario of scenarios) {
    const group = scenariosByProduct.get(scenario.productId) ?? [];
    group.push(scenario);
    scenariosByProduct.set(scenario.productId, group);
  }

  const knownProductIds = new Set(products.map((product) => product.id));
  const inputs: ReviewedPublicationIndexInput[] = products.map((product) => ({
    productId: product.id,
    graph: composeReviewedOverlayBatch(
      product,
      scenariosByProduct.get(product.id) ?? [],
      [],
    ),
  }));

  for (const productId of scenariosByProduct.keys()) {
    if (!knownProductIds.has(productId)) inputs.push({ productId });
  }

  return composeReviewedPublicationIndex(inputs);
}

export function searchReviewedFixtureRepository(
  repo: FixtureRepository,
  query: CanonicalSearchQuery = EMPTY_QUERY,
): ReviewedSearchResult {
  return executeReviewedSearch(buildFixtureReviewedPublicationIndex(repo), {
    query,
  });
}
