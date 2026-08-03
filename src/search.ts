import type {
  FixtureRepository,
  PublicFacet,
  PublicScenario,
  SeededRandom,
  TagCategory,
} from "./domain";
import { TAG_CATEGORIES } from "./domain";
import { project } from "./publication";

export const UNKNOWN = "unknown" as const;
export const SORT_ORDERS = [
  "title",
  "discovery",
  "new",
  "last-checked",
  "random",
] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];
export const PLAY_TIME_FILTERS = ["short", "medium", "long", UNKNOWN] as const;
export type PlayTimeFilter = "" | (typeof PLAY_TIME_FILTERS)[number];
export const SYSTEM_OPTIONS = [
  "合成システムA",
  "合成システムB",
  UNKNOWN,
] as const;
export const EDITION_OPTIONS = ["6版", "7版", UNKNOWN] as const;
export const PLAYER_COUNT_OPTIONS = ["1人", "2〜4人", "5人", UNKNOWN] as const;
export const MODALITY_OPTIONS = [
  "online",
  "offline",
  "either",
  UNKNOWN,
] as const;
export const BOOK_OPTIONS = [
  "基本ルールブック",
  "追加資料集",
  UNKNOWN,
] as const;
export const COMPATIBILITY_OPTIONS = ["新版対応", "旧版対応", UNKNOWN] as const;
export const TAG_OPTIONS: Record<TagCategory, readonly string[]> = {
  genre: ["ミステリー", "冒険", "ホラー", UNKNOWN],
  tone: ["明るい", "静か", "緊張感", UNKNOWN],
  setting: ["現代", "幻想", "宇宙", UNKNOWN],
  structure: ["一本道", "探索型", "分岐型", UNKNOWN],
  content: ["会話中心", "推理中心", "戦闘あり", UNKNOWN],
};

export type CanonicalSearchQuery = {
  keyword: string;
  system: string;
  edition: string;
  playerCount: string;
  playTime: PlayTimeFilter;
  modality: string;
  tags: Record<TagCategory, string>;
  book: string;
  compatibility: string;
  sort: SortOrder;
  seed: string;
};

export const EMPTY_QUERY: CanonicalSearchQuery = {
  keyword: "",
  system: "",
  edition: "",
  playerCount: "",
  playTime: "",
  modality: "",
  tags: {
    genre: "",
    tone: "",
    setting: "",
    structure: "",
    content: "",
  },
  book: "",
  compatibility: "",
  sort: "title",
  seed: "demo",
};

export class HashSeededRandom implements SeededRandom {
  order<T extends { id: string }>(values: readonly T[], seed: string): T[] {
    const hash = (value: string) => {
      let result = 2166136261;
      for (const character of value)
        result = Math.imul(result ^ character.charCodeAt(0), 16777619);
      return result >>> 0;
    };
    return [...values].sort(
      (a, b) =>
        hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`) ||
        a.id.localeCompare(b.id),
    );
  }
}

const normalize = (value: string) => value.toLocaleLowerCase("ja").trim();

function matchesFacet<T>(
  facet: PublicFacet<T>,
  expected: string,
  matches: (value: T, expected: string) => boolean,
): boolean {
  if (!expected) return true;
  if (expected === UNKNOWN) return facet.state === "unknown";
  return facet.state === "known" && matches(facet.value, expected);
}

const matchesString = (value: string, expected: string) => value === expected;
const matchesArray = (values: readonly string[], expected: string) =>
  values.includes(expected);

function matchesKeyword(row: PublicScenario, keyword: string): boolean {
  const query = normalize(keyword);
  if (!query) return true;
  const values = [row.title, row.productTitle, ...row.systems];
  for (const category of TAG_CATEGORIES) {
    const facet = row.tags[category];
    if (facet.state === "known") values.push(...facet.value);
  }
  if (row.requiredBooks.state === "known")
    values.push(...row.requiredBooks.value);
  if (row.compatibility.state === "known")
    values.push(...row.compatibility.value);
  return values.some((value) => normalize(value).includes(query));
}

function matchesPlayTime(
  facet: PublicFacet<number>,
  expected: PlayTimeFilter,
): boolean {
  if (!expected) return true;
  if (expected === UNKNOWN) return facet.state === "unknown";
  if (facet.state !== "known") return false;
  if (expected === "short") return facet.value <= 120;
  if (expected === "medium") return facet.value > 120 && facet.value <= 240;
  return facet.value > 240;
}

function stableTitle(a: PublicScenario, b: PublicScenario): number {
  return a.title.localeCompare(b.title, "ja") || a.id.localeCompare(b.id);
}

const compareTimestampDescending = (a: string, b: string) =>
  Date.parse(b) - Date.parse(a);

function sortRows(
  rows: readonly PublicScenario[],
  sort: SortOrder,
  seed: string,
): PublicScenario[] {
  if (sort === "random") return new HashSeededRandom().order(rows, seed);
  return [...rows].sort((a, b) => {
    if (sort === "discovery")
      return (
        a.productTitle.localeCompare(b.productTitle, "ja") || stableTitle(a, b)
      );
    if (sort === "new")
      return (
        compareTimestampDescending(a.publishedAt, b.publishedAt) ||
        stableTitle(a, b)
      );
    if (sort === "last-checked")
      return (
        compareTimestampDescending(a.lastCheckedAt, b.lastCheckedAt) ||
        stableTitle(a, b)
      );
    return stableTitle(a, b);
  });
}

export function search(
  repo: FixtureRepository,
  query: CanonicalSearchQuery = EMPTY_QUERY,
): PublicScenario[] {
  const products = new Map(
    repo.products().map((product) => [product.id, product]),
  );
  const projected = repo
    .scenarios()
    .map((scenario) => project(products.get(scenario.productId), scenario))
    .filter(
      (decision): decision is Extract<typeof decision, { publish: true }> =>
        decision.publish,
    )
    .map((decision) => decision.value);

  const filtered = projected.filter((row) => {
    if (!matchesKeyword(row, query.keyword)) return false;
    if (
      query.system &&
      (query.system === UNKNOWN
        ? row.systems.length !== 0
        : !row.systems.includes(query.system))
    )
      return false;
    if (!matchesFacet(row.edition, query.edition, matchesString)) return false;
    if (!matchesFacet(row.playerCount, query.playerCount, matchesString))
      return false;
    if (!matchesPlayTime(row.playTimeMinutes, query.playTime)) return false;
    if (!matchesFacet(row.modality, query.modality, matchesString))
      return false;
    if (!matchesFacet(row.requiredBooks, query.book, matchesArray))
      return false;
    if (!matchesFacet(row.compatibility, query.compatibility, matchesArray))
      return false;
    return TAG_CATEGORIES.every((category) =>
      matchesFacet(row.tags[category], query.tags[category], matchesArray),
    );
  });

  return sortRows(filtered, query.sort, query.seed);
}
