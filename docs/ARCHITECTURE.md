# Architecture

## Status

Stage 4 Architecture and Technology Decision. This document records confirmed provider-neutral application boundaries, the confirmed technology stack, cost controls, and references the physical schema. No application code, dependency, lockfile, SQL migration, database, deployment, authentication, Secret, billing, or BOOTH network request is created in this document.

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [DECISIONS.md](DECISIONS.md) | [ROADMAP.md](ROADMAP.md) | [DATA_MODEL.md](DATA_MODEL.md) | [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md) | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md)

---

## Provider-Neutral Application Boundaries

Provider-neutral boundaries are defined before any provider-specific detail. These boundaries apply regardless of the physical infrastructure selected.

### Domain Entities and Value Objects

Domain entities map directly to the logical entities in `DATA_MODEL.md`. Each entity has an immutable identity (`ImmutableID`) assigned at creation.

| Entity | Boundary Layer |
|---|---|
| `BoothProduct` | Root aggregate; owns all-ages state, classification, sales state, content version |
| `Scenario` | Nested aggregate within BoothProduct; owns observed title, PL, play style, handout fields |
| `ProductComponent` | Internal source-representation value object; never published directly |
| `ScenarioPlayTime` | Value object collection within Scenario; one per modality |
| `ScenarioConversationMethod` | Value collection within Scenario |
| `ScenarioPlayEnvironment` | Value collection within Scenario |
| `SystemFamily` | Registry aggregate; created only through reviewed registry additions |
| `Edition` | Registry value object within SystemFamily |
| `ObservedAlias` | Normalization evidence record |
| `RulesetReference` | Source-evidence record within Scenario |
| `CompatibilityClaim` | Source-evidence record within Scenario |
| `Book` | Registry aggregate |
| `BookRequirement` | Value object within Scenario |
| `Tag` | Registry value; created only through reviewed additions |
| `ScenarioTag` | Association between Scenario and Tag with full provenance |
| `SourceSnapshot` | Append-only evidence anchor; one per source access |
| `NormalizationHistory` | Append-only reanalysis record |
| `HoldAgeUnknownPurgeEvent` | Immutable redaction tombstone |

The `EvidencedValue<T>` type is a value object applied to every field whose value may be known, unknown, held, or not applicable. It never uses null or a default to represent an absent or unknown value (D-023).

### Repository Interfaces

Repository interfaces define data-access contracts in provider-neutral terms. Each interface is defined at the domain boundary; the implementation selects the physical store.

| Repository | Responsibility |
|---|---|
| `BoothProductRepository` | Create, retrieve by source_product_id, update projection fields, enforce hold_age_unknown prohibition |
| `ScenarioRepository` | Create, retrieve by product, delete on hold_age_unknown purge |
| `SourceSnapshotRepository` | Append-only insert; restricted purge under HoldAgeUnknownPurgeService |
| `NormalizationHistoryRepository` | Append-only insert; restricted purge under HoldAgeUnknownPurgeService |
| `ObservedAliasRepository` | Insert and retrieve by comparison_key; registry-version invalidation scan |
| `RulesetReferenceRepository` | Insert and retrieve by scenario; reanalysis queries |
| `CompatibilityClaimRepository` | Insert and retrieve by scenario; reanalysis queries |
| `BookRequirementRepository` | Insert and retrieve by scenario |
| `ScenarioTagRepository` | Insert and retrieve by scenario and tag; spoiler exclusion filter |
| `RegistryRepository` | Read-only access to SystemFamily, Edition, Book, Tag; write only through registry governance |
| `HoldAgeUnknownPurgeEventRepository` | Append-only insert of tombstone records |

### Services and Use Cases

| Service / Use Case | Responsibility |
|---|---|
| `ScenarioSearchService` | Evaluate `searchable_scenario` projection gates and return eligible scenarios |
| `SearchableScenarioProjection` | Deterministic gate evaluation; sole public eligibility mechanism (D-025) |
| `ProductClassificationService` | Rules-first product classification; AI candidate generation for ambiguous cases only |
| `AllAgesVerificationService` | Evaluate age evidence; enforce hold_age_unknown when evidence is missing or ambiguous |
| `HoldAgeUnknownPurgeService` | **Narrow compliance exception to the append-only rule.** Authorized to irreversibly purge prohibited payloads when a product transitions to hold_age_unknown. See PHYSICAL_SCHEMA.md Section 9 and D-039 for the complete contract. This service must not be callable from ordinary application paths. |
| `NormalizationService` | Alias comparison-key pipeline; canonical entity resolution; reanalysis triggering |
| `ContentVersionService` | Compute content version hashes; produce access/outcome version strings for hold_age_unknown |
| `SeededRandomSortService` | Boundary only (implementation deferred to Stage 5+); derives seed from request parameters |
| `PublicationGateService` | Evaluates all gates before any field is exposed in API responses |

### Adapters

| Adapter | Responsibility |
|---|---|
| `BoothPageAdapter` | Future: transform raw BOOTH page data into BoothProduct and Scenario domain events. Not active in Stage 5 fixture-backed scaffold. |
| `FixtureAdapter` | Stage 5 scaffold: load static JSON fixture files as in-memory scenario data for search validation |
| `PostgreSQLAdapter` | Implements all repository interfaces against PostgreSQL (Supabase Free) |
| `DrizzleORMAdapter` | Type-safe query layer over PostgreSQLAdapter using Drizzle ORM (Apache-2.0) |

### Publication-Gate Ownership

The `SearchableScenarioProjection` owns and enforces all eligibility gates from DATA_MODEL.md Section 10. No other service, adapter, or API handler may bypass or supplement these gates. The projection is the sole and complete public eligibility mechanism.

### Normalization and Reanalysis Boundaries

Normalization runs outside the public query path. The reanalysis avoidance key is the three-tuple `(content_version, normalizer_version, registry_version)`; all three are always non-null. Reanalysis is triggered when any one of the three changes. Both old and new records are retained in `normalization_history` for permitted content (D-026).

The `HoldAgeUnknownPurgeService` is the single exception: it may delete or irreversibly sanitize `normalization_history` rows containing prohibited payloads for a hold product, replacing them with a non-descriptive tombstone entry. This exception does not extend to any other normalization history.

### Rollback and Migration Boundaries

- Rollback is a revert commit or a bounded documentation fix-forward within the allowed paths. Shared history is never rewritten.
- Schema migrations are produced by Drizzle Kit and reviewed before execution. No migration runs in the Stage 5 fixture-backed scaffold (fixtures use in-memory data).
- Migration provisioning is deferred to a later dedicated database-provisioning Issue.

### Backup and Observability Boundaries

- Backup: Supabase Free includes Point-in-Time Recovery (PITR) at the free tier; scope and retention are verified at provisioning time. No additional backup infrastructure is created in Stage 4.
- Observability: Supabase dashboard provides basic usage metrics (storage, egress, MAU). Application-layer logging uses structured JSON to stdout. No paid observability provider is introduced.
- Cost monitoring: Supabase and Vercel dashboards track usage against free-tier limits. No automatic paid upgrade is configured.

### Data-Erasure Boundaries

The `HoldAgeUnknownPurgeService` is the sole authorized erasure path for prohibited descriptive and body-derived content. It operates atomically within a single database transaction. The redaction tombstone (Section 3.18 of PHYSICAL_SCHEMA.md) is the only permitted post-purge record for the affected product. All other data-erasure operations require a separate owner-authorized Issue.

---

## Domain Boundaries

The application has two primary domain layers, consistent with the two-layer product/scenario model in [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md):

### BOOTH Product Domain

- One record per BOOTH product page.
- Owns: product URL, BOOTH product ID, all-ages state, title, creator, sales state, content version, is_free indicator.
- Responsible for: detecting ended products, tracking last-checked timestamp, content version hash, and enforcing hold_age_unknown prohibitions.

### Scenario Domain

- One or more records per BOOTH product.
- Owns: all playable-content fields (system, edition, PL rules, play time, tags, handouts, etc.).
- Responsible for: tag provenance separation, confidence/hold state, derived-tag evidence metadata.

### Supporting Domains

| Domain | Responsibility |
|---|---|
| System normalization | TRPG system names, editions, aliases, required/optional rulebooks |
| Tag management | Tag categories, provenance, derived-tag evidence, spoiler exclusions |
| Collection scheduler | Low-load discovery, incremental update, periodic reconciliation (deferred; not in Stage 5 scaffold) |
| Search and filter | Query, facet, sort, seeded-random logic |

---

## Fixture-First Search Scaffold

The Stage 5 scaffold implements a search UI backed by static JSON fixtures only. No live BOOTH access, no database connection, and no collection pipeline runs in Stage 5.

- The `FixtureAdapter` loads static JSON fixture files representing a small curated set of scenario records.
- All search, filter, sort, and gate logic runs against fixture data in memory.
- The `SearchableScenarioProjection` gates are exercised against fixture data to validate correct behavior before any live database is provisioned.
- Fixtures are not production or canonical data; they contain no actual BOOTH product information.
- A fixture-first approach is the safest way to validate interaction patterns and gate logic before provisioning infrastructure.

---

## Confirmed Technology Stack

All sources accessed 2026-08-02.

### Next.js

- **License:** MIT. Source: https://github.com/vercel/next.js/blob/canary/license.md (accessed 2026-08-02)
- **Selected version:** Latest stable Next.js 16.x verified at scaffold time. Exact patch version is pinned in the lockfile at scaffold time; not hard-coded in this ADR.
- **Installation reference:** https://nextjs.org/docs/app/getting-started/installation (accessed 2026-08-02)
- **Runtime:** Node.js v24 LTS (see below). EOL Node.js v20 is prohibited even though Next.js documents Node.js 20.9 as its minimum.

### TypeScript

- **Version:** TypeScript 7.0, announced available 2026-07-08.
- **License:** Apache-2.0. Source: https://github.com/microsoft/typescript (accessed 2026-08-02)
- **Note:** TypeScript 7.0 is implemented in Go (microsoft/typescript-go). Source: https://github.com/microsoft/typescript-go (accessed 2026-08-02). The Apache-2.0 license applies; the prior incorrect MIT claim is withdrawn.
- **Announcement:** https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ (accessed 2026-08-02)

### Node.js

- **Selected version:** Node.js v24 LTS.
- **EOL prohibition:** Node.js v20 is EOL and prohibited.
- **Source:** https://nodejs.org/en/about/previous-releases (accessed 2026-08-02)

### Vercel (Hosting)

- **Plan:** Hobby (free).
- **Cost:** $0/month (¥0/month). Pauses at included limits rather than auto-charging. Manual upgrade only.
- **Restriction:** Hobby is restricted to non-commercial personal use.
- **Gate:** Deployment remains prohibited until the owner explicitly confirms this project qualifies as non-commercial under Vercel's current definition.
- **Sources:** https://vercel.com/docs/plans/hobby (accessed 2026-08-02); https://vercel.com/docs/plans (accessed 2026-08-02); https://vercel.com/docs/limits/fair-use-guidelines (accessed 2026-08-02)

### Supabase (Database Platform)

- **Plan:** Free.
- **Cost:** $0/month (¥0/month).
- **Free-plan limits (official, accessed 2026-08-02):**
  - Two active free projects.
  - 500 MB database storage per project.
  - 1 GB file storage.
  - 5 GB egress plus 5 GB cached egress.
  - 50,000 MAU.
  - 500,000 Edge Function invocations.
- **Pause behavior:** A low-activity free project may pause after a 7-day period. It can be restored within 90 days.
- **Quota exceedance:** Uses notifications, grace period, and service restrictions. Does not automatically upgrade the account to a paid plan. Free Plan is not charged; upgrade requires explicit plan action.
- **Gate:** Provisioning remains prohibited until a later dedicated provisioning Issue.
- **Sources:** https://supabase.com/pricing (accessed 2026-08-02); https://supabase.com/docs/guides/platform/billing-on-supabase (accessed 2026-08-02); https://supabase.com/docs/guides/platform/free-project-pausing (accessed 2026-08-02); https://supabase.com/docs/guides/platform/billing-faq (accessed 2026-08-02); https://supabase.com/docs/guides/platform/cost-control (accessed 2026-08-02)

### PostgreSQL

- **Selected version:** PostgreSQL 17, unless the later provisioning Issue demonstrates a safer supported managed version.
- **License:** PostgreSQL License (BSD-like open source).
- **Version selection rationale:** PostgreSQL 17 is a current stable release with long-term support. Version selection is revisable at provisioning time if Supabase's managed offering supports a different version.

### Drizzle ORM and Drizzle Kit

- **License:** Apache-2.0. Source: https://github.com/drizzle-team/drizzle-orm (accessed 2026-08-02). The prior incorrect MIT claim is withdrawn; no license-verification gate based on the MIT claim is retained.
- **Capabilities confirmed:** PostgreSQL support, Drizzle Kit migration tooling, active releases.
- **Release source:** https://github.com/drizzle-team/drizzle-orm/releases (accessed 2026-08-02)
- **Exact package versions:** Pinned in the lockfile at scaffold time.

### GitHub Actions (CI)

- **Standard GitHub-hosted runners:** Free for public repositories.
- **Private repositories on GitHub Free:** 2,000 minutes/month and 500 MB Actions storage included. Private-repository overage can charge unless a spend limit budget is configured with "Stop usage when budget limit is reached."
- **This repository:** Public at research time; expected CI cost ¥0.
- **Note:** Not all Actions usage is universally unlimited. The ¥0 cost applies because this repository is public. If the repository is made private, cost controls must be reviewed.
- **Sources:** https://docs.github.com/en/actions/concepts/billing-and-usage (accessed 2026-08-02); https://docs.github.com/en/billing/reference/product-usage-included (accessed 2026-08-02)

---

## Cost Controls

The selected configuration is confirmed at ¥0/month with service-pause/restriction risks and manual-upgrade gates only.

| Service | Monthly Cost | Risk | Upgrade |
|---|---|---|---|
| Vercel Hobby | ¥0 | Service-pause at included limits | Manual; requires explicit owner action |
| Supabase Free | ¥0 | Project-pause after 7-day inactivity; service restriction on quota exceedance | Manual; free plan not auto-charged |
| GitHub Actions (public repo) | ¥0 | None at current public status; cost applies if made private without budget gate | N/A while public |

**Total confirmed expected cost: ¥0/month.**

No billing is enabled. Any paid-plan transition requires a separate owner-authorized Issue. The JPY 0–1,000 monthly target is retained; the current configuration is at the zero baseline. No automatic upgrade of any service is configured or permitted.

---

## hold_age_unknown Compliance Exception

The `HoldAgeUnknownPurgeService` is an explicitly authorized narrow exception to the append-only rule (D-026). It is the only mechanism permitted to irreversibly purge or sanitize prohibited descriptive and body-derived content when a `booth_product` transitions to `hold_age_unknown`. Full contract: PHYSICAL_SCHEMA.md Section 9 and D-039 in DECISIONS.md.

This exception:
- Does not permit ordinary mutation of permitted history.
- Does not weaken D-002, D-012, D-026, or DATA_MODEL.md Section 3.5.
- Operates only on prohibited payloads directly associated with the hold product.
- Leaves only non-sensitive immutable audit metadata and the redaction tombstone (which cannot reconstruct prohibited content).

---

## Physical Schema

See [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md) for the complete non-executable implementation-ready specification, including:
- EvidencedValue<T> physical representation as JSONB NOT NULL
- Physical table specifications for all Stage 3 entities
- Index strategy
- Append-only invariants
- HoldAgeUnknownPurgeService contract and tombstone table
- is_free physical representation (resolves PD-009)

---

## Isolation from luluportal

This application is fully isolated from `shiroku46/luluportal`. No infrastructure, code, database, authentication, deployment, or configuration is shared. See [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) and [DECISIONS.md — D-008](DECISIONS.md#d-008--luluportal-is-read-only-reference-full-isolation-required).

---

## Stage 5 Scaffold Handoff

Stage 5 is bounded to the minimal fixture-backed application scaffold:
- Next.js 16.x project scaffold with TypeScript 7.0 and Node.js v24 LTS.
- Static JSON fixture files representing curated scenario records (not production or canonical data).
- Search UI backed by fixtures only; no live database, no BOOTH access, no collection pipeline.
- Unit test infrastructure and CI integration (GitHub Actions).
- Verification that all `searchable_scenario` projection gates operate correctly against fixture data.

The following are explicitly excluded from Stage 5:
- Database provisioning or connection.
- Deployment to Vercel or any host.
- Authentication, billing, Secrets, or environment variables.
- Live BOOTH network requests.
- Population of the canonical registry.
- Any production data.

---

## What Is Not Created in This Document

The following are explicitly deferred:

- No database is provisioned or configured.
- No deployment is set up.
- No authentication is configured.
- No billing accounts are created or modified.
- No application code is written.
- No SQL migration or generated schema file is created.
- No dependency or lockfile is created.
- No BOOTH network requests are made.
