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

**Status**: Not started.

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

**Status**: Complete. Stage 4 documentation was merged to `main` through PRs #44, #59, and #64. Final synchronized ADR merge (PR #64, head `780d090bdf39dff704f45d5beb0f5842e3ad6d61`) was merged to `main` as `297d15c3c71b352dcf4d9fd20f62ed34f458a201`.

**Merged foundations**:
- Stage 3 logical model: `4932f54655b2c48a5de66fb67f92738ccb23c6fa`.
- PR #44 physical schema: `1a0cd2c7f195ba51b49bb75ef3d88091f93356f4`.
- PR #59 final physical-schema publication/handoff corrections: `13e2b097a6f72c9fa652c78995008f9dd20710ff`.
- PR #64 architecture/provider/cost ADR and roadmap synchronization: `297d15c3c71b352dcf4d9fd20f62ed34f458a201`.

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
- Ordinary permitted history is append-only; `hold_age_unknown` permits only the narrow product-FK-scoped irreversible purge of prohibited payload and hashes, including the complete `is_free` evidenced object and its non-permitted evidence/provenance; each sanitized record's non-payload identifier, non-body-derived version references, completed state, and completion time are retained in the tombstone; no body-derived payload is retained.

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
