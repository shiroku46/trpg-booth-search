# Architecture

## Status

Architecture Decision Record (ADR) — Stage 4 accepted. Provider-neutral application boundaries and technology choices are confirmed in this document with current official dated evidence. No database is provisioned, no deployment is configured, no application code is created, and no authentication, billing, or secrets are established in Stage 4.

Technology choices are confirmed here. Provisioning, deployment, and application scaffold are authorized only in subsequent Issues per [ROADMAP.md](ROADMAP.md).

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [DECISIONS.md](DECISIONS.md) | [ROADMAP.md](ROADMAP.md) | [DATA_MODEL.md](DATA_MODEL.md) | [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md) | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md)

Governing decisions: D-027 through D-037 in [DECISIONS.md](DECISIONS.md).

---

## 1. Provider-Neutral Application Boundaries

Provider-neutral boundaries are defined in this section before any provider-specific detail. The physical schema in [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md) is the provider-specific implementation. No provider name, ORM type, or database column type appears in this section.

### 1.1 Domain Layer

The domain layer contains the logical entities, value objects, and invariants defined in [DATA_MODEL.md](DATA_MODEL.md). No framework, ORM, database type, or provider-specific construct appears in the domain layer.

**Aggregate roots:**

| Aggregate | Domain scope | DATA_MODEL.md reference |
|---|---|---|
| `BoothProduct` | BOOTH product page identity, sales lifecycle, all-ages gate, publication gate, hold purge contract | Section 3 |
| `Scenario` | Individual playable scenario and all playable-content fields; publication eligibility via `searchable_scenario` | Section 4 |
| `SystemFamily` | Canonical TRPG system family registry entry | Section 6.1 |
| `Edition` | Canonical edition registry entry within a system family | Section 6.2 |
| `Book` | Canonical book or rulebook registry entry | Section 6.6 |
| `Tag` | Canonical tag catalogue entry | Section 7.1 |
| `SourceSnapshot` | Append-only source access evidence record | Section 8.1 |

**Child entities within aggregates:**

| Entity | Parent aggregate | DATA_MODEL.md reference |
|---|---|---|
| `ProductComponent` | `BoothProduct` | Section 5 |
| `ScenarioPlayTime` | `Scenario` | Section 4.3 |
| `ScenarioConversationMethod` | `Scenario` | Section 4.4 |
| `ScenarioPlayEnvironment` | `Scenario` | Section 4.4 |
| `RulesetReference` | `Scenario` | Section 6.4 |
| `CompatibilityClaim` | `Scenario` | Section 6.5 |
| `BookRequirement` | `Scenario` | Section 6.7 |
| `ScenarioTag` | `Scenario` | Section 7.2 |
| `ObservedAlias` | Normalization domain | Section 6.3 |
| `NormalizationHistory` | Provenance domain | Section 8.2 |

**Value objects (immutable; equality by value):**

| Value object | Notes |
|---|---|
| `EvidencedValue<T>` | Universal evidenced-value state envelope (D-023); physical encoding defined in [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md) Section 2 |
| `SourceEvidenceRef` | Non-spoiler pointer to a source observation record |
| `ImmutableID` | UUID v4 once assigned; never changes (D-034) |
| Controlled vocabulary codes | `ProductClassCode`, `SalesStateCode`, `AllAgesStateCode`, `HoldReasonCode`, `ConflictReasonCode`, `SeparationStateCode`, `WorkCompositionCode`, `ProgressionMethodCode`, `HandoutStructureCode`, `PlayModalityCode`, `PlayTimeCollectionStateCode`, `ConversationMethodCode`, `PlayEnvironmentCode`, `ComponentClassCode`, `CompatibilityRelationshipKind`, `RequirementKindCode`, `TagCategoryCode`, `ReanalysisTriggerCode` — see DATA_MODEL.md for definitions |

### 1.2 Repository Interfaces (Ports)

Repository interfaces define the data-access contract. The domain layer and service layer depend on these interfaces, not on any specific database implementation. Adapters depend on the interfaces, not vice versa.

Each repository exposes at minimum:
- `findById(id)` — returns entity or null
- `save(entity)` — insert or update the current projection record only
- `appendHistory(record)` — for append-only writes; never modifies existing history records

Repository interfaces are defined here as typed contracts; implementations (adapters) are scaffolded in Stage 5 and later.

| Interface | Aggregate / entity | Key operations |
|---|---|---|
| `BoothProductRepository` | `BoothProduct` | find by id; find by source_product_id; find all with filter; purge prohibited fields on hold_age_unknown transition |
| `ScenarioRepository` | `Scenario` | find by id; find all for product; find publishable (searchable_scenario predicate) |
| `ScenarioPlayTimeRepository` | `ScenarioPlayTime` | find by scenario_id; at least one record required per scenario |
| `ScenarioConversationMethodRepository` | `ScenarioConversationMethod` | find by scenario_id |
| `ScenarioPlayEnvironmentRepository` | `ScenarioPlayEnvironment` | find by scenario_id |
| `ProductComponentRepository` | `ProductComponent` | find by booth_product_id |
| `SystemFamilyRepository` | `SystemFamily` | find by id; find active (non-deprecated) |
| `EditionRepository` | `Edition` | find by id; find by system_family_id |
| `ObservedAliasRepository` | `ObservedAlias` | find by comparison_key; find unresolved; find by conflict_status |
| `RulesetReferenceRepository` | `RulesetReference` | find by scenario_id; find publishable |
| `CompatibilityClaimRepository` | `CompatibilityClaim` | find by scenario_id; find publishable |
| `BookRepository` | `Book` | find by id; find active (non-deprecated) |
| `BookRequirementRepository` | `BookRequirement` | find by scenario_id; find publishable; find group by group_id |
| `TagRepository` | `Tag` | find by id; find by category |
| `ScenarioTagRepository` | `ScenarioTag` | find by scenario_id; find publishable; find by tag_id |
| `SourceSnapshotRepository` | `SourceSnapshot` | append only; find by source_url and checked_at |
| `NormalizationHistoryRepository` | `NormalizationHistory` | append only; find by target_type and target_id |

### 1.3 Services and Use Cases

| Service | Responsibility | DATA_MODEL.md reference |
|---|---|---|
| `SearchableScenarioQuery` | Evaluates the complete `searchable_scenario` projection predicate; the **sole and complete** mechanism governing public publication eligibility (D-025) | Section 10 |
| `ScenarioSearchService` | Accepts user filter/sort inputs; delegates eligibility to `SearchableScenarioQuery`; returns paginated results | Sections 10.3–10.5 |
| `SortService` | Implements confirmed sort orders: discovery, new, last-checked, title, seeded-random, free-first; boundary for seeded-random algorithm (D-036) | Section 10.5 |
| `ProductClassificationService` | Rules-first classification (D-011, D-020); produces `EvidencedValue<ProductClassCode>` | Section 3.2 |
| `AllAgesGateService` | Evaluates all-ages evidence; applies `hold_age_unknown` when evidence is missing, ambiguous, insufficient, or conflicting (D-012) | Sections 3.2, 3.5 |
| `NormalizationService` | Runs alias normalization pipeline; updates `ObservedAlias` records; triggers reanalysis when any key component changes | Section 6.3; SYSTEM_NORMALIZATION.md |
| `HoldAgeUnknownPurgeService` | Executes the irreversible purge/redaction on hold_age_unknown transition; appends tombstone to `NormalizationHistory`; prohibited payloads are not preserved (D-026) | Section 3.5 |
| `PublicationGateService` | Evaluates all per-field and per-relationship publication gates; no field bypasses the gate | Section 10.1 |

**Bounded service contracts:**
- `SearchableScenarioQuery` is the sole mechanism for publication eligibility. No ad-hoc eligibility check in route handlers or the presentation layer may bypass or supplement it.
- `HoldAgeUnknownPurgeService` is the sole mechanism for irreversible redaction. It must not reconstruct purged content from any source, including prior history records or cached source snapshots.
- `SortService.seededRandom(seed, items)` — seed is computed externally (date + optional per-session token, no server-side state required for anonymous users); the sort is deterministic given the seed; algorithm is confirmed here as boundary-only, deferred to the seeded-random implementation stage.
- `NormalizationService` skips reanalysis only when all three of (`content_version`, `normalizer_version`, `registry_version`) are unchanged since the last analysis. A change to any one triggers a new `NormalizationHistory` record.

### 1.4 Adapters

Adapters are implemented in later stages, not Stage 4 or Stage 5 scaffold, unless noted:

| Adapter | Provider | Authorized in |
|---|---|---|
| Database adapter | Drizzle ORM → Supabase PostgreSQL 17 | After provisioning Issue |
| Next.js API Route adapter | Route handlers invoking service layer | Stage 5 scaffold |
| Fixture adapter | TypeScript/JSON fixture files → repository interfaces (for fixture-backed search stage) | Stage 5 scaffold |
| BOOTH HTTP collection adapter | HTTP client for public BOOTH product pages | Later dedicated collection stage (after Stage 1b preflight) |

---

## 2. Technology Decision Record

Research was performed 2026-08-02 against official primary sources. Sources that could not be accessed are flagged **[UNVERIFIED]** with a verification gate before the relevant implementation step.

### 2.1 Frontend Framework: Next.js

| Field | Value |
|---|---|
| **Selected** | Next.js |
| **Confirmed stable version** | 16.2.12 |
| **Docs last updated** | 2026-07-22 |
| **License** | MIT (project convention; independent verification of the license file from the repository is recommended before first build) |
| **Minimum Node.js** | 20.9 |
| **Minimum TypeScript** | 5.1.0 |
| **Source** | https://nextjs.org/docs/app/getting-started/installation (accessed 2026-08-02) |
| **Support policy** | Maintained by Vercel; the major version in current docs (16.x) receives active support; earlier major versions receive declining security patches |
| **Uncertainty** | License file not directly confirmed; project MIT convention is well-established |

**Reason:** App Router supports static site generation (SSG) for fixture-backed initial stage and server-side rendering (SSR) for database-backed later stage without a framework switch. Tailwind CSS, ESLint, and TypeScript integration is default. Faceted search and navigation requirements from PRODUCT_REQUIREMENTS.md are a natural fit.

### 2.2 Language and Runtime: TypeScript + Node.js

| Field | Value |
|---|---|
| **Language** | TypeScript |
| **Confirmed version** | 7.0 |
| **TypeScript license** | Apache 2.0 (indicated by Microsoft copyright on typescriptlang.org; independent license file verification recommended before first build) |
| **Source (TypeScript)** | https://www.typescriptlang.org/ (accessed 2026-08-02) |
| **Runtime** | Node.js |
| **LTS versions as of 2026-08-02** | v22 (Jod), v24 (Krypton) — both supported per nodejs.org (accessed 2026-08-02) |
| **Minimum for Next.js 16** | Node.js 20.9 |
| **Package manager** | pnpm (default from `create-next-app`; npm is also acceptable) |
| **Source (Node.js)** | https://nodejs.org/en/about/previous-releases (accessed 2026-08-02) |
| **Uncertainty** | The Node.js release page showed a date of July 28, 2026 for both v22 and v24, which likely reflects a phase transition (Active LTS → Maintenance LTS) rather than full EOL. Verify the support phase for the selected Node.js version before beginning development. TypeScript license file not directly confirmed. |

### 2.3 Database Engine: PostgreSQL

| Field | Value |
|---|---|
| **Engine** | PostgreSQL |
| **Selected version** | 17 |
| **Version 17 EOL** | November 8, 2029 |
| **Current stable** | 18.4 (released 2025-09-25) |
| **Engine license** | PostgreSQL License (permissive open source, BSD-compatible) |
| **Source** | https://www.postgresql.org/support/versioning/ (accessed 2026-08-02) |
| **Version choice rationale** | PostgreSQL 17 provides 2029 EOL runway. PostgreSQL 18 is the current stable but may not yet be available on the managed Supabase free tier at provisioning time. PostgreSQL 17 is the safer choice; upgrade to 18 can be re-evaluated at the provisioning stage. |

### 2.4 Database Provider: Supabase

| Field | Value |
|---|---|
| **Provider** | Supabase |
| **Plan** | Free tier |
| **Provider license** | Apache 2.0 (Supabase platform code); database is PostgreSQL with PostgreSQL License |
| **Free-tier limits** | **[UNVERIFIED]** — supabase.com could not be accessed during Stage 4 research (2026-08-02). The official Supabase pricing/billing page must be verified independently before provisioning. Known characteristics from prior research that must be re-confirmed: approximately 500 MB PostgreSQL storage, project pausing on inactivity (reported as 7 days of no activity), no automatic paid-plan upgrade (project pauses instead), 2 free active projects per organization. These figures are not confirmed from an official 2026-08-02 source and must not be treated as current. |
| **Auto-upgrade** | **[UNVERIFIED]** — must confirm from official source before provisioning |
| **Provisioning gate** | Database provisioning is **not authorized in Stage 4**. It requires a separate provisioning Issue after (a) the official free-tier limits are verified from supabase.com and (b) the physical schema in [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md) is confirmed in this ADR merge. |

### 2.5 ORM and Query Layer: Drizzle ORM

| Field | Value |
|---|---|
| **ORM** | Drizzle ORM |
| **License** | MIT (reported by npm registry and project documentation; **direct license file from the official repository could not be accessed on 2026-08-02** — independent verification of https://github.com/drizzle-team/drizzle-orm/blob/main/LICENSE is required before adding to package.json) |
| **Migration tool** | Drizzle Kit (generates SQL migration files for human review before application) |
| **PostgreSQL support** | Confirmed (Drizzle is PostgreSQL-first) |
| **Runtime** | Node.js (compatible with Next.js 16 / Node 20.9+) |
| **Maintenance** | Actively maintained as of 2026-08-02 based on npm registry; independent activity verification recommended |
| **Source** | https://orm.drizzle.team (access blocked on 2026-08-02; npm registry consulted as secondary source) |
| **Verification gate** | License must be independently confirmed before adoption at scaffold stage |

**Migration policy:** Drizzle Kit generates SQL migration files. All migration files are reviewed before applying. No auto-apply in production. The first migration corresponds to [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md).

### 2.6 Hosting: Vercel Hobby Plan

| Field | Value |
|---|---|
| **Platform** | Vercel |
| **Plan** | Hobby (free) |
| **Non-commercial restriction** | **The Hobby plan restricts users to non-commercial, personal use only (Vercel fair use guidelines, accessed 2026-08-02).** This application must be confirmed as non-commercial by the owner before deployment on the Hobby plan. PRODUCT_REQUIREMENTS.md excludes all advertising and affiliate links, and the application has no revenue model, which supports a non-commercial classification — but the owner must independently confirm this interpretation is consistent with Vercel's fair use policy before the deployment Issue proceeds. |
| **Auto-upgrade to paid** | **None.** When usage limits are exceeded, the Hobby plan is paused (not auto-charged). Features pause until limits reset (typically 30 days). Users are notified by email as limits are approached. |
| **Key included limits** | 1,000,000 Function Invocations/month; 4 CPU-hrs active CPU; 360 GB-hrs provisioned memory; 1,000,000 Edge Requests; 100 deployments/day; 200 projects |
| **Blob storage** | Available for Hobby; specific per-month storage and transfer allowances not confirmed from the pricing page (figures were absent from the Hobby-specific listing). Confirmed: "you will not pay for any additional usage" — Blob pauses instead of charging. |
| **Source** | https://vercel.com/docs/plans/hobby (last updated 2026-06-16, accessed 2026-08-02); https://vercel.com/docs/plans (last updated 2026-06-16, accessed 2026-08-02); https://vercel.com/docs/vercel-blob/usage-and-pricing (last updated 2026-06-16, accessed 2026-08-02) |
| **Deployment gate** | Deployment is **not authorized in Stage 4**. It requires a separate deployment Issue after application scaffold. |

### 2.7 CI: GitHub Actions

| Field | Value |
|---|---|
| **Platform** | GitHub Actions |
| **Free tier** | **[UNVERIFIED]** — docs.github.com could not be accessed during Stage 4 research (2026-08-02). The official GitHub Actions billing page must be independently verified before enabling workflows. This repository is expected to be public; GitHub Actions is expected to include unlimited minutes for public repositories under long-standing documented policy. For private repositories, standard free-tier included minutes apply. These must be re-confirmed from the official source before relying on them. |
| **Security boundary** | GitHub Actions workflows run default-branch-controlled code only; no proposed-branch code executes in write-capable jobs (AGENTS.md, SECURITY.md) |

---

## 3. Rendering and API Boundary

### 3.1 Fixture-Backed Search (First Implementation Stage)

The first implementation stage uses fixture data — static TypeScript/JSON files committed to the repository — with no live database connection or network access.

- The `searchable_scenario` projection logic runs over fixture data in TypeScript at build time.
- Next.js generates static pages (SSG).
- No Supabase connection, no Drizzle ORM queries, no external service calls.
- The fixture adapter implements the repository interfaces defined in Section 1.2.
- Validates search interaction patterns, faceted filtering, and sort options before the database is provisioned.
- This stage does not require database provisioning, authentication, or billing.

### 3.2 Database-Backed Search (Later Stage)

After database provisioning (separate authorized Issue):

- Next.js Route Handlers serve as the API boundary.
- The database adapter implements repository interfaces using Drizzle ORM + Supabase PostgreSQL 17.
- The `searchable_scenario` projection is implemented as a filtered database query respecting all gates in DATA_MODEL.md Section 10.
- Connection pooling: Supabase's built-in PgBouncer connection pooler; transaction-mode pooling for serverless functions. Pooler availability on the free tier must be confirmed at provisioning time.
- All filtering, sorting, and publication gate evaluation happens in the service layer; route handlers do not contain raw SQL strings or eligibility logic.

### 3.3 API Boundary for Search

- **Route**: Next.js Route Handler (e.g., `GET /api/search`).
- **Inputs**: Filter parameters (system, PL range, play time range, tags, modality, sort order, page/cursor); all inputs are validated at the route handler boundary before reaching the service layer.
- **Outputs**: Paginated list of publishable scenario summaries; never includes exact prices, product images, adult content, held fields, or unapproved AI candidates.
- **Sort inputs (confirmed)**: Discovery (algorithm deferred), new (first_seen_at), last-checked (last_checked_at), title (observed_title.value alphabetical), seeded-random (algorithm deferred, D-036), free-first (is_free.value = true first; see D-035).
- **BOOTH product URL**: Every result includes the canonical BOOTH product URL. No internal product-detail page (D-003).
- **Unknown values**: Fields with `state = unknown` display an explicit indicator (「不明」) and are never treated as zero, false, or empty string (D-023).

---

## 4. Cost Analysis and Controls

| Provider | Source | Expected monthly cost | Auto-upgrade risk |
|---|---|---|---|
| Vercel Hobby | vercel.com/docs/plans/hobby, accessed 2026-08-02 | ¥0 | None — pauses on limit exceed; no charge |
| Supabase Free | **[UNVERIFIED — supabase.com blocked 2026-08-02]** | ¥0 (estimated; must verify before provisioning) | Requires official verification |
| GitHub Actions | **[UNVERIFIED — docs.github.com blocked 2026-08-02]** | ¥0 (expected for public repo; must verify) | Requires official verification |
| Domain (optional) | Not selected; deferred | ¥0 (or ¥100–¥200/month if added) | N/A |
| **Total expected** | | **¥0 (within ¥0–¥1,000 target)** | **None for Vercel (confirmed); requires verification for Supabase and GitHub Actions** |

**Cost controls in effect:**
1. **Vercel**: No billing is enabled. The Hobby plan cannot auto-charge on limit exceed — it pauses features. Upgrading to Pro requires explicit human action.
2. **Supabase**: No billing is enabled until a provisioning Issue explicitly authorizes it. The provisioning Issue must first independently verify from supabase.com that: (a) the free tier is within budget; (b) there is no automatic paid-plan transition.
3. **GitHub Actions**: Verified to be unlimited for public repositories before enabling any workflows that could consume significant minutes.
4. **AI budget (future)**: Daily and monthly AI limits defined in [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) apply when an AI collection stage is authorized. Not applicable in Stage 4 or Stage 5.
5. **Spend Management**: Vercel Pro spend management is not available on the Hobby plan; budget control is maintained by remaining on the Hobby plan and not enabling billing.

---

## 5. Isolation from luluportal

This application is fully isolated from `shiroku46/luluportal`. No infrastructure, code, database, authentication, deployment, environment variables, or configuration is shared. See [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) and D-008 in [DECISIONS.md](DECISIONS.md).

---

## 6. Rollback, Migration, Backup, Observability, and Data-Erasure Boundaries

### Rollback

- Normal rollback: git revert or documentation fix-forward. History is never rewritten (D-026).
- Database migration rollback: Drizzle Kit generates reversible migration files where possible. Irreversible schema changes (e.g., dropping a column after data purge) require explicit documentation in the migration file.
- Application rollback: Deploy a prior immutable build on Vercel (instant rollback via Vercel dashboard).

### Migration

- Drizzle Kit generates SQL migration files from the Drizzle schema. Each file is reviewed before applying.
- The first migration corresponds to [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md) and is authorized by the provisioning Issue.
- No migration runs in CI without explicit stage authorization. No auto-apply in production.

### Backup

- Supabase free tier backup policy: **[UNVERIFIED — must confirm from supabase.com before provisioning]**. Expected to include daily backups; retention period is unconfirmed.
- For the fixture-backed stage: all data is version-controlled in git; no database backup is needed.
- Point-in-Time Recovery (PITR) is a Supabase Pro feature; not expected to be available on the free tier. This means that a `hold_age_unknown` purge applied to the current database state cannot be undone through PITR — which is the intended behavior (irreversible redaction per D-026).

### Observability

- Vercel dashboard: runtime logs (1 hour on Hobby plan), deployment status, usage metrics.
- Supabase dashboard: query analytics, database storage metrics.
- Application-level observability (error tracking, request latency) is deferred to a later dedicated stage.
- Cost observability: Vercel and Supabase usage pages are monitored manually at each stage milestone.

### Data Erasure

- `hold_age_unknown` purge/redaction is implemented by `HoldAgeUnknownPurgeService` (Section 1.3).
- Prohibited payloads are permanently deleted from the database; only the non-descriptive tombstone record is retained in `NormalizationHistory`.
- This service is the only mechanism for performing irreversible redaction. No other code path may delete or nullify these fields outside the contract defined in DATA_MODEL.md Section 3.5.

---

## 7. Provisional Items for Later Stages

The following choices remain provisional until the referenced gate is met:

| Item | Provisional choice | Verification gate |
|---|---|---|
| Supabase free-tier limits | Assumed within bounds for MVP; specific limits unverified | Verify from official supabase.com before provisioning Issue |
| Supabase PostgreSQL version available | PostgreSQL 17 assumed | Confirm when Supabase project is inspected at provisioning |
| GitHub Actions free tier | Unlimited minutes for public repos assumed | Verify from official docs.github.com before enabling CI |
| Vercel non-commercial qualification | Application appears non-commercial per PRODUCT_REQUIREMENTS.md | Owner confirms before first deployment Issue |
| Drizzle ORM license | MIT assumed | Verify license file at github.com/drizzle-team/drizzle-orm before adding to package.json |
| Drizzle ORM version | Latest stable at scaffold time | Confirm at scaffold Issue |
| Next.js license file | MIT assumed | Verify from github.com/vercel/next.js before first build |
| TypeScript license file | Apache 2.0 assumed | Verify from github.com/microsoft/TypeScript before first build |
| Node.js support phase | v22 or v24 LTS assumed | Verify current support phase at nodejs.org before development |
| pnpm vs npm | pnpm as default from create-next-app | Either acceptable; confirm at scaffold Issue |
| Supabase PgBouncer availability | Transaction-mode pooling assumed on free tier | Confirm at provisioning |
| Seeded random algorithm | Date + session seed, deterministic | Algorithm confirmed and implemented at seeded-random stage |
| Discovery sort algorithm | Editorial/algorithmic | Deferred to a dedicated design Issue |
| Supabase backup retention | Expected daily backup; retention period unknown | Verify from official source at provisioning |
