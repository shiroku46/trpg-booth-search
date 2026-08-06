CREATE TABLE "review_application_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"review_case_id" uuid NOT NULL,
	"review_decision_event_id" uuid NOT NULL,
	"booth_product_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field_path" text NOT NULL,
	"content_version" text NOT NULL,
	"normalizer_version" text NOT NULL,
	"registry_version" text NOT NULL,
	"outcome" text NOT NULL,
	"applied_at" timestamp with time zone NOT NULL,
	CONSTRAINT "review_application_event_review_case_id_unique" UNIQUE("review_case_id"),
	CONSTRAINT "review_application_event_review_decision_event_id_unique" UNIQUE("review_decision_event_id"),
	CONSTRAINT "review_application_entity_type_ck" CHECK ("review_application_event"."entity_type" IN ('booth_product', 'scenario')),
	CONSTRAINT "review_application_field_path_ck" CHECK (length("review_application_event"."field_path") BETWEEN 1 AND 128 AND "review_application_event"."field_path" ~ '^[a-z][a-z0-9_]*([.][a-z][a-z0-9_]*){0,5}$'),
	CONSTRAINT "review_application_version_ck" CHECK ((
        length(btrim("review_application_event"."content_version")) > 0
        AND length(btrim("review_application_event"."normalizer_version")) > 0
        AND length(btrim("review_application_event"."registry_version")) > 0
      ) IS TRUE),
	CONSTRAINT "review_application_outcome_ck" CHECK ("review_application_event"."outcome" IN (
        'approved',
        'excluded_rejected',
        'excluded_needs_more_evidence'
      ))
);
--> statement-breakpoint
ALTER TABLE "review_application_event" ADD CONSTRAINT "review_application_event_review_case_id_review_case_id_fk" FOREIGN KEY ("review_case_id") REFERENCES "public"."review_case"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_application_event" ADD CONSTRAINT "review_application_event_review_decision_event_id_review_decision_event_id_fk" FOREIGN KEY ("review_decision_event_id") REFERENCES "public"."review_decision_event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_application_event" ADD CONSTRAINT "review_application_event_booth_product_id_booth_product_id_fk" FOREIGN KEY ("booth_product_id") REFERENCES "public"."booth_product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_application_target_idx" ON "review_application_event" USING btree ("booth_product_id","entity_type","entity_id","field_path","content_version","normalizer_version","registry_version");--> statement-breakpoint
CREATE INDEX "review_application_time_idx" ON "review_application_event" USING btree ("applied_at","id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage16_validate_review_application()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  case_row public.review_case%ROWTYPE;
  decision_row public.review_decision_event%ROWTYPE;
  expected_outcome text;
BEGIN
  SELECT * INTO case_row FROM public.review_case WHERE id = NEW.review_case_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'review application case does not exist';
  END IF;

  SELECT * INTO decision_row
  FROM public.review_decision_event
  WHERE id = NEW.review_decision_event_id;
  IF NOT FOUND OR decision_row.review_case_id IS DISTINCT FROM case_row.id THEN
    RAISE EXCEPTION 'review application decision/case mismatch';
  END IF;

  IF NEW.booth_product_id IS DISTINCT FROM case_row.booth_product_id
    OR NEW.entity_type IS DISTINCT FROM case_row.entity_type
    OR NEW.entity_id IS DISTINCT FROM case_row.entity_id
    OR NEW.field_path IS DISTINCT FROM case_row.field_path
    OR NEW.content_version IS DISTINCT FROM case_row.content_version
    OR NEW.normalizer_version IS DISTINCT FROM case_row.normalizer_version
    OR NEW.registry_version IS DISTINCT FROM case_row.registry_version THEN
    RAISE EXCEPTION 'review application target/version mismatch';
  END IF;

  IF case_row.entity_type = 'booth_product' THEN
    IF case_row.entity_id IS DISTINCT FROM case_row.booth_product_id THEN
      RAISE EXCEPTION 'review application product ownership mismatch';
    END IF;
  ELSIF case_row.entity_type = 'scenario' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.scenario
      WHERE id = case_row.entity_id
        AND booth_product_id = case_row.booth_product_id
    ) THEN
      RAISE EXCEPTION 'review application scenario ownership mismatch';
    END IF;
  ELSE
    RAISE EXCEPTION 'review application entity type is invalid';
  END IF;

  IF decision_row.decision = 'approved' THEN
    expected_outcome := 'approved';
    IF case_row.confidence NOT IN ('high', 'medium')
      OR case_row.evidenced_state = 'hold'
      OR case_row.has_conflict
      OR (case_row.evidenced_state = 'known' AND case_row.evidence_count = 0) THEN
      RAISE EXCEPTION 'unsafe review approval cannot be applied';
    END IF;
  ELSIF decision_row.decision = 'rejected' THEN
    expected_outcome := 'excluded_rejected';
  ELSIF decision_row.decision = 'needs_more_evidence' THEN
    expected_outcome := 'excluded_needs_more_evidence';
  ELSE
    RAISE EXCEPTION 'review application decision is invalid';
  END IF;

  IF NEW.outcome IS DISTINCT FROM expected_outcome THEN
    RAISE EXCEPTION 'review application outcome mismatch';
  END IF;
  IF NEW.applied_at <= decision_row.decided_at THEN
    RAISE EXCEPTION 'review application must follow decision time';
  END IF;
  RETURN NEW;
END;
$$;

--> statement-breakpoint
CREATE CONSTRAINT TRIGGER review_application_validate_insert
AFTER INSERT ON public.review_application_event
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.stage16_validate_review_application();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage16_guard_review_application_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'review application records are append-only';
END;
$$;

--> statement-breakpoint
CREATE TRIGGER review_application_append_only
BEFORE UPDATE OR DELETE ON review_application_event
FOR EACH ROW EXECUTE FUNCTION public.stage16_guard_review_application_append_only();
