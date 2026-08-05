import { eq, sql } from "drizzle-orm";

import type { Product, Scenario } from "../domain";
import type { PersistenceDatabase } from "./database";
import {
  boothProduct,
  normalizationHistory,
  redactionTombstone,
  scenario,
  sourceSnapshot,
} from "./schema";

export type SourceSnapshotInput = {
  id: string;
  productId: string;
  sourceUrl: string;
  outcome: string;
  statusCode?: number;
  rawSha256?: string;
  normalizedSha256?: string;
  contentVersion: string;
  parserVersion: string;
  checkedAt: string;
};

export type NormalizationHistoryInput = {
  id: string;
  productId: string;
  entityType: "booth_product" | "scenario";
  entityId: string;
  contentVersion: string;
  normalizerVersion: string;
  registryVersion: string;
  bodyDerivedSha256?: string;
  decision: Record<string, unknown>;
  createdAt: string;
};

export type StoredGraphInput = {
  product: Product;
  sourceProductId: string;
  contentVersion: string;
  currentRecordUpdatedAt: string;
  scenarios: readonly Scenario[];
  sourceSnapshots?: readonly SourceSnapshotInput[];
  normalizationHistory?: readonly NormalizationHistoryInput[];
};

export type LoadedGraph = {
  product: Product;
  scenarios: Scenario[];
};

export type PurgeResult = {
  productId: string;
  snapshotCount: number;
  historyCount: number;
  scenarioCount: number;
  completedAt: string;
};

function normalizeTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()))
    throw new Error("Database returned an invalid timestamp.");
  return parsed.toISOString().replace(".000Z", "Z");
}

export class PostgresProductScenarioRepository {
  constructor(private readonly db: PersistenceDatabase) {}

  async saveGraph(input: StoredGraphInput): Promise<void> {
    if (input.scenarios.some((item) => item.productId !== input.product.id))
      throw new Error("Every scenario must belong to the saved product.");
    if (
      input.sourceSnapshots?.some(
        (item) => item.productId !== input.product.id,
      ) ||
      input.normalizationHistory?.some(
        (item) => item.productId !== input.product.id,
      )
    )
      throw new Error(
        "Snapshot and history ownership must use the product ID.",
      );

    const scenarioIds = new Set(input.scenarios.map((item) => item.id));
    if (
      input.normalizationHistory?.some((item) =>
        item.entityType === "booth_product"
          ? item.entityId !== input.product.id
          : !scenarioIds.has(item.entityId),
      )
    )
      throw new Error(
        "Normalization history must reference an entity owned by the product graph.",
      );

    await this.db.transaction(async (tx) => {
      await tx.insert(boothProduct).values({
        id: input.product.id,
        sourcePlatform: "booth",
        sourceProductId: input.sourceProductId,
        canonicalUrl: input.product.canonicalUrl,
        observedTitle: input.product.title ?? null,
        allAgesState: input.product.allAges,
        classification: input.product.classification ?? null,
        salesState: input.product.salesState,
        sourcePublicationDate: input.product.sourcePublicationDate,
        isFree: input.product.isFree ?? null,
        firstSeenAt: input.product.firstSeenAt,
        lastCheckedAt: input.product.lastCheckedAt,
        contentVersion: input.contentVersion,
        currentRecordUpdatedAt: input.currentRecordUpdatedAt,
      });

      if (input.scenarios.length > 0)
        await tx.insert(scenario).values(
          input.scenarios.map((item) => ({
            id: item.id,
            boothProductId: item.productId,
            title: item.title,
            playerCount: item.playerCount,
            edition: item.edition,
            playTimeMinutes: item.playTimeMinutes,
            modality: item.modality,
            tags: item.tags,
            requiredBooks: item.requiredBooks,
            compatibility: item.compatibility,
            relationships: item.relationships,
            separationApproved: item.separationApproved,
            hold: item.hold ?? false,
            firstSeenAt: input.product.firstSeenAt,
            lastCheckedAt: input.product.lastCheckedAt,
            contentVersion: item.title.contentVersion,
            currentRecordUpdatedAt: input.currentRecordUpdatedAt,
          })),
        );

      if (input.sourceSnapshots && input.sourceSnapshots.length > 0)
        await tx.insert(sourceSnapshot).values(
          input.sourceSnapshots.map((item) => ({
            id: item.id,
            boothProductId: item.productId,
            sourceUrl: item.sourceUrl,
            outcome: item.outcome,
            statusCode: item.statusCode ?? null,
            rawSha256: item.rawSha256 ?? null,
            normalizedSha256: item.normalizedSha256 ?? null,
            contentVersion: item.contentVersion,
            parserVersion: item.parserVersion,
            checkedAt: item.checkedAt,
          })),
        );

      if (input.normalizationHistory && input.normalizationHistory.length > 0)
        await tx.insert(normalizationHistory).values(
          input.normalizationHistory.map((item) => ({
            id: item.id,
            boothProductId: item.productId,
            entityType: item.entityType,
            entityId: item.entityId,
            contentVersion: item.contentVersion,
            normalizerVersion: item.normalizerVersion,
            registryVersion: item.registryVersion,
            bodyDerivedSha256: item.bodyDerivedSha256 ?? null,
            decision: item.decision,
            createdAt: item.createdAt,
          })),
        );
    });
  }

  async loadGraph(productId: string): Promise<LoadedGraph | null> {
    const [productRow] = await this.db
      .select()
      .from(boothProduct)
      .where(eq(boothProduct.id, productId));
    if (
      !productRow ||
      !productRow.observedTitle ||
      !productRow.salesState ||
      !productRow.sourcePublicationDate
    )
      return null;

    const scenarioRows = await this.db
      .select()
      .from(scenario)
      .where(eq(scenario.boothProductId, productId));

    const loadedScenarios: Scenario[] = [];
    for (const row of scenarioRows) {
      if (
        !row.title ||
        !row.playerCount ||
        !row.edition ||
        !row.playTimeMinutes ||
        !row.modality ||
        !row.tags
      )
        continue;
      loadedScenarios.push({
        id: row.id,
        productId: row.boothProductId,
        title: row.title,
        playerCount: row.playerCount,
        edition: row.edition,
        playTimeMinutes: row.playTimeMinutes,
        modality: row.modality,
        tags: row.tags,
        requiredBooks: row.requiredBooks,
        compatibility: row.compatibility,
        separationApproved: row.separationApproved,
        relationships: row.relationships,
        ...(row.hold ? { hold: true } : {}),
      });
    }

    return {
      product: {
        id: productRow.id,
        canonicalUrl: productRow.canonicalUrl,
        title: productRow.observedTitle,
        salesState: productRow.salesState,
        sourcePublicationDate: productRow.sourcePublicationDate,
        ...(productRow.isFree ? { isFree: productRow.isFree } : {}),
        firstSeenAt: normalizeTimestamp(productRow.firstSeenAt),
        lastCheckedAt: normalizeTimestamp(productRow.lastCheckedAt),
        allAges: productRow.allAgesState,
        ...(productRow.classification
          ? { classification: productRow.classification }
          : {}),
      },
      scenarios: loadedScenarios,
    };
  }

  async purgeForAgeUnknown(
    productId: string,
    completedAt: string,
  ): Promise<PurgeResult> {
    return this.db.transaction(async (tx) => {
      const [productRow] = await tx
        .select({ id: boothProduct.id })
        .from(boothProduct)
        .where(eq(boothProduct.id, productId));
      if (!productRow) throw new Error("Product does not exist.");

      const scenarioRows = await tx
        .select({ id: scenario.id })
        .from(scenario)
        .where(eq(scenario.boothProductId, productId));
      const snapshotRows = await tx
        .select({ id: sourceSnapshot.id })
        .from(sourceSnapshot)
        .where(eq(sourceSnapshot.boothProductId, productId));
      const historyRows = await tx
        .select({ id: normalizationHistory.id })
        .from(normalizationHistory)
        .where(eq(normalizationHistory.boothProductId, productId));

      const outcomeVersion = `outcome:hold_age_unknown:${completedAt}`;
      const holdState: Product["allAges"] = {
        state: "hold",
        holdReason: "hold_age_unknown",
        confidence: "unresolved",
        reviewState: "needs_more_evidence",
        evidence: [],
        contentVersion: outcomeVersion,
        checkedAt: completedAt,
      };

      await tx
        .update(boothProduct)
        .set({
          observedTitle: null,
          allAgesState: holdState,
          classification: null,
          salesState: null,
          sourcePublicationDate: null,
          isFree: null,
          contentVersion: outcomeVersion,
          currentRecordUpdatedAt: completedAt,
          lastCheckedAt: completedAt,
        })
        .where(eq(boothProduct.id, productId));

      await tx
        .update(scenario)
        .set({
          title: null,
          playerCount: null,
          edition: null,
          playTimeMinutes: null,
          modality: null,
          tags: null,
          requiredBooks: [],
          compatibility: [],
          relationships: [],
          separationApproved: false,
          hold: true,
          contentVersion: outcomeVersion,
          currentRecordUpdatedAt: completedAt,
          lastCheckedAt: completedAt,
        })
        .where(eq(scenario.boothProductId, productId));

      await tx.execute(
        sql`select set_config('app.allow_age_hold_purge', 'on', true)`,
      );
      await tx
        .update(sourceSnapshot)
        .set({
          outcome: "hold_age_unknown",
          rawSha256: null,
          normalizedSha256: null,
          contentVersion: outcomeVersion,
        })
        .where(eq(sourceSnapshot.boothProductId, productId));
      await tx
        .update(normalizationHistory)
        .set({
          bodyDerivedSha256: null,
          decision: {
            state: "redacted",
            reason: "hold_age_unknown",
          },
        })
        .where(eq(normalizationHistory.boothProductId, productId));

      const tombstoneId = crypto.randomUUID();
      await tx.insert(redactionTombstone).values({
        id: tombstoneId,
        boothProductId: productId,
        snapshotCount: snapshotRows.length,
        historyCount: historyRows.length,
        scenarioCount: scenarioRows.length,
        purgeState: "completed",
        purgeCompletedAt: completedAt,
      });

      return {
        productId,
        snapshotCount: snapshotRows.length,
        historyCount: historyRows.length,
        scenarioCount: scenarioRows.length,
        completedAt,
      };
    });
  }

  async securityState(productId: string) {
    const [productRow] = await this.db
      .select()
      .from(boothProduct)
      .where(eq(boothProduct.id, productId));
    const scenarioRows = await this.db
      .select()
      .from(scenario)
      .where(eq(scenario.boothProductId, productId));
    const snapshotRows = await this.db
      .select()
      .from(sourceSnapshot)
      .where(eq(sourceSnapshot.boothProductId, productId));
    const historyRows = await this.db
      .select()
      .from(normalizationHistory)
      .where(eq(normalizationHistory.boothProductId, productId));
    const tombstones = await this.db
      .select()
      .from(redactionTombstone)
      .where(eq(redactionTombstone.boothProductId, productId));

    return {
      product: productRow ?? null,
      scenarios: scenarioRows,
      snapshots: snapshotRows,
      histories: historyRows,
      tombstones,
    };
  }
}
