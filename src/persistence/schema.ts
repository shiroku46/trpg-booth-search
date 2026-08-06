import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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
  BookRequirement,
  ClassificationEnvelope,
  EvidencedValue,
  Modality,
  PlayerCountRange,
  PlayTimeRange,
  Product,
  Relationship,
  SalesState,
  ScenarioTags,
} from "../domain";
import type { RegistryManifest } from "../registry";
import type { ReviewCaseReason } from "../review";

export type StoredAllAges = Product["allAges"];
export type StoredPublicationDate = Product["sourcePublicationDate"];
export type StoredSalesState = EvidencedValue<SalesState>;
export type StoredPlayerCount = EvidencedValue<PlayerCountRange>;
export type StoredPlayTime = EvidencedValue<PlayTimeRange>;
export type StoredModality = EvidencedValue<Modality>;

export const registrySnapshot = pgTable(
  "registry_snapshot",
  {
    registryVersion: text("registry_version").primaryKey(),
    schemaVersion: integer("schema_version").notNull(),
    normalizerVersion: text("normalizer_version").notNull(),
    reviewedAt: date("reviewed_at", { mode: "string" }).notNull(),
    manifestSha256: text("manifest_sha256").notNull(),
    manifest: jsonb("manifest").$type<RegistryManifest>().notNull(),
    installedAt: timestamp("installed_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    index("registry_snapshot_reviewed_idx").on(
      table.reviewedAt,
      table.registryVersion,
    ),
    check(
      "registry_snapshot_version_ck",
      sql`${table.registryVersion} ~ '^registry-[0-9]{4}-[0-9]{2}-[0-9]{2}[.][0-9]+$'`,
    ),
    check(
      "registry_snapshot_schema_version_ck",
      sql`${table.schemaVersion} > 0`,
    ),
    check(
      "registry_snapshot_normalizer_version_ck",
      sql`length(btrim(${table.normalizerVersion})) > 0`,
    ),
    check(
      "registry_snapshot_manifest_sha256_ck",
      sql`${table.manifestSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "registry_snapshot_manifest_shape_ck",
      sql`(
        jsonb_typeof(${table.manifest}) = 'object'
        AND jsonb_typeof(${table.manifest}->'schemaVersion') = 'number'
        AND jsonb_typeof(${table.manifest}->'registryVersion') = 'string'
        AND jsonb_typeof(${table.manifest}->'normalizerVersion') = 'string'
        AND jsonb_typeof(${table.manifest}->'reviewedAt') = 'string'
        AND jsonb_typeof(${table.manifest}->'officialDomains') = 'array'
        AND jsonb_typeof(${table.manifest}->'systemFamilies') = 'array'
        AND jsonb_typeof(${table.manifest}->'editions') = 'array'
        AND jsonb_typeof(${table.manifest}->'books') = 'array'
        AND jsonb_typeof(${table.manifest}->'aliases') = 'array'
      ) IS TRUE`,
    ),
    check(
      "registry_snapshot_manifest_identity_ck",
      sql`(
        (${table.manifest}->>'schemaVersion')::integer = ${table.schemaVersion}
        AND ${table.manifest}->>'registryVersion' = ${table.registryVersion}
        AND ${table.manifest}->>'normalizerVersion' = ${table.normalizerVersion}
        AND ${table.manifest}->>'reviewedAt' = ${table.reviewedAt}::text
      ) IS TRUE`,
    ),
  ],
);

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
    sourcePublicationDate: jsonb(
      "source_publication_date",
    ).$type<StoredPublicationDate>(),
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
      "booth_product_source_identity_match_ck",
      sql`(
        ${table.sourceProductId} ~ '^[0-9]+$'
        AND substring(${table.canonicalUrl} from '/items/([0-9]+)$') = ${table.sourceProductId}
      ) IS TRUE`,
    ),
    check(
      "booth_product_version_and_time_ck",
      sql`(
        length(btrim(${table.contentVersion})) > 0
        AND ${table.firstSeenAt} <= ${table.lastCheckedAt}
        AND ${table.firstSeenAt} <= ${table.currentRecordUpdatedAt}
      ) IS TRUE`,
    ),
    check(
      "booth_product_all_ages_envelope_ck",
      sql`(
        jsonb_typeof(${table.allAgesState}) = 'object'
        AND ${table.allAgesState}->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
        AND ${table.allAgesState}->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
        AND jsonb_typeof(${table.allAgesState}->'evidence') = 'array'
        AND jsonb_typeof(${table.allAgesState}->'contentVersion') = 'string'
        AND length(${table.allAgesState}->>'contentVersion') > 0
        AND jsonb_typeof(${table.allAgesState}->'checkedAt') = 'string'
        AND length(${table.allAgesState}->>'checkedAt') > 0
        AND (
          (
            ${table.allAgesState}->>'state' = 'known'
            AND ${table.allAgesState}->>'value' = 'all_ages_confirmed'
            AND ${table.allAgesState}->>'reviewState' = 'approved'
            AND jsonb_array_length(${table.allAgesState}->'evidence') > 0
            AND NOT (${table.allAgesState} ? 'holdReason')
          )
          OR (
            ${table.allAgesState}->>'state' = 'hold'
            AND ${table.allAgesState}->>'holdReason' = 'hold_age_unknown'
            AND ${table.allAgesState}->>'confidence' = 'unresolved'
            AND ${table.allAgesState}->>'reviewState' = 'needs_more_evidence'
            AND NOT (${table.allAgesState} ? 'value')
          )
        )
      ) IS TRUE`,
    ),
    check(
      "booth_product_classification_value_ck",
      sql`(
        ${table.classification} IS NULL
        OR (
          jsonb_typeof(${table.classification}) = 'object'
          AND ${table.classification}->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND ${table.classification}->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof(${table.classification}->'evidence') = 'array'
          AND jsonb_typeof(${table.classification}->'contentVersion') = 'string'
          AND length(${table.classification}->>'contentVersion') > 0
          AND jsonb_typeof(${table.classification}->'checkedAt') = 'string'
          AND length(${table.classification}->>'checkedAt') > 0
          AND jsonb_typeof(${table.classification}->'normalizerVersion') = 'string'
          AND length(${table.classification}->>'normalizerVersion') > 0
          AND jsonb_typeof(${table.classification}->'registryVersion') = 'string'
          AND length(${table.classification}->>'registryVersion') > 0
          AND (
            (
              ${table.classification}->>'state' = 'known'
              AND ${table.classification}->>'value' IN (
                'scenario_single',
                'scenario_collection',
                'mixed_scenario_and_material',
                'material_only',
                'hold_unknown'
              )
              AND NOT (${table.classification} ? 'holdReason')
            )
            OR (
              ${table.classification}->>'state' IN ('unknown', 'not_applicable')
              AND NOT (${table.classification} ? 'value')
              AND NOT (${table.classification} ? 'holdReason')
            )
            OR (
              ${table.classification}->>'state' = 'hold'
              AND jsonb_typeof(${table.classification}->'holdReason') = 'string'
              AND length(${table.classification}->>'holdReason') > 0
              AND NOT (${table.classification} ? 'value')
            )
          )
        )
      ) IS TRUE`,
    ),
    check(
      "booth_product_sales_state_value_ck",
      sql`(
        ${table.salesState} IS NULL
        OR (
          jsonb_typeof(${table.salesState}) = 'object'
          AND ${table.salesState}->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND ${table.salesState}->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof(${table.salesState}->'evidence') = 'array'
          AND jsonb_typeof(${table.salesState}->'contentVersion') = 'string'
          AND length(${table.salesState}->>'contentVersion') > 0
          AND jsonb_typeof(${table.salesState}->'checkedAt') = 'string'
          AND length(${table.salesState}->>'checkedAt') > 0
          AND (
            (
              ${table.salesState}->>'state' = 'known'
              AND ${table.salesState}->>'value' IN ('available', 'sold_out', 'sales_ended')
              AND NOT (${table.salesState} ? 'holdReason')
            )
            OR (
              ${table.salesState}->>'state' IN ('unknown', 'not_applicable')
              AND NOT (${table.salesState} ? 'value')
              AND NOT (${table.salesState} ? 'holdReason')
            )
            OR (
              ${table.salesState}->>'state' = 'hold'
              AND jsonb_typeof(${table.salesState}->'holdReason') = 'string'
              AND length(${table.salesState}->>'holdReason') > 0
              AND NOT (${table.salesState} ? 'value')
            )
          )
        )
      ) IS TRUE`,
    ),
    check(
      "booth_product_publication_date_envelope_ck",
      sql`(
        ${table.sourcePublicationDate} IS NULL
        OR (
          jsonb_typeof(${table.sourcePublicationDate}) = 'object'
          AND ${table.sourcePublicationDate}->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND ${table.sourcePublicationDate}->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof(${table.sourcePublicationDate}->'evidence') = 'array'
          AND jsonb_typeof(${table.sourcePublicationDate}->'contentVersion') = 'string'
          AND length(${table.sourcePublicationDate}->>'contentVersion') > 0
          AND jsonb_typeof(${table.sourcePublicationDate}->'checkedAt') = 'string'
          AND length(${table.sourcePublicationDate}->>'checkedAt') > 0
          AND (
            (
              ${table.sourcePublicationDate}->>'state' = 'known'
              AND jsonb_typeof(${table.sourcePublicationDate}->'value') = 'string'
              AND length(${table.sourcePublicationDate}->>'value') > 0
              AND NOT (${table.sourcePublicationDate} ? 'holdReason')
            )
            OR (
              ${table.sourcePublicationDate}->>'state' IN ('unknown', 'not_applicable')
              AND NOT (${table.sourcePublicationDate} ? 'value')
              AND NOT (${table.sourcePublicationDate} ? 'holdReason')
            )
            OR (
              ${table.sourcePublicationDate}->>'state' = 'hold'
              AND jsonb_typeof(${table.sourcePublicationDate}->'holdReason') = 'string'
              AND length(${table.sourcePublicationDate}->>'holdReason') > 0
              AND NOT (${table.sourcePublicationDate} ? 'value')
            )
          )
        )
      ) IS TRUE`,
    ),
    check(
      "booth_product_is_free_envelope_ck",
      sql`(
        ${table.isFree} IS NULL
        OR (
          jsonb_typeof(${table.isFree}) = 'object'
          AND ${table.isFree}->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND ${table.isFree}->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof(${table.isFree}->'evidence') = 'array'
          AND jsonb_typeof(${table.isFree}->'contentVersion') = 'string'
          AND length(${table.isFree}->>'contentVersion') > 0
          AND jsonb_typeof(${table.isFree}->'checkedAt') = 'string'
          AND length(${table.isFree}->>'checkedAt') > 0
          AND (
            (
              ${table.isFree}->>'state' = 'known'
              AND jsonb_typeof(${table.isFree}->'value') = 'boolean'
              AND NOT (${table.isFree} ? 'holdReason')
            )
            OR (
              ${table.isFree}->>'state' IN ('unknown', 'not_applicable')
              AND NOT (${table.isFree} ? 'value')
              AND NOT (${table.isFree} ? 'holdReason')
            )
            OR (
              ${table.isFree}->>'state' = 'hold'
              AND jsonb_typeof(${table.isFree}->'holdReason') = 'string'
              AND length(${table.isFree}->>'holdReason') > 0
              AND NOT (${table.isFree} ? 'value')
            )
          )
        )
      ) IS TRUE`,
    ),
    check(
      "booth_product_age_hold_purge_ck",
      sql`(
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
      ) IS TRUE`,
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
      "scenario_version_and_time_ck",
      sql`(
        length(btrim(${table.contentVersion})) > 0
        AND ${table.firstSeenAt} <= ${table.lastCheckedAt}
        AND ${table.firstSeenAt} <= ${table.currentRecordUpdatedAt}
      ) IS TRUE`,
    ),
    check(
      "scenario_required_fields_or_purged_ck",
      sql`(
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
      ) IS TRUE`,
    ),
    check(
      "scenario_title_envelope_ck",
      sql`(
        ${table.title} IS NULL
        OR (
          jsonb_typeof(${table.title}) = 'object'
          AND ${table.title}->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND ${table.title}->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof(${table.title}->'evidence') = 'array'
          AND jsonb_typeof(${table.title}->'contentVersion') = 'string'
          AND length(${table.title}->>'contentVersion') > 0
          AND jsonb_typeof(${table.title}->'checkedAt') = 'string'
          AND length(${table.title}->>'checkedAt') > 0
          AND (
            (
              ${table.title}->>'state' = 'known'
              AND jsonb_typeof(${table.title}->'value') = 'string'
              AND length(${table.title}->>'value') > 0
              AND NOT (${table.title} ? 'holdReason')
            )
            OR (
              ${table.title}->>'state' IN ('unknown', 'not_applicable')
              AND NOT (${table.title} ? 'value')
              AND NOT (${table.title} ? 'holdReason')
            )
            OR (
              ${table.title}->>'state' = 'hold'
              AND jsonb_typeof(${table.title}->'holdReason') = 'string'
              AND length(${table.title}->>'holdReason') > 0
              AND NOT (${table.title} ? 'value')
            )
          )
        )
      ) IS TRUE`,
    ),
    check(
      "scenario_edition_envelope_ck",
      sql`(
        ${table.edition} IS NULL
        OR (
          jsonb_typeof(${table.edition}) = 'object'
          AND ${table.edition}->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND ${table.edition}->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof(${table.edition}->'evidence') = 'array'
          AND jsonb_typeof(${table.edition}->'contentVersion') = 'string'
          AND length(${table.edition}->>'contentVersion') > 0
          AND jsonb_typeof(${table.edition}->'checkedAt') = 'string'
          AND length(${table.edition}->>'checkedAt') > 0
          AND (
            (
              ${table.edition}->>'state' = 'known'
              AND jsonb_typeof(${table.edition}->'value') = 'string'
              AND length(${table.edition}->>'value') > 0
              AND NOT (${table.edition} ? 'holdReason')
            )
            OR (
              ${table.edition}->>'state' IN ('unknown', 'not_applicable')
              AND NOT (${table.edition} ? 'value')
              AND NOT (${table.edition} ? 'holdReason')
            )
            OR (
              ${table.edition}->>'state' = 'hold'
              AND jsonb_typeof(${table.edition}->'holdReason') = 'string'
              AND length(${table.edition}->>'holdReason') > 0
              AND NOT (${table.edition} ? 'value')
            )
          )
        )
      ) IS TRUE`,
    ),
    check(
      "scenario_player_range_ck",
      sql`(
        ${table.playerCount} IS NULL
        OR (
          jsonb_typeof(${table.playerCount}) = 'object'
          AND ${table.playerCount}->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND ${table.playerCount}->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof(${table.playerCount}->'evidence') = 'array'
          AND jsonb_typeof(${table.playerCount}->'contentVersion') = 'string'
          AND length(${table.playerCount}->>'contentVersion') > 0
          AND jsonb_typeof(${table.playerCount}->'checkedAt') = 'string'
          AND length(${table.playerCount}->>'checkedAt') > 0
          AND (
            (
              ${table.playerCount}->>'state' = 'known'
              AND jsonb_typeof(${table.playerCount}->'value') = 'object'
              AND jsonb_typeof(${table.playerCount}->'value'->'minimumPlayers') = 'number'
              AND jsonb_typeof(${table.playerCount}->'value'->'maximumPlayers') = 'number'
              AND (${table.playerCount}->'value'->>'minimumPlayers')::integer >= 1
              AND (${table.playerCount}->'value'->>'minimumPlayers')::integer
                <= (${table.playerCount}->'value'->>'maximumPlayers')::integer
              AND NOT (${table.playerCount} ? 'holdReason')
            )
            OR (
              ${table.playerCount}->>'state' IN ('unknown', 'not_applicable')
              AND NOT (${table.playerCount} ? 'value')
              AND NOT (${table.playerCount} ? 'holdReason')
            )
            OR (
              ${table.playerCount}->>'state' = 'hold'
              AND jsonb_typeof(${table.playerCount}->'holdReason') = 'string'
              AND length(${table.playerCount}->>'holdReason') > 0
              AND NOT (${table.playerCount} ? 'value')
            )
          )
        )
      ) IS TRUE`,
    ),
    check(
      "scenario_play_time_range_ck",
      sql`(
        ${table.playTimeMinutes} IS NULL
        OR (
          jsonb_typeof(${table.playTimeMinutes}) = 'object'
          AND ${table.playTimeMinutes}->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND ${table.playTimeMinutes}->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof(${table.playTimeMinutes}->'evidence') = 'array'
          AND jsonb_typeof(${table.playTimeMinutes}->'contentVersion') = 'string'
          AND length(${table.playTimeMinutes}->>'contentVersion') > 0
          AND jsonb_typeof(${table.playTimeMinutes}->'checkedAt') = 'string'
          AND length(${table.playTimeMinutes}->>'checkedAt') > 0
          AND (
            (
              ${table.playTimeMinutes}->>'state' = 'known'
              AND jsonb_typeof(${table.playTimeMinutes}->'value') = 'object'
              AND jsonb_typeof(${table.playTimeMinutes}->'value'->'minimumMinutes') = 'number'
              AND jsonb_typeof(${table.playTimeMinutes}->'value'->'maximumMinutes') = 'number'
              AND (${table.playTimeMinutes}->'value'->>'minimumMinutes')::integer >= 0
              AND (${table.playTimeMinutes}->'value'->>'minimumMinutes')::integer
                <= (${table.playTimeMinutes}->'value'->>'maximumMinutes')::integer
              AND NOT (${table.playTimeMinutes} ? 'holdReason')
            )
            OR (
              ${table.playTimeMinutes}->>'state' IN ('unknown', 'not_applicable')
              AND NOT (${table.playTimeMinutes} ? 'value')
              AND NOT (${table.playTimeMinutes} ? 'holdReason')
            )
            OR (
              ${table.playTimeMinutes}->>'state' = 'hold'
              AND jsonb_typeof(${table.playTimeMinutes}->'holdReason') = 'string'
              AND length(${table.playTimeMinutes}->>'holdReason') > 0
              AND NOT (${table.playTimeMinutes} ? 'value')
            )
          )
        )
      ) IS TRUE`,
    ),
    check(
      "scenario_modality_value_ck",
      sql`(
        ${table.modality} IS NULL
        OR (
          jsonb_typeof(${table.modality}) = 'object'
          AND ${table.modality}->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND ${table.modality}->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof(${table.modality}->'evidence') = 'array'
          AND jsonb_typeof(${table.modality}->'contentVersion') = 'string'
          AND length(${table.modality}->>'contentVersion') > 0
          AND jsonb_typeof(${table.modality}->'checkedAt') = 'string'
          AND length(${table.modality}->>'checkedAt') > 0
          AND (
            (
              ${table.modality}->>'state' = 'known'
              AND ${table.modality}->>'value' IN ('online', 'offline', 'either')
              AND NOT (${table.modality} ? 'holdReason')
            )
            OR (
              ${table.modality}->>'state' IN ('unknown', 'not_applicable')
              AND NOT (${table.modality} ? 'value')
              AND NOT (${table.modality} ? 'holdReason')
            )
            OR (
              ${table.modality}->>'state' = 'hold'
              AND jsonb_typeof(${table.modality}->'holdReason') = 'string'
              AND length(${table.modality}->>'holdReason') > 0
              AND NOT (${table.modality} ? 'value')
            )
          )
        )
      ) IS TRUE`,
    ),
    check(
      "scenario_collection_shapes_ck",
      sql`(
        ${table.tags} IS NULL
        OR (
          jsonb_typeof(${table.tags}) = 'object'
          AND ${table.tags} ?& ARRAY['genre', 'tone', 'setting', 'structure', 'content']
          AND jsonb_typeof(${table.tags}->'genre') = 'object'
          AND jsonb_typeof(${table.tags}->'tone') = 'object'
          AND jsonb_typeof(${table.tags}->'setting') = 'object'
          AND jsonb_typeof(${table.tags}->'structure') = 'object'
          AND jsonb_typeof(${table.tags}->'content') = 'object'
        )
      ) IS TRUE
      AND jsonb_typeof(${table.requiredBooks}) = 'array'
      AND jsonb_typeof(${table.compatibility}) = 'array'
      AND jsonb_typeof(${table.relationships}) = 'array'`,
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
    check(
      "source_snapshot_safe_metadata_ck",
      sql`(
        ${table.outcome} ~ '^[a-z0-9_:-]{1,64}$'
        AND length(btrim(${table.contentVersion})) > 0
        AND length(btrim(${table.parserVersion})) > 0
      ) IS TRUE`,
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
    recordKind: text("record_kind", {
      enum: ["initial_analysis", "reanalysis"],
    })
      .notNull()
      .default("initial_analysis"),
    reanalysisTrigger: text("reanalysis_trigger", {
      enum: [
        "content_changed",
        "normalizer_version_changed",
        "registry_version_changed",
        "alias_approved",
        "canonical_entity_added",
        "manual_trigger",
      ],
    }),
    contentVersionOld: text("content_version_old"),
    normalizerVersionOld: text("normalizer_version_old"),
    registryVersionOld: text("registry_version_old"),
    oldResultSnapshot: jsonb("old_result_snapshot").$type<
      Record<string, unknown>
    >(),
    contentVersion: text("content_version").notNull(),
    normalizerVersion: text("normalizer_version").notNull(),
    registryVersion: text("registry_version").notNull(),
    bodyDerivedSha256: text("body_derived_sha256"),
    decision: jsonb("decision").$type<Record<string, unknown>>().notNull(),
    reasonDetail: text("reason_detail"),
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
    index("normalization_history_latest_idx").on(
      table.boothProductId,
      table.entityType,
      table.entityId,
      table.createdAt,
    ),
    check(
      "normalization_history_entity_type_ck",
      sql`${table.entityType} IN ('booth_product', 'scenario')`,
    ),
    check(
      "normalization_history_record_kind_ck",
      sql`${table.recordKind} IN ('initial_analysis', 'reanalysis')`,
    ),
    check(
      "normalization_history_transition_shape_ck",
      sql`(
        (
          ${table.recordKind} = 'initial_analysis'
          AND ${table.reanalysisTrigger} IS NULL
          AND ${table.contentVersionOld} IS NULL
          AND ${table.normalizerVersionOld} IS NULL
          AND ${table.registryVersionOld} IS NULL
          AND ${table.oldResultSnapshot} IS NULL
          AND ${table.reasonDetail} IS NULL
        )
        OR
        (
          ${table.recordKind} = 'reanalysis'
          AND ${table.reanalysisTrigger} IN (
            'content_changed',
            'normalizer_version_changed',
            'registry_version_changed',
            'alias_approved',
            'canonical_entity_added',
            'manual_trigger'
          )
          AND length(btrim(${table.contentVersionOld})) > 0
          AND length(btrim(${table.normalizerVersionOld})) > 0
          AND length(btrim(${table.registryVersionOld})) > 0
          AND jsonb_typeof(${table.oldResultSnapshot}) = 'object'
          AND length(btrim(${table.reasonDetail})) BETWEEN 1 AND 1000
        )
      ) IS TRUE`,
    ),
    check(
      "normalization_history_trigger_change_ck",
      sql`(
        ${table.recordKind} = 'initial_analysis'
        OR ${table.reanalysisTrigger} = 'manual_trigger'
        OR (
          ${table.reanalysisTrigger} = 'content_changed'
          AND ${table.contentVersionOld} <> ${table.contentVersion}
        )
        OR (
          ${table.reanalysisTrigger} = 'normalizer_version_changed'
          AND ${table.normalizerVersionOld} <> ${table.normalizerVersion}
        )
        OR (
          ${table.reanalysisTrigger} IN (
            'registry_version_changed',
            'alias_approved',
            'canonical_entity_added'
          )
          AND ${table.registryVersionOld} <> ${table.registryVersion}
        )
      ) IS TRUE`,
    ),
    check(
      "normalization_history_body_hash_ck",
      sql`${table.bodyDerivedSha256} IS NULL OR ${table.bodyDerivedSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "normalization_history_decision_shape_ck",
      sql`jsonb_typeof(${table.decision}) = 'object'`,
    ),
    check(
      "normalization_history_version_ck",
      sql`(
        length(btrim(${table.contentVersion})) > 0
        AND length(btrim(${table.normalizerVersion})) > 0
        AND length(btrim(${table.registryVersion})) > 0
      ) IS TRUE`,
    ),
  ],
);

export const reviewCase = pgTable(
  "review_case",
  {
    id: uuid("id").primaryKey(),
    boothProductId: uuid("booth_product_id")
      .notNull()
      .references(() => boothProduct.id, { onDelete: "restrict" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fieldPath: text("field_path").notNull(),
    evidencedState: text("evidenced_state", {
      enum: ["known", "unknown", "hold", "not_applicable"],
    }).notNull(),
    confidence: text("confidence", {
      enum: ["high", "medium", "low", "unresolved"],
    }).notNull(),
    initialReviewState: text("initial_review_state", {
      enum: ["unreviewed", "needs_more_evidence"],
    }).notNull(),
    evidenceCount: integer("evidence_count").notNull(),
    hasConflict: boolean("has_conflict").notNull(),
    holdReason: text("hold_reason"),
    containsAiEvidence: boolean("contains_ai_evidence").notNull(),
    contentVersion: text("content_version").notNull(),
    normalizerVersion: text("normalizer_version").notNull(),
    registryVersion: text("registry_version").notNull(),
    priority: text("priority", {
      enum: ["blocking", "high", "normal"],
    }).notNull(),
    reasons: jsonb("reasons").$type<ReviewCaseReason[]>().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    uniqueIndex("review_case_identity_uq").on(
      table.boothProductId,
      table.entityType,
      table.entityId,
      table.fieldPath,
      table.contentVersion,
      table.normalizerVersion,
      table.registryVersion,
    ),
    index("review_case_pending_idx").on(
      table.priority,
      table.createdAt,
      table.id,
    ),
    check(
      "review_case_entity_type_ck",
      sql`${table.entityType} IN ('booth_product', 'scenario')`,
    ),
    check(
      "review_case_field_path_ck",
      sql`length(${table.fieldPath}) BETWEEN 1 AND 128 AND ${table.fieldPath} ~ '^[a-z][a-z0-9_]*([.][a-z][a-z0-9_]*){0,5}$'`,
    ),
    check("review_case_evidence_count_ck", sql`${table.evidenceCount} >= 0`),
    check(
      "review_case_hold_shape_ck",
      sql`(
        (
          ${table.evidencedState} = 'hold'
          AND ${table.holdReason} ~ '^[a-z][a-z0-9_:-]{0,127}$'
        )
        OR (
          ${table.evidencedState} <> 'hold'
          AND ${table.holdReason} IS NULL
        )
      ) IS TRUE`,
    ),
    check(
      "review_case_version_ck",
      sql`(
        length(btrim(${table.contentVersion})) > 0
        AND length(btrim(${table.normalizerVersion})) > 0
        AND length(btrim(${table.registryVersion})) > 0
      ) IS TRUE`,
    ),
    check(
      "review_case_reasons_ck",
      sql`(
        jsonb_typeof(${table.reasons}) = 'array'
        AND jsonb_array_length(${table.reasons}) > 0
        AND ${table.reasons} <@ '[
          "hold_requires_resolution",
          "conflict_requires_resolution",
          "ai_candidate_requires_approval",
          "needs_more_evidence",
          "unresolved_confidence",
          "known_without_evidence",
          "low_confidence",
          "manual_review_requested"
        ]'::jsonb
      ) IS TRUE`,
    ),
    check(
      "review_case_priority_ck",
      sql`(
        CASE
          WHEN ${table.reasons} ?| ARRAY[
            'hold_requires_resolution',
            'conflict_requires_resolution',
            'ai_candidate_requires_approval'
          ] THEN ${table.priority} = 'blocking'
          WHEN ${table.reasons} ?| ARRAY[
            'needs_more_evidence',
            'unresolved_confidence',
            'known_without_evidence'
          ] THEN ${table.priority} = 'high'
          ELSE ${table.priority} = 'normal'
        END
      ) IS TRUE`,
    ),
  ],
);

export const reviewDecisionEvent = pgTable(
  "review_decision_event",
  {
    id: uuid("id").primaryKey(),
    reviewCaseId: uuid("review_case_id")
      .notNull()
      .unique()
      .references(() => reviewCase.id, { onDelete: "restrict" }),
    decision: text("decision", {
      enum: ["approved", "rejected", "needs_more_evidence"],
    }).notNull(),
    reason: text("reason", {
      enum: [
        "evidence_sufficient",
        "evidence_insufficient",
        "evidence_conflict",
        "incorrect_mapping",
        "unsupported_claim",
        "manual_policy_decision",
      ],
    }).notNull(),
    decidedAt: timestamp("decided_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    index("review_decision_time_idx").on(table.decidedAt, table.id),
    check(
      "review_decision_reason_ck",
      sql`(
        (
          ${table.decision} = 'approved'
          AND ${table.reason} IN ('evidence_sufficient', 'manual_policy_decision')
        )
        OR (
          ${table.decision} = 'needs_more_evidence'
          AND ${table.reason} IN (
            'evidence_insufficient',
            'evidence_conflict',
            'manual_policy_decision'
          )
        )
        OR (
          ${table.decision} = 'rejected'
          AND ${table.reason} IN (
            'evidence_conflict',
            'incorrect_mapping',
            'unsupported_claim',
            'manual_policy_decision'
          )
        )
      ) IS TRUE`,
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
  registrySnapshot,
  boothProduct,
  scenario,
  sourceSnapshot,
  normalizationHistory,
  reviewCase,
  reviewDecisionEvent,
  redactionTombstone,
};
