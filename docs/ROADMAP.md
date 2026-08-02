# Roadmap

## Status

Sequential one-Issue-at-a-time MVP roadmap. Each stage is a single Issue. A stage does not begin until the previous stage is merged to `main`.

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

**Stage 1 has three parts**:

### Stage 1a — Documentation Research (Complete)

**Status**: Complete (Issue #15, 2026-08-01).

**Deliverables**:
- `docs/BOOTH_COLLECTION_RESEARCH.md` — dated evidence record of official guideline findings, public discovery entry points, all-ages boundary, product classification model, and conservative pilot cadence decisions.
- `docs/DECISIONS.md` — updated with D-009 through D-013 covering fail-closed robots/full-terms preflight, union discovery entry points, rules-first product classification, strict all-ages hold behaviour, and conservative pilot limits.
- `docs/DATA_COLLECTION_POLICY.md` — updated with discovered entry-point union, stop conditions, sales lifecycle handling, evidence schema, and numeric pilot limits.
- `docs/LEGAL_AND_COMPLIANCE.md` — updated with current guideline findings, full-terms/robots unresolved status, and explicit no-production statement.
- `docs/ROADMAP.md` — updated to mark Stage 1a complete.

**Findings summary**:
- Public discovery entry points identified: keyword search, category browse, tag filter, new-item listing, canonical product page.
- Guidelines conditional allowance recorded; full master and individual terms at `policies.pixiv.net` remain unverified.
- robots.txt retrieval failed; robots status remains unverified.
- Product classification model validated with 10 candidate classes and rules-first approach.
- Conservative 20-request pilot cadence decided as project limit, not official BOOTH allowance.

### Stage 1b — Collection Preflight: robots.txt Before Pilot; Full Terms Before Production

**Status**: Not started.

**Pilot prerequisite**: Direct robots.txt preflight is a hard prerequisite before any listing or detail collection run begins. The current body, retrieval time, response status, content hash, and applicable directives must be recorded. If robots.txt is unavailable or restrictive for an intended endpoint, that endpoint or run remains disabled.

**Production prerequisite**: Direct review of the full current BOOTH master terms and individual terms at `policies.pixiv.net` is required before production collection. Full-terms review is not a prerequisite for documentation-only design work or, by itself, for a bounded low-load pilot after the robots.txt preflight and all other endpoint/run-level stop conditions are clear.

**Scope**:
- Direct technical retrieval of current robots.txt: record body, retrieval time, response status, content hash, and applicable directives.
- Direct review of the full current BOOTH master terms and individual terms at `policies.pixiv.net`: record findings before production collection.
- Record the robots.txt preflight and terms-review findings distinctly so their different gates cannot be conflated.

**Constraints**:
- This stage authorizes only the robots.txt preflight and terms review. No product listing or detail request is made as part of this preflight Issue itself.
- Findings do not constitute legal approval — see [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md).
- The bounded 20-request pilot (D-013) may begin only after the robots.txt preflight is complete and recorded, and only when no concrete endpoint/run-level stop condition in D-021 applies.
- Production collection remains prohibited until the full current master and individual terms have been directly reviewed and recorded.

---

### Stage 1c — BOOTH Collection Policy Correction

**Goal**: Correct the overbroad collection-policy wording that treated all BOOTH network prototypes as prohibited until robots.txt and full terms were available. Align documentation with the official BOOTH guideline. No collector, scraper, HTTP client, or network request is made in this stage.

**Status**: Complete (Issue #19, 2026-08-01).

**Deliverables**:
- `docs/BOOTH_COLLECTION_RESEARCH.md` — blanket prohibition narrowed to endpoint/run-level fail-closed rule.
- `docs/DATA_COLLECTION_POLICY.md` — compliance and collection-approach sections updated.
- `docs/LEGAL_AND_COMPLIANCE.md` — permitted-in-principle standing confirmed under the official guideline; fail-closed boundary narrowed to endpoint/run level.
- `docs/DECISIONS.md` — D-021 added as superseding decision; D-009 marked as superseded in part.
- `docs/ROADMAP.md` — this entry added.

**Outcome**: Low-load collection of public BOOTH product information for search/information-analysis purposes is permitted in principle under the current official guideline (https://booth.pm/guidelines, https://booth.pm/announcements/898). Actual network collection implementation remains scheduled for its later dedicated prototype stage. This correction authorizes planning and bounded future execution, not immediate production crawling.

---

## Stage 2 — System/Edition Normalization Specification

**Goal**: Define the product-wide normalization contract for TRPG systems, editions, aliases, compatibility claims, rulebooks, supplements, and related entities before the data model or application code is designed.

**Status**: Complete (Issue #17, 2026-08-01).

**Deliverables**:
- `docs/SYSTEM_NORMALIZATION.md` — normalization specification covering entity boundaries, stable identifiers, alias normalization, edition handling, compatibility vocabulary, book/requirement model, rules-first extraction, provenance, registry governance, search/display contract, and Stage 3 handoff.
- `docs/DECISIONS.md` — updated with D-014 through D-020 and PD-007.
- `docs/ROADMAP.md` — updated to mark Stage 2 complete and identify the data model as the next stage.

**Summary of accepted decisions**:
- Separate `system_family` and `edition` entities (D-014).
- Verbatim alias preservation with approved canonical mapping (D-015).
- Fail-closed edition inference; `edition_unknown` as default (D-016).
- Controlled six-kind compatibility vocabulary (D-017).
- Separate book identity and scenario-scoped requirement relationships (D-018).
- Versioned, reviewed registry governance starting from an empty registry (D-019).
- Rules-first extraction with AI candidates only for ambiguous fields (D-020).

**Pending**: Which actual systems, editions, and books seed the first reviewed registry remains a pending decision (PD-007) requiring a future dedicated research Issue.

---

## Stage 3 — BOOTH-Product / Individual-Scenario Data Model

**Goal**: Define the two-layer logical data model for BOOTH products and individual scenarios, incorporating the normalization contract defined in Stage 2 and the product classification model from Stage 1.

**Status**: Complete (Issue #21, 2026-08-01).

**Deliverables**:
- `docs/DATA_MODEL.md` — technology-neutral logical schema defining entity boundaries, field names, logical types, cardinalities, uniqueness, required/optional status, invariant/check rules, the `EvidencedValue<T>` state contract, the `searchable_scenario` projection, and append-only history structures for `booth_product`, `scenario`, `product_component`, normalization entities, tags, provenance, and quality/hold reasons.
- `docs/DECISIONS.md` — updated with D-022 through D-026 (Stage 3 modelling decisions) and PD-008, PD-009 (pending items for Stage 4 and later).
- `docs/ROADMAP.md` — updated to mark Stage 3 complete and identify Stage 4 as the architecture/technology decision stage.

**Summary of accepted decisions**:
- Technology-neutral logical schema before provider-specific implementation (D-022).
- Explicit evidenced-value state envelope rather than null/default inference (D-023).
- Subordinate product components for source variants while retaining two public layers (D-024).
- Deterministic `searchable_scenario` projection as the sole public gate (D-025).
- Append-only source and derivation history (D-026).

**Pending carried forward**:
- Provider-specific SQL types, UUID implementation, indexing, ORM, database vendor, physical partitioning, and migration tooling remain explicitly pending for Stage 4 (PD-008).
- Free-first sort non-exact free/paid indicator definition remains pending for the architecture/collection stage (PD-009); exact price is permanently excluded.
- Collection implementation, database provisioning, deployment, authentication, billing, and live BOOTH access are out of Stage 3.

---

## Stage 4 — Architecture and Technology Decision

**Goal**: Translate the logical data model defined in Stage 3 into provider-neutral application boundaries (entities, repositories, service interfaces) and only then into a provider-specific physical schema. Confirm and record the technology stack, database provider, hosting platform, and cost structure before any implementation begins.

**Status**: Complete (Issue #39, 2026-08-02).

**Deliverables**:
- `docs/ARCHITECTURE.md` — updated with confirmed provider-neutral boundaries, technology stack, cost controls, fixture-first approach, and hold_age_unknown compliance exception.
- `docs/DECISIONS.md` — updated with D-027 through D-040 (technology and architecture decisions); PD-001, PD-003, PD-005, PD-008, PD-009 resolved.
- `docs/ROADMAP.md` — updated to mark Stage 4 complete and define Stage 5 handoff scope.
- `docs/PHYSICAL_SCHEMA.md` — created with complete non-executable physical schema specification for all Stage 3 entities, indexes, append-only invariants, and HoldAgeUnknownPurgeService contract.

**Summary of accepted decisions**:
- Technology stack: Next.js 16.x (MIT), TypeScript 7.0 (Apache-2.0), Node.js v24 LTS (D-027). EOL Node.js v20 prohibited.
- Hosting: Vercel Hobby, ¥0, non-commercial personal use restriction, manual upgrade only, deployment gate pending owner non-commercial confirmation (D-028).
- Database: PostgreSQL 17 via Supabase Free, ¥0, provisioning deferred to a later Issue (D-029).
- ORM: Drizzle ORM + Drizzle Kit, Apache-2.0 (not MIT; prior MIT claim withdrawn), exact versions pinned at scaffold time (D-030).
- CI: GitHub Actions, ¥0 for this public repository (D-031).
- Provider-neutral boundary layout defined before provider-specific schema (D-032).
- Fixture-first search scaffold for Stage 5; no live BOOTH access (D-033).
- `is_free: EvidencedValue<Boolean>` resolves PD-009; exact price permanently excluded (D-034).
- Index strategy for confirmed search/filter/sort inputs (D-035).
- Non-null three-part reanalysis key `(content_version, normalizer_version, registry_version)` (D-036).
- Seeded-random sort boundary: query-layer only, no stored state, deferred implementation (D-037).
- Rollback, migration, backup, observability, and erasure boundaries defined (D-038).
- HoldAgeUnknownPurgeService: narrow compliance exception to append-only rule (D-039).
- Stage 5 scaffold handoff scope bounded (D-040).

**Confirmed cost**: ¥0/month total — Vercel Hobby ¥0, Supabase Free ¥0, GitHub Actions (public repo) ¥0. No billing enabled; any paid transition requires a separate owner-authorized Issue.

**Prerequisites**:
- Stage 3 logical data model merged (completed).
- Stage 1b robots.txt preflight remains required before any listing/detail collection run; it is not a blocker for Stage 4 or Stage 5 architecture work.
- Stage 1b full-terms review remains required before production collection; it is not a blocker for Stage 4 or Stage 5 fixture-backed scaffold work.

**Remaining gates before provisioning**:
- Owner non-commercial confirmation (PD-011) required before Vercel deployment.
- Provisioning Issue (PD-010) required before database is created.

---

## Stage 5 — Minimal Fixture-Backed Application Scaffold

**Goal**: Create the minimal Next.js/TypeScript application scaffold with fixture-backed search. Validate the `searchable_scenario` projection gates and search interaction model before any live infrastructure is provisioned.

**Status**: Not started. This is the next product stage after Stage 4 merges.

**Prerequisites**:
- Stage 4 architecture and technology decisions merged.
- Stage 1b robots.txt preflight is not a blocker for this stage.
- Database provisioning (PD-010) is not required for this stage; fixtures are in-memory only.
- Vercel non-commercial confirmation (PD-011) is not required for this stage; no deployment is created.

**Scope (bounded by D-040)**:
- Next.js 16.x project scaffold with TypeScript 7.0 and Node.js v24 LTS.
- Static JSON fixture files representing a small curated set of scenario records (not production or canonical data; no actual BOOTH product information).
- Search UI backed by fixtures in memory only.
- Unit test infrastructure and CI integration (GitHub Actions).
- Verification that all `searchable_scenario` projection gates operate correctly against fixture data.
- Linting, formatting, and type-check CI.

**Explicitly excluded from Stage 5** (per D-040):
- Database provisioning or connection.
- Deployment to Vercel or any host.
- Authentication, billing, Secrets, or environment variables.
- Live BOOTH network requests.
- Population of the canonical registry.
- Any production data.
- Collection pipeline implementation.

---

## Later Candidate Stages

The following stages are candidates for the post-architecture roadmap. Order and scope may be adjusted after Stage 4 findings. Each stage is a separate Issue.

| Stage | Description |
|---|---|
| Minimal Next.js/TypeScript setup | Project scaffold, linting, formatting, type-check CI; no application logic yet |
| Quality gates | Unit test infrastructure, coverage baseline, CI integration |
| Fixed-fixture search | Search UI backed by static fixtures (no live database); validates interaction patterns |
| Filters | Faceted filters for system, PL, play time, tags; still fixture-backed |
| Seeded random display | Implement seeded-random sort option |
| Sales-state handling | Implement ended-product exclusion from search; retain internal history |
| Low-load collection prototype | Implement low-load BOOTH data collection based on Stage 1 research; no production deployment |
| Content hashes | Implement content-version/hash tracking for reanalysis avoidance |
| Confidence and hold states | Implement hold/unknown/confidence metadata for AI-derived fields |
| Database decision and setup | Provision production database based on Architecture Decision Record |
| End-to-end acceptance | E2E test suite covering golden-path search and navigation |
| Accessibility | Full accessibility audit and fixes: keyboard, mobile, WCAG compliance |
| Retro archive-room design | Implement the retro Japanese archive-room visual design |

---

## Out of Scope for MVP

The following are explicitly deferred beyond the MVP roadmap:

- User accounts, login, favorites
- Rating and recommendation sorting
- Author submission portal
- Multi-platform support (non-BOOTH sources)
- Internationalization (non-Japanese UI)
- R-18/R-18G content
- Advertising or affiliate integration
- Internal product-detail pages
