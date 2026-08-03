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

const replaceKnownTimestamp = (
  source: Scenario["publishedAt"],
  value: string,
): Scenario["publishedAt"] => {
  if (source.state !== "known") throw new Error("expected known timestamp");
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
): Scenario["playerCount"] => {
  if (source.state !== "known") throw new Error("expected known player count");
  return { ...source, value };
};

const replaceKnownPlayTime = (
  source: Scenario["playTimeMinutes"],
  value: PlayTimeRange,
): Scenario["playTimeMinutes"] => {
  if (source.state !== "known") throw new Error("expected known play time");
  return { ...source, value };
};

const offsetTimestampRepository: FixtureRepository = {
  products: () =>
    fixtureRepository
      .products()
      .filter((product) => ["visible", "newest"].includes(product.id)),
  scenarios: () =>
    fixtureRepository
      .scenarios()
      .filter((scenario) => ["visible", "newest"].includes(scenario.id))
      .map((scenario) => {
        const timestamp =
          scenario.id === "newest"
            ? "2026-07-31T23:45:00.500Z"
            : "2026-08-01T00:30:00+02:00";
        return {
          ...scenario,
          publishedAt: replaceKnownTimestamp(scenario.publishedAt, timestamp),
          lastCheckedAt: replaceKnownTimestamp(
            scenario.lastCheckedAt,
            timestamp,
          ),
        };
      }),
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

  it("omits invalid optional relationships without suppressing a scenario", () => {
    const repository = visibleScenarioRepository((scenario) => ({
      ...scenario,
      tags: {
        genre: rejectEvidence(scenario.tags.genre),
        tone: rejectEvidence(scenario.tags.tone),
        setting: rejectEvidence(scenario.tags.setting),
        structure: rejectEvidence(scenario.tags.structure),
        content: rejectEvidence(scenario.tags.content),
      },
      requiredBooks: rejectEvidence(scenario.requiredBooks),
      compatibility: rejectEvidence(scenario.compatibility),
    }));
    const row = search(repository)[0];
    expect(row?.id).toBe("visible");
    expect(row?.requiredBooks).toEqual({ state: "omitted" });
    expect(row?.compatibility).toEqual({ state: "omitted" });
    expect(row?.tags).toEqual({
      genre: { state: "omitted" },
      tone: { state: "omitted" },
      setting: { state: "omitted" },
      structure: { state: "omitted" },
      content: { state: "omitted" },
    });
    expect(search(repository, query({ book: "基本ルールブック" }))).toEqual([]);
    expect(
      search(repository, query({ tags: { genre: "ミステリー" } })),
    ).toEqual([]);
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
      search(fixtureRepository, query({ playerCount: "1" })).map(
        (row) => row.id,
      ),
    ).toEqual(["newest"]);
    expect(
      search(fixtureRepository, query({ playerCount: "2" }))
        .map((row) => row.id)
        .sort(),
    ).toEqual(["relation", "visible"]);
    expect(
      search(fixtureRepository, query({ playerCount: "4" }))
        .map((row) => row.id)
        .sort(),
    ).toEqual(["relation", "visible"]);
    expect(
      search(fixtureRepository, query({ playerCount: "5" })).map(
        (row) => row.id,
      ),
    ).toEqual(["long"]);
    expect(
      search(fixtureRepository, query({ playerCount: "unknown" })).map(
        (row) => row.id,
      ),
    ).toEqual(["unknown"]);
    expect(
      search(fixtureRepository, query({ playTime: "short" })).map(
        (row) => row.id,
      ),
    ).toEqual(["newest"]);
    expect(
      search(fixtureRepository, query({ playTime: "medium" }))
        .map((row) => row.id)
        .sort(),
    ).toEqual(["relation", "visible"]);
    expect(
      search(fixtureRepository, query({ playTime: "long" })).map(
        (row) => row.id,
      ),
    ).toEqual(["long"]);
    expect(
      search(fixtureRepository, query({ playTime: "unknown" })).map(
        (row) => row.id,
      ),
    ).toEqual(["unknown"]);
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
  });

  it("matches keywords only against public titles and system labels", () => {
    expect(
      search(fixtureRepository, query({ keyword: "航路" })).map(
        (row) => row.id,
      ),
    ).toEqual(["newest"]);
    expect(
      search(fixtureRepository, query({ keyword: "星系b" })).map(
        (row) => row.id,
      ),
    ).toEqual(["newest"]);
    expect(search(fixtureRepository, query({ keyword: "宇宙" }))).toEqual([]);
    expect(
      search(fixtureRepository, query({ keyword: "基本ルールブック" })),
    ).toEqual([]);
    expect(
      search(fixtureRepository, query({ keyword: "合成商品 visible" })),
    ).toEqual([]);
    expect(
      search(fixtureRepository, query({ keyword: "非承認AI候補" })),
    ).toEqual([]);
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
    expect(search(repository, query({ playerCount: "5" }))).toEqual([]);
    expect(search(repository, query({ playTime: "short" }))).toHaveLength(1);
    expect(search(repository, query({ playTime: "medium" }))).toHaveLength(1);
  });

  it("provides deterministic sort orders and stable tie-breakers", () => {
    const newest = search(fixtureRepository, query({ sort: "new" }));
    expect(newest[0]?.id).toBe("newest");
    const checked = search(fixtureRepository, query({ sort: "last-checked" }));
    expect(checked[0]?.id).toBe("long");
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

  it("sorts valid timestamps by instant rather than source text", () => {
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
  });

  it("validates source timestamps and falls back to product first-seen", () => {
    const firstSeenAt = "2026-06-15T12:30:00.250+09:00";
    for (const invalidTimestamp of [
      "2026-08-01T00:00:00",
      "2026-02-30T00:00:00Z",
      "08/01/2026",
      "2026-08-01T00:00:00+14:01",
    ]) {
      const repository = visibleScenarioRepository(
        (scenario) => ({
          ...scenario,
          publishedAt: replaceKnownTimestamp(
            scenario.publishedAt,
            invalidTimestamp,
          ),
        }),
        (product) => ({ ...product, firstSeenAt }),
      );
      expect(search(repository)[0]?.publishedAt).toBe(firstSeenAt);
    }

    const unknownRepository = visibleScenarioRepository(
      (scenario) => ({
        ...scenario,
        publishedAt: explicitUnknown(scenario.publishedAt),
      }),
      (product) => ({ ...product, firstSeenAt }),
    );
    expect(search(unknownRepository)[0]?.publishedAt).toBe(firstSeenAt);

    const validRepository = visibleScenarioRepository((scenario) => ({
      ...scenario,
      publishedAt: replaceKnownTimestamp(
        scenario.publishedAt,
        "2026-08-01T00:00:00.123+14:00",
      ),
    }));
    expect(search(validRepository)[0]?.publishedAt).toBe(
      "2026-08-01T00:00:00.123+14:00",
    );

    const invalidFallbackRepository = visibleScenarioRepository(
      (scenario) => ({
        ...scenario,
        publishedAt: explicitUnknown(scenario.publishedAt),
      }),
      (product) => ({ ...product, firstSeenAt: "invalid" }),
    );
    expect(search(invalidFallbackRepository)).toEqual([]);

    const invalidLastCheckedRepository = visibleScenarioRepository(
      (scenario) => ({
        ...scenario,
        lastCheckedAt: replaceKnownTimestamp(
          scenario.lastCheckedAt,
          "2026-08-01T00:00:00",
        ),
      }),
    );
    expect(search(invalidLastCheckedRepository)).toEqual([]);
  });

  it("validates player-count and play-time range values", () => {
    const zeroRepository = visibleScenarioRepository((scenario) => ({
      ...scenario,
      playTimeMinutes: replaceKnownPlayTime(scenario.playTimeMinutes, {
        minimumMinutes: 0,
        maximumMinutes: 0,
      }),
    }));
    expect(search(zeroRepository)[0]?.playTimeMinutes).toEqual({
      state: "known",
      value: { minimumMinutes: 0, maximumMinutes: 0 },
    });

    const invalidPlayerRanges: PlayerCountRange[] = [
      { minimumPlayers: 0, maximumPlayers: 2 },
      { minimumPlayers: 2, maximumPlayers: 1 },
      { minimumPlayers: 1.5, maximumPlayers: 2 },
      { minimumPlayers: 1, maximumPlayers: Number.POSITIVE_INFINITY },
    ];
    for (const invalidRange of invalidPlayerRanges) {
      const repository = visibleScenarioRepository((scenario) => ({
        ...scenario,
        playerCount: replaceKnownPlayerCount(
          scenario.playerCount,
          invalidRange,
        ),
      }));
      expect(search(repository)).toEqual([]);
    }

    const invalidPlayTimeRanges: PlayTimeRange[] = [
      { minimumMinutes: -1, maximumMinutes: 10 },
      { minimumMinutes: 10, maximumMinutes: 5 },
      { minimumMinutes: 0, maximumMinutes: Number.POSITIVE_INFINITY },
      { minimumMinutes: Number.NaN, maximumMinutes: 10 },
    ];
    for (const invalidRange of invalidPlayTimeRanges) {
      const repository = visibleScenarioRepository((scenario) => ({
        ...scenario,
        playTimeMinutes: replaceKnownPlayTime(
          scenario.playTimeMinutes,
          invalidRange,
        ),
      }));
      expect(search(repository)).toEqual([]);
    }
  });

  it("never exposes exact price or performs network access", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const rows = search(fixtureRepository);
    for (const row of rows) expect(row).not.toHaveProperty("price");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
