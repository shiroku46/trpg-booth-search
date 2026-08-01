# Decisions

> **Status**: This document records initial accepted decisions and explicit pending decisions arising from Issue #10. See [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) for confirmed requirements, [ROADMAP.md](ROADMAP.md) for the planned delivery sequence, and [ARCHITECTURE.md](ARCHITECTURE.md) for provisional technical candidates.

---

## How to read this document

Each entry follows this structure:

- **Decision**: What was decided.
- **Reason**: Why this decision was made.
- **Rejected alternatives**: Options that were considered and not chosen.
- **Impact**: What this decision affects.
- **Decision date**: When the decision was accepted.
- **Evidence / originating requirement**: The source that produced or confirms this decision.
- **Conditions for revisiting**: When this decision should be reconsidered.

---

## Accepted Decisions

### D-001 — BOOTH-only source for MVP

- **Decision**: The MVP data source is BOOTH only. No other marketplace or platform is in scope for the initial release.
- **Reason**: Focused scope reduces complexity. BOOTH is the primary platform where the target content (all-ages TRPG scenarios) is concentrated in the Japanese market.
- **Rejected alternatives**: Including multiple platforms simultaneously (DLsite, etc.) — rejected as out of scope for MVP.
- **Impact**: All data collection, legal review, and technical research targets BOOTH exclusively for MVP.
- **Decision date**: 2026-08-01
- **Evidence / originating requirement**: Issue #10 — MVP source and scope.
- **Conditions for revisiting**: Future product-type extension issues may evaluate additional platforms after MVP is established.

---

### D-002 — All-ages only; R-18/R-18G excluded from all layers

- **Decision**: R-18 and R-18G content is excluded from collection, storage, publication, and all search results. The boundary is strict.
- **Reason**: The product purpose is all-ages TRPG scenario discovery. Including adult content would require separate legal, age-verification, and moderation infrastructure not in scope for MVP.
- **Rejected alternatives**: Including adult content with optional filtering — rejected; the strict boundary simplifies legal and compliance posture and matches the stated product purpose.
- **Impact**: Collection, database schema, extraction rules, and UI filters must all enforce this boundary. See [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md).
- **Decision date**: 2026-08-01
- **Evidence / originating requirement**: Issue #10 — MVP exclusions; data collection policy.
- **Conditions for revisiting**: A future separate product for adult content would require its own Issue, legal review, and age-verification infrastructure.

---

### D-003 — Two-layer product/scenario model

- **Decision**: A BOOTH product (the purchasable unit) and the individual scenarios it contains are tracked as two distinct layers.
- **Reason**: A single BOOTH product may contain multiple distinct scenarios. Scenario-level discovery requires granular metadata that does not exist at the product level alone.
- **Rejected alternatives**: Product-only model — rejected because it cannot support scenario-level filtering by player count, play time, etc.
- **Impact**: Data model, extraction rules, and search UI must both support the two-layer structure. Conservative handling applies when scenario boundaries are ambiguous.
- **Decision date**: 2026-08-01
- **Evidence / originating requirement**: Issue #10 — BOOTH-product and individual-scenario two-layer model.
- **Conditions for revisiting**: If the scenario layer proves too expensive to populate accurately, a product-only fallback may be scoped as a separate issue.

---

### D-004 — Direct navigation to BOOTH; no internal product-detail pages in MVP

- **Decision**: Search results link directly to the BOOTH product page. This application does not host internal product-detail pages in the MVP.
- **Reason**: Purchase, payment, and download remain on BOOTH. An internal detail page would duplicate BOOTH content and create maintenance overhead without adding value in MVP.
- **Rejected alternatives**: Internal product-detail pages — deferred to post-MVP.
- **Impact**: UI design is constrained to list and filter views for MVP; individual product routing is not required.
- **Decision date**: 2026-08-01
- **Evidence / originating requirement**: Issue #10 — direct navigation; MVP exclusions.
- **Conditions for revisiting**: Post-MVP, if a detail page is needed for extended metadata display.

---

### D-005 — VRCFinder as structural reference only; retro Japanese archive-room design direction

- **Decision**: VRCFinder informs structural patterns (layout, filter UX) and is not a source of code or data. The visual design direction is retro Japanese archive-room, distinct from VRCFinder.
- **Reason**: VRCFinder is an established structural model for TRPG scenario discovery tools, making it a useful reference. The distinct aesthetic direction establishes a clear product identity.
- **Rejected alternatives**: Adopting VRCFinder's visual aesthetic — rejected in favour of the distinct retro archive direction.
- **Impact**: UI implementation must target the retro archive-room aesthetic, not replicate VRCFinder.
- **Decision date**: 2026-08-01
- **Evidence / originating requirement**: Issue #10 — VRCFinder as structural reference; design direction.
- **Conditions for revisiting**: If the retro aesthetic creates accessibility or usability issues, the design direction may be refined in a separate Issue.

---

### D-006 — Sequential one-Issue-at-a-time roadmap

- **Decision**: The roadmap advances one Issue at a time, in the sequence defined in [ROADMAP.md](ROADMAP.md). No parallel feature tracks in MVP.
- **Reason**: Reduces risk of scope creep and conflicting in-flight changes in a single-developer context.
- **Rejected alternatives**: Parallel feature development — rejected for MVP complexity.
- **Impact**: Each Issue must be complete and merged before the next begins.
- **Decision date**: 2026-08-01
- **Evidence / originating requirement**: Issue #10 — roadmap structure.
- **Conditions for revisiting**: Revisit if a second contributor joins and parallel tracks become practical.

---

### D-007 — Isolation from `shiroku46/luluportal`

- **Decision**: This application is fully isolated from `shiroku46/luluportal`. No shared code, database, authentication, environment variables, deployment, Issues, Pull Requests, workflows, or settings.
- **Reason**: Separation of concerns, independent development lifecycle, and compliance isolation.
- **Rejected alternatives**: Shared infrastructure with luluportal — rejected; the two products have independent scope and security posture.
- **Impact**: All architecture, deployment, and operations decisions for this project must treat luluportal as an external, read-only reference. See [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
- **Decision date**: 2026-08-01
- **Evidence / originating requirement**: Issue #10 — isolation requirement.
- **Conditions for revisiting**: Not expected to change.

---

### D-008 — Japanese-only for MVP

- **Decision**: The application UI is Japanese-only for MVP. No multilingual support is planned.
- **Reason**: The target content and audience are Japanese. Multilingual support adds complexity not justified for MVP.
- **Rejected alternatives**: English-language UI, bilingual UI — deferred.
- **Impact**: UI text, error messages, and documentation visible to end users are Japanese.
- **Decision date**: 2026-08-01
- **Evidence / originating requirement**: Issue #10 — Japanese-only MVP.
- **Conditions for revisiting**: Post-MVP, if international audience demand is confirmed.

---

## Pending Decisions

The following are explicitly **not yet decided**. Research Issues are required before these can be accepted.

### PD-001 — BOOTH collection method

- **What is pending**: The technical approach for discovering and retrieving BOOTH product data (for example: API, structured page extraction, search endpoint, feed). The current BOOTH terms and robots.txt must be reviewed first.
- **Why pending**: No production collection or full crawl is authorized by Issue #10. A dedicated research Issue is required. See [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) and [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md).
- **Required before**: Data collection prototype or production collection work begins.

---

### PD-002 — Technology stack selection

- **What is pending**: Specific framework, database, hosting provider, and tooling choices. Next.js, TypeScript, Vercel, PostgreSQL, Supabase, and GitHub Actions are provisional candidates only.
- **Why pending**: Current pricing, free tiers, limits, licenses, and terms require a dedicated Architecture Decision Issue before adoption. See [ARCHITECTURE.md](ARCHITECTURE.md).
- **Required before**: Any application scaffolding or database setup begins.

---

### PD-003 — BOOTH terms and robots.txt compliance

- **What is pending**: Review of BOOTH's current official terms of service and robots.txt for compatibility with the planned collection approach.
- **Why pending**: Terms and robots rules must be checked from current official sources before any production collection begins. This review has not yet been completed.
- **Required before**: Any production scraping, crawling, or low-load collection begins.

---

### PD-004 — AI provider and model for extraction

- **What is pending**: The AI provider, model, and specific usage pattern for ambiguous candidate tag generation.
- **Why pending**: AI budget, rate limits, and provider terms must be evaluated. Only rules-first extraction is confirmed; AI is scoped to ambiguous candidate generation only.
- **Required before**: Any AI-assisted extraction is implemented.

---

### PD-005 — Database provider and schema

- **What is pending**: Database provider selection and schema design.
- **Why pending**: Dependent on PD-002 (stack) and cost evaluation (target JPY 0–1,000/month). No database is created in this Issue.
- **Required before**: Product/scenario data model implementation begins.

---

### PD-006 — Free tier and pricing limits for all services

- **What is pending**: Confirmed free tier limits, pricing tiers, and overage behaviour for all candidate services (Vercel, Supabase, GitHub Actions, AI providers).
- **Why pending**: Current published limits must be verified from provider documentation at the time of the Architecture Decision Issue.
- **Required before**: Any paid-service adoption is confirmed.
