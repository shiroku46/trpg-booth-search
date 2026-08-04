import type {
  BookRequirement,
  Classification,
  ClassificationEnvelope,
  EvidencedValue,
  FixtureRepository,
  Modality,
  PlayerCountRange,
  PlayTimeRange,
  Product,
  Relationship,
  SalesState,
  Scenario,
  ScenarioTags,
} from "../src/domain";

const meta = (checkedAt = "2026-08-02T00:00:00Z") =>
  ({
    confidence: "high",
    reviewState: "approved",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
    contentVersion: "fixture-v3",
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

const held = <T>(holdReason: string): EvidencedValue<T> => ({
  state: "hold",
  holdReason,
  ...meta(),
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
  salesState: known<SalesState>("available"),
  sourcePublicationDate: known("2026-05-01T00:00:00Z"),
  firstSeenAt: "2026-01-01T00:00:00Z",
  lastCheckedAt: "2026-08-02T00:00:00Z",
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

const playerRange = (
  minimumPlayers: number,
  maximumPlayers: number,
): PlayerCountRange => ({ minimumPlayers, maximumPlayers });

const timeRange = (
  minimumMinutes: number,
  maximumMinutes: number,
): PlayTimeRange => ({ minimumMinutes, maximumMinutes });

const book = (
  title: string,
  kind: BookRequirement["kind"] = "required",
): BookRequirement => ({ title, kind });

const relationship = (
  system: string,
  aliases: readonly string[] = [],
): Relationship => ({ system: known(system), aliases: known(aliases) });

const scenario = (
  id: string,
  productId: string,
  extra: Partial<Scenario> = {},
): Scenario => ({
  id,
  productId,
  title: known(`星明かりの冒険 ${id}`),
  playerCount: known(playerRange(2, 4)),
  edition: known("7版"),
  playTimeMinutes: known(timeRange(121, 240)),
  modality: known<Modality>("online"),
  tags: tags(),
  requiredBooks: [known(book("基本ルールブック"))],
  compatibility: [known("新版対応")],
  separationApproved: true,
  relationships: [relationship("合成システムA", ["A式システム"])],
  ...extra,
});

const products: Product[] = [
  product("visible"),
  product("unknown", {
    salesState: known<SalesState>("sold_out"),
    sourcePublicationDate: known("2026-04-10T00:00:00Z"),
    lastCheckedAt: "2026-07-20T00:00:00Z",
  }),
  product("relation", {
    sourcePublicationDate: known("2026-03-15T00:00:00Z"),
    lastCheckedAt: "2026-08-01T00:00:00Z",
  }),
  product("newest", {
    sourcePublicationDate: known("2026-07-25T00:00:00Z"),
    lastCheckedAt: "2026-07-30T00:00:00Z",
  }),
  product("long", {
    sourcePublicationDate: known("2026-02-01T00:00:00Z"),
    lastCheckedAt: "2026-08-03T00:00:00Z",
  }),
  product("invalid-unknown"),
  product("facet-invalid"),
  product("ended", { salesState: known<SalesState>("sales_ended") }),
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
    salesState: held<SalesState>("hold_age_unknown"),
    sourcePublicationDate: unknown(),
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
    requiredBooks: [unknown<BookRequirement>()],
    compatibility: [unknown<string>()],
  }),
  scenario("relation", "relation", {
    title: known("硝子時計の街"),
    modality: known<Modality>("offline"),
    tags: tags({
      tone: known(["緊張感"]),
      setting: known(["現代"]),
      content: known(["会話中心"]),
    }),
    requiredBooks: [known(book("追加資料集", "optional"))],
    compatibility: [
      known("旧版対応"),
      { ...known("未承認互換"), reviewState: "unreviewed" },
    ],
    relationships: [
      { system: unknown(), aliases: unknown() },
      {
        system: {
          ...known("未承認合成システム"),
          reviewState: "unreviewed",
        },
        aliases: known(["未承認別名"]),
      },
    ],
  }),
  scenario("newest", "newest", {
    title: known("朝焼けの航路"),
    playerCount: known(playerRange(1, 1)),
    edition: known("6版"),
    playTimeMinutes: known(timeRange(60, 120)),
    modality: known<Modality>("either"),
    tags: tags({
      genre: known(["冒険"]),
      tone: known(["明るい"]),
      setting: known(["宇宙"]),
      structure: known(["一本道"]),
      content: known(["会話中心"]),
    }),
    requiredBooks: [],
    compatibility: [known("旧版対応")],
    relationships: [relationship("合成システムB", ["星系B", "System B"])],
  }),
  scenario("long", "long", {
    title: known("冬灯りの館"),
    playerCount: known(playerRange(5, 5)),
    edition: known("7版"),
    playTimeMinutes: known(timeRange(241, 360)),
    modality: known<Modality>("offline"),
    tags: tags({
      genre: known(["ホラー"]),
      tone: known(["緊張感"]),
      setting: known(["幻想"]),
      structure: known(["分岐型"]),
      content: known(["戦闘あり"]),
    }),
    requiredBooks: [
      known(book("基本ルールブック")),
      known(book("追加資料集", "optional")),
      held<BookRequirement>("synthetic_held_book"),
    ],
    compatibility: [known("新版対応")],
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
    requiredBooks: [unknown<BookRequirement>()],
    compatibility: [unknown<string>()],
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
