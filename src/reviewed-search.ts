import type { PublicScenario } from "./domain";
import type { ReviewedPublicationIndexResult } from "./reviewed-publication-index";
import {
  EMPTY_QUERY,
  searchPublicRows,
  type CanonicalSearchQuery,
} from "./search";

export type ReviewedSearchRequest = Readonly<{
  query?: CanonicalSearchQuery;
}>;

export type ReviewedSearchResult = Readonly<{
  query: CanonicalSearchQuery;
  rows: readonly PublicScenario[];
  publicationReport: ReviewedPublicationIndexResult["report"];
}>;

function detach<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => detach(item)) as T;
  if (value && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      copy[key] = detach(nested);
    }
    return copy as T;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

export function normalizeReviewedSearchQuery(
  query: CanonicalSearchQuery = EMPTY_QUERY,
): CanonicalSearchQuery {
  return {
    keyword: query.keyword.trim(),
    system: query.system,
    edition: query.edition,
    playerCount: query.playerCount,
    playTime: query.playTime,
    modality: query.modality,
    tags: {
      genre: query.tags.genre,
      tone: query.tags.tone,
      setting: query.tags.setting,
      structure: query.tags.structure,
      content: query.tags.content,
    },
    book: query.book,
    compatibility: query.compatibility,
    sort: query.sort,
    seed: query.seed,
  };
}

export function executeReviewedSearch(
  index: ReviewedPublicationIndexResult,
  request: ReviewedSearchRequest = {},
): ReviewedSearchResult {
  const query = normalizeReviewedSearchQuery(request.query);
  return deepFreeze({
    query: detach(query),
    rows: detach(searchPublicRows(index.rows, query)),
    publicationReport: detach(index.report),
  });
}
