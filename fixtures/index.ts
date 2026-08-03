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
  contentVersion: "fixture-v2",
  checkedAt: "2026-08-02T00:00:00Z",
} as const;

const known = <T>(
  value: T,
  overrides: Partial<
    Omit<
      Extract<EvidencedValue<T>, { state: "known" }>,
      "state" | "value"
    >
  > = {},
): EvidencedValue<T> => ({
  state: "known",
  value,
  ...meta,
  ...overrides,
});

const unknown = <T>(
  overrides: Partial<
    Omit<Extract<EvidencedValue<T>, { state: "unknown" }>, "state">
  > = {},
): EvidencedValue<T> => ({
  state: "unknown",
  ...meta,
  ...overrides,
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

const systemA = {
  system: known("合成システムA"),
  normalizedSystem: known("synthetic-a"),
  edition: known("第1版"),
  aliases: [known("シンセA"), known("Synthetic A")],
} as const;

const scenario = (
  id: string,
  productId: string,
  extra: Partial<Scenario> = {},
): Scenario => ({
  id,
  productId,
  title: known(`星明かりの冒険 ${id}`),
  playerCount: known("2〜4人"),
  playerRange: known({ min: 2, max: 4 }),
  playTime: known({ min: 120, max: 180, modality: "online" }),
  tags: [
    { category: "genre", label: known("ファンタジー") },
    { category: "tone", label: known("希望") },
    { category: "setting", label: known("空中都市") },
    { category: "play_style", label: known("探索") },
    { category: "content_note", label: known("軽い危機") },
  ],
  books: [
    {
      kind: "required",
      title: known("合成基本ルールブック"),
      compatibility: known("compatible"),
    },
  ],
  publicationDate: known("2026-07-01T00:00:00Z"),
  discoveryScore: known(80),
  separationApproved: true,
  relationships: [systemA],
  ...extra,
});

const products: Product[] = [
  product("visible"),
  product("moon"),
  product("forest"),
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
  scenario("visible", "visible", {
    title: known("星明かりの冒険", {
      checkedAt: "2026-08-02T03:00:00Z",
    }),
  }),
  scenario("moon", "moon", {
    title: known("月影の図書館", {
      checkedAt: "2026-08-01T03:00:00Z",
    }),
    playerCount: known("3〜5人"),
    playerRange: known({ min: 3, max: 5 }),
    playTime: known({ min: 60, max: 90, modality: "offline" }),
    relationships: [
      {
        system: known("合成システムB"),
        normalizedSystem: known("synthetic-b"),
        edition: known("改訂版"),
        aliases: [known("シンセB")],
      },
    ],
    tags: [
      { category: "genre", label: known("ミステリー") },
      { category: "tone", label: known("静謐") },
      { category: "setting", label: known("図書館") },
      { category: "play_style", label: known("推理") },
      { category: "content_note", label: known("暗所") },
    ],
    books: [
      {
        kind: "optional",
        title: known("合成追加資料集"),
        compatibility: known("conversion_required"),
      },
    ],
    publicationDate: known("2026-08-01T00:00:00Z"),
    discoveryScore: known(95),
  }),
  scenario("forest", "forest", {
    title: known("森の時計塔", {
      checkedAt: "2026-07-30T03:00:00Z",
    }),
    playerCount: known("1〜2人"),
    playerRange: known({ min: 1, max: 2 }),
    playTime: known({ min: 180, max: 240, modality: "hybrid" }),
    relationships: [
      {
        ...systemA,
        edition: known("第2版"),
      },
    ],
    tags: [
      { category: "genre", label: known("ファンタジー") },
      { category: "tone", label: known("郷愁") },
      { category: "setting", label: known("森林") },
      { category: "play_style", label: known("物語重視") },
      { category: "content_note", label: known("時間喪失") },
      {
        category: "genre",
        label: {
          ...known("未承認タグ"),
          reviewState: "unreviewed",
        },
      },
    ],
    books: [
      {
        kind: "required",
        title: known("合成基本ルールブック"),
        compatibility: unknown(),
      },
      {
        kind: "optional",
        title: {
          ...known("未承認資料"),
          reviewState: "unreviewed",
        },
      },
    ],
    publicationDate: unknown(),
    discoveryScore: known(80),
  }),
  scenario("unknown", "unknown", {
    playerCount: unknown(),
    playerRange: unknown(),
    playTime: unknown(),
    publicationDate: unknown(),
    discoveryScore: unknown(),
  }),
  scenario("invalid-unknown", "invalid-unknown", {
    playerCount: { ...unknown(), reviewState: "rejected" },
    playerRange: { ...unknown(), reviewState: "rejected" },
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
    tags: [
      {
        category: "genre",
        label: {
          ...known("未承認ジャンル"),
          reviewState: "unreviewed",
        },
      },
    ],
    books: [
      {
        kind: "required",
        title: {
          ...known("未承認ルールブック"),
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
