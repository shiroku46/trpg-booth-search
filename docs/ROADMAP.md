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

**Prerequisites**:
- Stage 3 logical data model merged (commit `4932f54`).
- Stage 1b robots.txt preflight remains required before any listing/detail collection run; it is not a blocker for Stage 4 architecture decisions.
- Stage 1b full-terms review remains required before production collection; it is not a blocker for Stage 4 architecture design.

**Deliverables**:
- `docs/ARCHITECTURE.md` — accepted provider-neutral boundary and technology ADR (no longer provisional).
- `docs/PHYSICAL_SCHEMA.md` — implementation-ready PostgreSQL 17 schema specification for all Stage 3 entities.
- `docs/DECISIONS.md` — updated with D-027 through D-037 (Stage 4 decisions) and PD-001, PD-003, PD-005, PD-008, PD-009 resolved.
- `docs/ROADMAP.md` — Stage 4 marked complete; Stage 5 handoff added.

**Summary of accepted decisions (D-027 through D-037)**:
- Next.js 16.x / MIT frontend framework (D-027).
- TypeScript 7.0 / Node.js LTS / pnpm language and runtime stack (D-028).
- PostgreSQL 17 / Supabase Free provider (D-029; provisioning deferred pending official free-tier verification).
- Vercel Hobby plan hosting, no auto-upgrade (D-030; non-commercial confirmation required before deployment).
- GitHub Actions CI (D-031; free-tier verification required for private repos).
- Drizzle ORM + Drizzle Kit (D-032; license verification required before scaffold).
- EvidencedValue\<T\> encoded as `jsonb NOT NULL` (D-033).
- ImmutableID encoded as UUID v4 / `gen_random_uuid()` (D-034).
- Free-first sort via `is_free: EvidencedValue<Boolean>` (D-035; no exact price stored).
- Seeded random strategy boundary: date-based seed, algorithm deferred (D-036).
- Cost controls: free-plan hard stops, no billing enabled until authorized Issue (D-037).

**Pending carried forward**:
- Supabase free-tier limits: **[UNVERIFIED]** — must verify from official supabase.com before provisioning Issue.
- GitHub Actions free-tier limits: **[UNVERIFIED]** — must verify from docs.github.com before enabling CI workflows.
- Drizzle ORM license: MIT assumed but not verified from official license file — confirm before scaffold.
- Vercel non-commercial qualification: owner must confirm before deployment Issue.
- Node.js support phase: v22 or v24 LTS assumed; verify current maintenance status.
- Seeded random and discovery sort algorithms: boundaries defined; implementations deferred.
- Collection implementation, database provisioning, deployment, authentication, and billing: remain out of scope until their respective authorized Issues.

---

## Stage 5 — Minimal Application Scaffold

**Goal**: Create the minimal Next.js/TypeScript project scaffold with linting, formatting, type-check CI, and the fixture adapter. No application logic, live database, or production deployment is created in Stage 5.

**Status**: Not started. This is the next product stage after Stage 4 merges.

**Prerequisites**:
- Stage 4 ADR and physical schema merged (this entry added).
- All Stage 5 verification gates in [ARCHITECTURE.md](ARCHITECTURE.md) Section 7 (Provisional Items) that affect the scaffold must be confirmed: Drizzle ORM license, Next.js license, TypeScript license, Node.js support phase.
- Vercel non-commercial qualification confirmed by owner (before any deployment step within Stage 5).

**Scope**:
- Initialize Next.js 16 project with TypeScript, pnpm, ESLint/Biome, and Tailwind CSS.
- Configure type-check and lint CI in GitHub Actions (verify free-tier limits before enabling).
- Implement the fixture adapter (TypeScript/JSON fixture files → repository interfaces defined in [ARCHITECTURE.md](ARCHITECTURE.md) Section 1.2).
- Implement the domain entity types and value object types corresponding to [DATA_MODEL.md](DATA_MODEL.md) and [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md).
- Define the repository interfaces as TypeScript contracts (no database implementation yet).
- No database provisioning, deployment, authentication, billing, or live BOOTH access.
- No canonical registry entries populated.
- No production data operations.

**Constraints**:
- Must faithfully represent all `EvidencedValue<T>` state invariants (D-023, D-033) in TypeScript types.
- Must not create application code beyond the scaffold, fixture adapter, and domain type definitions.
- Verify each provisional item from [ARCHITECTURE.md](ARCHITECTURE.md) Section 7 that is within scope at this stage.
- Drizzle ORM license must be confirmed before adding it as a dependency.
- GitHub Actions CI minutes must be confirmed within free tier before enabling workflows.

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
