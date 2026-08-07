import type { CanonicalSearchQuery } from "../search";
import {
  executeReviewedSearch,
  type ReviewedSearchResult,
} from "../reviewed-search";
import type { PersistenceDatabase } from "./database";
import {
  PostgresReviewedPublicationIndexService,
  type ReviewedPublicationIndexRequest,
} from "./reviewed-publication-index-service";

export type ReviewedSearchServiceRequest = Readonly<{
  products: readonly ReviewedPublicationIndexRequest[];
  query?: CanonicalSearchQuery;
}>;

export class PostgresReviewedSearchService {
  private readonly publicationIndexService: PostgresReviewedPublicationIndexService;

  constructor(db: PersistenceDatabase) {
    this.publicationIndexService = new PostgresReviewedPublicationIndexService(
      db,
    );
  }

  async search(
    request: ReviewedSearchServiceRequest,
  ): Promise<ReviewedSearchResult> {
    const index = await this.publicationIndexService.loadPublicationIndex(
      request.products,
    );
    return executeReviewedSearch(index, { query: request.query });
  }
}
