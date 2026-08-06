import type { ReviewApplicationTarget } from "../review-application";
import {
  composeReviewedOverlayBatch,
  reviewTargetIdentity,
} from "../reviewed-overlay-batch";
import {
  composeReviewedPublicationIndex,
  type ReviewedPublicationIndexInput,
  type ReviewedPublicationIndexResult,
} from "../reviewed-publication-index";
import type { PersistenceDatabase } from "./database";
import { PostgresProductScenarioRepository } from "./repository";
import { PostgresReviewedOverlayBatchService } from "./reviewed-overlay-batch-service";

export type ReviewedPublicationIndexRequest = Readonly<{
  productId: string;
  targets: readonly ReviewApplicationTarget[];
}>;

export class PostgresReviewedPublicationIndexService {
  private readonly graphRepository: PostgresProductScenarioRepository;
  private readonly overlayBatchService: PostgresReviewedOverlayBatchService;

  constructor(private readonly db: PersistenceDatabase) {
    this.graphRepository = new PostgresProductScenarioRepository(db);
    this.overlayBatchService = new PostgresReviewedOverlayBatchService(db);
  }

  async loadPublicationIndex(
    requests: readonly ReviewedPublicationIndexRequest[],
  ): Promise<ReviewedPublicationIndexResult> {
    const requestedProducts = new Set<string>();
    for (const request of requests) {
      if (requestedProducts.has(request.productId))
        throw new Error("duplicate product request in reviewed publication index");
      requestedProducts.add(request.productId);

      const targetIdentities = new Set<string>();
      for (const target of request.targets) {
        if (target.productId !== request.productId)
          throw new Error("review target does not belong to requested product");
        const identity = reviewTargetIdentity(target);
        if (targetIdentities.has(identity))
          throw new Error("duplicate exact review target in product request");
        targetIdentities.add(identity);
      }
    }

    const inputs: ReviewedPublicationIndexInput[] = [];
    for (const request of requests) {
      if (!request.productId.trim()) {
        inputs.push({ productId: request.productId });
        continue;
      }

      if (request.targets.length > 0) {
        const graph = await this.overlayBatchService.loadReviewedGraphBatch(
          request.targets,
        );
        inputs.push({ productId: request.productId, graph: graph ?? undefined });
        continue;
      }

      const storedGraph = await this.graphRepository.loadGraph(request.productId);
      inputs.push({
        productId: request.productId,
        graph: storedGraph
          ? composeReviewedOverlayBatch(
              storedGraph.product,
              storedGraph.scenarios,
              [],
            )
          : undefined,
      });
    }

    return composeReviewedPublicationIndex(inputs);
  }
}
