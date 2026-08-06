CREATE TABLE "review_case" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booth_product_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field_path" text NOT NULL,
	"evidenced_state" text NOT NULL,
	"confidence" text NOT NULL,
	"initial_review_state" text NOT NULL,
	"evidence_count" integer NOT NULL,
	"has_conflict" boolean NOT NULL,
	"hold_reason" text,
	"contains_ai_evidence" boolean NOT NULL,
	"content_version" text NOT NULL,
	"normalizer_version" text NOT NULL,
	"registry_version" text NOT NULL,
	"priority" text NOT NULL,
	"reasons" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "review_case_entity_type_ck" CHECK ("review_case"."entity_type" IN ('booth_product', 'scenario')),
	CONSTRAINT "review_case_evidenced_state_ck" CHECK ("review_case"."evidenced_state" IN ('known', 'unknown', 'hold', 'not_applicable')),
	CONSTRAINT "review_case_confidence_ck" CHECK ("review_case"."confidence" IN ('high', 'medium', 'low', 'unresolved')),
	CONSTRAINT "review_case_initial_state_ck" CHECK ("review_case"."initial_review_state" IN ('unreviewed', 'needs_more_evidence')),
	CONSTRAINT "review_case_field_path_ck" CHECK (length("review_case"."field_path") BETWEEN 1 AND 128 AND "review_case"."field_path" ~ '^[a-z][a-z0-9_]*([.][a-z][a-z0-9_]*){0,5}$'),
	CONSTRAINT "review_case_evidence_count_ck" CHECK ("review_case"."evidence_count" >= 0),
	CONSTRAINT "review_case_hold_shape_ck" CHECK ((
        (
          "review_case"."evidenced_state" = 'hold'
          AND "review_case"."hold_reason" ~ '^[a-z][a-z0-9_:-]{0,127}$'
        )
        OR (
          "review_case"."evidenced_state" <> 'hold'
          AND "review_case"."hold_reason" IS NULL
        )
      ) IS TRUE),
	CONSTRAINT "review_case_version_ck" CHECK ((
        length(btrim("review_case"."content_version")) > 0
        AND length(btrim("review_case"."normalizer_version")) > 0
        AND length(btrim("review_case"."registry_version")) > 0
      ) IS TRUE),
	CONSTRAINT "review_case_reasons_ck" CHECK ((
        jsonb_typeof("review_case"."reasons") = 'array'
        AND jsonb_array_length("review_case"."reasons") > 0
        AND "review_case"."reasons" <@ '[
          "hold_requires_resolution",
          "conflict_requires_resolution",
          "ai_candidate_requires_approval",
          "needs_more_evidence",
          "unresolved_confidence",
          "known_without_evidence",
          "low_confidence",
          "manual_review_requested"
        ]'::jsonb
      ) IS TRUE),
	CONSTRAINT "review_case_priority_ck" CHECK ((
        CASE
          WHEN "review_case"."reasons" ?| ARRAY[
            'hold_requires_resolution',
            'conflict_requires_resolution',
            'ai_candidate_requires_approval'
          ] THEN "review_case"."priority" = 'blocking'
          WHEN "review_case"."reasons" ?| ARRAY[
            'needs_more_evidence',
            'unresolved_confidence',
            'known_without_evidence'
          ] THEN "review_case"."priority" = 'high'
          ELSE "review_case"."priority" = 'normal'
        END
      ) IS TRUE)
);
--> statement-breakpoint
CREATE TABLE "review_decision_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"review_case_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"decided_at" timestamp with time zone NOT NULL,
	CONSTRAINT "review_decision_event_review_case_id_unique" UNIQUE("review_case_id"),
	CONSTRAINT "review_decision_reason_ck" CHECK ((
        (
          "review_decision_event"."decision" = 'approved'
          AND "review_decision_event"."reason" IN ('evidence_sufficient', 'manual_policy_decision')
        )
        OR (
          "review_decision_event"."decision" = 'needs_more_evidence'
          AND "review_decision_event"."reason" IN (
            'evidence_insufficient',
            'evidence_conflict',
            'manual_policy_decision'
          )
        )
        OR (
          "review_decision_event"."decision" = 'rejected'
          AND "review_decision_event"."reason" IN (
            'evidence_conflict',
            'incorrect_mapping',
            'unsupported_claim',
            'manual_policy_decision'
          )
        )
      ) IS TRUE)
);
--> statement-breakpoint
ALTER TABLE "review_case" ADD CONSTRAINT "review_case_booth_product_id_booth_product_id_fk" FOREIGN KEY ("booth_product_id") REFERENCES "public"."booth_product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decision_event" ADD CONSTRAINT "review_decision_event_review_case_id_review_case_id_fk" FOREIGN KEY ("review_case_id") REFERENCES "public"."review_case"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "review_case_identity_uq" ON "review_case" USING btree ("booth_product_id","entity_type","entity_id","field_path","content_version","normalizer_version","registry_version");--> statement-breakpoint
CREATE INDEX "review_case_pending_idx" ON "review_case" USING btree ("priority","created_at","id");--> statement-breakpoint
CREATE INDEX "review_decision_time_idx" ON "review_decision_event" USING btree ("decided_at","id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage15_guard_review_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'review records are append-only';
END;
$$;

--> statement-breakpoint
CREATE TRIGGER review_case_append_only
BEFORE UPDATE OR DELETE ON review_case
FOR EACH ROW EXECUTE FUNCTION public.stage15_guard_review_append_only();

--> statement-breakpoint
CREATE TRIGGER review_decision_event_append_only
BEFORE UPDATE OR DELETE ON review_decision_event
FOR EACH ROW EXECUTE FUNCTION public.stage15_guard_review_append_only();
