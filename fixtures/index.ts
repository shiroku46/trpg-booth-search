import type {
  Classification,
  ClassificationEnvelope,
  EvidencedValue,
  FixtureRepository,
  Modality,
  Product,
  Scenario,
  ScenarioTags,
} from "../src/domain";

const meta = (checkedAt = "2026-08-02T00:00:00Z") =>
  ({
    confidence: "high",
    reviewState: "approved",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
    contentVersion: "fixture-v2",
    checkedAt,
  }) as const;

const known = <T>(
  value: T,
  checkedAt = "2026-08-02T00:00:00Z",
): EvidencedValue<T> => ({
  state: "known",
  value,
  ...meta(checkedAt),
});

const unknown = <T>(
  checkedAt = "2026-08-02T00:00:00Z",
): EvidencedValue<T> => ({
  state: "unknown",
  ...meta(checkedAt),
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

const tags = (extra: Partial<ScenarioTags> = {}): ScenarioTags => ({
  genre: known(["ミステリー"]),
  tone: known(["静か"]),
  setting: known(["現代"]),
  structure: known(["探索型"]),
  content: known(["推理中心"]),
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
  edition: known("7版"),
  playTimeMinutes: known(180),
  modality: known<Modality>("online"),
  tags: tags(),
  requiredBooks: known(["基本ルールブック"]),
  compatibility: known(["新版対応"]),
  publishedAt: known("2026-05-01T00:00:00Z"),
  lastCheckedAt: known("2026-08-02T00:00:00Z"),
  separationApproved: true,
  relationships: [{ system: known("合成システムA") }],
  ...extra,
});

const products: Product[] = [
  product("visible"),
  product("unknown"),
  product("relation"),
  product("newest"),
  product("long"),
  product("invalid-unknown"),
  product("facet-invalid"),
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
      ...meta(),
      evidence: [],
    },
  }),
  product("ai"),
];

const scenarios: Scenario[] = [
  scenario("visible", "visible", {
    title: known("星明かりの図書館"),
  }),
  scenario("unknown", "unknown", {
    title: known("不明な森の手紙"),
    playerCount: unknown(),
    edition: unknown(),
    playTimeMinutes: unknown(),
    modality: unknown(),
    tags: tags({
      genre: unknown(),
      tone: known(["静か"]),
      setting: known(["幻想"]),
      structure: unknown(),
      content: known(["会話中心"]),
    }),
    requiredBooks: unknown(),
    compatibility: unknown(),
    publishedAt: known("2026-04-10T00:00:00Z"),
    lastCheckedAt: known("2026-07-20T00:00:00Z"),
  }),
  scenario("relation", "relation", {
    title: known("硝子時計の街"),
    modality: known<Modality>("offline"),
    tags: tags({
      tone: known(["緊張感"]),
      setting: known(["現代"]),
      content: known(["会話中心"]),
    }),
    requiredBooks: known(["追加資料集"]),
    compatibility: known(["旧版対応"]),
    publishedAt: known("2026-03-15T00:00:00Z"),
    lastCheckedAt: known("2026-08-01T00:00:00Z"),
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
  scenario("newest", "newest", {
    title: known("朝焼けの航路"),
    playerCount: known("1人"),
    edition: known("6版"),
    playTimeMinutes: known(90),
    modality: known<Modality>("either"),
    tags: tags({
      genre: known(["冒険"]),
      tone: known(["明るい"]),
      setting: known(["宇宙"]),
      structure: known(["一本道"]),
      content: known(["会話中心"]),
    }),
    requiredBooks: known([]),
    compatibility: known(["旧版対応"]),
    publishedAt: known("2026-07-25T00:00:00Z"),
    lastCheckedAt: known("2026-07-30T00:00:00Z"),
    relationships: [{ system: known("合成システムB") }],
  }),
  scenario("long", "long", {
    title: known("冬灯りの館"),
    playerCount: known("5人"),
    edition: known("7版"),
    playTimeMinutes: known(300),
    modality: known<Modality>("offline"),
    tags: tags({
      genre: known(["ホラー"]),
      tone: known(["緊張感"]),
      setting: known(["幻想"]),
      structure: known(["分岐型"]),
      content: known(["戦闘あり"]),
    }),
    requiredBooks: known(["基本ルールブック", "追加資料集"]),
    compatibility: known(["新版対応"]),
    publishedAt: known("2026-02-01T00:00:00Z"),
    lastCheckedAt: known("2026-08-03T00:00:00Z"),
  }),
  scenario("invalid-unknown", "invalid-unknown", {
    playerCount: {
      ...unknown(),
      reviewState: "rejected",
    },
  }),
  scenario("facet-invalid", "facet-invalid", {
    edition: {
      ...known("7版"),
      reviewState: "needs_more_evidence",
    },
  }),
  scenario("ended", "ended"),
  scenario("conflict", "conflict"),
  scenario("unapproved-classification", "unapproved-classification"),
  scenario("missing-classification-version", "missing-classification-version"),
  scenario("incomplete", "visible", { title: unknown() }),
  scenario("held", "adult", {
    title: unknown(),
    playerCount: unknown(),
    edition: unknown(),
    playTimeMinutes: unknown(),
    modality: unknown(),
    tags: tags({
      genre: unknown(),
      tone: unknown(),
      setting: unknown(),
      structure: unknown(),
      content: unknown(),
    }),
    requiredBooks: unknown(),
    compatibility: unknown(),
    publishedAt: unknown(),
    lastCheckedAt: unknown(),
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
