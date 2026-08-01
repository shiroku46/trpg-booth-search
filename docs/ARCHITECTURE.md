# Architecture

## Status

Architectural principles and provisional candidates. No database, deployment, authentication, billing, or application code is created in this Issue (Stage 0).

Technology candidates are **[PROVISIONAL]**. None are adopted until a separate Architecture Decision Record (ADR) confirms pricing, free-tier limits, license, and terms for each candidate.

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [DECISIONS.md](DECISIONS.md) | [ROADMAP.md](ROADMAP.md) | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md)

---

## Domain Boundaries

The application has two primary domain layers, consistent with the two-layer product/scenario model in [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md):

### BOOTH Product Domain

- One record per BOOTH product page.
- Owns: product URL, BOOTH product ID, title, creator, sales state, collection method metadata.
- Responsible for: detecting ended products, tracking last-checked timestamp, content version hash.

### Scenario Domain

- One or more records per BOOTH product.
- Owns: all playable-content fields (system, edition, PL rules, play time, tags, handouts, etc.).
- Responsible for: tag provenance separation, confidence/hold state, derived-tag evidence metadata.

### Supporting Domains (candidate)

The following supporting domains are anticipated but not yet designed:

| Domain | Responsibility |
|---|---|
| System normalization | TRPG system names, editions, aliases, required/optional rulebooks |
| Tag management | Tag categories, provenance, derived-tag evidence, spoiler exclusions |
| Collection scheduler | Low-load discovery, incremental update, periodic reconciliation |
| Search and filter | Query, facet, sort, seeded-random logic |

Domain boundaries are defined here at an architectural level only. No implementation is created in this Issue.

---

## Provisional Technology Candidates

The following candidates are under consideration. None are adopted without an Architecture Decision Record.

| Layer | Candidate | Status |
|---|---|---|
| Frontend framework | Next.js | **[PROVISIONAL]** |
| Language | TypeScript | **[PROVISIONAL]** |
| Hosting / deployment | Vercel | **[PROVISIONAL]** |
| Database | PostgreSQL | **[PROVISIONAL]** |
| Database platform | Supabase | **[PROVISIONAL]** |
| CI / automation | GitHub Actions | **[PROVISIONAL]** |

**Before any candidate is adopted**, the Architecture Decision Record must confirm:
- Current pricing and free-tier limits from official sources.
- License terms.
- Terms of service relevant to this application's use case.
- That the candidate fits within the JPY 0–1,000/month cost target.

---

## Cost Requirements

| Requirement | Detail |
|---|---|
| **Target monthly cost** | JPY 0–1,000 |
| **No automatic paid-plan transition** | No candidate may be adopted if it auto-upgrades to a paid plan without human action |
| **Human approval above JPY 1,000** | Any configuration that could exceed JPY 1,000/month requires explicit human approval |
| **AI cost measurable** | AI provider costs must be observable and bounded by daily/monthly limits |
| **Database capacity measurable** | Database storage and query costs must be observable |
| **Actions time measurable** | GitHub Actions minutes must be observable and within free-tier or budgeted limits |

Cost requirements apply to the Architecture Decision Record (Stage: Architecture Decision Record in [ROADMAP.md](ROADMAP.md)).

---

## Isolation from luluportal

This application is fully isolated from `shiroku46/luluportal`. No infrastructure, code, database, authentication, deployment, or configuration is shared. See [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) and [DECISIONS.md — D-008](DECISIONS.md#d-008--luluportal-is-read-only-reference-full-isolation-required).

---

## What Is Not Created in This Issue

The following are explicitly deferred to later Issues:

- No database is provisioned or configured.
- No deployment is set up.
- No authentication is configured.
- No billing accounts are created or modified.
- No application code is written.
- No infrastructure-as-code is written.

This document is planning-only. Implementation begins after Stage 1 research and the Architecture Decision Record.
