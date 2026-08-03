import { describe, expect, it, vi } from "vitest";
import { fixtureRepository } from "../fixtures";
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
      search(
        fixtureRepository,
        query({ tags: { genre: "ホラー" } }),
      ).map((row) => row.id),
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
    const checked = search(
      fixtureRepository,
      query({ sort: "last-checked" }),
    );
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

  it("never exposes exact price or performs network access", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const rows = search(fixtureRepository);
    for (const row of rows) expect(row).not.toHaveProperty("price");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
