import { describe, expect, it, vi } from "vitest";
import { fixtureRepository } from "../fixtures";
import type {
  BookRequirement,
  EvidencedValue,
  FixtureRepository,
  Product,
  Scenario,
} from "./domain";
import {
  EMPTY_QUERY,
  HashSeededRandom,
  search,
  type CanonicalSearchQuery,
} from "./search";

type QueryOverrides = Omit<Partial<CanonicalSearchQuery>, "tags"> & {
  tags?: Partial<CanonicalSearchQuery["tags"]>;
};

const query = (overrides: QueryOverrides = {}): CanonicalSearchQuery => ({
  ...EMPTY_QUERY,
  ...overrides,
  tags: { ...EMPTY_QUERY.tags, ...overrides.tags },
});

const replaceKnown = <T>(
  source: EvidencedValue<T>,
  value: T,
): EvidencedValue<T> => {
  if (source.state !== "known") {
    throw new Error("expected known evidence");
  }
  return { ...source, value };
};

const explicitUnknown = <T>(
  source: EvidencedValue<T>,
): EvidencedValue<T> => ({
  state: "unknown",
  confidence: source.confidence,
  reviewState: "approved",
  evidence: source.evidence,
  contentVersion: source.contentVersion,
  checkedAt: source.checkedAt,
});

const visibleProduct = (): Product => {
  const product = fixtureRepository
    .products()
    .find((candidate) => candidate.id === "visible");
  if (!product) throw new Error("missing visible product");
  return product;
};

const visibleScenario = (): Scenario => {
  const scenario = fixtureRepository
    .scenarios()
    .find((candidate) => candidate.id === "visible");
  if (!scenario) throw new Error("missing visible scenario");
  return scenario;
};

const repository = (
  products: readonly Product[],
  scenarios: readonly Scenario[],
): FixtureRepository => ({
  products: () => products,
  scenarios: () => scenarios,
});

describe("fail-closed publication and search", () => {
  it("publishes only eligible all-ages scenarios", () => {
    const ids = search(fixtureRepository)
      .map((row) => row.id)
      .sort();
    expect(ids).toEqual([
      "long",
      "newest",
      "relation",
      "unknown",
      "visible",
    ]);
    expect(ids).not.toContain("ended");
    expect(ids).not.toContain("ai");
  });

  it("projects relationship evidence independently per row", () => {
    const product = visibleProduct();
    const scenario = visibleScenario();
    const approvedBook = scenario.requiredBooks[0];
    const approvedCompatibility = scenario.compatibility[0];
    if (
      approvedBook?.state !== "known" ||
      approvedCompatibility?.state !== "known"
    ) {
      throw new Error("missing relationship fixture");
    }

    const rejectedBook: EvidencedValue<BookRequirement> = {
      ...approvedBook,
      value: { title: "非公開資料", kind: "required" },
      reviewState: "rejected",
    };
    const unreviewedCompatibility: EvidencedValue<string> = {
      ...approvedCompatibility,
      value: "未承認互換",
      reviewState: "unreviewed",
    };
    const rows = search(
      repository(
        [product],
        [
          {
            ...scenario,
            requiredBooks: [approvedBook, rejectedBook],
            compatibility: [
              approvedCompatibility,
              unreviewedCompatibility,
            ],
          },
        ],
      ),
    );

    expect(rows[0]?.requiredBooks).toEqual({
      state: "known",
      value: [{ title: "基本ルールブック", kind: "required" }],
    });
    expect(rows[0]?.compatibility).toEqual({
      state: "known",
      value: ["新版対応"],
    });
    expect(
      search(
        repository([product], [scenario]),
        query({ compatibility: "未承認互換" }),
      ),
    ).toEqual([]);
  });

  it("preserves explicit unknown without publishing omitted rows", () => {
    const product = visibleProduct();
    const scenario = visibleScenario();
    const compatibility = scenario.compatibility[0];
    if (!compatibility) throw new Error("missing compatibility fixture");

    const unknownScenario: Scenario = {
      ...scenario,
      compatibility: [explicitUnknown(compatibility)],
    };
    expect(
      search(
        repository([product], [unknownScenario]),
        query({ compatibility: "unknown" }),
      ).map((row) => row.id),
    ).toEqual(["visible"]);

    const rejectedScenario: Scenario = {
      ...scenario,
      compatibility: [{ ...compatibility, reviewState: "rejected" }],
    };
    expect(
      search(
        repository([product], [rejectedScenario]),
        query({ compatibility: "unknown" }),
      ),
    ).toEqual([]);
  });

  it("projects parent timestamps identically to collection siblings", () => {
    const product = visibleProduct();
    const scenario = visibleScenario();
    if (product.classification?.state !== "known") {
      throw new Error("missing classification fixture");
    }
    if (scenario.title.state !== "known") {
      throw new Error("missing title fixture");
    }

    const collectionProduct: Product = {
      ...product,
      classification: {
        ...product.classification,
        value: "scenario_collection",
      },
      sourcePublicationDate: replaceKnown(
        product.sourcePublicationDate,
        "2026-06-01T00:00:00Z",
      ),
      lastCheckedAt: "2026-08-03T10:00:00Z",
    };
    const sibling: Scenario = {
      ...scenario,
      id: "visible-sibling",
      title: replaceKnown(scenario.title, "星明かりの姉妹編"),
    };
    const rows = search(
      repository([collectionProduct], [scenario, sibling]),
    );

    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.publishedAt))).toEqual(
      new Set(["2026-06-01T00:00:00Z"]),
    );
    expect(new Set(rows.map((row) => row.lastCheckedAt))).toEqual(
      new Set(["2026-08-03T10:00:00Z"]),
    );
  });

  it("uses first-seen fallback for invalid parent publication dates", () => {
    const product = visibleProduct();
    const scenario = visibleScenario();
    const fallback = "2026-06-15T12:30:00.250+09:00";
    const invalidProduct: Product = {
      ...product,
      sourcePublicationDate: replaceKnown(
        product.sourcePublicationDate,
        "2026-02-30T00:00:00Z",
      ),
      firstSeenAt: fallback,
    };
    expect(
      search(repository([invalidProduct], [scenario]))[0]?.publishedAt,
    ).toBe(fallback);

    const invalidCheckedProduct: Product = {
      ...product,
      lastCheckedAt: "2026-08-01T00:00:00",
    };
    expect(
      search(repository([invalidCheckedProduct], [scenario])),
    ).toEqual([]);
  });

  it("supports deterministic facets and sort orders", () => {
    expect(
      search(fixtureRepository, query({ compatibility: "旧版対応" }))
        .map((row) => row.id)
        .sort(),
    ).toEqual(["newest", "relation"]);
    expect(
      search(fixtureRepository, query({ book: "追加資料集" }))
        .map((row) => row.id)
        .sort(),
    ).toEqual(["long", "relation"]);
    expect(
      search(fixtureRepository, query({ keyword: "星系b" })).map(
        (row) => row.id,
      ),
    ).toEqual(["newest"]);

    const first = search(
      fixtureRepository,
      query({ sort: "random", seed: "same-seed" }),
    );
    const second = search(
      fixtureRepository,
      query({ sort: "random", seed: "same-seed" }),
    );
    expect(first).toEqual(second);
    expect(new HashSeededRandom().order(first, "x")).toEqual(
      new HashSeededRandom().order(first, "x"),
    );
  });

  it("never exposes exact price or performs network access", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const rows = search(fixtureRepository);
    for (const row of rows) expect(row).not.toHaveProperty("price");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
