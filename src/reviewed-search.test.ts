import { describe, expect, it } from "vitest";
import { fixtureRepository } from "../fixtures";
import type { PublicScenario } from "./domain";
import { project } from "./publication";
import type { ReviewedPublicationIndexResult } from "./reviewed-publication-index";
import {
  executeReviewedSearch,
  normalizeReviewedSearchQuery,
} from "./reviewed-search";
import {
  EMPTY_QUERY,
  SORT_ORDERS,
  searchPublicRows,
  type CanonicalSearchQuery,
} from "./search";

function publicRows(): PublicScenario[] {
  const products = new Map(
    fixtureRepository.products().map((item) => [item.id, item]),
  );
  return fixtureRepository
    .scenarios()
    .map((item) => project(products.get(item.productId), item))
    .filter(
      (decision): decision is Extract<typeof decision, { publish: true }> =>
        decision.publish,
    )
    .map((decision) => decision.value);
}

function index(): ReviewedPublicationIndexResult {
  return {
    rows: publicRows(),
    report: [
      {
        state: "missing_product",
        productId: "33333333-3333-4333-8333-333333333333",
        targetReport: [],
        scenarios: [],
      },
    ],
  };
}

describe("Stage 20 deterministic reviewed search", () => {
  it("executes the default query and deeply detaches the result", () => {
    const source = index();
    const before = JSON.stringify(source);
    const result = executeReviewedSearch(source);
    expect(result.query).toEqual(EMPTY_QUERY);
    expect(result.rows).toEqual(searchPublicRows(source.rows, EMPTY_QUERY));
    expect(result.publicationReport).toEqual(source.report);
    expect(JSON.stringify(source)).toBe(before);
    expect(result.rows).not.toBe(source.rows);
    expect(result.publicationReport).not.toBe(source.report);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.query)).toBe(true);
    expect(Object.isFrozen(result.rows)).toBe(true);
    expect(Object.isFrozen(result.publicationReport)).toBe(true);
  });

  it("normalizes keyword whitespace without mutating the input query", () => {
    const query: CanonicalSearchQuery = {
      ...EMPTY_QUERY,
      keyword: "  合成  ",
      tags: { ...EMPTY_QUERY.tags },
    };
    const before = JSON.stringify(query);
    const normalized = normalizeReviewedSearchQuery(query);
    expect(normalized.keyword).toBe("合成");
    expect(JSON.stringify(query)).toBe(before);
    expect(normalized.tags).not.toBe(query.tags);
  });

  it.each(SORT_ORDERS)("matches public-row search for %s sorting", (sort) => {
    const source = index();
    const query: CanonicalSearchQuery = {
      ...EMPTY_QUERY,
      sort,
      seed: "stage20-seed",
      tags: { ...EMPTY_QUERY.tags },
    };
    const result = executeReviewedSearch(source, { query });
    expect(result.rows).toEqual(searchPublicRows(source.rows, query));
  });

  it("keeps seeded-random ordering deterministic", () => {
    const source = index();
    const query: CanonicalSearchQuery = {
      ...EMPTY_QUERY,
      sort: "random",
      seed: "fixed-seed",
      tags: { ...EMPTY_QUERY.tags },
    };
    const first = executeReviewedSearch(source, { query });
    const second = executeReviewedSearch(source, { query });
    expect(second).toEqual(first);
  });
});
