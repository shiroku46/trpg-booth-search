CREATE TABLE "discovery_manifest" (
	"fingerprint" text PRIMARY KEY NOT NULL,
	"schema_version" integer NOT NULL,
	"source_sha" text NOT NULL,
	"parser_version" text NOT NULL,
	"listing_url" text NOT NULL,
	"listing_raw_sha256" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"installed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "discovery_manifest_fingerprint_ck" CHECK ("discovery_manifest"."fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "discovery_manifest_schema_version_ck" CHECK ("discovery_manifest"."schema_version" = 1),
	CONSTRAINT "discovery_manifest_source_sha_ck" CHECK ("discovery_manifest"."source_sha" ~ '^[0-9a-f]{40}$'),
	CONSTRAINT "discovery_manifest_parser_version_ck" CHECK ("discovery_manifest"."parser_version" = 'stage28-pilot-v8'),
	CONSTRAINT "discovery_manifest_listing_url_ck" CHECK ("discovery_manifest"."listing_url" = 'https://booth.pm/ja/browse/TRPG?adult=none&type=digital'),
	CONSTRAINT "discovery_manifest_listing_raw_sha_ck" CHECK ("discovery_manifest"."listing_raw_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "discovery_manifest_shape_ck" CHECK ((
        jsonb_typeof("discovery_manifest"."manifest") = 'object'
        AND ("discovery_manifest"."manifest"->>'schemaVersion')::integer = 1
        AND jsonb_typeof("discovery_manifest"."manifest"->'source') = 'object'
        AND jsonb_typeof("discovery_manifest"."manifest"->'entries') = 'array'
        AND jsonb_array_length("discovery_manifest"."manifest"->'entries') BETWEEN 1 AND 100
        AND jsonb_typeof("discovery_manifest"."manifest"->'fingerprint') = 'string'
      ) IS TRUE),
	CONSTRAINT "discovery_manifest_identity_ck" CHECK ((
        "discovery_manifest"."manifest"->>'fingerprint' = "discovery_manifest"."fingerprint"
        AND ("discovery_manifest"."manifest"->>'schemaVersion')::integer = "discovery_manifest"."schema_version"
        AND "discovery_manifest"."manifest"->'source'->>'kind' = 'booth_listing_identity_only'
        AND "discovery_manifest"."manifest"->'source'->>'sourceSha' = "discovery_manifest"."source_sha"
        AND "discovery_manifest"."manifest"->'source'->>'parserVersion' = "discovery_manifest"."parser_version"
        AND "discovery_manifest"."manifest"->'source'->>'listingUrl' = "discovery_manifest"."listing_url"
        AND "discovery_manifest"."manifest"->'source'->>'listingRawSha256' = "discovery_manifest"."listing_raw_sha256"
      ) IS TRUE)
);
--> statement-breakpoint
CREATE INDEX "discovery_manifest_installed_idx" ON "discovery_manifest" USING btree ("installed_at","fingerprint");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage30_guard_discovery_manifest_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'discovery_manifest is append-only';
END;
$$;

--> statement-breakpoint
CREATE TRIGGER discovery_manifest_append_only
BEFORE UPDATE OR DELETE ON discovery_manifest
FOR EACH ROW EXECUTE FUNCTION public.stage30_guard_discovery_manifest_append_only();
