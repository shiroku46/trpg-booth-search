import type { ReviewedSearchResult } from "./reviewed-search";
import type { CanonicalSearchQuery } from "./search";

export interface ReviewedSearchSource {
  search(query?: CanonicalSearchQuery): Promise<ReviewedSearchResult>;
}
