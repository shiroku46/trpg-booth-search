import { and, eq } from "drizzle-orm";

import {
  assertReviewApplicationTarget,
  type ReviewApplicationTarget,
} from "../review-application";
import type { ReviewSnapshot } from "../review";
import {
  composeReviewedOverlayBatch,
  reviewTargetIdentity,
  type ReviewedOverlayBatchInput,
  type ReviewedOverlayBatchResult,
} from "../reviewed-overlay-batch";
import type { PersistenceDatabase } from "./database";
import { PostgresProductScenarioRepository } from "./repository";
import { PostgresReviewApplicationRepository } from "./review-application-repository";
import { reviewCase } from "./schema";

function snapshotFromRow(row: typeof reviewCase.$inferSelect): ReviewSnapshot {
  return {
    evidencedState: row.evidencedState,
    confidence: row.confidence,
    initialReviewState: row.initialReviewState,
    evidenceCount: row.evidenceCount,
    hasConflict: row.hasConflict,
    holdReason: row.holdReason,
    containsAiEvidence: row.containsAiEvidence,
    versionKey: {
      contentVersion: row.contentVersion,
      normalizerVersion: row.normalizerVersion,
      registryVersion: row.registryVersion,
    },
  };
}

export class PostgresReviewedOverlayBatchService {
  private readonly graphRepository: PostgresProductScenarioRepository;
  private readonly applicationRepository: PostgresReviewApplicationRepository;

  constructor(private readonly db: PersistenceDatabase) {
    this.graphRepository = new PostgresProductScenarioRepository(db);
    this.applicationRepository = new PostgresReviewApplicationRepository(db);
  }

  async loadReviewedGraphBatch(
    targets: readonly ReviewApplicationTarget[],
  ): Promise<ReviewedOverlayBatchResult | null> {
    if (targets.length === 0) return null;

    for (const target of targets) assertReviewApplicationTarget(target);
    const productId = targets[0]!.productId;
    if (targets.some((target) => target.productId !== productId)) {
      throw new Error(
        "review overlay batch must target exactly one product graph",
      );
    }

    const identities = new Set<string>();
    for (const target of targets) {
      const identity = reviewTargetIdentity(target);
      if (identities.has(identity)) {
        throw new Error("duplicate exact review target in overlay batch");
      }
      identities.add(identity);
    }

    const graph = await this.graphRepository.loadGraph(productId);
    if (!graph) return null;

    const inputs: ReviewedOverlayBatchInput[] = [];
    for (const target of targets) {
      const [caseRow] = await this.db
        .select()
        .from(reviewCase)
        .where(
          and(
            eq(reviewCase.boothProductId, target.productId),
            eq(reviewCase.entityType, target.entityType),
            eq(reviewCase.entityId, target.entityId),
            eq(reviewCase.fieldPath, target.fieldPath),
            eq(reviewCase.contentVersion, target.versionKey.contentVersion),
            eq(
              reviewCase.normalizerVersion,
              target.versionKey.normalizerVersion,
            ),
            eq(reviewCase.registryVersion, target.versionKey.registryVersion),
          ),
        );

      if (!caseRow) {
        inputs.push({ target });
        continue;
      }
      inputs.push({
        target,
        snapshot: snapshotFromRow(caseRow),
        projection:
          await this.applicationRepository.loadEffectiveProjection(target),
      });
    }

    return composeReviewedOverlayBatch(graph.product, graph.scenarios, inputs);
  }
}
