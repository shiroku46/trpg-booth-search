import { describe, expect, it, vi } from "vitest";
import { fixtureRepository } from "../fixtures";
import type {
  EvidencedValue,
  FixtureRepository,
  PlayerCountRange,
  PlayTimeRange,
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
  if (source.state !== "known") throw new Error("expected known evidence");
  return { ...source, value };
};

const explicitUnknown = <T>(source: EvidencedValue<T>): EvidencedValue<T> => ({
  state: "unknown",
  confidence: source.confidence,
  reviewState: source.reviewState,
  evidence: source.evidence,
  contentVersion: source.contentVersion,
  checkedAt: source.checkedAt,
  ...(source.conflictReason ? { conflictReason: source.conflictReason } : {}),
});

const rejectEvidence = <T>(source: EvidencedValue<T>): EvidencedValue<T> => ({
  ...source,
  reviewState: "rejected",
});

const visibleScenarioRepository = (
  transform: (scenario: Scenario) => Scenario,
  transformProduct: (product: Product) => Product = (product) => product,
): FixtureRepository => ({
  products: () =>
    fixtureRepository
      .products()
      .filter((product) => product.id === "visible")
      .map(transformProduct),
  scenarios: () =>
    fixtureRepository
      .scenarios()
      .filter((scenario) => scenario.id === "visible")
      .map(transform),
});

const replaceKnownPlayerCount = (
  source: Scenario["playerCount"],
  value: PlayerCountRange,
): Scenario["playerCount"] => replaceKnown(source, value);

const replaceKnownPlayTime = (
  source: Scenario["playTimeMinutes"],
  value: PlayTimeRange,
): Scenario["playTimeMinutes"] => replaceKnown(source, value);

const offsetTimestampRepository: FixtureRepository = {
  products: () =>
    fixtureRepository
      .products()
      .filter((product) => ["visible", "newest"].includes(product.id))
      .map((product) => {
        const timestamp =
          product.id === "newest"
            ? "2026-07-31T23:45:00.500Z"
            : "2026-08-01T00:30:00+02:00";
        return {
          ...product,
          sourcePublicationDate: replaceKnown(
            product.sourcePublicationDate,
            timestamp,
          ),
          lastCheckedAt: timestamp,
        };
      }),
  scenarios: () =>
    fixtureRepository
      .scenarios()
      .filter((scenario) => ["visible", "newest"].includes(scenario.id)),
};

describe("fail-closed publication and search", () => {
  it("publishes only eligible scenarios and preserves explicit unknowns", () => {
    const rows = search(fixtureRepository);
    expect(rows.map((row) => row.id).sort()).toEqual([
      "long",
      "newest",
      "relation",
      "unknown",
      "visible",
    ]);
    const unknown = rows.find((row) => row.id === "unknown");
    expect(unknown?.playerCount).toEqual({ state: "unknown" });
    expect(unknown?.edition).toEqual({ state: "unknown" });
    expect(unknown?.requiredBooks).toEqual({ state: "unknown" });
    expect(unknown?.compatibility).toEqual({ state: "unknown" });
  });

  it("rejects incomplete core evidence before filtering or sorting", () => {
    const ids = search(fixtureRepository).map((row) => row.id);
    expect(ids).not.toContain("invalid-unknown");
    expect(ids).not.toContain("facet-invalid");
    expect(ids).not.toContain("unapproved-classification");
    expect(ids).not.toContain("conflict");
    expect(ids).not.toContain("missing-classification-version");
    expect(ids).not.toContain("ai");
  });

  it("projects optional relationship evidence independently per row", () => {
    const repository = visibleScenarioRepository((scenario) => {
      const approvedBook = scenario.requiredBooks[0];
      const approvedCompatibility = scenario.compatibility[0];
      if (
        approvedBook?.state !== "known" ||
        approvedCompatibility?.state !== "known"
      )
        throw new Error("expected known relationship fixtures");
      return {
        ...scenario,
        requiredBooks: [
          approvedBook,
          {
            ...approvedBook,
            value: { title: "非公開資料", kind: "required" },
            reviewState: "rejected",
          },
        ],
        compatibility: [
          approvedCompatibility,
          {
            ...approvedCompatibility,
            value: "未承認互換",
            reviewState: "unreviewed",
          },
        ],
      };
    });

    const row = search(repository)[0];
    expect(row?.requiredBooks).toEqual({
      state: "known",
      value: [{ title: "基本ルールブック", kind: "required" }],
    });
    expect(row?.compatibility).toEqual({
      state: "known",
      value: ["新版対応"],
    });
    expect(search(repository, query({ book: "非公開資料" }))).toEqual([]);
    expect(
      search(repository, query({ compatibility: "未承認互換" })),
    ).toEqual([]);
  });

  it("omits relationship rows that have no publishable siblings", () => {
    const repository = visibleScenarioRepository((scenario) => ({
      ...scenario,
      requiredBooks: scenario.requiredBooks.map(rejectEvidence),
      compatibility: scenario.compatibility.map(rejectEvidence),
      tags: {
        genre: rejectEvidence(scenario.tags.genre),
        tone: rejectEvidence(scenario.tags.tone),
        setting: rejectEvidence(scenario.tags.setting),
        structure: rejectEvidence(scenario.tags.structure),
        content: rejectEvidence(scenario.tags.content),
      },
    }));
    const row = search(repository)[0];
    expect(row?.requiredBooks).toEqual({ state: "omitted" });
    expect(row?.compatibility).toEqual({ state: "omitted" });
    expect(row?.tags.genre).toEqual({ state: "omitted" });
  });

  it("distinguishes explicit-unknown systems from omitted relationships", () => {
    const omittedRepository = visibleScenarioRepository((scenario) => ({
      ...scenario,
      relationships: scenario.relationships.map((relationship) => ({
        system: rejectEvidence(relationship.system),
        aliases: rejectEvidence(relationship.aliases),
      })),
    }));
    expect(search(omittedRepository)[0]?.systems).toEqual({ state: "omitted" });
    expect(search(omittedRepository, query({ system: "unknown" }))).toEqual([]);

    const unknownRepository = visibleScenarioRepository((scenario) => ({
      ...scenario,
      relationships: [
        {
          system: explicitUnknown(scenario.relationships[0]!.system),
          aliases: explicitUnknown(scenario.relationships[0]!.aliases),
        },
      ],
    }));
    expect(search(unknownRepository)[0]?.systems).toEqual({ state: "unknown" });
    expect(
      search(unknownRepository, query({ system: "unknown" })).map(
        (row) => row.id,
      ),
    ).toEqual(["visible"]);
  });

  it("supports normalized facets, aliases, ranges, and explicit unknown", () => {
    expect(
      search(fixtureRepository, query({ system: "合成システムB" })).map(
        (row) => row.id,
      ),
    ).toEqual(["newest"]);
    expect(
      search(fixtureRepository, query({ edition: "unknown" })).map(
        (row) => row.id,
      ),
    ).toEqual(["unknown"]);
    expect(
      search(fixtureRepository, query({ playerCount: "2" }))
        .map((row) => row.id)
        .sort(),
    ).toEqual(["relation", "visible"]);
    expect(
      search(fixtureRepository, query({ playTime: "long" })).map(
        (row) => row.id,
      ),
    ).toEqual(["long"]);
    expect(
      search(fixtureRepository, query({ modality: "offline" }))
        .map((row) => row.id)
        .sort(),
    ).toEqual(["long", "relation"]);
    expect(
      search(fixtureRepository, query({ tags: { genre: "ホラー" } })).map(
        (row) => row.id,
      ),
    ).toEqual(["long"]);
    expect(
      search(fixtureRepository, query({ book: "追加資料集" }))
        .map((row) => row.id)
        .sort(),
    ).toEqual(["long", "relation"]);
    expect(
      search(fixtureRepository, query({ compatibility: "旧版対応" }))
        .map((row) => row.id)
        .sort(),
    ).toEqual(["newest", "relation"]);
    expect(
      search(fixtureRepository, query({ keyword: "星系b" })).map(
        (row) => row.id,
      ),
    ).toEqual(["newest"]);
    expect(search(fixtureRepository, query({ keyword: "宇宙" }))).toEqual([]);
  });

  it("uses inclusive player and play-time range boundaries", () => {
    const repository = visibleScenarioRepository((scenario) => ({
      ...scenario,
      playerCount: replaceKnownPlayerCount(scenario.playerCount, {
        minimumPlayers: 2,
        maximumPlayers: 4,
      }),
      playTimeMinutes: replaceKnownPlayTime(scenario.playTimeMinutes, {
        minimumMinutes: 120,
        maximumMinutes: 121,
      }),
    }));
    expect(search(repository, query({ playerCount: "2" }))).toHaveLength(1);
    expect(search(repository, query({ playerCount: "4" }))).toHaveLength(1);
    expect(search(repository, query({ playerCount: "1" }))).toEqual([]);
    expect(search(repository, query({ playTime: "short" }))).toHaveLength(1);
    expect(search(repository, query({ playTime: "medium" }))).toHaveLength(1);
  });

  it("projects parent product timestamps identically to collection siblings", () => {
    const baseProduct = fixtureRepository
      .products()
      .find((product) => product.id === "visible");
    const baseScenario = fixtureRepository
      .scenarios()
      .find((scenario) => scenario.id === "visible");
    if (
      !baseProduct ||
      !baseScenario ||
      baseProduct.classification?.state !== "known" ||
      baseScenario.title.state !== "known"
    )
      throw new Error("missing visible fixture");

    const repository: FixtureRepository = {
      products: () => [
        {
          ...baseProduct,
          classification: {
            ...baseProduct.classification,
            value: "scenario_collection",
          },
          sourcePublicationDate: replaceKnown(
            baseProduct.sourcePublicationDate,
            "2026-06-01T00:00:00Z",
          ),
          lastCheckedAt: "2026-08-03T10:00:00Z",
        },
      ],
      scenarios: () => [
        baseScenario,
        {
          ...baseScenario,
          id: "visible-sibling",
          title: replaceKnown(baseScenario.title, "星明かりの姉妹編"),
        },
      ],
    };

    const rows = search(repository);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.publishedAt))).toEqual(
      new Set(["2026-06-01T00:00:00Z"]),
    );
    expect(new Set(rows.map((row) => row.lastCheckedAt))).toEqual(
      new Set(["2026-08-03T10:00:00Z"]),
    );
  });

  it("sorts product timestamps by instant and keeps stable tie-breakers", () => {
    expect(
      search(offsetTimestampRepository, query({ sort: "new" })).map(
        (row) => row.id,
      ),
    ).toEqual(["newest", "visible"]);
    expect(
      search(offsetTimestampRepository, query({ sort: "last-checked" })).map(
        (row) => row.id,
      ),
    ).toEqual(["newest", "visible"]);

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

  it("validates parent timestamps and falls back to product first-seen", () => {
    const firstSeenAt = "2026-06-15T12:30:00.250+09:00";
    for (const invalidTimestamp of [
      "2026-08-01T00:00:00",
      "2026-02-30T00:00:00Z",
      "08/01/2026",
      "2026-08-01T00:00:00+14:01",
    ]) {
      const repository = visibleScenarioRepository(
        (scenario) => scenario,
        (product) => ({
          ...product,
          sourcePublicationDate: replaceKnown(
            product.sourcePublicationDate,
            invalidTimestamp,
          ),
          firstSeenAt,
        }),
      );
      expect(search(repository)[0]?.publishedAt).toBe(firstSeenAt);
    }

    const unknownRepository = visibleScenarioRepository(
      (scenario) => scenario,
      (product) => ({
        ...product,
        sourcePublicationDate: explicitUnknown(product.sourcePublicationDate),
        firstSeenAt,
      }),
    );
    expect(search(unknownRepository)[0]?.publishedAt).toBe(firstSeenAt);

    const validRepository = visibleScenarioRepository(
      (scenario) => scenario,
      (product) => ({
        ...product,
        sourcePublicationDate: replaceKnown(
          product.sourcePublicationDate,
          "2026-08-01T00:00:00.123+14:00",
        ),
      }),
    );
    expect(search(validRepository)[0]?.publishedAt).toBe(
      "2026-08-01T00:00:00.123+14:00",
    );

    const invalidFallbackRepository = visibleScenarioRepository(
      (scenario) => scenario,
      (product) => ({
        ...product,
        sourcePublicationDate: explicitUnknown(product.sourcePublicationDate),
        firstSeenAt: "invalid",
      }),
    );
    expect(search(invalidFallbackRepository)).toEqual([]);

    const invalidLastCheckedRepository = visibleScenarioRepository(
      (scenario) => scenario,
      (product) => ({ ...product, lastCheckedAt: "2026-08-01T00:00:00" }),
    );
    expect(search(invalidLastCheckedRepository)).toEqual([]);
  });

  it("validates player-count and play-time ranges", () => {
    const invalidPlayerRepository = visibleScenarioRepository((scenario) => ({
      ...scenario,
      playerCount: replaceKnownPlayerCount(scenario.playerCount, {
        minimumPlayers: 0,
        maximumPlayers: 2,
      }),
    }));
    expect(search(invalidPlayerRepository)).toEqual([]);

    const invalidTimeRepository = visibleScenarioRepository((scenario) => ({
      ...scenario,
      playTimeMinutes: replaceKnownPlayTime(scenario.playTimeMinutes, {
        minimumMinutes: 10,
        maximumMinutes: 5,
      }),
    }));
    expect(search(invalidTimeRepository)).toEqual([]);
  });

  it("never exposes exact price or performs network access", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const rows = search(fixtureRepository);
    for (const row of rows) expect(row).not.toHaveProperty("price");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
