import { describe, expect, it, vi } from "vitest";
import { fixtureRepository } from "../fixtures";
import type { FixtureRepository, Scenario } from "./domain";
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

const visibleScenarioRepository = (
  transform: (scenario: Scenario) => Scenario,
): FixtureRepository => ({
  products: () =>
    fixtureRepository
      .products()
      .filter((product) => product.id === "visible"),
  scenarios: () =>
    fixtureRepository
      .scenarios()
      .filter((scenario) => scenario.id === "visible")
      .map(transform),
});

const replaceKnownPlayTime = (
  source: Scenario["playTimeMinutes"],
  value: number,
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

  it("rejects incomplete evidence before filtering or sorting", () => {
    const ids = search(fixtureRepository).map((row) => row.id);
    expect(ids).not.toContain("invalid-unknown");
    expect(ids).not.toContain("facet-invalid");
    expect(ids).not.toContain("unapproved-classification");
    expect(ids).not.toContain("conflict");
    expect(ids).not.toContain("missing-classification-version");
    expect(ids).not.toContain("ai");
  });

  it("supports every canonical facet including explicit unknown", () => {
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
      search(fixtureRepository, query({ playerCount: "5人" })).map(
        (row) => row.id,
      ),
    ).toEqual(["long"]);
    expect(
      search(fixtureRepository, query({ playTime: "short" })).map(
        (row) => row.id,
      ),
    ).toEqual(["newest"]);
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

  it("matches keywords only against the public projection", () => {
    expect(
      search(fixtureRepository, query({ keyword: "宇宙" })).map(
        (row) => row.id,
      ),
    ).toEqual(["newest"]);
    expect(
      search(fixtureRepository, query({ keyword: "非承認AI候補" })),
    ).toEqual([]);
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

  it("requires valid timezone-aware ISO timestamps", () => {
    for (const invalidTimestamp of [
      "2026-08-01T00:00:00",
      "2026-02-30T00:00:00Z",
      "08/01/2026",
      "2026-08-01T00:00:00+14:01",
    ]) {
      const repository = visibleScenarioRepository((scenario) => ({
        ...scenario,
        publishedAt: replaceKnownTimestamp(
          scenario.publishedAt,
          invalidTimestamp,
        ),
      }));
      expect(search(repository)).toEqual([]);
    }

    const validRepository = visibleScenarioRepository((scenario) => ({
      ...scenario,
      publishedAt: replaceKnownTimestamp(
        scenario.publishedAt,
        "2026-08-01T00:00:00.123+14:00",
      ),
    }));
    expect(search(validRepository).map((row) => row.id)).toEqual(["visible"]);
  });

  it("accepts zero play time and rejects invalid numeric durations", () => {
    const zeroRepository = visibleScenarioRepository((scenario) => ({
      ...scenario,
      playTimeMinutes: replaceKnownPlayTime(scenario.playTimeMinutes, 0),
    }));
    expect(search(zeroRepository)[0]?.playTimeMinutes).toEqual({
      state: "known",
      value: 0,
    });

    for (const invalidDuration of [-1, Number.POSITIVE_INFINITY, Number.NaN]) {
      const repository = visibleScenarioRepository((scenario) => ({
        ...scenario,
        playTimeMinutes: replaceKnownPlayTime(
          scenario.playTimeMinutes,
          invalidDuration,
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
