# Roadmap

> **Status**: Confirmed MVP roadmap. This is a sequential one-Issue-at-a-time plan. No stage begins until the previous stage is merged and all required checks pass. See [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) for the full requirements set, [DECISIONS.md](DECISIONS.md) for accepted and pending decisions, and [ARCHITECTURE.md](ARCHITECTURE.md) for provisional technical candidates.

---

## Delivery model

- One Issue at a time, in sequence.
- Each Issue must be fully merged and validated before the next begins.
- Scope is the current working directory only; `shiroku46/luluportal` is never modified.

---

## Stage 0 — Documentation (current Issue)

**Issue #10 — Establish product requirements and MVP roadmap**

Migrate the approved initial requirements into six cross-linked repository documents. No code, database, collection, or deployment work occurs in this stage.

**Deliverables**: `docs/PRODUCT_REQUIREMENTS.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, `docs/DATA_COLLECTION_POLICY.md`, `docs/LEGAL_AND_COMPLIANCE.md`, `docs/ARCHITECTURE.md`.

---

## Stage 1 — BOOTH collection-entry and product-classification research

**[Next Issue]**

> This is the first next product Issue after Stage 0.

A low-load, read-only research Issue that:

- Checks BOOTH's current official terms of service and robots.txt from their official sources.
- Conducts a small number of low-load research requests (not a full crawl or production scraping).
- Identifies available entry points for product discovery (for example: search endpoints, category pages, structured feeds).
- Determines how to classify all-ages TRPG scenario products versus excluded products.
- Produces a findings document; no production collection or database setup occurs.

**Constraint**: Only a small number of low-load research requests are authorized. No full crawl, no production scraping, no storage of collected data. See [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) and [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md).

---

## Later Candidate Stages

The following stages are candidates for the roadmap. Their order, scope, and feasibility depend on findings from earlier stages. No stage is confirmed until the preceding stage is complete.

| Candidate Stage | Description |
|---|---|
| Domain normalization | Establish normalized TRPG system names, editions, and aliases. |
| Product/scenario data model | Design and document the two-layer BOOTH-product/individual-scenario schema. Requires PD-005 (database decision) resolved. |
| Architecture Decision | Evaluate and confirm technology stack (Next.js, TypeScript, Vercel, PostgreSQL, Supabase, GitHub Actions) against current pricing, free tier limits, and terms. Resolve all pending decisions from [DECISIONS.md](DECISIONS.md). |
| Minimal Next.js / TypeScript setup | Project scaffold with no application logic; CI and linting only. Requires Architecture Decision resolved. |
| Quality gates | Establish test infrastructure, coverage requirements, and accessibility baseline. |
| Fixed-fixture search | Search UI backed by a fixed test fixture (no live data). |
| Filters | Player count, play time, system, and tag filters. |
| Seeded random display | Reproducible random ordering keyed by seed. |
| Sales-state handling | Exclude ended products from normal results; retain in internal history. |
| Low-load collection prototype | Implement low-load data collection within confirmed legal and terms constraints. Requires Stage 1 findings, legal review, and Architecture Decision. |
| Content hashes | Content-version/hash tracking to avoid unnecessary reanalysis. See [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md). |
| Confidence and hold states | Implement confidence, conflict, hold, and unknown metadata states. See [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md). |
| Database decision and setup | Select and configure the database provider within JPY 0–1,000/month target. Requires Architecture Decision. |
| E2E tests | End-to-end acceptance tests. |
| Accessibility audit | Full keyboard navigation, mobile, and screen reader review. |
| Retro archive-room design | Apply the confirmed retro Japanese archive-room visual design direction. |

---

## Deferred and out-of-scope for MVP

The following are explicitly deferred or out of scope for the MVP and will not appear in the Stage 1–N roadmap until a separate scoping Issue authorizes them:

- Rating-based and recommendation-based sorting.
- Internal product-detail pages.
- User accounts, login, and favorites.
- Multiple platform support (DLsite, etc.).
- R-18 / R-18G content.
- Author submission flows.
- Advertising and affiliate integration.
- Multilingual support.
