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
	CONSTRAINT "booth_product_all_ages_envelope_ck" CHECK (
        jsonb_typeof("booth_product"."all_ages_state") = 'object'
        AND (
          (
            "booth_product"."all_ages_state"->>'state' = 'known'
            AND "booth_product"."all_ages_state"->>'value' = 'all_ages_confirmed'
            AND "booth_product"."all_ages_state"->>'reviewState' = 'approved'
          )
          OR (
            "booth_product"."all_ages_state"->>'state' = 'hold'
            AND "booth_product"."all_ages_state"->>'holdReason' = 'hold_age_unknown'
          )
        )
      ),
	CONSTRAINT "booth_product_classification_value_ck" CHECK (
        "booth_product"."classification" IS NULL
        OR (
          jsonb_typeof("booth_product"."classification") = 'object'
          AND (
            "booth_product"."classification"->>'state' <> 'known'
            OR "booth_product"."classification"->>'value' IN (
              'scenario_single',
              'scenario_collection',
              'mixed_scenario_and_material',
              'material_only',
              'hold_unknown'
            )
          )
        )
      ),
	CONSTRAINT "booth_product_sales_state_value_ck" CHECK (
        "booth_product"."sales_state" IS NULL
        OR (
          jsonb_typeof("booth_product"."sales_state") = 'object'
          AND (
            "booth_product"."sales_state"->>'state' <> 'known'
            OR "booth_product"."sales_state"->>'value' IN (
              'available',
              'sold_out',
              'sales_ended'
            )
          )
        )
      ),
	CONSTRAINT "booth_product_age_hold_purge_ck" CHECK (
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
      )
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
	CONSTRAINT "normalization_history_body_hash_ck" CHECK ("normalization_history"."body_derived_sha256" IS NULL OR "normalization_history"."body_derived_sha256" ~ '^[0-9a-f]{64}$')
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
	CONSTRAINT "scenario_required_fields_or_purged_ck" CHECK (
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
      ),
	CONSTRAINT "scenario_player_range_ck" CHECK (
        "scenario"."player_count" IS NULL
        OR "scenario"."player_count"->>'state' <> 'known'
        OR (
          jsonb_typeof("scenario"."player_count"->'value'->'minimumPlayers') = 'number'
          AND jsonb_typeof("scenario"."player_count"->'value'->'maximumPlayers') = 'number'
          AND ("scenario"."player_count"->'value'->>'minimumPlayers')::integer >= 1
          AND ("scenario"."player_count"->'value'->>'minimumPlayers')::integer
            <= ("scenario"."player_count"->'value'->>'maximumPlayers')::integer
        )
      ),
	CONSTRAINT "scenario_play_time_range_ck" CHECK (
        "scenario"."play_time_minutes" IS NULL
        OR "scenario"."play_time_minutes"->>'state' <> 'known'
        OR (
          jsonb_typeof("scenario"."play_time_minutes"->'value'->'minimumMinutes') = 'number'
          AND jsonb_typeof("scenario"."play_time_minutes"->'value'->'maximumMinutes') = 'number'
          AND ("scenario"."play_time_minutes"->'value'->>'minimumMinutes')::integer >= 0
          AND ("scenario"."play_time_minutes"->'value'->>'minimumMinutes')::integer
            <= ("scenario"."play_time_minutes"->'value'->>'maximumMinutes')::integer
        )
      ),
	CONSTRAINT "scenario_modality_value_ck" CHECK (
        "scenario"."modality" IS NULL
        OR "scenario"."modality"->>'state' <> 'known'
        OR "scenario"."modality"->>'value' IN ('online', 'offline', 'either')
      )
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
	CONSTRAINT "source_snapshot_normalized_hash_ck" CHECK ("source_snapshot"."normalized_sha256" IS NULL OR "source_snapshot"."normalized_sha256" ~ '^[0-9a-f]{64}$')
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
CREATE OR REPLACE FUNCTION stage9_guard_append_only()
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
FOR EACH ROW EXECUTE FUNCTION stage9_guard_append_only();

--> statement-breakpoint
CREATE TRIGGER normalization_history_append_only
BEFORE UPDATE OR DELETE ON normalization_history
FOR EACH ROW EXECUTE FUNCTION stage9_guard_append_only();
