import { describe, expect, it } from "vitest";
import { fixtureRepository } from "../fixtures";
import type {
  EvidencedValue,
  Product,
  PublicScenario,
  Scenario,
} from "./domain";
import { project } from "./publication";
import type { ReviewApplicationTarget } from "./review-application";
import type { ReviewedOverlayBatchResult } from "./reviewed-overlay-batch";
import { composeReviewedPublicationIndex } from "./reviewed-publication-index";
import { EMPTY_QUERY, search, searchPublicRows } from "./search";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";
const PRODUCT_C = "33333333-3333-4333-8333-333333333333";

function known<T>(value: T): EvidencedValue<T> {
  return {
    state: "known",
    value,
    confidence: "high",
    reviewState: "approved",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
    contentVersion: "content-v1",
    checkedAt: "2026-08-06T00:00:00Z",
  };
}

function product(id: string): Product {
  return {
    id,
    canonicalUrl: `https://booth.pm/ja/items/${id.slice(0, 8)}`,
    title: `商品-${id.slice(0, 4)}`,
    salesState: known("available" as const),
    sourcePublicationDate: known("2026-08-01T00:00:00Z"),
    firstSeenAt: "2026-08-06T00:00:00Z",
    lastCheckedAt: "2026-08-06T00:00:00Z",
    allAges: known("all_ages_confirmed" as const),
    classification: {
      ...known("scenario_single" as const),
      normalizerVersion: "normalizer-v1",
      registryVersion: "registry-v1",
    },
  };
}

function scenario(
  productId: string,
  id: string,
  title: string,
  hold = false,
): Scenario {
  const list = known<readonly string[]>(["synthetic"]);
  return {
    id,
    productId,
    title: known(title),
    playerCount: known({ minimumPlayers: 2, maximumPlayers: 4 }),
    edition: known("テスト版"),
    playTimeMinutes: known({ minimumMinutes: 120, maximumMinutes: 180 }),
    modality: known("online" as const),
    tags: {
      genre: list,
      tone: list,
      setting: list,
      structure: list,
      content: list,
    },
    requiredBooks: [],
    compatibility: [],
    separationApproved: true,
    relationships: [],
    ...(hold ? { hold: true } : {}),
  };
}

function target(
  productId: string,
  scenarioId: string,
): ReviewApplicationTarget {
  return {
    productId,
    entityType: "scenario",
    entityId: scenarioId,
    fieldPath: "edition",
    versionKey: {
      contentVersion: "content-v1",
      normalizerVersion: "normalizer-v1",
      registryVersion: "registry-v1",
    },
  };
}

function graph(
  sourceProduct: Product,
  scenarios: readonly Scenario[],
  withReport = false,
): ReviewedOverlayBatchResult {
  return {
    product: sourceProduct,
    scenarios,
    report: withReport
      ? [
          {
            state: "omitted",
            reason: "unapplied",
            target: target(sourceProduct.id, scenarios[0]!.id),
          },
        ]
      : [],
  };
}

describe("Stage 19 deterministic reviewed publication index", () => {
  it("returns detached immutable empty output", () => {
    const result = composeReviewedPublicationIndex([]);
    expect(result).toEqual({ rows: [], report: [] });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.rows)).toBe(true);
    expect(Object.isFrozen(result.report)).toBe(true);
  });

  it("canonicalizes product and scenario order independent of caller order", () => {
    const a = graph(product(PRODUCT_A), [
      scenario(PRODUCT_A, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "B"),
      scenario(PRODUCT_A, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "A"),
    ]);
    const b = graph(product(PRODUCT_B), [
      scenario(PRODUCT_B, "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "C"),
    ]);
    const forward = composeReviewedPublicationIndex([
      { productId: PRODUCT_A, graph: a },
      { productId: PRODUCT_B, graph: b },
    ]);
    const reverse = composeReviewedPublicationIndex([
      { productId: PRODUCT_B, graph: b },
      { productId: PRODUCT_A, graph: a },
    ]);
    expect(reverse).toEqual(forward);
    expect(forward.rows.map((row) => row.title)).toEqual(["A", "B", "C"]);
    expect(forward.report.map((item) => item.productId)).toEqual([
      PRODUCT_A,
      PRODUCT_B,
    ]);
  });

  it("rejects duplicate products and reports missing, malformed, mismatch, and unpublished scenarios", () => {
    const sourceProduct = product(PRODUCT_A);
    const sourceScenario = scenario(
      PRODUCT_A,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "公開候補",
    );
    expect(() =>
      composeReviewedPublicationIndex([
        { productId: PRODUCT_A, graph: graph(sourceProduct, [sourceScenario]) },
        { productId: PRODUCT_A },
      ]),
    ).toThrow("duplicate product request");

    const mixed = composeReviewedPublicationIndex([
      { productId: "" },
      { productId: PRODUCT_B },
      {
        productId: PRODUCT_C,
        graph: graph(product(PRODUCT_B), [
          scenario(PRODUCT_B, "dddddddd-dddd-4ddd-8ddd-dddddddddddd", "不一致"),
        ]),
      },
      {
        productId: PRODUCT_A,
        graph: graph(
          sourceProduct,
          [
            sourceScenario,
            scenario(
              PRODUCT_A,
              "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              "保留",
              true,
            ),
          ],
          true,
        ),
      },
    ]);

    expect(mixed.rows.map((row) => row.title)).toEqual(["公開候補"]);
    expect(mixed.report).toMatchObject([
      { state: "malformed_product_id", productId: "" },
      {
        state: "projected",
        productId: PRODUCT_A,
        targetReport: [{ state: "omitted", reason: "unapplied" }],
        scenarios: [
          { state: "published" },
          { state: "omitted", reason: "hold_or_missing_product" },
        ],
      },
      { state: "missing_product", productId: PRODUCT_B },
      {
        state: "product_mismatch",
        productId: PRODUCT_C,
        actualProductId: PRODUCT_B,
      },
    ]);
    expect(Object.isFrozen(mixed.report[1])).toBe(true);
    expect(Object.isFrozen(mixed.report[1]!.targetReport)).toBe(true);
  });

  it("does not mutate source graphs", () => {
    const sourceProduct = product(PRODUCT_A);
    const sourceScenarios = [
      scenario(PRODUCT_A, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "A"),
    ];
    const sourceGraph = graph(sourceProduct, sourceScenarios, true);
    const before = JSON.stringify(sourceGraph);
    const result = composeReviewedPublicationIndex([
      { productId: PRODUCT_A, graph: sourceGraph },
    ]);
    expect(JSON.stringify(sourceGraph)).toBe(before);
    expect(result.rows[0]).not.toBe(sourceScenarios[0]);
    expect(Object.isFrozen(result.rows[0])).toBe(true);
  });

  it("searches projected public rows with the existing search semantics", () => {
    const products = new Map(
      fixtureRepository.products().map((item) => [item.id, item]),
    );
    const publicRows: PublicScenario[] = fixtureRepository
      .scenarios()
      .map((item) => project(products.get(item.productId), item))
      .filter(
        (decision): decision is Extract<typeof decision, { publish: true }> =>
          decision.publish,
      )
      .map((decision) => decision.value);
    const queries = [
      EMPTY_QUERY,
      { ...EMPTY_QUERY, sort: "free-first" as const },
      { ...EMPTY_QUERY, keyword: "合成" },
      { ...EMPTY_QUERY, edition: "6版" },
    ];
    for (const query of queries) {
      expect(searchPublicRows(publicRows, query)).toEqual(
        search(fixtureRepository, query),
      );
    }
  });
});
