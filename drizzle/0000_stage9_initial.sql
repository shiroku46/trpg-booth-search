CREATE TABLE "booth_product" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_platform" text NOT NULL,
	"source_product_id" text NOT NULL,
	"canonical_url" text NOT NULL,
	"observed_title" text,
	"all_ages_state" jsonb NOT NULL,
	"classification" jsonb,
	"sales_state" jsonb,
	"source_publication_date" jsonb,
	"is_free" jsonb,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_checked_at" timestamp with time zone NOT NULL,
	"content_version" text NOT NULL,
	"current_record_updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "booth_product_source_platform_ck" CHECK ("booth_product"."source_platform" = 'booth'),
	CONSTRAINT "booth_product_canonical_url_ck" CHECK ("booth_product"."canonical_url" ~ '^https://booth[.]pm/(?:[A-Za-z]{2}/)?items/[0-9]+$'),
	CONSTRAINT "booth_product_source_identity_match_ck" CHECK ((
        "booth_product"."source_product_id" ~ '^[0-9]+$'
        AND substring("booth_product"."canonical_url" from '/items/([0-9]+)$') = "booth_product"."source_product_id"
      ) IS TRUE),
	CONSTRAINT "booth_product_version_and_time_ck" CHECK ((
        length(btrim("booth_product"."content_version")) > 0
        AND "booth_product"."first_seen_at" <= "booth_product"."last_checked_at"
        AND "booth_product"."first_seen_at" <= "booth_product"."current_record_updated_at"
      ) IS TRUE),
	CONSTRAINT "booth_product_all_ages_envelope_ck" CHECK ((
        jsonb_typeof("booth_product"."all_ages_state") = 'object'
        AND "booth_product"."all_ages_state"->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
        AND "booth_product"."all_ages_state"->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
        AND jsonb_typeof("booth_product"."all_ages_state"->'evidence') = 'array'
        AND jsonb_typeof("booth_product"."all_ages_state"->'contentVersion') = 'string'
        AND length("booth_product"."all_ages_state"->>'contentVersion') > 0
        AND jsonb_typeof("booth_product"."all_ages_state"->'checkedAt') = 'string'
        AND length("booth_product"."all_ages_state"->>'checkedAt') > 0
        AND (
          (
            "booth_product"."all_ages_state"->>'state' = 'known'
            AND "booth_product"."all_ages_state"->>'value' = 'all_ages_confirmed'
            AND "booth_product"."all_ages_state"->>'reviewState' = 'approved'
            AND jsonb_array_length("booth_product"."all_ages_state"->'evidence') > 0
            AND NOT ("booth_product"."all_ages_state" ? 'holdReason')
          )
          OR (
            "booth_product"."all_ages_state"->>'state' = 'hold'
            AND "booth_product"."all_ages_state"->>'holdReason' = 'hold_age_unknown'
            AND "booth_product"."all_ages_state"->>'confidence' = 'unresolved'
            AND "booth_product"."all_ages_state"->>'reviewState' = 'needs_more_evidence'
            AND NOT ("booth_product"."all_ages_state" ? 'value')
          )
        )
      ) IS TRUE),
	CONSTRAINT "booth_product_classification_value_ck" CHECK ((
        "booth_product"."classification" IS NULL
        OR (
          jsonb_typeof("booth_product"."classification") = 'object'
          AND "booth_product"."classification"->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND "booth_product"."classification"->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof("booth_product"."classification"->'evidence') = 'array'
          AND jsonb_typeof("booth_product"."classification"->'contentVersion') = 'string'
          AND length("booth_product"."classification"->>'contentVersion') > 0
          AND jsonb_typeof("booth_product"."classification"->'checkedAt') = 'string'
          AND length("booth_product"."classification"->>'checkedAt') > 0
          AND jsonb_typeof("booth_product"."classification"->'normalizerVersion') = 'string'
          AND length("booth_product"."classification"->>'normalizerVersion') > 0
          AND jsonb_typeof("booth_product"."classification"->'registryVersion') = 'string'
          AND length("booth_product"."classification"->>'registryVersion') > 0
          AND (
            (
              "booth_product"."classification"->>'state' = 'known'
              AND "booth_product"."classification"->>'value' IN (
                'scenario_single',
                'scenario_collection',
                'mixed_scenario_and_material',
                'material_only',
                'hold_unknown'
              )
              AND NOT ("booth_product"."classification" ? 'holdReason')
            )
            OR (
              "booth_product"."classification"->>'state' IN ('unknown', 'not_applicable')
              AND NOT ("booth_product"."classification" ? 'value')
              AND NOT ("booth_product"."classification" ? 'holdReason')
            )
            OR (
              "booth_product"."classification"->>'state' = 'hold'
              AND jsonb_typeof("booth_product"."classification"->'holdReason') = 'string'
              AND length("booth_product"."classification"->>'holdReason') > 0
              AND NOT ("booth_product"."classification" ? 'value')
            )
          )
        )
      ) IS TRUE),
	CONSTRAINT "booth_product_sales_state_value_ck" CHECK ((
        "booth_product"."sales_state" IS NULL
        OR (
          jsonb_typeof("booth_product"."sales_state") = 'object'
          AND "booth_product"."sales_state"->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND "booth_product"."sales_state"->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof("booth_product"."sales_state"->'evidence') = 'array'
          AND jsonb_typeof("booth_product"."sales_state"->'contentVersion') = 'string'
          AND length("booth_product"."sales_state"->>'contentVersion') > 0
          AND jsonb_typeof("booth_product"."sales_state"->'checkedAt') = 'string'
          AND length("booth_product"."sales_state"->>'checkedAt') > 0
          AND (
            (
              "booth_product"."sales_state"->>'state' = 'known'
              AND "booth_product"."sales_state"->>'value' IN ('available', 'sold_out', 'sales_ended')
              AND NOT ("booth_product"."sales_state" ? 'holdReason')
            )
            OR (
              "booth_product"."sales_state"->>'state' IN ('unknown', 'not_applicable')
              AND NOT ("booth_product"."sales_state" ? 'value')
              AND NOT ("booth_product"."sales_state" ? 'holdReason')
            )
            OR (
              "booth_product"."sales_state"->>'state' = 'hold'
              AND jsonb_typeof("booth_product"."sales_state"->'holdReason') = 'string'
              AND length("booth_product"."sales_state"->>'holdReason') > 0
              AND NOT ("booth_product"."sales_state" ? 'value')
            )
          )
        )
      ) IS TRUE),
	CONSTRAINT "booth_product_publication_date_envelope_ck" CHECK ((
        "booth_product"."source_publication_date" IS NULL
        OR (
          jsonb_typeof("booth_product"."source_publication_date") = 'object'
          AND "booth_product"."source_publication_date"->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND "booth_product"."source_publication_date"->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof("booth_product"."source_publication_date"->'evidence') = 'array'
          AND jsonb_typeof("booth_product"."source_publication_date"->'contentVersion') = 'string'
          AND length("booth_product"."source_publication_date"->>'contentVersion') > 0
          AND jsonb_typeof("booth_product"."source_publication_date"->'checkedAt') = 'string'
          AND length("booth_product"."source_publication_date"->>'checkedAt') > 0
          AND (
            (
              "booth_product"."source_publication_date"->>'state' = 'known'
              AND jsonb_typeof("booth_product"."source_publication_date"->'value') = 'string'
              AND length("booth_product"."source_publication_date"->>'value') > 0
              AND NOT ("booth_product"."source_publication_date" ? 'holdReason')
            )
            OR (
              "booth_product"."source_publication_date"->>'state' IN ('unknown', 'not_applicable')
              AND NOT ("booth_product"."source_publication_date" ? 'value')
              AND NOT ("booth_product"."source_publication_date" ? 'holdReason')
            )
            OR (
              "booth_product"."source_publication_date"->>'state' = 'hold'
              AND jsonb_typeof("booth_product"."source_publication_date"->'holdReason') = 'string'
              AND length("booth_product"."source_publication_date"->>'holdReason') > 0
              AND NOT ("booth_product"."source_publication_date" ? 'value')
            )
          )
        )
      ) IS TRUE),
	CONSTRAINT "booth_product_is_free_envelope_ck" CHECK ((
        "booth_product"."is_free" IS NULL
        OR (
          jsonb_typeof("booth_product"."is_free") = 'object'
          AND "booth_product"."is_free"->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND "booth_product"."is_free"->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof("booth_product"."is_free"->'evidence') = 'array'
          AND jsonb_typeof("booth_product"."is_free"->'contentVersion') = 'string'
          AND length("booth_product"."is_free"->>'contentVersion') > 0
          AND jsonb_typeof("booth_product"."is_free"->'checkedAt') = 'string'
          AND length("booth_product"."is_free"->>'checkedAt') > 0
          AND (
            (
              "booth_product"."is_free"->>'state' = 'known'
              AND jsonb_typeof("booth_product"."is_free"->'value') = 'boolean'
              AND NOT ("booth_product"."is_free" ? 'holdReason')
            )
            OR (
              "booth_product"."is_free"->>'state' IN ('unknown', 'not_applicable')
              AND NOT ("booth_product"."is_free" ? 'value')
              AND NOT ("booth_product"."is_free" ? 'holdReason')
            )
            OR (
              "booth_product"."is_free"->>'state' = 'hold'
              AND jsonb_typeof("booth_product"."is_free"->'holdReason') = 'string'
              AND length("booth_product"."is_free"->>'holdReason') > 0
              AND NOT ("booth_product"."is_free" ? 'value')
            )
          )
        )
      ) IS TRUE),
	CONSTRAINT "booth_product_age_hold_purge_ck" CHECK ((
        NOT (
          "booth_product"."all_ages_state"->>'state' = 'hold'
          AND "booth_product"."all_ages_state"->>'holdReason' = 'hold_age_unknown'
        )
        OR (
          "booth_product"."observed_title" IS NULL
          AND "booth_product"."classification" IS NULL
          AND "booth_product"."sales_state" IS NULL
          AND "booth_product"."source_publication_date" IS NULL
          AND "booth_product"."is_free" IS NULL
          AND "booth_product"."content_version" LIKE 'outcome:hold_age_unknown:%'
        )
      ) IS TRUE)
);
--> statement-breakpoint
CREATE TABLE "normalization_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booth_product_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"content_version" text NOT NULL,
	"normalizer_version" text NOT NULL,
	"registry_version" text NOT NULL,
	"body_derived_sha256" text,
	"decision" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "normalization_history_entity_type_ck" CHECK ("normalization_history"."entity_type" IN ('booth_product', 'scenario')),
	CONSTRAINT "normalization_history_body_hash_ck" CHECK ("normalization_history"."body_derived_sha256" IS NULL OR "normalization_history"."body_derived_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "normalization_history_decision_shape_ck" CHECK (jsonb_typeof("normalization_history"."decision") = 'object'),
	CONSTRAINT "normalization_history_version_ck" CHECK ((
        length(btrim("normalization_history"."content_version")) > 0
        AND length(btrim("normalization_history"."normalizer_version")) > 0
        AND length(btrim("normalization_history"."registry_version")) > 0
      ) IS TRUE)
);
--> statement-breakpoint
CREATE TABLE "redaction_tombstone" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booth_product_id" uuid NOT NULL,
	"snapshot_count" integer NOT NULL,
	"history_count" integer NOT NULL,
	"scenario_count" integer NOT NULL,
	"purge_state" text NOT NULL,
	"purge_completed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "redaction_tombstone_nonnegative_counts_ck" CHECK (
        "redaction_tombstone"."snapshot_count" >= 0
        AND "redaction_tombstone"."history_count" >= 0
        AND "redaction_tombstone"."scenario_count" >= 0
      ),
	CONSTRAINT "redaction_tombstone_state_ck" CHECK ("redaction_tombstone"."purge_state" = 'completed')
);
--> statement-breakpoint
CREATE TABLE "scenario" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booth_product_id" uuid NOT NULL,
	"title" jsonb,
	"player_count" jsonb,
	"edition" jsonb,
	"play_time_minutes" jsonb,
	"modality" jsonb,
	"tags" jsonb,
	"required_books" jsonb NOT NULL,
	"compatibility" jsonb NOT NULL,
	"relationships" jsonb NOT NULL,
	"separation_approved" boolean NOT NULL,
	"hold" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_checked_at" timestamp with time zone NOT NULL,
	"content_version" text NOT NULL,
	"current_record_updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "scenario_version_and_time_ck" CHECK ((
        length(btrim("scenario"."content_version")) > 0
        AND "scenario"."first_seen_at" <= "scenario"."last_checked_at"
        AND "scenario"."first_seen_at" <= "scenario"."current_record_updated_at"
      ) IS TRUE),
	CONSTRAINT "scenario_required_fields_or_purged_ck" CHECK ((
        (
          "scenario"."title" IS NOT NULL
          AND "scenario"."player_count" IS NOT NULL
          AND "scenario"."edition" IS NOT NULL
          AND "scenario"."play_time_minutes" IS NOT NULL
          AND "scenario"."modality" IS NOT NULL
          AND "scenario"."tags" IS NOT NULL
        )
        OR (
          "scenario"."hold" = true
          AND "scenario"."title" IS NULL
          AND "scenario"."player_count" IS NULL
          AND "scenario"."edition" IS NULL
          AND "scenario"."play_time_minutes" IS NULL
          AND "scenario"."modality" IS NULL
          AND "scenario"."tags" IS NULL
          AND "scenario"."required_books" = '[]'::jsonb
          AND "scenario"."compatibility" = '[]'::jsonb
          AND "scenario"."relationships" = '[]'::jsonb
          AND "scenario"."content_version" LIKE 'outcome:hold_age_unknown:%'
        )
      ) IS TRUE),
	CONSTRAINT "scenario_title_envelope_ck" CHECK ((
        "scenario"."title" IS NULL
        OR (
          jsonb_typeof("scenario"."title") = 'object'
          AND "scenario"."title"->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND "scenario"."title"->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof("scenario"."title"->'evidence') = 'array'
          AND jsonb_typeof("scenario"."title"->'contentVersion') = 'string'
          AND length("scenario"."title"->>'contentVersion') > 0
          AND jsonb_typeof("scenario"."title"->'checkedAt') = 'string'
          AND length("scenario"."title"->>'checkedAt') > 0
          AND (
            (
              "scenario"."title"->>'state' = 'known'
              AND jsonb_typeof("scenario"."title"->'value') = 'string'
              AND length("scenario"."title"->>'value') > 0
              AND NOT ("scenario"."title" ? 'holdReason')
            )
            OR (
              "scenario"."title"->>'state' IN ('unknown', 'not_applicable')
              AND NOT ("scenario"."title" ? 'value')
              AND NOT ("scenario"."title" ? 'holdReason')
            )
            OR (
              "scenario"."title"->>'state' = 'hold'
              AND jsonb_typeof("scenario"."title"->'holdReason') = 'string'
              AND length("scenario"."title"->>'holdReason') > 0
              AND NOT ("scenario"."title" ? 'value')
            )
          )
        )
      ) IS TRUE),
	CONSTRAINT "scenario_edition_envelope_ck" CHECK ((
        "scenario"."edition" IS NULL
        OR (
          jsonb_typeof("scenario"."edition") = 'object'
          AND "scenario"."edition"->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND "scenario"."edition"->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof("scenario"."edition"->'evidence') = 'array'
          AND jsonb_typeof("scenario"."edition"->'contentVersion') = 'string'
          AND length("scenario"."edition"->>'contentVersion') > 0
          AND jsonb_typeof("scenario"."edition"->'checkedAt') = 'string'
          AND length("scenario"."edition"->>'checkedAt') > 0
          AND (
            (
              "scenario"."edition"->>'state' = 'known'
              AND jsonb_typeof("scenario"."edition"->'value') = 'string'
              AND length("scenario"."edition"->>'value') > 0
              AND NOT ("scenario"."edition" ? 'holdReason')
            )
            OR (
              "scenario"."edition"->>'state' IN ('unknown', 'not_applicable')
              AND NOT ("scenario"."edition" ? 'value')
              AND NOT ("scenario"."edition" ? 'holdReason')
            )
            OR (
              "scenario"."edition"->>'state' = 'hold'
              AND jsonb_typeof("scenario"."edition"->'holdReason') = 'string'
              AND length("scenario"."edition"->>'holdReason') > 0
              AND NOT ("scenario"."edition" ? 'value')
            )
          )
        )
      ) IS TRUE),
	CONSTRAINT "scenario_player_range_ck" CHECK ((
        "scenario"."player_count" IS NULL
        OR (
          jsonb_typeof("scenario"."player_count") = 'object'
          AND "scenario"."player_count"->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND "scenario"."player_count"->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof("scenario"."player_count"->'evidence') = 'array'
          AND jsonb_typeof("scenario"."player_count"->'contentVersion') = 'string'
          AND length("scenario"."player_count"->>'contentVersion') > 0
          AND jsonb_typeof("scenario"."player_count"->'checkedAt') = 'string'
          AND length("scenario"."player_count"->>'checkedAt') > 0
          AND (
            (
              "scenario"."player_count"->>'state' = 'known'
              AND jsonb_typeof("scenario"."player_count"->'value') = 'object'
              AND jsonb_typeof("scenario"."player_count"->'value'->'minimumPlayers') = 'number'
              AND jsonb_typeof("scenario"."player_count"->'value'->'maximumPlayers') = 'number'
              AND ("scenario"."player_count"->'value'->>'minimumPlayers')::integer >= 1
              AND ("scenario"."player_count"->'value'->>'minimumPlayers')::integer
                <= ("scenario"."player_count"->'value'->>'maximumPlayers')::integer
              AND NOT ("scenario"."player_count" ? 'holdReason')
            )
            OR (
              "scenario"."player_count"->>'state' IN ('unknown', 'not_applicable')
              AND NOT ("scenario"."player_count" ? 'value')
              AND NOT ("scenario"."player_count" ? 'holdReason')
            )
            OR (
              "scenario"."player_count"->>'state' = 'hold'
              AND jsonb_typeof("scenario"."player_count"->'holdReason') = 'string'
              AND length("scenario"."player_count"->>'holdReason') > 0
              AND NOT ("scenario"."player_count" ? 'value')
            )
          )
        )
      ) IS TRUE),
	CONSTRAINT "scenario_play_time_range_ck" CHECK ((
        "scenario"."play_time_minutes" IS NULL
        OR (
          jsonb_typeof("scenario"."play_time_minutes") = 'object'
          AND "scenario"."play_time_minutes"->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND "scenario"."play_time_minutes"->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof("scenario"."play_time_minutes"->'evidence') = 'array'
          AND jsonb_typeof("scenario"."play_time_minutes"->'contentVersion') = 'string'
          AND length("scenario"."play_time_minutes"->>'contentVersion') > 0
          AND jsonb_typeof("scenario"."play_time_minutes"->'checkedAt') = 'string'
          AND length("scenario"."play_time_minutes"->>'checkedAt') > 0
          AND (
            (
              "scenario"."play_time_minutes"->>'state' = 'known'
              AND jsonb_typeof("scenario"."play_time_minutes"->'value') = 'object'
              AND jsonb_typeof("scenario"."play_time_minutes"->'value'->'minimumMinutes') = 'number'
              AND jsonb_typeof("scenario"."play_time_minutes"->'value'->'maximumMinutes') = 'number'
              AND ("scenario"."play_time_minutes"->'value'->>'minimumMinutes')::integer >= 0
              AND ("scenario"."play_time_minutes"->'value'->>'minimumMinutes')::integer
                <= ("scenario"."play_time_minutes"->'value'->>'maximumMinutes')::integer
              AND NOT ("scenario"."play_time_minutes" ? 'holdReason')
            )
            OR (
              "scenario"."play_time_minutes"->>'state' IN ('unknown', 'not_applicable')
              AND NOT ("scenario"."play_time_minutes" ? 'value')
              AND NOT ("scenario"."play_time_minutes" ? 'holdReason')
            )
            OR (
              "scenario"."play_time_minutes"->>'state' = 'hold'
              AND jsonb_typeof("scenario"."play_time_minutes"->'holdReason') = 'string'
              AND length("scenario"."play_time_minutes"->>'holdReason') > 0
              AND NOT ("scenario"."play_time_minutes" ? 'value')
            )
          )
        )
      ) IS TRUE),
	CONSTRAINT "scenario_modality_value_ck" CHECK ((
        "scenario"."modality" IS NULL
        OR (
          jsonb_typeof("scenario"."modality") = 'object'
          AND "scenario"."modality"->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
          AND "scenario"."modality"->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
          AND jsonb_typeof("scenario"."modality"->'evidence') = 'array'
          AND jsonb_typeof("scenario"."modality"->'contentVersion') = 'string'
          AND length("scenario"."modality"->>'contentVersion') > 0
          AND jsonb_typeof("scenario"."modality"->'checkedAt') = 'string'
          AND length("scenario"."modality"->>'checkedAt') > 0
          AND (
            (
              "scenario"."modality"->>'state' = 'known'
              AND "scenario"."modality"->>'value' IN ('online', 'offline', 'either')
              AND NOT ("scenario"."modality" ? 'holdReason')
            )
            OR (
              "scenario"."modality"->>'state' IN ('unknown', 'not_applicable')
              AND NOT ("scenario"."modality" ? 'value')
              AND NOT ("scenario"."modality" ? 'holdReason')
            )
            OR (
              "scenario"."modality"->>'state' = 'hold'
              AND jsonb_typeof("scenario"."modality"->'holdReason') = 'string'
              AND length("scenario"."modality"->>'holdReason') > 0
              AND NOT ("scenario"."modality" ? 'value')
            )
          )
        )
      ) IS TRUE),
	CONSTRAINT "scenario_collection_shapes_ck" CHECK ((
        "scenario"."tags" IS NULL
        OR (
          jsonb_typeof("scenario"."tags") = 'object'
          AND "scenario"."tags" ?& ARRAY['genre', 'tone', 'setting', 'structure', 'content']
          AND jsonb_typeof("scenario"."tags"->'genre') = 'object'
          AND jsonb_typeof("scenario"."tags"->'tone') = 'object'
          AND jsonb_typeof("scenario"."tags"->'setting') = 'object'
          AND jsonb_typeof("scenario"."tags"->'structure') = 'object'
          AND jsonb_typeof("scenario"."tags"->'content') = 'object'
        )
      ) IS TRUE
      AND jsonb_typeof("scenario"."required_books") = 'array'
      AND jsonb_typeof("scenario"."compatibility") = 'array'
      AND jsonb_typeof("scenario"."relationships") = 'array')
);
--> statement-breakpoint
CREATE TABLE "source_snapshot" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booth_product_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"outcome" text NOT NULL,
	"status_code" integer,
	"raw_sha256" text,
	"normalized_sha256" text,
	"content_version" text NOT NULL,
	"parser_version" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "source_snapshot_url_ck" CHECK ("source_snapshot"."source_url" ~ '^https://booth[.]pm/'),
	CONSTRAINT "source_snapshot_raw_hash_ck" CHECK ("source_snapshot"."raw_sha256" IS NULL OR "source_snapshot"."raw_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "source_snapshot_normalized_hash_ck" CHECK ("source_snapshot"."normalized_sha256" IS NULL OR "source_snapshot"."normalized_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "source_snapshot_safe_metadata_ck" CHECK ((
        "source_snapshot"."outcome" ~ '^[a-z0-9_:-]{1,64}$'
        AND length(btrim("source_snapshot"."content_version")) > 0
        AND length(btrim("source_snapshot"."parser_version")) > 0
      ) IS TRUE)
);
--> statement-breakpoint
ALTER TABLE "normalization_history" ADD CONSTRAINT "normalization_history_booth_product_id_booth_product_id_fk" FOREIGN KEY ("booth_product_id") REFERENCES "public"."booth_product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redaction_tombstone" ADD CONSTRAINT "redaction_tombstone_booth_product_id_booth_product_id_fk" FOREIGN KEY ("booth_product_id") REFERENCES "public"."booth_product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario" ADD CONSTRAINT "scenario_booth_product_id_booth_product_id_fk" FOREIGN KEY ("booth_product_id") REFERENCES "public"."booth_product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_snapshot" ADD CONSTRAINT "source_snapshot_booth_product_id_booth_product_id_fk" FOREIGN KEY ("booth_product_id") REFERENCES "public"."booth_product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booth_product_source_identity_uq" ON "booth_product" USING btree ("source_platform","source_product_id");--> statement-breakpoint
CREATE INDEX "booth_product_last_checked_idx" ON "booth_product" USING btree ("last_checked_at");--> statement-breakpoint
CREATE INDEX "booth_product_first_seen_idx" ON "booth_product" USING btree ("first_seen_at");--> statement-breakpoint
CREATE INDEX "normalization_history_product_idx" ON "normalization_history" USING btree ("booth_product_id");--> statement-breakpoint
CREATE INDEX "normalization_history_entity_idx" ON "normalization_history" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "redaction_tombstone_product_uq" ON "redaction_tombstone" USING btree ("booth_product_id");--> statement-breakpoint
CREATE INDEX "scenario_product_idx" ON "scenario" USING btree ("booth_product_id");--> statement-breakpoint
CREATE INDEX "scenario_last_checked_idx" ON "scenario" USING btree ("last_checked_at");--> statement-breakpoint
CREATE INDEX "source_snapshot_product_idx" ON "source_snapshot" USING btree ("booth_product_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage9_valid_base_envelope(value jsonb, extra_keys text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
  WHEN jsonb_typeof(value) <> 'object' THEN false
  WHEN jsonb_typeof(value->'evidence') <> 'array' THEN false
  ELSE (
    value->>'state' IN ('known', 'unknown', 'hold', 'not_applicable')
    AND value->>'confidence' IN ('high', 'medium', 'low', 'unresolved')
    AND value->>'reviewState' IN ('unreviewed', 'approved', 'rejected', 'needs_more_evidence')
    AND jsonb_typeof(value->'contentVersion') = 'string'
    AND length(value->>'contentVersion') > 0
    AND jsonb_typeof(value->'checkedAt') = 'string'
    AND length(value->>'checkedAt') > 0
    AND (value->>'state' <> 'known' OR jsonb_array_length(value->'evidence') > 0)
    AND (NOT (value ? 'conflictReason') OR (
      jsonb_typeof(value->'conflictReason') = 'string'
      AND length(value->>'conflictReason') > 0
    ))
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_object_keys(value) AS envelope_key
      WHERE NOT (
        envelope_key = ANY(
          ARRAY[
            'state', 'value', 'holdReason', 'confidence', 'reviewState',
            'evidence', 'contentVersion', 'checkedAt', 'conflictReason'
          ] || extra_keys
        )
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(value->'evidence') AS evidence_item
      WHERE NOT ((
        jsonb_typeof(evidence_item) = 'object'
        AND (SELECT count(*) FROM jsonb_object_keys(evidence_item)) = 2
        AND jsonb_typeof(evidence_item->'pointer') = 'string'
        AND length(evidence_item->>'pointer') > 0
        AND evidence_item->>'method' IN (
          'explicit_source', 'deterministic_rule', 'ai_candidate'
        )
      ) IS TRUE)
    )
  ) IS TRUE
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage9_valid_string_envelope(value jsonb, extra_keys text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
  WHEN NOT public.stage9_valid_base_envelope(value, extra_keys) THEN false
  WHEN value->>'state' = 'known' THEN (
    jsonb_typeof(value->'value') = 'string'
    AND length(btrim(value->>'value')) > 0
    AND NOT (value ? 'holdReason')
  ) IS TRUE
  WHEN value->>'state' IN ('unknown', 'not_applicable') THEN (
    NOT (value ? 'value') AND NOT (value ? 'holdReason')
  )
  WHEN value->>'state' = 'hold' THEN (
    jsonb_typeof(value->'holdReason') = 'string'
    AND length(value->>'holdReason') > 0
    AND NOT (value ? 'value')
  ) IS TRUE
  ELSE false
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage9_valid_boolean_envelope(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
  WHEN NOT public.stage9_valid_base_envelope(value, ARRAY[]::text[]) THEN false
  WHEN value->>'state' = 'known' THEN (
    jsonb_typeof(value->'value') = 'boolean'
    AND NOT (value ? 'holdReason')
  ) IS TRUE
  WHEN value->>'state' IN ('unknown', 'not_applicable') THEN (
    NOT (value ? 'value') AND NOT (value ? 'holdReason')
  )
  WHEN value->>'state' = 'hold' THEN (
    jsonb_typeof(value->'holdReason') = 'string'
    AND length(value->>'holdReason') > 0
    AND NOT (value ? 'value')
  ) IS TRUE
  ELSE false
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage9_valid_string_array_envelope(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
  WHEN NOT public.stage9_valid_base_envelope(value, ARRAY[]::text[]) THEN false
  WHEN value->>'state' = 'known' THEN CASE
    WHEN jsonb_typeof(value->'value') <> 'array' THEN false
    ELSE (
      NOT (value ? 'holdReason')
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(value->'value') AS array_item
        WHERE NOT ((
          jsonb_typeof(array_item) = 'string'
          AND length(btrim(array_item #>> '{}')) > 0
        ) IS TRUE)
      )
    )
  END
  WHEN value->>'state' IN ('unknown', 'not_applicable') THEN (
    NOT (value ? 'value') AND NOT (value ? 'holdReason')
  )
  WHEN value->>'state' = 'hold' THEN (
    jsonb_typeof(value->'holdReason') = 'string'
    AND length(value->>'holdReason') > 0
    AND NOT (value ? 'value')
  ) IS TRUE
  ELSE false
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage9_valid_book_envelope(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
  WHEN NOT public.stage9_valid_base_envelope(value, ARRAY[]::text[]) THEN false
  WHEN value->>'state' = 'known' THEN (
    jsonb_typeof(value->'value') = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(value->'value')) = 2
    AND jsonb_typeof(value->'value'->'title') = 'string'
    AND length(btrim(value->'value'->>'title')) > 0
    AND value->'value'->>'kind' IN ('required', 'optional')
    AND NOT (value ? 'holdReason')
  ) IS TRUE
  WHEN value->>'state' IN ('unknown', 'not_applicable') THEN (
    NOT (value ? 'value') AND NOT (value ? 'holdReason')
  )
  WHEN value->>'state' = 'hold' THEN (
    jsonb_typeof(value->'holdReason') = 'string'
    AND length(value->>'holdReason') > 0
    AND NOT (value ? 'value')
  ) IS TRUE
  ELSE false
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage9_valid_player_range_envelope(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
  WHEN NOT public.stage9_valid_base_envelope(value, ARRAY[]::text[]) THEN false
  WHEN value->>'state' = 'known' THEN CASE
    WHEN jsonb_typeof(value->'value') <> 'object' THEN false
    WHEN jsonb_typeof(value->'value'->'minimumPlayers') <> 'number' THEN false
    WHEN jsonb_typeof(value->'value'->'maximumPlayers') <> 'number' THEN false
    ELSE (
      (value->'value'->>'minimumPlayers')::integer >= 1
      AND (value->'value'->>'minimumPlayers')::integer
        <= (value->'value'->>'maximumPlayers')::integer
      AND NOT (value ? 'holdReason')
    ) IS TRUE
  END
  WHEN value->>'state' IN ('unknown', 'not_applicable') THEN (
    NOT (value ? 'value') AND NOT (value ? 'holdReason')
  )
  WHEN value->>'state' = 'hold' THEN (
    jsonb_typeof(value->'holdReason') = 'string'
    AND length(value->>'holdReason') > 0
    AND NOT (value ? 'value')
  ) IS TRUE
  ELSE false
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage9_valid_time_range_envelope(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
  WHEN NOT public.stage9_valid_base_envelope(value, ARRAY[]::text[]) THEN false
  WHEN value->>'state' = 'known' THEN CASE
    WHEN jsonb_typeof(value->'value') <> 'object' THEN false
    WHEN jsonb_typeof(value->'value'->'minimumMinutes') <> 'number' THEN false
    WHEN jsonb_typeof(value->'value'->'maximumMinutes') <> 'number' THEN false
    ELSE (
      (value->'value'->>'minimumMinutes')::integer >= 0
      AND (value->'value'->>'minimumMinutes')::integer
        <= (value->'value'->>'maximumMinutes')::integer
      AND NOT (value ? 'holdReason')
    ) IS TRUE
  END
  WHEN value->>'state' IN ('unknown', 'not_applicable') THEN (
    NOT (value ? 'value') AND NOT (value ? 'holdReason')
  )
  WHEN value->>'state' = 'hold' THEN (
    jsonb_typeof(value->'holdReason') = 'string'
    AND length(value->>'holdReason') > 0
    AND NOT (value ? 'value')
  ) IS TRUE
  ELSE false
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage9_valid_tag_map(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
  WHEN jsonb_typeof(value) <> 'object' THEN false
  ELSE (
    (SELECT count(*) FROM jsonb_object_keys(value)) = 5
    AND value ?& ARRAY['genre', 'tone', 'setting', 'structure', 'content']
    AND public.stage9_valid_string_array_envelope(value->'genre')
    AND public.stage9_valid_string_array_envelope(value->'tone')
    AND public.stage9_valid_string_array_envelope(value->'setting')
    AND public.stage9_valid_string_array_envelope(value->'structure')
    AND public.stage9_valid_string_array_envelope(value->'content')
  ) IS TRUE
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage9_valid_string_envelope_array(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
  WHEN jsonb_typeof(value) <> 'array' THEN false
  ELSE NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(value) AS envelope
    WHERE NOT public.stage9_valid_string_envelope(envelope, ARRAY[]::text[])
  )
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage9_valid_book_envelope_array(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
  WHEN jsonb_typeof(value) <> 'array' THEN false
  ELSE NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(value) AS envelope
    WHERE NOT public.stage9_valid_book_envelope(envelope)
  )
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage9_valid_relationship_array(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
  WHEN jsonb_typeof(value) <> 'array' THEN false
  ELSE NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(value) AS relationship
    WHERE NOT ((
      jsonb_typeof(relationship) = 'object'
      AND (SELECT count(*) FROM jsonb_object_keys(relationship)) = 2
      AND relationship ?& ARRAY['system', 'aliases']
      AND public.stage9_valid_string_envelope(
        relationship->'system', ARRAY[]::text[]
      )
      AND public.stage9_valid_string_array_envelope(relationship->'aliases')
    ) IS TRUE)
  )
END;
$$;

--> statement-breakpoint
ALTER TABLE booth_product
ADD CONSTRAINT booth_product_nested_envelope_shape_ck CHECK ((
  public.stage9_valid_string_envelope(all_ages_state, ARRAY[]::text[])
  AND (
    classification IS NULL
    OR public.stage9_valid_string_envelope(
      classification,
      ARRAY['normalizerVersion', 'registryVersion']
    )
  )
  AND (sales_state IS NULL OR public.stage9_valid_string_envelope(
    sales_state, ARRAY[]::text[]
  ))
  AND (source_publication_date IS NULL OR public.stage9_valid_string_envelope(
    source_publication_date, ARRAY[]::text[]
  ))
  AND (is_free IS NULL OR public.stage9_valid_boolean_envelope(is_free))
) IS TRUE);

--> statement-breakpoint
ALTER TABLE scenario
ADD CONSTRAINT scenario_nested_envelope_shape_ck CHECK ((
  (title IS NULL OR public.stage9_valid_string_envelope(title, ARRAY[]::text[]))
  AND (player_count IS NULL OR public.stage9_valid_player_range_envelope(player_count))
  AND (edition IS NULL OR public.stage9_valid_string_envelope(edition, ARRAY[]::text[]))
  AND (
    play_time_minutes IS NULL
    OR public.stage9_valid_time_range_envelope(play_time_minutes)
  )
  AND (modality IS NULL OR public.stage9_valid_string_envelope(
    modality, ARRAY[]::text[]
  ))
  AND (tags IS NULL OR public.stage9_valid_tag_map(tags))
  AND public.stage9_valid_book_envelope_array(required_books)
  AND public.stage9_valid_string_envelope_array(compatibility)
  AND public.stage9_valid_relationship_array(relationships)
) IS TRUE);

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage9_guard_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_age_hold_purge', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'append-only history';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

--> statement-breakpoint
CREATE TRIGGER source_snapshot_append_only
BEFORE UPDATE OR DELETE ON source_snapshot
FOR EACH ROW EXECUTE FUNCTION public.stage9_guard_append_only();

--> statement-breakpoint
CREATE TRIGGER normalization_history_append_only
BEFORE UPDATE OR DELETE ON normalization_history
FOR EACH ROW EXECUTE FUNCTION public.stage9_guard_append_only();
