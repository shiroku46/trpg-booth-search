import { and, eq } from "drizzle-orm";

import {
  assertReviewApplicationTarget,
  type ReviewApplicationTarget,
} from "../review-application";
import type { ReviewSnapshot } from "../review";
import {
  isSupportedReviewField,
  materializeReviewedGraph,
  type ReviewedGraphOverlayResult,
} from "../reviewed-overlay";
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

const omitted = (
  reason: "unapplied" | "unsupported_field" | "entity_missing",
  target: ReviewApplicationTarget,
): ReviewedGraphOverlayResult => ({ state: "omitted", reason, target });

export class PostgresReviewedOverlayService {
  private readonly graphRepository: PostgresProductScenarioRepository;
  private readonly applicationRepository: PostgresReviewApplicationRepository;

  constructor(private readonly db: PersistenceDatabase) {
    this.graphRepository = new PostgresProductScenarioRepository(db);
    this.applicationRepository = new PostgresReviewApplicationRepository(db);
  }

  async loadReviewedGraph(
    target: ReviewApplicationTarget,
  ): Promise<ReviewedGraphOverlayResult> {
    assertReviewApplicationTarget(target);
    if (!isSupportedReviewField(target))
      return omitted("unsupported_field", target);

    const graph = await this.graphRepository.loadGraph(target.productId);
    if (!graph) return omitted("entity_missing", target);

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
          eq(reviewCase.normalizerVersion, target.versionKey.normalizerVersion),
          eq(reviewCase.registryVersion, target.versionKey.registryVersion),
        ),
      );
    if (!caseRow) return omitted("unapplied", target);

    const projection =
      await this.applicationRepository.loadEffectiveProjection(target);
    return materializeReviewedGraph(
      graph.product,
      graph.scenarios,
      snapshotFromRow(caseRow),
      projection,
      target,
    );
  }
}
