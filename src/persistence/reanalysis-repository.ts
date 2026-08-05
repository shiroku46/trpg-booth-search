import { and, asc, desc, eq } from "drizzle-orm";

import {
  planReanalysis,
  type ReanalysisPlan,
  type ReanalysisTrigger,
  type ReanalysisVersionKey,
} from "../reanalysis";
import type { PersistenceDatabase } from "./database";
import {
  boothProduct,
  normalizationHistory,
  scenario,
} from "./schema";

export type ReanalysisEntityType = "booth_product" | "scenario";

export type ReanalysisTarget = {
  productId: string;
  entityType: ReanalysisEntityType;
  entityId: string;
};

export type RecordAnalysisInput = ReanalysisTarget & {
  id: string;
  nextKey: ReanalysisVersionKey;
  resultSnapshot: Record<string, unknown>;
  bodyDerivedSha256?: string;
  createdAt: string;
  requestedTrigger?: ReanalysisTrigger;
  reasonDetail?: string;
};

export type RecordAnalysisResult =
  | {
      state: "inserted_initial";
      historyId: string;
      plan: Extract<ReanalysisPlan, { state: "initial_analysis" }>;
    }
  | {
      state: "inserted_reanalysis";
      historyId: string;
      plan: Extract<ReanalysisPlan, { state: "reanalyze" }>;
    }
  | {
      state: "skipped";
      plan: Extract<ReanalysisPlan, { state: "skip" }>;
    };

export type LoadedAnalysisHistory = {
  id: string;
  target: ReanalysisTarget;
  recordKind: "initial_analysis" | "reanalysis";
  reanalysisTrigger: ReanalysisTrigger | null;
  previousKey: ReanalysisVersionKey | null;
  currentKey: ReanalysisVersionKey;
  oldResultSnapshot: Readonly<Record<string, unknown>> | null;
  newResultSnapshot: Readonly<Record<string, unknown>>;
  bodyDerivedSha256: string | null;
  reasonDetail: string | null;
  createdAt: string;
};

const SHA256 = /^[0-9a-f]{64}$/u;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

type PersistenceTransaction = Parameters<
  Parameters<PersistenceDatabase["transaction"]>[0]
>[0];
type ReadDatabase = Pick<PersistenceTransaction, "select">;

function parseEntityType(value: string): ReanalysisEntityType {
  if (value === "booth_product" || value === "scenario") return value;
  throw new Error("Stored reanalysis entity type is invalid.");
}

function normalizeTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()))
    throw new Error("Reanalysis timestamp is invalid.");
  return parsed.toISOString().replace(".000Z", "Z");
}

function jsonObject(
  value: Record<string, unknown>,
  name: string,
): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw new Error(`${name} must be a JSON object.`);
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new Error(`${name} must be JSON serializable.`);
  }
  if (encoded === undefined)
    throw new Error(`${name} must be JSON serializable.`);
  const decoded = JSON.parse(encoded) as unknown;
  if (!decoded || Array.isArray(decoded) || typeof decoded !== "object")
    throw new Error(`${name} must be a JSON object.`);
  return decoded as Record<string, unknown>;
}

function optionalReasonDetail(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (
    value.length === 0 ||
    value.length > 1000 ||
    value.trim() !== value ||
    CONTROL_CHARACTERS.test(value)
  )
    throw new Error("Reanalysis reason detail is invalid.");
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>))
      deepFreeze(nested);
  }
  return value;
}

function currentKey(
  row: typeof normalizationHistory.$inferSelect,
): ReanalysisVersionKey {
  return {
    contentVersion: row.contentVersion,
    normalizerVersion: row.normalizerVersion,
    registryVersion: row.registryVersion,
  };
}

function loadedRow(
  row: typeof normalizationHistory.$inferSelect,
): LoadedAnalysisHistory {
  const previousKey =
    row.contentVersionOld &&
    row.normalizerVersionOld &&
    row.registryVersionOld
      ? {
          contentVersion: row.contentVersionOld,
          normalizerVersion: row.normalizerVersionOld,
          registryVersion: row.registryVersionOld,
        }
      : null;
  return deepFreeze({
    id: row.id,
    target: {
      productId: row.boothProductId,
      entityType: parseEntityType(row.entityType),
      entityId: row.entityId,
    },
    recordKind: row.recordKind,
    reanalysisTrigger: row.reanalysisTrigger,
    previousKey,
    currentKey: currentKey(row),
    oldResultSnapshot: row.oldResultSnapshot
      ? structuredClone(row.oldResultSnapshot)
      : null,
    newResultSnapshot: structuredClone(row.decision),
    bodyDerivedSha256: row.bodyDerivedSha256,
    reasonDetail: row.reasonDetail,
    createdAt: normalizeTimestamp(row.createdAt),
  });
}

async function assertOwnedTarget(
  db: ReadDatabase,
  target: ReanalysisTarget,
): Promise<void> {
  if (target.entityType === "booth_product") {
    if (target.entityId !== target.productId)
      throw new Error("A product analysis must target its owning product ID.");
    const [row] = await db
      .select({ id: boothProduct.id })
      .from(boothProduct)
      .where(eq(boothProduct.id, target.productId));
    if (!row) throw new Error("Reanalysis product does not exist.");
    return;
  }

  const [row] = await db
    .select({ productId: scenario.boothProductId })
    .from(scenario)
    .where(eq(scenario.id, target.entityId));
  if (!row || row.productId !== target.productId)
    throw new Error("Reanalysis scenario is not owned by the product.");
}

async function latestRow(
  db: ReadDatabase,
  target: ReanalysisTarget,
): Promise<typeof normalizationHistory.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(normalizationHistory)
    .where(
      and(
        eq(normalizationHistory.boothProductId, target.productId),
        eq(normalizationHistory.entityType, target.entityType),
        eq(normalizationHistory.entityId, target.entityId),
      ),
    )
    .orderBy(desc(normalizationHistory.createdAt), desc(normalizationHistory.id))
    .limit(1);
  return row ?? null;
}

export class PostgresReanalysisRepository {
  constructor(private readonly db: PersistenceDatabase) {}

  async record(input: RecordAnalysisInput): Promise<RecordAnalysisResult> {
    const target: ReanalysisTarget = {
      productId: input.productId,
      entityType: input.entityType,
      entityId: input.entityId,
    };
    const resultSnapshot = jsonObject(input.resultSnapshot, "Result snapshot");
    const createdAt = normalizeTimestamp(input.createdAt);
    const reasonDetail = optionalReasonDetail(input.reasonDetail);
    if (
      input.bodyDerivedSha256 !== undefined &&
      !SHA256.test(input.bodyDerivedSha256)
    )
      throw new Error("Body-derived SHA-256 is invalid.");

    return this.db.transaction(async (tx) => {
      await assertOwnedTarget(tx, target);
      const previousRow = await latestRow(tx, target);
      const plan = planReanalysis(
        previousRow ? currentKey(previousRow) : null,
        input.nextKey,
        input.requestedTrigger,
      );

      if (plan.state === "skip") return { state: "skipped", plan };

      if (
        previousRow &&
        new Date(createdAt).valueOf() <= new Date(previousRow.createdAt).valueOf()
      )
        throw new Error(
          "A reanalysis transition must be newer than the current analysis.",
        );

      if (plan.state === "initial_analysis") {
        await tx.insert(normalizationHistory).values({
          id: input.id,
          boothProductId: target.productId,
          entityType: target.entityType,
          entityId: target.entityId,
          recordKind: "initial_analysis",
          contentVersion: plan.next.contentVersion,
          normalizerVersion: plan.next.normalizerVersion,
          registryVersion: plan.next.registryVersion,
          bodyDerivedSha256: input.bodyDerivedSha256 ?? null,
          decision: resultSnapshot,
          createdAt,
        });
        return {
          state: "inserted_initial",
          historyId: input.id,
          plan,
        };
      }

      const combinedReasonDetail = reasonDetail
        ? `${plan.reasonDetail};detail=${reasonDetail}`
        : plan.reasonDetail;
      await tx.insert(normalizationHistory).values({
        id: input.id,
        boothProductId: target.productId,
        entityType: target.entityType,
        entityId: target.entityId,
        recordKind: "reanalysis",
        reanalysisTrigger: plan.trigger,
        contentVersionOld: plan.previous.contentVersion,
        normalizerVersionOld: plan.previous.normalizerVersion,
        registryVersionOld: plan.previous.registryVersion,
        oldResultSnapshot: structuredClone(previousRow!.decision),
        contentVersion: plan.next.contentVersion,
        normalizerVersion: plan.next.normalizerVersion,
        registryVersion: plan.next.registryVersion,
        bodyDerivedSha256: input.bodyDerivedSha256 ?? null,
        decision: resultSnapshot,
        reasonDetail: combinedReasonDetail,
        createdAt,
      });
      return {
        state: "inserted_reanalysis",
        historyId: input.id,
        plan,
      };
    });
  }

  async history(target: ReanalysisTarget): Promise<LoadedAnalysisHistory[]> {
    await assertOwnedTarget(this.db, target);
    const rows = await this.db
      .select()
      .from(normalizationHistory)
      .where(
        and(
          eq(normalizationHistory.boothProductId, target.productId),
          eq(normalizationHistory.entityType, target.entityType),
          eq(normalizationHistory.entityId, target.entityId),
        ),
      )
      .orderBy(asc(normalizationHistory.createdAt), asc(normalizationHistory.id));
    return deepFreeze(rows.map(loadedRow));
  }
}
