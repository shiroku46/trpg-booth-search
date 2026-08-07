# Roadmap

## Status

Sequential one-Issue-at-a-time MVP roadmap. Each stage is a single bounded delivery unit. A stage does not begin until the previous stage is merged to `main` with its exact-head gates complete.

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [DECISIONS.md](DECISIONS.md) | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) | [ARCHITECTURE.md](ARCHITECTURE.md) | [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md)

---

## Stage 0 — Documentation and Planning

**Goal**: Establish product-planning source of truth before research or implementation begins.

**Deliverables**:
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/DECISIONS.md`
- `docs/ROADMAP.md`
- `docs/DATA_COLLECTION_POLICY.md`
- `docs/LEGAL_AND_COMPLIANCE.md`
- `docs/ARCHITECTURE.md`

**Status**: Complete (Issue #10 merged).

---

## Stage 1 — BOOTH Collection Entry and Product-Classification Research

**Goal**: Research BOOTH access patterns, terms, robots.txt, and product classification. No production collection or full crawl is authorized at any point in this stage.

### Stage 1a — Documentation Research

**Status**: Complete (Issue #15, 2026-08-01).

**Deliverables**:
- `docs/BOOTH_COLLECTION_RESEARCH.md`
- accepted discovery, classification, all-ages, provenance, and conservative pilot decisions in `docs/DECISIONS.md`;
- aligned collection, legal, and roadmap documentation.

**Findings summary**:
- Public discovery entry points identified: keyword search, category browse, tag filter, new-item listing, and canonical product page.
- Product classification model validated with rules-first handling and explicit hold states.
- Conservative 20-request pilot cadence is a project limit, not an official BOOTH allowance.

### Stage 1b — Collection Preflight: robots.txt Before Pilot; Full Terms Before Production

**Status**: Bounded preflight and one-listing pilot completed on 2026-08-07 (Issues #125/#126); live collection remains stopped at the observed `challenge_or_login_gate`.

**Pilot prerequisite**: Direct robots.txt preflight is a hard prerequisite before any listing or detail collection run. Record body, retrieval time, response status, content hash, and applicable directives. If robots.txt is unavailable or restrictive for an intended endpoint, that endpoint/run remains disabled.

**Production prerequisite**: Direct review of the full current BOOTH master terms and individual terms at `policies.pixiv.net` is required before production collection. Full-terms review is not a prerequisite for documentation-only design work or, by itself, for a bounded low-load pilot after the robots.txt preflight and all endpoint/run stop conditions are clear.

**Scope**:
- robots.txt evidence only;
- direct terms-review evidence only;
- no listing/detail collection in this preflight Issue.

### Stage 1c — BOOTH Collection Policy Correction

**Status**: Complete (Issue #19, 2026-08-01).

**Outcome**: Low-load analysis of public BOOTH product information is permitted in principle under the recorded official guideline, subject to endpoint/run-level fail-closed safeguards. This authorizes planning and a later bounded pilot, not production crawling.

---

## Stage 2 — System/Edition Normalization Specification

**Goal**: Define the product-wide normalization contract for systems, editions, aliases, compatibility, books, supplements, provenance, and registry governance.

**Status**: Complete (Issue #17, 2026-08-01).

**Deliverables**:
- `docs/SYSTEM_NORMALIZATION.md`;
- decisions D-014 through D-020;
- explicit pending registry-seed research PD-007.

**Accepted boundaries**:
- separate system-family and edition entities;
- verbatim alias preservation with reviewed canonical mapping;
- fail-closed edition inference;
- controlled compatibility vocabulary;
- separate book identity and scenario-scoped requirements;
- versioned reviewed registry beginning empty;
- rules-first extraction with AI candidates only for unresolved fields.

---

## Stage 3 — BOOTH-Product / Individual-Scenario Data Model

**Goal**: Define the technology-neutral two-layer logical model incorporating Stage 1 classification and Stage 2 normalization.

**Status**: Complete. Issue #21 / PR #22 merged to `main` as `4932f54655b2c48a5de66fb67f92738ccb23c6fa`.

**Deliverables**:
- `docs/DATA_MODEL.md` with entity/cardinality/invariant contracts;
- explicit `EvidencedValue<T>` states;
- deterministic `searchable_scenario` publication projection;
- append-only permitted history plus the binding age-uncertainty erasure exception;
- decisions D-022 through D-026.

**Deferred from Stage 3**:
- provider-specific encoding and indexes;
- exact ORM/database/provider versions;
- executable migrations, provisioning, deployment, authentication, billing, and live BOOTH access.

---

## Stage 4 — Architecture and Technology Decision

**Goal**: Translate Stage 3 into accepted provider-neutral application boundaries, an implementation-ready non-executable physical schema, and a dated technology/provider/cost ADR before implementation begins.

**Status**: Exact-head review began on candidate `10fc0a862e9719370503bda3e10edae892347bd2`. Any head movement invalidates that candidate's CI, Unit Tests, and review evidence. Stage 4 is complete only when the final GitHub-visible immutable head recorded in PR #64 has matching successful CI and Unit Tests, clean independent exact-head Codex review, every review thread resolved, and is merged using that same value as `expected_head_sha`; evidence from `10fc0a862e9719370503bda3e10edae892347bd2` or any earlier head cannot satisfy a later head.

**Merged foundations**:
- Stage 3 logical model: `4932f54655b2c48a5de66fb67f92738ccb23c6fa`.
- PR #44 physical schema: `1a0cd2c7f195ba51b49bb75ef3d88091f93356f4`.
- PR #59 final physical-schema publication/handoff corrections: `13e2b097a6f72c9fa652c78995008f9dd20710ff`.

**Final Stage 4 deliverables**:
- `docs/PHYSICAL_SCHEMA.md` — every Stage 3 entity/invariant, JSONB evidence envelopes, indexes, publication projection, histories, tombstones, and restricted purge operation;
- `docs/ARCHITECTURE.md` — accepted provider-neutral boundaries, dated official-source technology/provider/cost ADR, cost controls, observability, migration/rollback/backup, and erasure boundaries;
- `docs/DECISIONS.md` — accepted Stage 4 decisions and remaining explicit provisioning/research gates;
- `docs/ROADMAP.md` — exact merge lineage and bounded Stage 5 handoff.

**Accepted Stage 4 results**:
- Node.js v24 LTS; EOL v20 prohibited.
- Stable Next.js 16.x, TypeScript 7.x, Drizzle ORM/Kit, and exact compatible versions pinned only at scaffold time.
- PostgreSQL 17 physical target, subject to managed-provider support verification before provisioning.
- Supabase Free is the bounded managed-database candidate; no project is created, no PITR claim is made, and backup readiness remains a separate gate.
- GitHub Actions on the public repository is expected to cost ¥0, with explicit budget-stop requirements if repository visibility or usage changes.
- Vercel Hobby is a conditional candidate only after owner confirmation of non-commercial eligibility; no deployment is authorized.
- Selected baseline expected cost is ¥0/month; all paid transitions are manual and require a separate owner-authorized Issue.
- `searchable_scenario` is the sole provider-neutral public gate.
- Ordinary permitted history is append-only; `hold_age_unknown` permits only the narrow product-FK-scoped irreversible purge of prohibited payload and hashes, retaining a non-reconstructable tombstone.

**Remaining gates that do not reopen Stage 4 architecture**:
- PD-002 collection mechanism and Stage 1b robots/terms evidence before network collection.
- PD-004 AI provider/model before AI-assisted extraction.
- PD-007 reviewed registry seed facts.
- PD-009 precise non-exact free-first evidence contract if not fully resolved by the physical schema implementation.
- PD-010 tested backup/recovery mechanism before production persistence.
- provider/version/eligibility checks at the exact later provisioning or deployment point.

---

## Stage 5 — Minimal Fixture-Backed Application Scaffold

**Goal**: Implement the approved Stage 4 boundaries as a minimal fixture-backed Next.js/TypeScript application with deterministic quality gates. Stage 5 does not redesign architecture and does not provision external services.

**Status**: Next stage after Stage 4’s final synchronization merge and closure of Issue #39.

**Required scope**:
- pin Node.js v24 LTS and compatible stable Next.js 16.x/TypeScript versions in a reviewed lockfile;
- minimal application scaffold with lint, formatting, type-check, build, and unit-test gates;
- fixed all-ages fixtures covering publishable, unknown, held, conflicting, ended, and relationship-row omission cases;
- provider-neutral domain/value types and repository ports derived from `DATA_MODEL.md` and `PHYSICAL_SCHEMA.md`;
- in-memory fixture repository and server-rendered search page;
- publication-gate enforcement before rendering/filtering;
- basic confirmed search/filter/sort interactions and deterministic seeded-random boundary;
- tests proving no exact price, adult/uncertain payload, unresolved relationship, or held scenario is publicly exposed.

**Explicit exclusions**:
- no Supabase, PostgreSQL, or Vercel project/resource creation;
- no executable SQL migration or live database connection;
- no live BOOTH, robots.txt, terms, collector, browser, or HTTP request;
- no authentication, account, billing, Secret, paid plan, deployment, production data, or canonical registry population;
- no backup/PITR/readiness claim;
- no weakening or redesign of Stage 4 boundaries.

**Completion gate**:
- GitHub-visible exact remote SHA;
- exact allowed paths and dependency review;
- native CI, Unit Tests, lint, type-check, and build success;
- independent exact-head Codex review with no blocking finding;
- all threads resolved;
- expected-head protected merge and `main` verification.

---

## Later Candidate Stages

Each is a separate Issue and begins only after its predecessor is complete.

| Candidate | Description |
|---|---|
| Faceted search expansion | System, PL, play time, tag, book, and compatibility filters over fixtures |
| Seeded random display | Implement and test stable seeded-random ordering |
| Sales-state handling | Ended-product exclusion while retaining permitted internal history |
| Collection preflight/pilot | Complete Stage 1b and run the separately authorized bounded pilot |
| Content-version tracking | Implement source/content/normalizer/registry version reanalysis rules |
| Confidence and hold workflows | Review and approval workflow for derived candidates |
| Database provisioning | Provision only after provider, cost, migration, and PD-010 recovery gates are satisfied |
| End-to-end acceptance | Golden-path search/navigation and publication-safety tests |
| Accessibility | Keyboard, mobile, semantic, and WCAG audit/fixes |
| Retro archive-room design | Apply the accepted distinct visual direction without weakening usability |

---

## Out of Scope for MVP

- User accounts, login, favorites, or per-user state
- Rating and recommendation sorting
- Author submission portal
- Multi-platform sources
- Internationalization
- R-18/R-18G or age-uncertain content
- Advertising or affiliate integration
- Internal purchase, payment, download, or product-detail flows

## Stage 9 repository delivery — 2026-08-05

Stage 9 implements the reviewed local PostgreSQL persistence and recovery gate under Issue #85.

Completed repository evidence:

- exact pinned Drizzle/PGlite dependency graph and committed lockfile;
- executable generated PostgreSQL migration and schema constraints;
- provider-neutral product/scenario repository round trip;
- product-owned snapshot/history provenance;
- append-only history enforcement with one restricted purge transaction;
- logical dump/restore before and after `hold_age_unknown` purge;
- proof that purge-safe recovery cannot reconstruct unique cleared payloads/hashes and cannot mutate another product;
- production dependency audit at zero findings and full graph with no high/critical findings;
- complete Node, build, repository, and Python gates.

Hosted Supabase provisioning remains deferred. No project, Secret, remote migration, billing, authentication, or deployment is created.

## Stage 10 and Design B repository delivery — 2026-08-05

Stage 10 and the subsequently approved personal-homepage Design B were completed through Issues #83 and #98 and PR #100. The repository now has keyboard and mobile E2E coverage, fixture-only security checks, reduced-motion behavior, visual baselines, and the approved early-2000s Japanese personal-homepage UI without external runtime assets.

## Stage 11 repository delivery — 2026-08-06

Issue #101 resolves the non-exact Free-first evidence contract and implements fail-closed ordering over the existing `is_free` evidence envelope. It may change order only: exact price remains prohibited, unknown/hold/missing evidence is never treated as paid or false, persistence preserves each state, and all existing publication and Design B boundaries remain binding. No provider, BOOTH request, Secret, deployment, billing, schema migration, or human action is required.

## Stage 12 repository delivery — 2026-08-06

Issue #105 resolves the initial-registry decision with `registry-2026-08-06.1`: four system families, four editions, eight books, and twenty-three approved aliases backed by bounded first-party identity evidence. The repository now has deterministic comparison-key normalization, target-aware resolution, reference/domain validation, and fail-closed ambiguity/collision states.

The fixture Preview remains synthetic and unchanged. Stage 12 creates no BOOTH request, production seed, schema migration, hosted resource, provider, Secret, exact-price field, popularity/rating/recommendation signal, or public registry filter. Collection and integration remain later separately authorized stages.

## Stage 13 repository delivery — 2026-08-06

Issue #107 adds immutable local persistence for the reviewed registry as a versioned, SHA-256-verified JSONB snapshot. Fresh migrations, idempotent installation, conflict rejection, append-only database enforcement, fail-closed loading, and dump/restore are proven with PGlite.

Stage 13 intentionally does not create relational canonical tables or select a UUID/text-ID mapping. It does not seed a hosted database or change the synthetic fixture Preview. Those boundaries remain separately reviewed later work.

## Stage 14 repository delivery — 2026-08-06

Issue #109 implements deterministic content-version tracking over the accepted content/normalizer/registry three-tuple. Existing analysis rows remain compatible as initial records, while new reanalysis transitions retain complete old/new version keys and JSON results with controlled triggers and append-only enforcement.

The implementation remains provider-neutral and local. It does not perform BOOTH access, AI inference, hosted scheduling, or public-history display. Confidence/hold workflow UX and external collection remain later work.


## Stage 15 repository delivery — 2026-08-06

Issue #111 adds a metadata-only, immutable local review-case and decision foundation. Cases are deduplicated by exact field/version identity, prioritized deterministically, and closed by one append-only controlled decision. Values and source payloads are not copied into the queue.

Issue #114 restores the schema, generated migration, metadata, documentation, timestamp-normalized idempotence, and complete validation that the original Stage 15 transport failed to publish before PR #112 was merged.

Stage 15 does not provide an operator UI or apply decisions back into source entities. External collection, AI inference, hosted authentication, and public review display remain later work.


## Stage 16 repository delivery — 2026-08-06

Issue #113 adds an immutable, auditable decision-application boundary. Exactly one metadata-only application event binds a Stage 15 case and decision to the exact product/entity/field and content/normalizer/registry version identity. Approved, rejected, and needs-more-evidence outcomes are derived deterministically; only safe exact-version approval enters the effective approval projection.

Database triggers enforce ownership, cross-record identity, outcome derivation, safe approval, timestamp order, and append-only behavior. Unapplied, stale, mismatched, rejected, held, conflicted, low-confidence, evidence-empty, or malformed states remain omitted. Existing Design B, fixtures, public search/publication, hosted-resource, and external-network boundaries remain unchanged.


## Stage 17 repository delivery — 2026-08-06

Issue #117 adds a read-only reviewed field overlay that binds the original evidenced value to the exact Stage 15 case metadata and Stage 16 application projection. Only `reviewState` changes in a deeply detached graph; every persisted source and review record remains unchanged.

The provider-neutral service allowlists fixed product/scenario fields and stable tag categories, rejects unstable array-row paths, verifies the complete metadata fingerprint and version key, and feeds the unchanged publication projection. Approved exact matches may become effective; rejected, needs-more-evidence, unapplied, stale, mismatched, malformed, and metadata-divergent states remain fail-closed.

## Stage 18 — Deterministic multi-field reviewed overlays

- [x] Canonically order explicit exact review targets independent of caller order.
- [x] Reject cross-product batches and duplicate exact identities.
- [x] Sequentially compose Stage 17 overlays without mutating source graphs or review records.
- [x] Return immutable per-target materialized or bounded omitted reports.
- [x] Resolve exact persisted cases and applications while preserving missing targets as `unapplied`.
- [x] Keep unstable array-row identities unsupported and fail closed.
- [x] Cover deterministic ordering, mixed outcomes, omission reasons, storage immutability, and publication projection.

## Stage 19 — Deterministic reviewed publication index

- [x] Compose explicit Stage 18 product graphs into one canonical public scenario index.
- [x] Preserve per-product Stage 18 target reports and per-scenario publication outcomes.
- [x] Keep missing, malformed, and mismatched product requests explicit.
- [x] Resolve only explicit `{ productId, targets }` persistence requests.
- [x] Reuse existing filters and sort orders over already-projected public rows.
- [x] Prove caller-order independence, storage immutability, and fail-closed publication behavior.

## Stage 20 — Deterministic reviewed search orchestration

- [x] Normalize one canonical query without changing existing search semantics.
- [x] Execute only over Stage 19 reviewed public rows.
- [x] Preserve the complete immutable publication/review report beside search results.
- [x] Compose persistence-backed explicit product requests with reviewed search.
- [x] Prove search parity, seeded-random determinism, request-order independence, and storage immutability.

## Stage 23 — Fixture Preview through reviewed search

- [x] Group explicit fixture scenarios by product and create empty-target Stage 18 reviewed graphs.
- [x] Compose the Stage 19 publication index and execute Stage 20 reviewed search.
- [x] Route the visible fixture Preview through the reviewed adapter instead of direct legacy fixture search.
- [x] Preserve exact existing filter/sort behavior including seeded random and explicit unknown states.
- [x] Preserve complete immutable publication reports and source-fixture non-mutation.
- [x] Keep live BOOTH access stopped at the challenge/login boundary.

## Stage 24 — Application reviewed-search source port

- [x] Define one async application-facing reviewed-search source contract.
- [x] Implement the contract for the synthetic fixture Preview.
- [x] Implement a PostgreSQL adapter bound to explicit immutable product/target requests.
- [x] Route the page through the source contract while retaining the fixture source as default.
- [x] Prove defensive request detachment, deterministic product ordering, storage non-mutation, and immutable results.
- [x] Keep provider selection, hosted persistence, and BOOTH access outside this stage.

## Stage 26 — Non-sensitive stopped-response diagnostics

- [x] Preserve the Stage 22 challenge/login stop as a fail-closed boundary.
- [x] Add stable challenge/login/adult marker IDs without changing marker semantics.
- [x] Retain only bounded hashes/transport metadata for rejected listing responses.
- [x] Keep rejected pages out of listing records and prohibit payload/snippet/header persistence.
- [x] Cover diagnostic behavior entirely offline with deterministic regression tests.
- [x] Invalidate earlier policy digests through the parser-version change so future network access still requires explicit review.

## Stage 27 — Strict stopped-response evidence schema

- [x] Treat generic exception details as untrusted for durable evidence.
- [x] Allowlist the exact diagnostic keys and fixed listing URL.
- [x] Validate transport, hash, normalization, and marker invariants.
- [x] Revalidate diagnostics at construction, propagation, and serialization boundaries.
- [x] Reject arbitrary or malformed details entirely offline.

## Stage 28 — Minimal listing discovery candidate extraction

- [x] Parse only anchor hrefs from an already-successful listing response.
- [x] Retain only positive numeric BOOTH product IDs and canonical product URLs.
- [x] Deduplicate and sort candidates deterministically independent of link order.
- [x] Fail closed on zero candidates or more than 100 unique candidates.
- [x] Keep challenge/login/adult classification ahead of discovery extraction.
- [x] Prove entirely offline that no titles, prices, snippets, or response text enter candidate evidence.

## Stage 30 — Immutable local discovery-manifest persistence

- [x] Persist validated Stage 29 manifests by exact fingerprint only.
- [x] Enforce source/parser/listing/hash identity at database and repository boundaries.
- [x] Make identical reinstall idempotent and block update/delete.
- [x] Return detached immutable manifests after full validation.
- [x] Prove product, scenario, review, and publication state are not promoted by installation.
- [x] Prove dump/restore compatibility entirely offline.

## Stage 31 — Blocked persisted discovery intake

- [x] Load exactly one explicitly supplied persisted manifest fingerprint.
- [x] Compose identity-only entries into immutable internal intake reports.
- [x] Keep detail access unauthorized, classification unknown, age unknown, and publication disabled.
- [x] Return explicit missing-manifest state without implicit latest selection.
- [x] Prove storage/product/scenario/review non-mutation entirely offline.

## Stage 32 — Post-CAPTCHA collection-mechanism reassessment

- [x] Record the exact one-request CAPTCHA stop as an operational access boundary.
- [x] Separate current policy compatibility in principle from runtime accessibility.
- [x] Disable the tested GitHub-hosted listing path rather than retry or bypass it.
- [x] Restrict later research to documented/public first-party interfaces, owner-supplied offline identities, or separately authorized bounded public-web environments.
- [x] Reject hidden/private endpoint probing, search-index substitution, CAPTCHA solving, stealth, proxy/identity rotation, login/session reuse, and other circumvention fallbacks.
- [x] Update PD-002: production collection mechanism remains unresolved and requires a new owner-authorized network Issue.

## Stage 33 — Main-only automatic Vercel deployments

- [x] Keep automatic Vercel Git deployment enabled for `main`.
- [x] Disable automatic deployment for every non-main branch, including slash-separated autonomous branches via minimatch globstar.
- [x] Preserve all existing preview security headers.
- [x] Add deterministic tests for the branch rules and header invariants.
- [x] Retain manual Git-reference deployment as the explicit visual-checkpoint escape hatch.
- [x] Add no token, deploy hook, paid plan, provider mutation, or application behavior change.

