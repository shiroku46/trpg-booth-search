# Roadmap

## Status

Sequential one-Issue-at-a-time MVP roadmap. Each stage is a single Issue. A stage does not begin until the previous stage is merged to `main`.

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [DECISIONS.md](DECISIONS.md) | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) | [ARCHITECTURE.md](ARCHITECTURE.md)

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

**Stage 1 has two parts**:

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

### Stage 1b — robots/Full-Terms Preflight (Blocker for any network prototype)

**Status**: Not started. **This is a hard prerequisite before any network request is made.**

**Scope**:
- Direct technical retrieval of current robots.txt: record body, retrieval time, response status, content hash, and applicable directives.
- Direct review of the full current BOOTH master terms and individual terms at `policies.pixiv.net`: record findings.
- Document both findings in a new Issue.

**Constraints**:
- This stage authorizes only the preflight retrieval of robots.txt and the terms review. No product listing or detail requests are made in this stage.
- Findings do not constitute legal approval — see [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md).
- The 20-request pilot (D-013) does not begin until Stage 1b is complete and recorded.

---

## Next Product Stage — System/Edition Normalization

**Goal**: Normalize TRPG system names, editions, aliases, and rulebook references to support accurate faceted search.

**Prerequisites**: Stage 1b complete and merged.

**Constraints**:
- No production database, no scraper implementation, no network collection.
- Normalization definitions are recorded as documentation; implementation begins in a later Issue.

**Note**: No implementation of system/edition normalization begins in Stage 1 (Issue #15). This stage is identified here as the next product-stage target.

---

## Later Candidate Stages

The following stages are candidates for the post-research roadmap. Order and scope may be adjusted after Stage 1 findings. Each stage is a separate Issue.

| Stage | Description |
|---|---|
| Product/scenario data model | Define the two-layer schema; no production database created yet |
| Architecture Decision Record | Select and confirm technology stack, hosting, database; confirm costs and terms |
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
