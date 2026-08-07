# Architecture

## Status

Stage 4 architecture and technology decisions are accepted as of 2026-08-02. The logical model in [DATA_MODEL.md](DATA_MODEL.md) and the non-executable physical specification in [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md) are binding. This decision does **not** provision a database, deploy an application, enable authentication or billing, create Secrets, run migrations, or authorize live BOOTH access.

The accepted implementation baseline is a provider-neutral application core with a future fixture-backed Next.js/TypeScript adapter. PostgreSQL 17, Drizzle ORM/Kit, Supabase Free, GitHub Actions, and conditionally Vercel Hobby are bounded implementation/provider choices described below. Exact package versions are selected and pinned only when the Stage 5 scaffold is created.

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [DECISIONS.md](DECISIONS.md) | [ROADMAP.md](ROADMAP.md) | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) | [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md)

---

## Accepted Technology, Provider, and Cost ADR

**Decision date:** 2026-08-02  
**Official-source access date:** 2026-08-02

| Layer | Accepted boundary | Current evidence and constraints |
|---|---|---|
| Runtime | Node.js v24 LTS | Node.js v20 is EOL and prohibited. The exact supported v24 release is pinned at scaffold time. |
| Web framework | Latest stable Next.js 16.x verified at scaffold time | MIT license. Do not hard-code an unverified patch version in this ADR. |
| Language | TypeScript 7.x toolchain selected at scaffold time | TypeScript 7.0 was announced available on 2026-07-08. Microsoft TypeScript repositories use Apache-2.0. Exact compatible versions are pinned in the future lockfile. |
| Data model target | PostgreSQL 17 | PostgreSQL 17 is the implementation target, subject to managed-provider support verification before provisioning. PostgreSQL uses the PostgreSQL License. |
| ORM and migrations | Drizzle ORM and Drizzle Kit | Apache-2.0. PostgreSQL support and migration tooling are documented by the official repository. Exact versions are pinned at scaffold time. No executable migration is authorized in Stage 4 or Stage 5. |
| Managed database candidate | Supabase Free | $0/month; two active free projects; 500 MB database per project; 1 GB storage; 5 GB egress plus 5 GB cached egress; 50,000 MAU; 500,000 Edge Function invocations. Low-activity projects may pause after about seven days and can be restored within 90 days. Quota handling may restrict service; it must not be represented as automatic paid upgrade. No project is provisioned here. |
| CI | GitHub Actions | Standard GitHub-hosted runners are free for public repositories, so the current expected CI cost is ¥0. Private GitHub Free includes 2,000 minutes/month and 500 MB Actions storage; private overage requires an explicit budget with “Stop usage when budget limit is reached.” This is not a claim of universally unlimited use. |
| Hosting candidate | Vercel Hobby | Free, but limited to non-commercial personal use. Deployment is prohibited until the owner explicitly confirms eligibility under the then-current terms. Hobby pauses at included limits rather than automatically charging. |

### Official sources

- Next.js license: https://github.com/vercel/next.js/blob/canary/license.md
- Next.js installation and current requirements: https://nextjs.org/docs/app/getting-started/installation
- TypeScript 7.0 announcement: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- TypeScript repositories and licenses: https://github.com/microsoft/TypeScript and https://github.com/microsoft/typescript-go
- Node.js release lifecycle: https://nodejs.org/en/about/previous-releases
- PostgreSQL versioning: https://www.postgresql.org/support/versioning/
- PostgreSQL license: https://www.postgresql.org/about/licence/
- Drizzle ORM/Kit repository and releases: https://github.com/drizzle-team/drizzle-orm and https://github.com/drizzle-team/drizzle-orm/releases
- Supabase pricing: https://supabase.com/pricing
- Supabase billing: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase free-project pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Supabase billing FAQ: https://supabase.com/docs/guides/platform/billing-faq
- Supabase cost controls: https://supabase.com/docs/guides/platform/cost-control
- GitHub Actions billing and usage: https://docs.github.com/en/actions/concepts/billing-and-usage
- GitHub included usage: https://docs.github.com/en/billing/reference/product-usage-included
- Vercel Hobby: https://vercel.com/docs/plans/hobby
- Vercel plans: https://vercel.com/docs/plans
- Vercel fair-use guidance: https://vercel.com/docs/limits/fair-use-guidelines

### Cost controls

The selected baseline is expected to cost **¥0/month**:

- Supabase Free: ¥0, with pause/quota-restriction risk and manual upgrade only.
- GitHub Actions for this public repository: expected ¥0.
- Vercel Hobby: ¥0 only if the owner later confirms non-commercial eligibility; no deployment is authorized now.

No billing may be enabled. Any paid transition, including one within the broader JPY 0–1,000 target, requires a separate owner-authorized Issue that states the maximum amount, stop behavior, and rollback. Automatic paid-plan escalation is prohibited.

---

## Provider-Neutral Application Boundaries

Provider-specific adapters must implement these boundaries without changing domain meaning or weakening publication, provenance, hold, or erasure rules.

### Domain entities and value objects

The domain layer owns the entities defined in [DATA_MODEL.md](DATA_MODEL.md):

- `booth_product`, `product_component`, and `scenario`;
- `system_family`, `edition`, `system_alias`, `compatibility_relationship`, `book`, and `book_requirement`;
- `tag`, `scenario_tag`, `source_snapshot`, `normalization_history`, and hold/quality records;
- typed `EvidencedValue<T>`, immutable identifiers, normalized comparison keys, evidence references, content/normalizer/registry versions, publication decisions, and deterministic random seeds.

The public product remains exactly two layers: BOOTH product and scenario. Components are internal source representation only.

### Repository ports

The application core defines replaceable repository interfaces for:

- products, components, scenarios, and publication projections;
- normalization registries, aliases, editions, compatibility, books, and tags;
- source snapshots and append-only normalization history;
- redaction tombstones and purge audit metadata;
- fixture-backed query/search and, later, transactional persistence.

Repositories return domain objects and evidenced states, not provider rows. They may not infer `unknown`, `hold`, or `not_applicable` from null/default values.

### Application services and use cases

The approved services are:

- fixture import and validation;
- product/scenario classification and separation;
- system, edition, alias, compatibility, book, and tag normalization;
- reanalysis planning from content, normalizer, and registry versions;
- publication-gate evaluation and `searchable_scenario` projection;
- faceted search, sorting, and deterministic seeded-random ordering;
- non-sensitive observability and cost/quota reporting;
- migration planning, rollback/fix-forward, backup-readiness checks, and restricted erasure.

No service may bypass the deterministic publication projection or publish an unresolved/held relationship merely because the parent scenario is eligible.

### Adapters

Initial adapters are fixed all-ages fixtures, an in-memory repository, and a server-rendered search UI. Later adapters may include PostgreSQL/Drizzle, Supabase, BOOTH collection, and hosting, but each requires its own authorized Issue and must preserve these ports. Provider SDK objects, environment variables, HTTP clients, and database records do not enter the domain layer.

---

## Publication, Normalization, and Reanalysis

`searchable_scenario` is a provider-neutral application projection, never a source-of-truth entity. It may later be implemented as a database view, materialized view, or application query. The complete gates in [DATA_MODEL.md](DATA_MODEL.md) and [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md) remain binding, including approved product classification, confirmed all-ages status, sales state, product/scenario separation, required fields, hold/conflict state, AI approval, spoiler safety, and normalization publication state.

Relationship rows are evaluated independently. An unresolved alias, tag, compatibility relationship, or book requirement is omitted from the public projection; it does not silently suppress an otherwise eligible scenario unless a binding scenario-level gate fails.

Reanalysis is deterministic over source content version, normalizer version, and registry version. The system preserves permitted source evidence and history, never rewrites prior permitted records, and emits a new history record for materially new analysis. Seeded-random ordering is a pure application service: the same canonical eligible set plus the same seed produces the same ordering, without becoming source data.

---

## Observability and Cost Boundary

Metrics and logs may contain non-sensitive identifiers, counts, states, versions, durations, quota usage, and decision outcomes. They must not contain source bodies, descriptive payloads, adult/uncertain content, Secrets, access tokens, or reconstructable body-derived hashes after a purge.

Required observability includes publication-gate counts, hold/conflict counts, normalization version, fixture/test version, collection request counts when later authorized, provider quota signals, CI usage, database/storage use, and explicit cost estimates. Exceeding an approved free allowance stops or restricts the affected operation; it does not authorize a paid transition.

---

## Migration, Rollback, and Backup Boundary

The physical schema is a specification, not an executable migration. A future database Issue must pin versions, generate reviewed migrations, validate them against non-production data, and define forward and rollback/fix-forward procedures. Shared history is never rewritten.

Supabase Free is **not** claimed to provide Point-in-Time Recovery for this project. Backup/recovery remains a provisioning gate. Before production persistence, a later owner-authorized Issue must select a mechanism available at the approved cost, document scope/frequency/retention/storage/encryption/access controls, document restore steps, run a successful non-production restore test, and prove that recovery storage cannot resurrect data removed by a `hold_age_unknown` purge. Until then, the project must not claim backup readiness, disaster-recovery completion, PITR availability, or production persistence readiness.

---

## Restricted `hold_age_unknown` Erasure Boundary

Ordinary `source_snapshot` and `normalization_history` records for permitted content are append-only. The sole destructive exception is the restricted `HoldAgeUnknownPurgeService` transition for one immutable `booth_product.id`.

When age evidence becomes unknown or conflicting, the service must physically remove or irreversibly sanitize all prohibited descriptive/body-derived payloads and body-derived hashes in product-owned snapshots, histories, projections, caches, and later recovery material. Selection is by the product foreign key only; URL, shop, creator, or descriptive identity is never an ownership key. The transaction may retain only non-sensitive immutable audit metadata and a tombstone containing target IDs/versions, counts, decision status, and completion time that cannot reconstruct the prohibited content. The exception does not authorize ordinary mutation of permitted history.

---

## Isolation from `luluportal`

This application is fully isolated from `shiroku46/luluportal`. No code, database, authentication, Secret, environment, deployment, workflow, Issue, Pull Request, or setting is shared. It is read-only structural reference only.

---

## Stage 5 Handoff

Stage 5 is implementation-only and may create a minimal fixture-backed Next.js/TypeScript scaffold that implements the approved provider-neutral boundaries and quality gates. It may pin compatible Node.js v24 LTS, stable Next.js 16.x, and TypeScript/Drizzle development versions in a reviewed lockfile, but it must not:

- provision Supabase, PostgreSQL, Vercel, or any external service;
- run an executable migration or connect to a database;
- access live BOOTH pages, robots.txt, or terms endpoints;
- add authentication, billing, Secrets, paid plans, production data, or canonical registry facts;
- deploy, claim production readiness, or claim backup/PITR readiness;
- redesign boundaries already accepted in Stage 4.

The scaffold begins with fixed all-ages fixtures, replaceable adapters, deterministic tests, and publication/hold enforcement before rendering or filtering.

---

## Stage 9 Executable Persistence Baseline

**Decision and verification date:** 2026-08-05

Stage 9 adds a repository-only PostgreSQL-compatible persistence adapter. It does not provision or connect a hosted database.

### Implemented boundary

- Drizzle ORM `0.45.2` and Drizzle Kit `0.31.10` define and generate the committed PostgreSQL migration.
- PGlite `0.5.4` is the in-memory/offline PostgreSQL-compatible execution harness for migration, integration, and recovery tests only.
- `@electric-sql/pglite-tools` `0.4.4` provides the logical `pg_dump`-compatible recovery fixture.
- The five executable tables are `booth_product`, `scenario`, `source_snapshot`, `normalization_history`, and `redaction_tombstone`.
- Repository rows are converted back to provider-neutral domain graphs. Public eligibility is still decided exclusively by the existing application publication projection.
- SQL nulls never acquire product meaning such as zero, false, available, all-ages, approved, or empty evidence.

### Migration and recovery evidence

The committed initial migration is applied from an empty database in tests. Synthetic all-ages product/scenario graphs are written, loaded, and projected; a logical dump is restored into a second fresh database; the restored graph remains publication-equivalent.

The restricted `hold_age_unknown` transaction is then executed against the restored database. It selects only by immutable product foreign key, clears prohibited descriptive values and body-derived hashes, sanitizes product-owned snapshot/history rows, clears the complete `is_free` envelope, and writes a non-reconstructable tombstone. A second dump and restore proves that cleared payloads and unique purged hashes cannot be reconstructed while an unrelated product remains intact.

`source_snapshot` and `normalization_history` are guarded by append-only triggers. Mutation is allowed only while the product-scoped purge transaction sets the transaction-local `app.allow_age_hold_purge` flag. This does not authorize ordinary history rewriting.

### Hosted-provider gate

Supabase Free remains a future hosted candidate, not an active resource. Stage 9 creates no Supabase project, link, password, service-role key, access token, Secret, remote migration, production seed, billing, deployment, or authentication. Hosted provisioning requires a separate explicit human-action checkpoint after the repository candidate is accepted.

The repository-local logical recovery proof is not a claim of Supabase PITR, managed backup, or production disaster-recovery readiness. A later hosted-provider procedure must separately define retention, storage, access control, encryption, restore commands, and purge-safe recovery handling.

### Dependency security boundary

The verified lockfile pins Next.js `16.2.12`, eslint-config-next `16.2.12`, Vitest `3.2.7`, and a Next-scoped patched PostCSS/sharp dependency graph. `npm audit --omit=dev` reports zero vulnerabilities; the complete graph reports no high or critical advisory.

Four moderate development-only advisories remain under the current stable Drizzle Kit chain (`drizzle-kit` -> `@esbuild-kit/esm-loader` -> `@esbuild-kit/core-utils` -> `esbuild`, GHSA-67mh-4wv8-2f99). The affected esbuild development-server behavior is not used: Drizzle Kit is restricted to non-networked migration generation/checking in CI, and Drizzle Studio or any externally reachable development server is not authorized. Re-evaluate when an upstream stable Drizzle Kit release removes the chain; do not use `npm audit fix --force`.

### Verification

The Stage 9 candidate passed migration generation/checking, TypeScript, lint, 23 Vitest tests including four persistence/recovery tests, production build, repository export/validation guards, 49 Python tests, and dependency audit enforcement without contacting BOOTH, Supabase, or any external database.


## Stage 17 Reviewed Overlay Boundary

The reviewed overlay is a read-only application service over the existing provider-neutral graph repository, immutable review-case/decision records, and immutable application projection. It never updates persisted product/scenario JSONB or copies values into review tables.

The service supports only an explicit fixed-field allowlist. It verifies the source envelope against the review-case metadata fingerprint and exact content/normalizer/registry key, returns a deeply detached graph, and changes only the effective `reviewState`. Existing publication logic then evaluates that detached graph under its unchanged fail-closed rules.

Array-row fields remain excluded until stable row-level identity exists. No hosted provider, network access, authentication, AI inference, UI, or public review-history boundary is introduced.

## Stage 18 reviewed overlay batch composition

Stage 18 adds a provider-neutral read layer that composes multiple exact-version Stage 17 overlays over one detached product graph. Callers must provide explicit `ReviewApplicationTarget` values; the layer never chooses a latest case, decision, normalizer, or registry version. Valid targets are ordered by entity type, entity ID, field path, content version, normalizer version, and registry version before sequential materialization. Cross-product and duplicate exact-target batches are rejected. Per-target omissions remain explicit, while the source graph and all persisted review records remain unchanged.

`PostgresReviewedOverlayBatchService` resolves each supplied exact target through the existing product graph, review case, decision, and application repositories. Missing cases are represented as `unapplied` report entries rather than silently disappearing. No new table or migration is introduced.

## Stage 19 reviewed publication index

Stage 19 adds a deterministic provider-neutral read layer above Stage 18. Explicit product requests are resolved into reviewed overlay batches, then every detached scenario is passed through the unchanged fail-closed publication projection. Product IDs and scenario IDs are canonically ordered, and no storage enumeration or latest-version heuristic is introduced.

`PostgresReviewedPublicationIndexService` accepts only explicit `{ productId, targets }` requests. Missing products and exact targets remain visible in immutable reports. Search can consume the resulting `PublicScenario` rows through `searchPublicRows`, which reuses the existing filter/sort implementation without re-projecting raw source graphs.

## Stage 20 reviewed search orchestration

Stage 20 composes the Stage 19 explicit reviewed publication-index service with the existing `searchPublicRows` function. It normalizes one supplied canonical query, executes only over already-public rows, and returns the unchanged publication/review report beside the filtered result set. It does not enumerate storage, select historical versions, or introduce a new ranking model.

## Stage 23 fixture Preview integration

The public fixture Preview now enters the same provider-neutral read chain used by the reviewed data path: explicit fixture products are grouped with their scenarios, materialized as empty-target Stage 18 reviewed graphs, composed into the Stage 19 publication index, and executed through Stage 20 reviewed search. The fixture dataset remains synthetic and no persistence or network provider is introduced.

## Stage 24 reviewed-search source port

The application-facing search boundary is now the async `ReviewedSearchSource` port. The fixture Preview implements this port through the Stage 23 adapter, while `PostgresReviewedSearchSource` binds an explicit immutable set of product/target requests to the existing persistence-backed Stage 20 service. The page remains fixture-backed; provider selection is not automatic and no hosted connection is introduced.

## Stage 30 identity-only discovery persistence boundary

`PostgresDiscoveryManifestRepository` is an offline adapter beneath the Stage 29 identity-only manifest contract. It persists only validated fingerprinted discovery manifests in local PostgreSQL-compatible storage and exposes exact-fingerprint install/load operations. There is no latest-manifest discovery, product promotion, network adapter, scheduler, or public projection at this boundary.

The `discovery_manifest` table is append-only. Database checks bind the duplicated source SHA, parser version, fixed listing URL, listing raw hash, schema version, and manifest fingerprint to the JSON envelope; application validation re-verifies the full Stage 29 contract after load.

## Stage 31 persisted discovery intake service

`DiscoveryIntakeService` composes the Stage 30 exact-fingerprint repository with the Stage 29 identity-only adapter. It is a read-only application service: no enumeration, implicit latest selection, writes, product promotion, network access, or public projection are permitted. Its immutable report carries only source provenance and blocked identity records.

## Stage 34 production-readiness boundary

`evaluateProductionReadiness()` is a provider-neutral, pure fail-closed gate over five explicit prerequisites: collection access, production data, hosted database, backup/restore, and production deployment. It consumes bounded metadata references only and has no provider SDK, network client, deployment effect, persistence mutation, or UI route.

The current checkpoint remains not ready. A successful repository build, local PostgreSQL test, Vercel preview/production-branch configuration, or BOOTH policy review cannot independently make the application production-ready. External gates remain separately authorized and evidence-bound.

