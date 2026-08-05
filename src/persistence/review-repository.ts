import { and, asc, eq, isNull, sql } from "drizzle-orm";

import {
  assertReviewDecisionAllowed,
  planReviewCase,
  REVIEW_CASE_REASONS,
  type ReviewCaseReason,
  type ReviewDecision,
  type ReviewDecisionReason,
  type ReviewPriority,
  type ReviewSnapshot,
} from "../review";
import type { PersistenceDatabase } from "./database";
import { boothProduct, reviewCase, reviewDecisionEvent, scenario } from "./schema";

export type ReviewEntityType = "booth_product" | "scenario";
export type ReviewTarget = {
  productId: string;
  entityType: ReviewEntityType;
  entityId: string;
  fieldPath: string;
};
export type OpenReviewCaseInput = ReviewTarget & {
  id: string;
  snapshot: ReviewSnapshot;
  manualReviewRequested?: boolean;
  createdAt: string;
};
export type DecideReviewCaseInput = {
  id: string;
  caseId: string;
  decision: ReviewDecision;
  reason: ReviewDecisionReason;
  decidedAt: string;
};
export type LoadedReviewCase = {
  id: string;
  target: ReviewTarget;
  snapshot: ReviewSnapshot;
  priority: ReviewPriority;
  reasons: readonly ReviewCaseReason[];
  createdAt: string;
  decision: null | {
    id: string;
    decision: ReviewDecision;
    reason: ReviewDecisionReason;
    decidedAt: string;
  };
};

const FIELD_PATH = /^[a-z][a-z0-9_]*(?:[.][a-z][a-z0-9_]*){0,5}$/u;
type Tx = Parameters<Parameters<PersistenceDatabase["transaction"]>[0]>[0];
type Reader = Pick<Tx, "select">;

const timestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error("Review timestamp is invalid.");
  return date.toISOString().replace(".000Z", "Z");
};

function reasons(value: unknown): ReviewCaseReason[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new Error("Stored review reasons are invalid.");
  const result: ReviewCaseReason[] = [];
  for (const item of value) {
    if (
      typeof item !== "string" ||
      !(REVIEW_CASE_REASONS as readonly string[]).includes(item) ||
      result.includes(item as ReviewCaseReason)
    )
      throw new Error("Stored review reasons are invalid.");
    result.push(item as ReviewCaseReason);
  }
  return result;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) freeze(nested);
  }
  return value;
}

function snapshot(row: typeof reviewCase.$inferSelect): ReviewSnapshot {
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

async function assertOwner(db: Reader, target: ReviewTarget) {
  if (target.entityType === "booth_product") {
    if (target.entityId !== target.productId)
      throw new Error("A product review must target its owner.");
    const [row] = await db.select({ id: boothProduct.id }).from(boothProduct).where(eq(boothProduct.id, target.productId));
    if (!row) throw new Error("Review product does not exist.");
    return;
  }
  const [row] = await db.select({ productId: scenario.boothProductId }).from(scenario).where(eq(scenario.id, target.entityId));
  if (!row || row.productId !== target.productId)
    throw new Error("Review scenario is not owned by the product.");
}

function view(
  row: typeof reviewCase.$inferSelect,
  event: typeof reviewDecisionEvent.$inferSelect | null,
): LoadedReviewCase {
  const entityType = row.entityType;
  if (entityType !== "booth_product" && entityType !== "scenario")
    throw new Error("Stored review entity type is invalid.");
  return freeze({
    id: row.id,
    target: {
      productId: row.boothProductId,
      entityType,
      entityId: row.entityId,
      fieldPath: row.fieldPath,
    },
    snapshot: snapshot(row),
    priority: row.priority,
    reasons: reasons(row.reasons),
    createdAt: timestamp(row.createdAt),
    decision: event
      ? {
          id: event.id,
          decision: event.decision,
          reason: event.reason,
          decidedAt: timestamp(event.decidedAt),
        }
      : null,
  });
}

export class PostgresReviewRepository {
  constructor(private readonly db: PersistenceDatabase) {}

  async openCase(input: OpenReviewCaseInput) {
    if (input.fieldPath.length > 128 || !FIELD_PATH.test(input.fieldPath))
      throw new Error("Review field path is invalid.");
    const createdAt = timestamp(input.createdAt);
    const plan = planReviewCase(input.snapshot, input.manualReviewRequested ?? false);
    if (plan.state === "no_case") throw new Error("Review is not required.");
    const target: ReviewTarget = {
      productId: input.productId,
      entityType: input.entityType,
      entityId: input.entityId,
      fieldPath: input.fieldPath,
    };

    return this.db.transaction(async (tx) => {
      await assertOwner(tx, target);
      const [existing] = await tx
        .select()
        .from(reviewCase)
        .where(
          and(
            eq(reviewCase.boothProductId, input.productId),
            eq(reviewCase.entityType, input.entityType),
            eq(reviewCase.entityId, input.entityId),
            eq(reviewCase.fieldPath, input.fieldPath),
            eq(reviewCase.contentVersion, input.snapshot.versionKey.contentVersion),
            eq(reviewCase.normalizerVersion, input.snapshot.versionKey.normalizerVersion),
            eq(reviewCase.registryVersion, input.snapshot.versionKey.registryVersion),
          ),
        );
      if (existing) {
        if (
          existing.createdAt !== createdAt ||
          existing.priority !== plan.priority ||
          JSON.stringify(snapshot(existing)) !== JSON.stringify(input.snapshot) ||
          JSON.stringify(reasons(existing.reasons)) !== JSON.stringify(plan.reasons)
        )
          throw new Error("Review case identity conflict.");
        return freeze({ state: "existing" as const, caseId: existing.id });
      }
      await tx.insert(reviewCase).values({
        id: input.id,
        boothProductId: input.productId,
        entityType: input.entityType,
        entityId: input.entityId,
        fieldPath: input.fieldPath,
        evidencedState: input.snapshot.evidencedState,
        confidence: input.snapshot.confidence,
        initialReviewState: input.snapshot.initialReviewState,
        evidenceCount: input.snapshot.evidenceCount,
        hasConflict: input.snapshot.hasConflict,
        holdReason: input.snapshot.holdReason,
        containsAiEvidence: input.snapshot.containsAiEvidence,
        contentVersion: input.snapshot.versionKey.contentVersion,
        normalizerVersion: input.snapshot.versionKey.normalizerVersion,
        registryVersion: input.snapshot.versionKey.registryVersion,
        priority: plan.priority,
        reasons: [...plan.reasons],
        createdAt,
      });
      return freeze({ state: "inserted" as const, caseId: input.id });
    });
  }

  async decide(input: DecideReviewCaseInput) {
    const decidedAt = timestamp(input.decidedAt);
    return this.db.transaction(async (tx) => {
      const [caseRow] = await tx.select().from(reviewCase).where(eq(reviewCase.id, input.caseId));
      if (!caseRow) throw new Error("Review case does not exist.");
      const [existing] = await tx.select().from(reviewDecisionEvent).where(eq(reviewDecisionEvent.reviewCaseId, input.caseId));
      if (existing) {
        if (existing.decision !== input.decision || existing.reason !== input.reason)
          throw new Error("Review case already has a different decision.");
        return freeze({ state: "existing" as const, decisionId: existing.id });
      }
      assertReviewDecisionAllowed(snapshot(caseRow), input.decision, input.reason);
      if (new Date(decidedAt).valueOf() <= new Date(caseRow.createdAt).valueOf())
        throw new Error("Review decision must be newer than its case.");
      await tx.insert(reviewDecisionEvent).values({
        id: input.id,
        reviewCaseId: input.caseId,
        decision: input.decision,
        reason: input.reason,
        decidedAt,
      });
      return freeze({ state: "inserted" as const, decisionId: input.id });
    });
  }

  async loadCase(caseId: string): Promise<LoadedReviewCase | null> {
    const [row] = await this.db.select().from(reviewCase).where(eq(reviewCase.id, caseId));
    if (!row) return null;
    const [event] = await this.db.select().from(reviewDecisionEvent).where(eq(reviewDecisionEvent.reviewCaseId, caseId));
    return view(row, event ?? null);
  }

  async pendingCases(): Promise<LoadedReviewCase[]> {
    const rows = await this.db
      .select({ caseRow: reviewCase })
      .from(reviewCase)
      .leftJoin(reviewDecisionEvent, eq(reviewDecisionEvent.reviewCaseId, reviewCase.id))
      .where(isNull(reviewDecisionEvent.id))
      .orderBy(
        asc(sql`CASE ${reviewCase.priority} WHEN 'blocking' THEN 0 WHEN 'high' THEN 1 ELSE 2 END`),
        asc(reviewCase.createdAt),
        asc(reviewCase.id),
      );
    return freeze(rows.map(({ caseRow }) => view(caseRow, null)));
  }
}
