import type {
  Classification,
  ClassificationEnvelope,
  EvidencedValue,
  FixtureRepository,
  Product,
  Scenario,
} from "../src/domain";
const meta = {
  confidence: "high",
  reviewState: "approved",
  evidence: [{ pointer: "synthetic", method: "explicit_source" }],
  contentVersion: "fixture-v1",
  checkedAt: "2026-08-02T00:00:00Z",
} as const;
const known = <T>(value: T): EvidencedValue<T> => ({
  state: "known",
  value,
  ...meta,
});
const unknown = <T>(): EvidencedValue<T> => ({
  state: "unknown",
  ...meta,
});
const classification = (value: Classification): ClassificationEnvelope => ({
  ...known(value),
  normalizerVersion: "manual-review-v1",
  registryVersion: "registry-not-consulted",
});
const product = (id: string, extra: Partial<Product> = {}): Product => ({
  id,
  canonicalUrl: `https://example.invalid/products/${id}`,
  title: `合成商品 ${id}`,
  salesState: "available",
  allAges: known("all_ages_confirmed"),
  classification: classification("scenario_single"),
  ...extra,
});
const scenario = (
  id: string,
  productId: string,
  extra: Partial<Scenario> = {},
): Scenario => ({
  id,
  productId,
  title: known(`星明かりの冒険 ${id}`),
  playerCount: known("2〜4人"),
  separationApproved: true,
  relationships: [{ system: known("合成システムA") }],
  ...extra,
});
const products: Product[] = [
  product("visible"),
  product("unknown"),
  product("invalid-unknown"),
  product("relation"),
  product("ended", { salesState: "sales_ended" }),
  product("conflict", {
    classification: {
      ...classification("scenario_single"),
      conflictReason: "synthetic_conflict",
    },
  }),
  product("unapproved-classification", {
    classification: {
      ...classification("scenario_single"),
      reviewState: "unreviewed",
    },
  }),
  product("missing-classification-version", {
    classification: {
      ...classification("scenario_single"),
      normalizerVersion: "",
    },
  }),
  product("adult", {
    title: undefined,
    salesState: undefined,
    classification: undefined,
    allAges: {
      state: "hold",
      holdReason: "hold_age_unknown",
      ...meta,
      evidence: [],
    },
  }),
  product("ai"),
];
const scenarios: Scenario[] = [
  scenario("visible", "visible"),
  scenario("unknown", "unknown", { playerCount: unknown() }),
  scenario("invalid-unknown", "invalid-unknown", {
    playerCount: {
      ...unknown(),
      reviewState: "rejected",
    },
  }),
  scenario("relation", "relation", {
    relationships: [
      { system: unknown() },
      {
        system: {
          ...known("未承認合成システム"),
          reviewState: "unreviewed",
        },
      },
    ],
  }),
  scenario("ended", "ended"),
  scenario("conflict", "conflict"),
  scenario("unapproved-classification", "unapproved-classification"),
  scenario("missing-classification-version", "missing-classification-version"),
  scenario("incomplete", "visible", { title: unknown() }),
  scenario("held", "adult", {
    title: unknown(),
    playerCount: unknown(),
    relationships: [],
    hold: true,
  }),
  scenario("ai", "ai", {
    title: {
      ...known("非承認AI候補"),
      reviewState: "unreviewed",
      evidence: [{ pointer: "synthetic", method: "ai_candidate" }],
    },
  }),
];
export const fixtureRepository: FixtureRepository = {
  products: () => products,
  scenarios: () => scenarios,
};
