import { describe, expect, it } from "vitest";

import {
  BOOTH_LISTING_URL,
  DISCOVERY_MANIFEST_SCHEMA_VERSION,
  DiscoveryManifestError,
  STAGE28_PARSER_VERSION,
  createDiscoveryManifest,
  createDiscoveryManifestFromStage28Evidence,
  toProductDiscoveryRequests,
  validateDiscoveryManifest,
} from "./discovery-manifest";

const SOURCE_SHA = "8".repeat(40);
const RAW_SHA = "a".repeat(64);
const NORMALIZED_SHA = "b".repeat(64);

function stage28Evidence() {
  return {
    schema_version: 2,
    parser_version: STAGE28_PARSER_VERSION,
    normalization_version: "booth-mixed-v2",
    mode: "network",
    preflight: [],
    preflight_fetches: 3,
    preflight_attempted_urls: [],
    endpoint_decisions: [],
    policy_digest: "c".repeat(64),
    policy_review: {
      decision: "approved_semantic_digest",
      approval_digest_supplied: true,
      approval_digest_matches_current: true,
    },
    listing_requests: 1,
    listing_records: [
      {
        sequence: 1,
        url: BOOTH_LISTING_URL,
        final_url: BOOTH_LISTING_URL,
        status: 200,
        content_type: "text/html; charset=utf-8",
        elapsed_ms: 12,
        request_attempts: 1,
        redirect_count: 0,
        evidence: {
          byte_length: 500,
          raw_sha256: RAW_SHA,
          normalized_version: "booth-text-v1",
          normalized_sha256: NORMALIZED_SHA,
        },
        candidate_count: 2,
        discovery_candidates: [
          {
            product_id: "20",
            canonical_url: "https://booth.pm/ja/items/20",
          },
          {
            product_id: "3",
            canonical_url: "https://booth.pm/ja/items/3",
          },
        ],
        checked_at: "2026-08-07T12:00:00Z",
      },
    ],
    status_distribution: { "200": 1 },
    request_ceiling: 1,
    delay_policy: {},
    transport_limits: {},
    single_concurrency: true,
    stop_state: "complete",
    stop_reason: null,
    stop_observation: null,
    forbidden_data_persisted: false,
  };
}

describe("Stage 29 discovery manifest", () => {
  it("creates a deterministic identity-only manifest independent of candidate order", () => {
    const first = createDiscoveryManifest({
      sourceSha: SOURCE_SHA,
      listingRawSha256: RAW_SHA,
      entries: [
        { productId: "20", canonicalUrl: "https://booth.pm/ja/items/20" },
        { productId: "3", canonicalUrl: "https://booth.pm/ja/items/3" },
      ],
    });
    const second = createDiscoveryManifest({
      sourceSha: SOURCE_SHA,
      listingRawSha256: RAW_SHA,
      entries: [...first.entries].reverse(),
    });

    expect(first.schemaVersion).toBe(DISCOVERY_MANIFEST_SCHEMA_VERSION);
    expect(first.entries.map((entry) => entry.productId)).toEqual(["3", "20"]);
    expect(first.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.source)).toBe(true);
    expect(Object.isFrozen(first.entries)).toBe(true);
    expect(first.entries.every(Object.isFrozen)).toBe(true);
  });

  it("converts a successful Stage 28 record without copying listing text or commercial fields", () => {
    const evidence = stage28Evidence();
    const manifest = createDiscoveryManifestFromStage28Evidence({
      sourceSha: SOURCE_SHA,
      evidence,
    });

    expect(manifest.entries).toEqual([
      { productId: "3", canonicalUrl: "https://booth.pm/ja/items/3" },
      { productId: "20", canonicalUrl: "https://booth.pm/ja/items/20" },
    ]);
    expect(manifest.source.listingRawSha256).toBe(RAW_SHA);
    expect(JSON.stringify(manifest)).not.toContain("checked_at");
    expect(JSON.stringify(manifest)).not.toContain("elapsed_ms");
  });

  it("rejects stopped Stage 28 evidence and any forbidden descriptive field", () => {
    const stopped: Record<string, unknown> = stage28Evidence();
    stopped.stop_state = "stopped";
    stopped.stop_reason = "challenge_or_login_gate";
    stopped.listing_records = [];
    expect(() =>
      createDiscoveryManifestFromStage28Evidence({
        sourceSha: SOURCE_SHA,
        evidence: stopped,
      }),
    ).toThrowError("stage28_listing_not_successful");

    const polluted = stage28Evidence() as ReturnType<typeof stage28Evidence> & {
      title?: string;
    };
    polluted.title = "must never enter the manifest";
    expect(() =>
      createDiscoveryManifestFromStage28Evidence({
        sourceSha: SOURCE_SHA,
        evidence: polluted,
      }),
    ).toThrowError("forbidden_listing_evidence_field");
  });

  it("fails closed on duplicate IDs, URL mismatches, unknown fields, and false fingerprints", () => {
    expect(() =>
      createDiscoveryManifest({
        sourceSha: SOURCE_SHA,
        listingRawSha256: RAW_SHA,
        entries: [
          { productId: "3", canonicalUrl: "https://booth.pm/ja/items/3" },
          { productId: "3", canonicalUrl: "https://booth.pm/ja/items/3" },
        ],
      }),
    ).toThrowError("duplicate_product_id");

    expect(() =>
      createDiscoveryManifest({
        sourceSha: SOURCE_SHA,
        listingRawSha256: RAW_SHA,
        entries: [
          { productId: "3", canonicalUrl: "https://booth.pm/ja/items/4" },
        ],
      }),
    ).toThrowError("product_url_mismatch");

    const valid = createDiscoveryManifest({
      sourceSha: SOURCE_SHA,
      listingRawSha256: RAW_SHA,
      entries: [
        { productId: "3", canonicalUrl: "https://booth.pm/ja/items/3" },
      ],
    });
    expect(() =>
      validateDiscoveryManifest({ ...valid, title: "forbidden" }),
    ).toThrowError("invalid_discovery_manifest");
    expect(() =>
      validateDiscoveryManifest({ ...valid, fingerprint: "0".repeat(64) }),
    ).toThrowError("manifest_fingerprint_mismatch");
  });

  it("adapts validated identities into explicitly unclassified, unpublished requests", () => {
    const manifest = createDiscoveryManifest({
      sourceSha: SOURCE_SHA,
      listingRawSha256: RAW_SHA,
      entries: [
        { productId: "7", canonicalUrl: "https://booth.pm/ja/items/7" },
      ],
    });
    const requests = toProductDiscoveryRequests(manifest);

    expect(requests).toEqual([
      {
        productId: "7",
        canonicalUrl: "https://booth.pm/ja/items/7",
        classificationState: "unclassified",
        ageState: "unknown",
        publicationEligible: false,
      },
    ]);
    expect(Object.isFrozen(requests)).toBe(true);
    expect(Object.isFrozen(requests[0])).toBe(true);
  });

  it("returns detached validated data and does not mutate caller-owned entries", () => {
    const entry = {
      productId: "9",
      canonicalUrl: "https://booth.pm/ja/items/9",
    };
    const manifest = createDiscoveryManifest({
      sourceSha: SOURCE_SHA,
      listingRawSha256: RAW_SHA,
      entries: [entry],
    });

    expect(manifest.entries[0]).not.toBe(entry);
    expect(entry).toEqual({
      productId: "9",
      canonicalUrl: "https://booth.pm/ja/items/9",
    });
    expect(() =>
      validateDiscoveryManifest({
        ...manifest,
        source: { ...manifest.source, parserVersion: "future-parser" },
      }),
    ).toThrow(DiscoveryManifestError);
  });
});
