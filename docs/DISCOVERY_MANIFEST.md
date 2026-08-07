# Identity-only discovery manifest

## Status

Stage 29 defines an offline-only handoff from the Stage 28 BOOTH listing candidate shape into later product-analysis work. It does not authorize a BOOTH retry, product-detail request, classification, age decision, publication, hosted persistence, deployment, or UI change.

The current live collection boundary remains the owner-authorized run `31177408337`, which made exactly one fixed all-ages listing request and stopped on `challenge_or_login_gate` with the stable marker `captcha`. No listing record or product candidate was produced by that run, and this document does not reinterpret that stop as successful collection.

## Manifest boundary

A manifest contains exactly:

- schema version `1`;
- fixed source kind `booth_listing_identity_only`;
- exact 40-hex source commit SHA;
- exact Stage 28 parser version `stage28-pilot-v8`;
- the fixed listing URL `https://booth.pm/ja/browse/TRPG?adult=none&type=digital`;
- the listing response raw SHA-256;
- one to 100 unique product identities, each containing only a positive decimal BOOTH product ID and the matching canonical `https://booth.pm/ja/items/<id>` URL;
- a SHA-256 fingerprint over the canonical schema/source/entry payload.

Entries are detached, immutable, deduplicated, and sorted numerically by product ID before fingerprinting. The validator rejects unknown manifest/source/entry fields, unsupported versions, malformed hashes, duplicate IDs, URL/ID mismatch, empty manifests, oversized manifests, and fingerprint mismatch.

## Stage 28 evidence conversion

A Stage 28 listing evidence object may produce a manifest only when the listing run is complete rather than stopped, exactly one listing request and one listing record exist, the record is HTTP 200 `text/html`, it used one attempt and zero redirects, and `forbidden_data_persisted` is false.

The adapter explicitly maps only Stage 28 `discovery_candidates` fields `{ product_id, canonical_url }` plus the listing raw SHA-256. It never copies checked timestamps, timing, preflight content, visible anchor text, product titles, descriptions, exact prices, creator/shop data, snippets, headers, response bodies, or other listing payload. Known descriptive/commercial field names cause fail-closed rejection if injected into the supplied evidence object.

## Downstream request boundary

A validated manifest can be transformed into provider-neutral product discovery requests containing only:

- product ID;
- canonical URL;
- `classificationState: "unclassified"`;
- `ageState: "unknown"`;
- `publicationEligible: false`.

These request objects deliberately are not `Product` domain entities. They carry no evidence that a product is all-ages, a TRPG scenario, available for publication, or safe to fetch. A later separately reviewed stage must establish those facts before any corresponding state can advance.

## Prohibited data and effects

Stage 29 stores or propagates no title, description, exact price/currency, image, creator/shop profile, anchor text, body/snippet, cookie, authorization/header data, adult/uncertain descriptive content, or downloaded file.

Stage 29 performs no BOOTH/pixiv request, CAPTCHA handling, retry, login/session, browser automation, proxy/identity rotation, endpoint expansion, product-detail fetch, AI inference, database/provider provisioning, Secret/billing change, deployment, analytics, or publication/UI change.
