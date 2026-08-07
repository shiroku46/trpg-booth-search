import { describe, expect, it } from "vitest";
import { fixtureRepository } from "../fixtures";
import type { FixtureRepository } from "./domain";
import {
  buildFixtureReviewedPublicationIndex,
  searchReviewedFixtureRepository,
} from "./fixture-reviewed-search";
import {
  EMPTY_QUERY,
  SORT_ORDERS,
  search,
  type CanonicalSearchQuery,
} from "./search";

function query(overrides: Partial<CanonicalSearchQuery>): CanonicalSearchQuery {
  return {
    ...EMPTY_QUERY,
    ...overrides,
    tags: {
      ...EMPTY_QUERY.tags,
      ...(overrides.tags ?? {}),
    },
  };
}

describe("Stage 23 fixture reviewed-search adapter", () => {
  it.each(SORT_ORDERS)(
    "matches legacy fixture search for %s sorting",
    (sort) => {
      const request = query({ sort, seed: "stage23-seed" });
      expect(
        searchReviewedFixtureRepository(fixtureRepository, request).rows,
      ).toEqual(search(fixtureRepository, request));
    },
  );

  it("matches representative legacy filters and explicit unknown states", () => {
    const requests: CanonicalSearchQuery[] = [
      query({ keyword: "図書館" }),
      query({ system: "合成システムB" }),
      query({ edition: "6版" }),
      query({ edition: "unknown" }),
      query({ playerCount: "1" }),
      query({ playerCount: "unknown" }),
      query({ playTime: "long" }),
      query({ modality: "offline" }),
      query({ book: "追加資料集" }),
      query({ compatibility: "旧版対応" }),
      query({ tags: { ...EMPTY_QUERY.tags, genre: "ホラー" } }),
      query({ keyword: "一致しない検索語" }),
    ];

    for (const request of requests) {
      expect(
        searchReviewedFixtureRepository(fixtureRepository, request).rows,
      ).toEqual(search(fixtureRepository, request));
    }
  });

  it("is independent of fixture repository caller ordering", () => {
    const reversed: FixtureRepository = {
      products: () => [...fixtureRepository.products()].reverse(),
      scenarios: () => [...fixtureRepository.scenarios()].reverse(),
    };
    for (const sort of SORT_ORDERS) {
      const request = query({ sort, seed: "order-independent" });
      expect(searchReviewedFixtureRepository(reversed, request)).toEqual(
        searchReviewedFixtureRepository(fixtureRepository, request),
      );
    }
  });

  it("does not mutate fixtures and returns detached immutable read models", () => {
    const before = JSON.stringify({
      products: fixtureRepository.products(),
      scenarios: fixtureRepository.scenarios(),
    });
    const index = buildFixtureReviewedPublicationIndex(fixtureRepository);
    const result = searchReviewedFixtureRepository(fixtureRepository);

    expect(
      JSON.stringify({
        products: fixtureRepository.products(),
        scenarios: fixtureRepository.scenarios(),
      }),
    ).toBe(before);
    expect(index.report).toHaveLength(fixtureRepository.products().length);
    expect(index.report.every((item) => item.state === "projected")).toBe(true);
    expect(result.publicationReport).toEqual(index.report);
    expect(result.rows).not.toBe(index.rows);
    expect(Object.isFrozen(index)).toBe(true);
    expect(Object.isFrozen(index.rows)).toBe(true);
    expect(Object.isFrozen(index.report)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.query)).toBe(true);
    expect(Object.isFrozen(result.rows)).toBe(true);
    expect(Object.isFrozen(result.publicationReport)).toBe(true);
  });
});
