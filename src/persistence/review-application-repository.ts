import { and, eq } from "drizzle-orm";

import {
  assertReviewApplicationTarget,
  planReviewDecisionApplication,
  projectEffectiveReviewApplication,
  type EffectiveReviewProjection,
  type ReviewApplicationCase,
  type ReviewApplicationDecisionRecord,
  type ReviewApplicationEvent,
  type ReviewApplicationOutcome,
  type ReviewApplicationTarget,
} from "../review-application";
import type { ReviewSnapshot } from "../review";
import type { PersistenceDatabase } from "./database";
import {
  reviewApplicationEvent,
  reviewCase,
  reviewDecisionEvent,
} from "./schema";

export type ApplyReviewDecisionInput = {
  id: string;
  reviewCaseId: string;
  reviewDecisionEventId: string;
  target: ReviewApplicationTarget;
  appliedAt: string;
};

const timestamp = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()))
    throw new Error("Review application timestamp is invalid.");
  return parsed.toISOString().replace(".000Z", "Z");
};

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>))
      freeze(nested);
  }
  return value;
}

function targetFromCase(
  row: typeof reviewCase.$inferSelect,
): ReviewApplicationTarget {
  if (row.entityType !== "booth_product" && row.entityType !== "scenario")
    throw new Error("Stored review application entity type is invalid.");
  return {
    productId: row.boothProductId,
    entityType: row.entityType,
    entityId: row.entityId,
    fieldPath: row.fieldPath,
    versionKey: {
      contentVersion: row.contentVersion,
      normalizerVersion: row.normalizerVersion,
      registryVersion: row.registryVersion,
    },
  };
}

function snapshotFromCase(row: typeof reviewCase.$inferSelect): ReviewSnapshot {
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

function applicationCase(
  row: typeof reviewCase.$inferSelect,
): ReviewApplicationCase {
  return {
    id: row.id,
    target: targetFromCase(row),
    snapshot: snapshotFromCase(row),
  };
}

function applicationDecision(
  row: typeof reviewDecisionEvent.$inferSelect,
): ReviewApplicationDecisionRecord {
  return {
    id: row.id,
    reviewCaseId: row.reviewCaseId,
    decision: row.decision,
    reason: row.reason,
    decidedAt: timestamp(row.decidedAt),
  };
}

function eventFromRow(
  row: typeof reviewApplicationEvent.$inferSelect,
): ReviewApplicationEvent {
  if (row.entityType !== "booth_product" && row.entityType !== "scenario")
    throw new Error("Stored review application entity type is invalid.");
  return {
    id: row.id,
    reviewCaseId: row.reviewCaseId,
    reviewDecisionEventId: row.reviewDecisionEventId,
    target: {
      productId: row.boothProductId,
      entityType: row.entityType,
      entityId: row.entityId,
      fieldPath: row.fieldPath,
      versionKey: {
        contentVersion: row.contentVersion,
        normalizerVersion: row.normalizerVersion,
        registryVersion: row.registryVersion,
      },
    },
    outcome: row.outcome,
    appliedAt: timestamp(row.appliedAt),
  };
}

function sameStoredApplication(
  row: typeof reviewApplicationEvent.$inferSelect,
  input: ApplyReviewDecisionInput,
  outcome: ReviewApplicationOutcome,
  appliedAt: string,
): boolean {
  return (
    row.reviewCaseId === input.reviewCaseId &&
    row.boothProductId === input.target.productId &&
    row.entityType === input.target.entityType &&
    row.entityId === input.target.entityId &&
    row.fieldPath === input.target.fieldPath &&
    row.contentVersion === input.target.versionKey.contentVersion &&
    row.normalizerVersion === input.target.versionKey.normalizerVersion &&
    row.registryVersion === input.target.versionKey.registryVersion &&
    row.outcome === outcome &&
    timestamp(row.appliedAt) === appliedAt
  );
}

export class PostgresReviewApplicationRepository {
  constructor(private readonly db: PersistenceDatabase) {}

  async apply(input: ApplyReviewDecisionInput) {
    assertReviewApplicationTarget(input.target);
    const appliedAt = timestamp(input.appliedAt);

    return this.db.transaction(async (tx) => {
      const [caseRow] = await tx
        .select()
        .from(reviewCase)
        .where(eq(reviewCase.id, input.reviewCaseId));
      if (!caseRow) throw new Error("Review application case does not exist.");

      const [decisionRow] = await tx
        .select()
        .from(reviewDecisionEvent)
        .where(eq(reviewDecisionEvent.id, input.reviewDecisionEventId));
      if (!decisionRow)
        throw new Error("Review application decision does not exist.");

      const reviewCaseValue = applicationCase(caseRow);
      const decisionValue = applicationDecision(decisionRow);
      const outcome = planReviewDecisionApplication(
        reviewCaseValue,
        decisionValue,
        input.target,
      );
      if (
        new Date(appliedAt).valueOf() <=
        new Date(decisionValue.decidedAt).valueOf()
      )
        throw new Error("Review application must follow its decision.");

      const [existing] = await tx
        .select()
        .from(reviewApplicationEvent)
        .where(
          eq(
            reviewApplicationEvent.reviewDecisionEventId,
            input.reviewDecisionEventId,
          ),
        );
      if (existing) {
        if (!sameStoredApplication(existing, input, outcome, appliedAt))
          throw new Error("Review application identity conflict.");
        return freeze({
          state: "existing" as const,
          applicationId: existing.id,
        });
      }

      await tx.insert(reviewApplicationEvent).values({
        id: input.id,
        reviewCaseId: input.reviewCaseId,
        reviewDecisionEventId: input.reviewDecisionEventId,
        boothProductId: input.target.productId,
        entityType: input.target.entityType,
        entityId: input.target.entityId,
        fieldPath: input.target.fieldPath,
        contentVersion: input.target.versionKey.contentVersion,
        normalizerVersion: input.target.versionKey.normalizerVersion,
        registryVersion: input.target.versionKey.registryVersion,
        outcome,
        appliedAt,
      });
      return freeze({
        state: "inserted" as const,
        applicationId: input.id,
        outcome,
      });
    });
  }

  async loadEffectiveProjection(
    target: ReviewApplicationTarget,
  ): Promise<EffectiveReviewProjection> {
    assertReviewApplicationTarget(target);
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
    if (!caseRow) return projectEffectiveReviewApplication(null, target);

    const [decisionRow] = await this.db
      .select()
      .from(reviewDecisionEvent)
      .where(eq(reviewDecisionEvent.reviewCaseId, caseRow.id));
    if (!decisionRow) return projectEffectiveReviewApplication(null, target);

    const [applicationRow] = await this.db
      .select()
      .from(reviewApplicationEvent)
      .where(eq(reviewApplicationEvent.reviewDecisionEventId, decisionRow.id));
    if (!applicationRow) return projectEffectiveReviewApplication(null, target);

    const reviewCaseValue = applicationCase(caseRow);
    const decisionValue = applicationDecision(decisionRow);
    const expectedOutcome = planReviewDecisionApplication(
      reviewCaseValue,
      decisionValue,
      target,
    );
    const event = eventFromRow(applicationRow);
    if (event.outcome !== expectedOutcome)
      throw new Error("Stored review application outcome is inconsistent.");
    if (
      new Date(event.appliedAt).valueOf() <=
      new Date(decisionValue.decidedAt).valueOf()
    )
      throw new Error("Stored review application timestamp is inconsistent.");
    return projectEffectiveReviewApplication(event, target);
  }
}
