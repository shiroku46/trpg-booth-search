import type { ReviewedSearchResult } from "../reviewed-search";
import type { ReviewedSearchSource } from "../reviewed-search-source";
import { EMPTY_QUERY, type CanonicalSearchQuery } from "../search";
import type { PersistenceDatabase } from "./database";
import type { ReviewedPublicationIndexRequest } from "./reviewed-publication-index-service";
import { PostgresReviewedSearchService } from "./reviewed-search-service";

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

export class PostgresReviewedSearchSource implements ReviewedSearchSource {
  private readonly service: PostgresReviewedSearchService;
  private readonly products: readonly ReviewedPublicationIndexRequest[];

  constructor(
    db: PersistenceDatabase,
    products: readonly ReviewedPublicationIndexRequest[],
  ) {
    this.service = new PostgresReviewedSearchService(db);
    this.products = deepFreeze(detach([...products]));
  }

  async search(
    query: CanonicalSearchQuery = EMPTY_QUERY,
  ): Promise<ReviewedSearchResult> {
    return this.service.search({ products: this.products, query });
  }
}
