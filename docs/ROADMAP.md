# Roadmap

## Status

Sequential one-Issue-at-a-time MVP roadmap. Each stage is a single Issue. A stage does not begin until the previous stage is merged to `main`.

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [DECISIONS.md](DECISIONS.md) | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) | [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Stage 0 — Documentation and Planning (current)

**Goal**: Establish product-planning source of truth before research or implementation begins.

**Deliverables**:
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/DECISIONS.md`
- `docs/ROADMAP.md`
- `docs/DATA_COLLECTION_POLICY.md`
- `docs/LEGAL_AND_COMPLIANCE.md`
- `docs/ARCHITECTURE.md`

**Status**: In progress (Issue #10).

---

## Stage 1 — BOOTH Collection Entry and Product-Classification Research

**Goal**: Research BOOTH access patterns, terms, robots.txt, and product classification, using only a small number of low-load requests. No production collection or full crawl is authorized.

**Scope**:
- Check current BOOTH terms of service from official sources.
- Check current BOOTH robots.txt.
- Identify BOOTH product page structure and candidate entry points for data collection.
- Classify BOOTH product types (scenario, supplement, material-only, DLC) to validate the two-layer model.
- Document findings as research notes; no production database, no scraper implementation.

**This is the first next product Issue.**

**Prerequisites**: Stage 0 merged.

**Constraints**:
- Only low-load research requests are authorized; no full crawl.
- Findings do not constitute legal approval — see [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md).
- Technology selection, database, and deployment remain pending after this stage.

---

## Later Candidate Stages

The following stages are candidates for the post-research roadmap. Order and scope may be adjusted after Stage 1 findings. Each stage is a separate Issue.

| Stage | Description |
|---|---|
| Domain normalization | Normalize TRPG system names, editions, aliases, and rulebook references |
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
