CREATE TABLE "registry_snapshot" (
	"registry_version" text PRIMARY KEY NOT NULL,
	"schema_version" integer NOT NULL,
	"normalizer_version" text NOT NULL,
	"reviewed_at" date NOT NULL,
	"manifest_sha256" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"installed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "registry_snapshot_version_ck" CHECK ("registry_snapshot"."registry_version" ~ '^registry-[0-9]{4}-[0-9]{2}-[0-9]{2}[.][0-9]+$'),
	CONSTRAINT "registry_snapshot_schema_version_ck" CHECK ("registry_snapshot"."schema_version" > 0),
	CONSTRAINT "registry_snapshot_normalizer_version_ck" CHECK (length(btrim("registry_snapshot"."normalizer_version")) > 0),
	CONSTRAINT "registry_snapshot_manifest_sha256_ck" CHECK ("registry_snapshot"."manifest_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "registry_snapshot_manifest_shape_ck" CHECK ((
        jsonb_typeof("registry_snapshot"."manifest") = 'object'
        AND jsonb_typeof("registry_snapshot"."manifest"->'schemaVersion') = 'number'
        AND jsonb_typeof("registry_snapshot"."manifest"->'registryVersion') = 'string'
        AND jsonb_typeof("registry_snapshot"."manifest"->'normalizerVersion') = 'string'
        AND jsonb_typeof("registry_snapshot"."manifest"->'reviewedAt') = 'string'
        AND jsonb_typeof("registry_snapshot"."manifest"->'officialDomains') = 'array'
        AND jsonb_typeof("registry_snapshot"."manifest"->'systemFamilies') = 'array'
        AND jsonb_typeof("registry_snapshot"."manifest"->'editions') = 'array'
        AND jsonb_typeof("registry_snapshot"."manifest"->'books') = 'array'
        AND jsonb_typeof("registry_snapshot"."manifest"->'aliases') = 'array'
      ) IS TRUE),
	CONSTRAINT "registry_snapshot_manifest_identity_ck" CHECK ((
        ("registry_snapshot"."manifest"->>'schemaVersion')::integer = "registry_snapshot"."schema_version"
        AND "registry_snapshot"."manifest"->>'registryVersion' = "registry_snapshot"."registry_version"
        AND "registry_snapshot"."manifest"->>'normalizerVersion' = "registry_snapshot"."normalizer_version"
        AND "registry_snapshot"."manifest"->>'reviewedAt' = "registry_snapshot"."reviewed_at"::text
      ) IS TRUE)
);
--> statement-breakpoint
CREATE INDEX "registry_snapshot_reviewed_idx" ON "registry_snapshot" USING btree ("reviewed_at","registry_version");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.stage13_guard_registry_snapshot_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'registry_snapshot is append-only';
END;
$$;

--> statement-breakpoint
CREATE TRIGGER registry_snapshot_append_only
BEFORE UPDATE OR DELETE ON registry_snapshot
FOR EACH ROW EXECUTE FUNCTION public.stage13_guard_registry_snapshot_append_only();
