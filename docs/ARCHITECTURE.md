# Architecture

## Status

Architectural principles, provisional technology candidates, and Stage 4 physical schema decisions. No database provisioning, deployment, authentication, billing, or application code has been created. The physical schema specification ([PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md)) was merged in PR #44 (2026-08-02). Backup and recovery remain an explicit unresolved provisioning gate. See [DECISIONS.md](DECISIONS.md) Stage 4 Decisions for the formal decision records.

Technology candidates are **[PROVISIONAL]**. None are fully adopted until a formal Architecture Decision Record confirms pricing, free-tier limits, license, and terms. Stage 4 has confirmed the provisional target stack listed below.

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [DECISIONS.md](DECISIONS.md) | [ROADMAP.md](ROADMAP.md) | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) | [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md)

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
| ORM | Drizzle ORM (Apache-2.0) | **[PROVISIONAL]** |
| Migration tooling | Drizzle Kit (Apache-2.0) | **[PROVISIONAL]** |

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

---

## Stage 4 Physical Schema

`docs/PHYSICAL_SCHEMA.md` (merged PR #44, 2026-08-02) defines PostgreSQL-oriented tables, JSONB envelopes for all `EvidencedValue<T>` fields, indexes, the `HoldAgeUnknownPurgeService` interface, the `searchable_scenario` provider-neutral projection, and the explicit unresolved backup/recovery provisioning gate. No database is provisioned and no migrations have run.

---

## Provider-Neutral Application Boundaries

`searchable_scenario` is a provider-neutral application projection, not a source-of-truth table. It may be implemented as a database view, materialized view, or application-layer query at provisioning time. Relationship rows (ruleset, compatibility, book-requirement, alias, tag) are projected independently and included only when each satisfies its entity-specific publication predicate; an ineligible row is omitted without suppressing an otherwise eligible scenario.

---

## Backup/Recovery Provisioning Gate (Unresolved)

The Supabase Free baseline does not claim Point-in-Time Recovery (PITR). Until a later owner-authorized Issue closes this gate — by selecting a recovery mechanism, documenting scope/frequency/retention/encryption/access controls/restore procedure, running a successful restore test against non-production data, confirming recovery storage does not retain `hold_age_unknown`-purged payload, and obtaining explicit approval for any paid capability — the project must not claim backup readiness, PITR availability, disaster-recovery completion, or production persistence readiness. See D-031 and PD-010 in [DECISIONS.md](DECISIONS.md) and [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md) Section 9.

---

## Stage 5 Handoff Constraints

Stage 5 may scaffold only a minimal fixture-backed Next.js/TypeScript application and quality gates. It may define provider-neutral domain types and repository interfaces derived from `docs/PHYSICAL_SCHEMA.md`, but it must not:

- create a Supabase project or database;
- run SQL migrations;
- connect to live BOOTH;
- deploy;
- enable authentication or billing;
- add production or canonical data;
- claim backup readiness.

The application must start with fixed all-ages fixtures, keep adapters replaceable, and enforce the same publication and hold boundaries defined in `docs/PHYSICAL_SCHEMA.md` before rendering or filtering.
