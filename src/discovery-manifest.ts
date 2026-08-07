import { createHash } from "node:crypto";

export const DISCOVERY_MANIFEST_SCHEMA_VERSION = 1 as const;
export const STAGE28_PARSER_VERSION = "stage28-pilot-v8" as const;
export const BOOTH_LISTING_URL =
  "https://booth.pm/ja/browse/TRPG?adult=none&type=digital" as const;
export const MAX_DISCOVERY_MANIFEST_ENTRIES = 100 as const;

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const PRODUCT_ID = /^[1-9][0-9]*$/;
const FORBIDDEN_EVIDENCE_KEYS = new Set([
  "anchor_text",
  "body",
  "body_bytes",
  "body_text",
  "creator",
  "description",
  "exact_price",
  "price",
  "response_body",
  "shop",
  "snippet",
  "title",
]);

export type DiscoveryManifestEntry = Readonly<{
  productId: string;
  canonicalUrl: string;
}>;

export type DiscoveryManifestSource = Readonly<{
  kind: "booth_listing_identity_only";
  sourceSha: string;
  parserVersion: typeof STAGE28_PARSER_VERSION;
  listingUrl: typeof BOOTH_LISTING_URL;
  listingRawSha256: string;
}>;

export type DiscoveryManifest = Readonly<{
  schemaVersion: typeof DISCOVERY_MANIFEST_SCHEMA_VERSION;
  source: DiscoveryManifestSource;
  entries: readonly DiscoveryManifestEntry[];
  fingerprint: string;
}>;

export type ProductDiscoveryRequest = Readonly<{
  productId: string;
  canonicalUrl: string;
  classificationState: "unclassified";
  ageState: "unknown";
  publicationEligible: false;
}>;

export class DiscoveryManifestError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "DiscoveryManifestError";
  }
}

function fail(reason: string): never {
  throw new DiscoveryManifestError(reason);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  reason: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    fail(reason);
  }
}

function canonicalProductUrl(productId: string): string {
  return `https://booth.pm/ja/items/${productId}`;
}

function normalizeEntries(value: unknown): readonly DiscoveryManifestEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail("manifest_entries_missing");
  }
  if (value.length > MAX_DISCOVERY_MANIFEST_ENTRIES) {
    fail("manifest_entry_limit_exceeded");
  }

  const seen = new Set<string>();
  const entries = value.map((item) => {
    if (!isRecord(item)) fail("invalid_manifest_entry");
    requireExactKeys(
      item,
      ["productId", "canonicalUrl"],
      "invalid_manifest_entry",
    );
    const productId = item.productId;
    const canonicalUrl = item.canonicalUrl;
    if (typeof productId !== "string" || !PRODUCT_ID.test(productId)) {
      fail("invalid_product_id");
    }
    if (
      typeof canonicalUrl !== "string" ||
      canonicalUrl !== canonicalProductUrl(productId)
    ) {
      fail("product_url_mismatch");
    }
    if (seen.has(productId)) fail("duplicate_product_id");
    seen.add(productId);
    return Object.freeze({ productId, canonicalUrl });
  });

  entries.sort((left, right) => {
    const a = BigInt(left.productId);
    const b = BigInt(right.productId);
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return Object.freeze(entries);
}

function normalizeSource(value: unknown): DiscoveryManifestSource {
  if (!isRecord(value)) fail("invalid_manifest_source");
  requireExactKeys(
    value,
    [
      "kind",
      "sourceSha",
      "parserVersion",
      "listingUrl",
      "listingRawSha256",
    ],
    "invalid_manifest_source",
  );
  if (value.kind !== "booth_listing_identity_only") {
    fail("invalid_manifest_source_kind");
  }
  if (typeof value.sourceSha !== "string" || !SHA40.test(value.sourceSha)) {
    fail("invalid_source_sha");
  }
  if (value.parserVersion !== STAGE28_PARSER_VERSION) {
    fail("invalid_parser_version");
  }
  if (value.listingUrl !== BOOTH_LISTING_URL) {
    fail("invalid_listing_url");
  }
  if (
    typeof value.listingRawSha256 !== "string" ||
    !SHA256.test(value.listingRawSha256)
  ) {
    fail("invalid_listing_raw_sha256");
  }
  return Object.freeze({
    kind: "booth_listing_identity_only" as const,
    sourceSha: value.sourceSha,
    parserVersion: STAGE28_PARSER_VERSION,
    listingUrl: BOOTH_LISTING_URL,
    listingRawSha256: value.listingRawSha256,
  });
}

function computeFingerprint(
  source: DiscoveryManifestSource,
  entries: readonly DiscoveryManifestEntry[],
): string {
  const payload = JSON.stringify({
    schemaVersion: DISCOVERY_MANIFEST_SCHEMA_VERSION,
    source,
    entries,
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function validateDiscoveryManifest(value: unknown): DiscoveryManifest {
  if (!isRecord(value)) fail("invalid_discovery_manifest");
  requireExactKeys(
    value,
    ["schemaVersion", "source", "entries", "fingerprint"],
    "invalid_discovery_manifest",
  );
  if (value.schemaVersion !== DISCOVERY_MANIFEST_SCHEMA_VERSION) {
    fail("unsupported_manifest_schema");
  }
  const source = normalizeSource(value.source);
  const entries = normalizeEntries(value.entries);
  if (typeof value.fingerprint !== "string" || !SHA256.test(value.fingerprint)) {
    fail("invalid_manifest_fingerprint");
  }
  const fingerprint = computeFingerprint(source, entries);
  if (value.fingerprint !== fingerprint) fail("manifest_fingerprint_mismatch");

  return Object.freeze({
    schemaVersion: DISCOVERY_MANIFEST_SCHEMA_VERSION,
    source,
    entries,
    fingerprint,
  });
}

export function createDiscoveryManifest(input: {
  sourceSha: string;
  listingRawSha256: string;
  entries: readonly { productId: string; canonicalUrl: string }[];
}): DiscoveryManifest {
  const source = normalizeSource({
    kind: "booth_listing_identity_only",
    sourceSha: input.sourceSha,
    parserVersion: STAGE28_PARSER_VERSION,
    listingUrl: BOOTH_LISTING_URL,
    listingRawSha256: input.listingRawSha256,
  });
  const entries = normalizeEntries(input.entries);
  return validateDiscoveryManifest({
    schemaVersion: DISCOVERY_MANIFEST_SCHEMA_VERSION,
    source,
    entries,
    fingerprint: computeFingerprint(source, entries),
  });
}

function rejectForbiddenEvidenceKeys(value: unknown, seen = new WeakSet<object>()): void {
  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => rejectForbiddenEvidenceKeys(item, seen));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_EVIDENCE_KEYS.has(key.toLowerCase())) {
      fail("forbidden_listing_evidence_field");
    }
    rejectForbiddenEvidenceKeys(child, seen);
  }
}

function requireNonNegativeInteger(value: unknown, reason: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail(reason);
  }
  return value;
}

export function createDiscoveryManifestFromStage28Evidence(input: {
  sourceSha: string;
  evidence: unknown;
}): DiscoveryManifest {
  const { evidence } = input;
  rejectForbiddenEvidenceKeys(evidence);
  if (!isRecord(evidence)) fail("invalid_stage28_evidence");
  if (evidence.parser_version !== STAGE28_PARSER_VERSION) {
    fail("invalid_parser_version");
  }
  if (
    evidence.mode !== "network" ||
    evidence.stop_state !== "complete" ||
    evidence.stop_reason !== null ||
    evidence.forbidden_data_persisted !== false ||
    evidence.listing_requests !== 1
  ) {
    fail("stage28_listing_not_successful");
  }
  if (!Array.isArray(evidence.listing_records) || evidence.listing_records.length !== 1) {
    fail("invalid_stage28_listing_records");
  }

  const record = evidence.listing_records[0];
  if (!isRecord(record)) fail("invalid_stage28_listing_record");
  requireExactKeys(
    record,
    [
      "sequence",
      "url",
      "final_url",
      "status",
      "content_type",
      "elapsed_ms",
      "request_attempts",
      "redirect_count",
      "evidence",
      "candidate_count",
      "discovery_candidates",
      "checked_at",
    ],
    "invalid_stage28_listing_record",
  );
  if (
    record.sequence !== 1 ||
    record.url !== BOOTH_LISTING_URL ||
    record.final_url !== BOOTH_LISTING_URL ||
    record.status !== 200 ||
    typeof record.content_type !== "string" ||
    record.content_type.split(";", 1)[0]?.trim().toLowerCase() !== "text/html" ||
    record.request_attempts !== 1 ||
    record.redirect_count !== 0 ||
    typeof record.checked_at !== "string" ||
    record.checked_at.length === 0 ||
    record.checked_at.length > 64
  ) {
    fail("invalid_stage28_listing_record");
  }
  requireNonNegativeInteger(record.elapsed_ms, "invalid_stage28_listing_record");

  if (!isRecord(record.evidence)) fail("invalid_stage28_hash_evidence");
  requireExactKeys(
    record.evidence,
    ["byte_length", "raw_sha256", "normalized_version", "normalized_sha256"],
    "invalid_stage28_hash_evidence",
  );
  requireNonNegativeInteger(record.evidence.byte_length, "invalid_stage28_hash_evidence");
  if (
    typeof record.evidence.raw_sha256 !== "string" ||
    !SHA256.test(record.evidence.raw_sha256) ||
    record.evidence.normalized_version !== "booth-text-v1" ||
    typeof record.evidence.normalized_sha256 !== "string" ||
    !SHA256.test(record.evidence.normalized_sha256)
  ) {
    fail("invalid_stage28_hash_evidence");
  }

  if (!Array.isArray(record.discovery_candidates)) {
    fail("invalid_stage28_discovery_candidates");
  }
  if (record.candidate_count !== record.discovery_candidates.length) {
    fail("stage28_candidate_count_mismatch");
  }

  return createDiscoveryManifest({
    sourceSha: input.sourceSha,
    listingRawSha256: record.evidence.raw_sha256,
    entries: record.discovery_candidates as readonly {
      productId: string;
      canonicalUrl: string;
    }[],
  });
}

export function toProductDiscoveryRequests(
  manifest: unknown,
): readonly ProductDiscoveryRequest[] {
  const validated = validateDiscoveryManifest(manifest);
  return Object.freeze(
    validated.entries.map((entry) =>
      Object.freeze({
        productId: entry.productId,
        canonicalUrl: entry.canonicalUrl,
        classificationState: "unclassified" as const,
        ageState: "unknown" as const,
        publicationEligible: false as const,
      }),
    ),
  );
}
