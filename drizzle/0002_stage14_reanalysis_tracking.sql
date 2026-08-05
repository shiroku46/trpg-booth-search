ALTER TABLE "normalization_history" ADD COLUMN "record_kind" text DEFAULT 'initial_analysis' NOT NULL;--> statement-breakpoint
ALTER TABLE "normalization_history" ADD COLUMN "reanalysis_trigger" text;--> statement-breakpoint
ALTER TABLE "normalization_history" ADD COLUMN "content_version_old" text;--> statement-breakpoint
ALTER TABLE "normalization_history" ADD COLUMN "normalizer_version_old" text;--> statement-breakpoint
ALTER TABLE "normalization_history" ADD COLUMN "registry_version_old" text;--> statement-breakpoint
ALTER TABLE "normalization_history" ADD COLUMN "old_result_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "normalization_history" ADD COLUMN "reason_detail" text;--> statement-breakpoint
CREATE INDEX "normalization_history_latest_idx" ON "normalization_history" USING btree ("booth_product_id","entity_type","entity_id","created_at");--> statement-breakpoint
ALTER TABLE "normalization_history" ADD CONSTRAINT "normalization_history_record_kind_ck" CHECK ("normalization_history"."record_kind" IN ('initial_analysis', 'reanalysis'));--> statement-breakpoint
ALTER TABLE "normalization_history" ADD CONSTRAINT "normalization_history_transition_shape_ck" CHECK ((
        (
          "normalization_history"."record_kind" = 'initial_analysis'
          AND "normalization_history"."reanalysis_trigger" IS NULL
          AND "normalization_history"."content_version_old" IS NULL
          AND "normalization_history"."normalizer_version_old" IS NULL
          AND "normalization_history"."registry_version_old" IS NULL
          AND "normalization_history"."old_result_snapshot" IS NULL
          AND "normalization_history"."reason_detail" IS NULL
        )
        OR
        (
          "normalization_history"."record_kind" = 'reanalysis'
          AND "normalization_history"."reanalysis_trigger" IN (
            'content_changed',
            'normalizer_version_changed',
            'registry_version_changed',
            'alias_approved',
            'canonical_entity_added',
            'manual_trigger'
          )
          AND length(btrim("normalization_history"."content_version_old")) > 0
          AND length(btrim("normalization_history"."normalizer_version_old")) > 0
          AND length(btrim("normalization_history"."registry_version_old")) > 0
          AND jsonb_typeof("normalization_history"."old_result_snapshot") = 'object'
          AND length(btrim("normalization_history"."reason_detail")) BETWEEN 1 AND 1000
        )
      ) IS TRUE);--> statement-breakpoint
ALTER TABLE "normalization_history" ADD CONSTRAINT "normalization_history_trigger_change_ck" CHECK ((
        "normalization_history"."record_kind" = 'initial_analysis'
        OR "normalization_history"."reanalysis_trigger" = 'manual_trigger'
        OR (
          "normalization_history"."reanalysis_trigger" = 'content_changed'
          AND "normalization_history"."content_version_old" <> "normalization_history"."content_version"
        )
        OR (
          "normalization_history"."reanalysis_trigger" = 'normalizer_version_changed'
          AND "normalization_history"."normalizer_version_old" <> "normalization_history"."normalizer_version"
        )
        OR (
          "normalization_history"."reanalysis_trigger" IN (
            'registry_version_changed',
            'alias_approved',
            'canonical_entity_added'
          )
          AND "normalization_history"."registry_version_old" <> "normalization_history"."registry_version"
        )
      ) IS TRUE);