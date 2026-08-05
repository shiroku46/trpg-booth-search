import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  ClassificationEnvelope,
  EvidencedValue,
  Modality,
  PlayerCountRange,
  PlayTimeRange,
  Product,
  Relationship,
  SalesState,
  ScenarioTags,
  BookRequirement,
} from "../domain";

export type StoredAllAges = Product["allAges"];
export type StoredPublicationDate = Product["sourcePublicationDate"];
export type StoredSalesState = EvidencedValue<SalesState>;
export type StoredPlayerCount = EvidencedValue<PlayerCountRange>;
export type StoredPlayTime = EvidencedValue<PlayTimeRange>;
export type StoredModality = EvidencedValue<Modality>;

export const boothProduct = pgTable(
  "booth_product",
  {
    id: uuid("id").primaryKey(),
    sourcePlatform: text("source_platform").notNull(),
    sourceProductId: text("source_product_id").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    observedTitle: text("observed_title"),
    allAgesState: jsonb("all_ages_state").$type<StoredAllAges>().notNull(),
    classification: jsonb("classification").$type<ClassificationEnvelope>(),
    salesState: jsonb("sales_state").$type<StoredSalesState>(),
    sourcePublicationDate: jsonb("source_publication_date").$type<StoredPublicationDate>(),
    isFree: jsonb("is_free").$type<EvidencedValue<boolean>>(),
    firstSeenAt: timestamp("first_seen_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    lastCheckedAt: timestamp("last_checked_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    contentVersion: text("content_version").notNull(),
    currentRecordUpdatedAt: timestamp("current_record_updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    uniqueIndex("booth_product_source_identity_uq").on(
      table.sourcePlatform,
      table.sourceProductId,
    ),
    index("booth_product_last_checked_idx").on(table.lastCheckedAt),
    index("booth_product_first_seen_idx").on(table.firstSeenAt),
    check(
      "booth_product_source_platform_ck",
      sql`${table.sourcePlatform} = 'booth'`,
    ),
    check(
      "booth_product_canonical_url_ck",
      sql`${table.canonicalUrl} ~ '^https://booth[.]pm/(?:[A-Za-z]{2}/)?items/[0-9]+$'`,
    ),
    check(
      "booth_product_all_ages_envelope_ck",
      sql`
        jsonb_typeof(${table.allAgesState}) = 'object'
        AND (
          (
            ${table.allAgesState}->>'state' = 'known'
            AND ${table.allAgesState}->>'value' = 'all_ages_confirmed'
            AND ${table.allAgesState}->>'reviewState' = 'approved'
          )
          OR (
            ${table.allAgesState}->>'state' = 'hold'
            AND ${table.allAgesState}->>'holdReason' = 'hold_age_unknown'
          )
        )
      `,
    ),
    check(
      "booth_product_classification_value_ck",
      sql`
        ${table.classification} IS NULL
        OR (
          jsonb_typeof(${table.classification}) = 'object'
          AND (
            ${table.classification}->>'state' <> 'known'
            OR ${table.classification}->>'value' IN (
              'scenario_single',
              'scenario_collection',
              'mixed_scenario_and_material',
              'material_only',
              'hold_unknown'
            )
          )
        )
      `,
    ),
    check(
      "booth_product_sales_state_value_ck",
      sql`
        ${table.salesState} IS NULL
        OR (
          jsonb_typeof(${table.salesState}) = 'object'
          AND (
            ${table.salesState}->>'state' <> 'known'
            OR ${table.salesState}->>'value' IN (
              'available',
              'sold_out',
              'sales_ended'
            )
          )
        )
      `,
    ),
    check(
      "booth_product_age_hold_purge_ck",
      sql`
        NOT (
          ${table.allAgesState}->>'state' = 'hold'
          AND ${table.allAgesState}->>'holdReason' = 'hold_age_unknown'
        )
        OR (
          ${table.observedTitle} IS NULL
          AND ${table.classification} IS NULL
          AND ${table.salesState} IS NULL
          AND ${table.sourcePublicationDate} IS NULL
          AND ${table.isFree} IS NULL
          AND ${table.contentVersion} LIKE 'outcome:hold_age_unknown:%'
        )
      `,
    ),
  ],
);

export const scenario = pgTable(
  "scenario",
  {
    id: uuid("id").primaryKey(),
    boothProductId: uuid("booth_product_id")
      .notNull()
      .references(() => boothProduct.id, { onDelete: "restrict" }),
    title: jsonb("title").$type<EvidencedValue<string>>(),
    playerCount: jsonb("player_count").$type<StoredPlayerCount>(),
    edition: jsonb("edition").$type<EvidencedValue<string>>(),
    playTimeMinutes: jsonb("play_time_minutes").$type<StoredPlayTime>(),
    modality: jsonb("modality").$type<StoredModality>(),
    tags: jsonb("tags").$type<ScenarioTags>(),
    requiredBooks: jsonb("required_books")
      .$type<readonly EvidencedValue<BookRequirement>[]>()
      .notNull(),
    compatibility: jsonb("compatibility")
      .$type<readonly EvidencedValue<string>[]>()
      .notNull(),
    relationships: jsonb("relationships")
      .$type<readonly Relationship[]>()
      .notNull(),
    separationApproved: boolean("separation_approved").notNull(),
    hold: boolean("hold").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    lastCheckedAt: timestamp("last_checked_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    contentVersion: text("content_version").notNull(),
    currentRecordUpdatedAt: timestamp("current_record_updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    index("scenario_product_idx").on(table.boothProductId),
    index("scenario_last_checked_idx").on(table.lastCheckedAt),
    check(
      "scenario_required_fields_or_purged_ck",
      sql`
        (
          ${table.title} IS NOT NULL
          AND ${table.playerCount} IS NOT NULL
          AND ${table.edition} IS NOT NULL
          AND ${table.playTimeMinutes} IS NOT NULL
          AND ${table.modality} IS NOT NULL
          AND ${table.tags} IS NOT NULL
        )
        OR (
          ${table.hold} = true
          AND ${table.title} IS NULL
          AND ${table.playerCount} IS NULL
          AND ${table.edition} IS NULL
          AND ${table.playTimeMinutes} IS NULL
          AND ${table.modality} IS NULL
          AND ${table.tags} IS NULL
          AND ${table.requiredBooks} = '[]'::jsonb
          AND ${table.compatibility} = '[]'::jsonb
          AND ${table.relationships} = '[]'::jsonb
          AND ${table.contentVersion} LIKE 'outcome:hold_age_unknown:%'
        )
      `,
    ),
    check(
      "scenario_player_range_ck",
      sql`
        ${table.playerCount} IS NULL
        OR ${table.playerCount}->>'state' <> 'known'
        OR (
          jsonb_typeof(${table.playerCount}->'value'->'minimumPlayers') = 'number'
          AND jsonb_typeof(${table.playerCount}->'value'->'maximumPlayers') = 'number'
          AND (${table.playerCount}->'value'->>'minimumPlayers')::integer >= 1
          AND (${table.playerCount}->'value'->>'minimumPlayers')::integer
            <= (${table.playerCount}->'value'->>'maximumPlayers')::integer
        )
      `,
    ),
    check(
      "scenario_play_time_range_ck",
      sql`
        ${table.playTimeMinutes} IS NULL
        OR ${table.playTimeMinutes}->>'state' <> 'known'
        OR (
          jsonb_typeof(${table.playTimeMinutes}->'value'->'minimumMinutes') = 'number'
          AND jsonb_typeof(${table.playTimeMinutes}->'value'->'maximumMinutes') = 'number'
          AND (${table.playTimeMinutes}->'value'->>'minimumMinutes')::integer >= 0
          AND (${table.playTimeMinutes}->'value'->>'minimumMinutes')::integer
            <= (${table.playTimeMinutes}->'value'->>'maximumMinutes')::integer
        )
      `,
    ),
    check(
      "scenario_modality_value_ck",
      sql`
        ${table.modality} IS NULL
        OR ${table.modality}->>'state' <> 'known'
        OR ${table.modality}->>'value' IN ('online', 'offline', 'either')
      `,
    ),
  ],
);

export const sourceSnapshot = pgTable(
  "source_snapshot",
  {
    id: uuid("id").primaryKey(),
    boothProductId: uuid("booth_product_id")
      .notNull()
      .references(() => boothProduct.id, { onDelete: "restrict" }),
    sourceUrl: text("source_url").notNull(),
    outcome: text("outcome").notNull(),
    statusCode: integer("status_code"),
    rawSha256: text("raw_sha256"),
    normalizedSha256: text("normalized_sha256"),
    contentVersion: text("content_version").notNull(),
    parserVersion: text("parser_version").notNull(),
    checkedAt: timestamp("checked_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    index("source_snapshot_product_idx").on(table.boothProductId),
    check(
      "source_snapshot_url_ck",
      sql`${table.sourceUrl} ~ '^https://booth[.]pm/'`,
    ),
    check(
      "source_snapshot_raw_hash_ck",
      sql`${table.rawSha256} IS NULL OR ${table.rawSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "source_snapshot_normalized_hash_ck",
      sql`${table.normalizedSha256} IS NULL OR ${table.normalizedSha256} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const normalizationHistory = pgTable(
  "normalization_history",
  {
    id: uuid("id").primaryKey(),
    boothProductId: uuid("booth_product_id")
      .notNull()
      .references(() => boothProduct.id, { onDelete: "restrict" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    contentVersion: text("content_version").notNull(),
    normalizerVersion: text("normalizer_version").notNull(),
    registryVersion: text("registry_version").notNull(),
    bodyDerivedSha256: text("body_derived_sha256"),
    decision: jsonb("decision").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    index("normalization_history_product_idx").on(table.boothProductId),
    index("normalization_history_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
    check(
      "normalization_history_entity_type_ck",
      sql`${table.entityType} IN ('booth_product', 'scenario')`,
    ),
    check(
      "normalization_history_body_hash_ck",
      sql`${table.bodyDerivedSha256} IS NULL OR ${table.bodyDerivedSha256} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const redactionTombstone = pgTable(
  "redaction_tombstone",
  {
    id: uuid("id").primaryKey(),
    boothProductId: uuid("booth_product_id")
      .notNull()
      .references(() => boothProduct.id, { onDelete: "restrict" }),
    snapshotCount: integer("snapshot_count").notNull(),
    historyCount: integer("history_count").notNull(),
    scenarioCount: integer("scenario_count").notNull(),
    purgeState: text("purge_state").notNull(),
    purgeCompletedAt: timestamp("purge_completed_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    uniqueIndex("redaction_tombstone_product_uq").on(table.boothProductId),
    check(
      "redaction_tombstone_nonnegative_counts_ck",
      sql`
        ${table.snapshotCount} >= 0
        AND ${table.historyCount} >= 0
        AND ${table.scenarioCount} >= 0
      `,
    ),
    check(
      "redaction_tombstone_state_ck",
      sql`${table.purgeState} = 'completed'`,
    ),
  ],
);

export const persistenceSchema = {
  boothProduct,
  scenario,
  sourceSnapshot,
  normalizationHistory,
  redactionTombstone,
};
