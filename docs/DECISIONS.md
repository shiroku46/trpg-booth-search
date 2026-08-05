# Decisions

## Status

This is the current decision register for the TRPG BOOTH search helper. Decisions D-001 through D-034 are accepted and binding unless explicitly marked historical/superseded. Stage 4 technology, provider, physical-schema, application-boundary, and expected-cost decisions were accepted on 2026-08-02 from the official sources listed in D-028. Acceptance does not mean that any provider has been provisioned, any application has been deployed, billing has been enabled, or live BOOTH access has been authorized.

Explicit pending decisions remain fail-closed. A pending item may not be inferred from an accepted neighbouring decision.

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [ROADMAP.md](ROADMAP.md) | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) | [ARCHITECTURE.md](ARCHITECTURE.md) | [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) | [DATA_MODEL.md](DATA_MODEL.md) | [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md)

---

## Accepted Product and Compliance Decisions

### D-001 — BOOTH-only source for MVP

The MVP discovers TRPG scenarios from BOOTH only. Other marketplaces are outside scope until a separately researched and authorized Issue adds them.

### D-002 — All-ages content only

Only confirmed all-ages content may be requested, stored, normalized, searched, or published. R-18, R-18G, age-gated, conflicting, and age-uncertain content is excluded at every layer.

### D-003 — Purchase, payment, and download remain on BOOTH

The application is discovery-only. Results link to the original BOOTH product page; no checkout, payment, download, affiliate, or internal product-detail transaction flow is created.

### D-004 — Two public layers

The public model consists of BOOTH product and individual scenario. A product may contain multiple scenarios. Internal source components may represent variants but never form a third public search layer.

### D-005 — No accounts or per-user state in MVP

The MVP has no login, account, favorite, personal list, or persistent user profile. A future account feature requires separate privacy and security design.

### D-006 — Japanese-only MVP

The MVP UI and content presentation are Japanese-only. Internationalization is deferred.

### D-007 — Structural reference and distinct visual direction

VRCFinder is a structural search-UX reference only. The accepted visual direction is a distinct retro Japanese archive-room design and must not imitate VRCFinder’s visual identity.

### D-008 — Full isolation from `luluportal`

`shiroku46/luluportal` is read-only reference only. No code, database, authentication, environment, Secret, deployment, Issue, Pull Request, workflow, or setting is shared.

### D-009 — Historical combined robots/terms gate

D-009 is retained as history and is operationally superseded by D-021. The active rule separates the robots.txt gate for a bounded listing/detail run from the full-current-terms gate for production collection. Neither gate blocks documentation-only design.

### D-010 — Union discovery entry points

Future discovery uses a deduplicated union of bounded BOOTH category, scenario-oriented tag, selected keyword, new-item, and canonical product-page entry points. Entry-point membership is candidate evidence, never final scenario classification.

### D-011 — Rules-first product classification

Classification is deterministic rules-first. AI may propose candidates only for fields still ambiguous after approved rules and may never auto-publish. Candidate classes include single scenario, collection, mixed scenario/material, material-only, rulebook/system, supplement, replay/reading material, update/DLC-only, non-TRPG, and hold/unknown. Product and child scenario/material classification remain separate.

### D-012 — Strict age-uncertainty hold

If all-ages evidence is absent, conflicting, gated, or uncertain, the product enters `hold_age_unknown`; descriptive content is not retained and nothing is published. Absence of an adult label is not proof of all-ages status.

### D-013 — Conservative bounded pilot

The first later network pilot is limited to at most 20 listing/detail requests total. Before a new cadence decision, the research ceiling is at most 100 requests/day. Requests are unauthenticated public GET/HEAD, one concurrent, at least 10 seconds apart with jitter. Stop on robots restriction/unavailability for the intended run, 401/403/429, CAPTCHA/challenge, repeated 5xx, age/access gates, or changed access behaviour. No proxy rotation, identity rotation, browser circumvention, or login cookies. These are project limits, not official BOOTH allowances.

### D-014 — Separate system family and edition

`system_family` and `edition` are separate entities. A scenario may identify a family while its edition remains explicitly unknown.

### D-015 — Preserve aliases verbatim

Observed alias text is immutable source evidence. A separately stored normalized comparison key supports matching; approved canonical mapping is reviewed and does not overwrite the observed text. Collisions remain held until resolved.

### D-016 — Fail-closed edition inference

Without explicit approved evidence, edition is `edition_unknown`. Publication date, popularity, shop, filename, price, or an ambiguous keyword may not assign an edition.

### D-017 — Controlled compatibility vocabulary

Compatibility relationships use only `native`, `explicitly_compatible`, `conversion_provided`, `dual_or_multi_edition`, `derived_candidate`, or `unknown`. Non-native relationships require evidence; derived candidates are not auto-published.

### D-018 — Separate book identity and scenario requirement

`book` identity and scenario-scoped `book_requirement` relationships are separate. Required, optional, and one-of groups remain distinguishable, and observed unresolved titles are preserved as evidence.

### D-019 — Reviewed, versioned registry beginning empty

The canonical system/edition/book registry begins empty and grows only through reviewed Issues/PRs with evidence. Versions and history are append-only; silent remapping is prohibited. Unknown, conflict, hold, alias-hit, and review metrics are tracked.

### D-020 — Four-level extraction precedence

Extraction order is: explicit structured/labelled source evidence; exact approved alias mapping; deterministic contextual rule with documented evidence; AI candidate for the remaining ambiguity. AI output remains a candidate until reviewed.

### D-021 — Endpoint/run-level fail-closed collection boundary

Low-load analysis of public BOOTH product information is permitted in principle under the recorded official BOOTH guideline and clarification. It is not a blanket authorization. Every future endpoint/run stops or remains disabled on robots restriction/unavailability for that run, 401/403/429, CAPTCHA/challenge, repeated 5xx, age/access-control boundaries, harmful load, likely rights infringement, or material endpoint-specific compliance uncertainty. Full crawl, production collection, bulk download, authentication bypass, and access-control circumvention remain prohibited. Direct review of current master/individual terms is required before production collection.

Official basis recorded on 2026-08-01:
- https://booth.pm/guidelines
- https://booth.pm/announcements/898
- https://booth.pm/announcements/949
- https://booth.pm/announcements/950

---

## Accepted Logical-Model Decisions

### D-022 — Logical schema before provider implementation

[DATA_MODEL.md](DATA_MODEL.md) is technology-neutral and binding. Provider-specific SQL types, UUID encoding, indexes, ORM mapping, partitioning, and migration implementation follow the logical contracts rather than redefining them.

### D-023 — Explicit `EvidencedValue<T>` state

A field that may be known, unknown, held, or not applicable uses an explicit typed state envelope. Null, zero, false, empty string, or a default category may not silently mean unknown. Public filters never reinterpret an unresolved state as a real value.

### D-024 — Internal product components

`product_component` preserves source variants beneath one product and may link to a scenario, but it is not directly searchable or public. Public eligibility remains scenario-level through the publication projection.

### D-025 — Deterministic `searchable_scenario` as sole public gate

Public eligibility is determined only by the complete deterministic projection in [DATA_MODEL.md](DATA_MODEL.md) and [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md). Required product classification, all-ages, sales, separation, required-field, hold/conflict, AI approval, spoiler, and normalization gates must pass. Ad-hoc application checks may not bypass or broaden the projection.

### D-026 — Append-only permitted history with narrow compliance purge

Source snapshots and normalization history for permitted non-sensitive content are append-only. Reanalysis appends a new record keyed by content, normalizer, and registry versions. Shared history is never rewritten.

The sole destructive exception is transition to `hold_age_unknown`: prohibited descriptive/body-derived payloads and body-derived hashes must be physically removed or irreversibly sanitized. Append-only retention never overrides D-002/D-012 or [DATA_MODEL.md](DATA_MODEL.md) Section 3.5. Only non-sensitive, non-reconstructable redaction metadata/tombstones remain immutable after completion.

---

## Accepted Stage 4 Architecture Decisions

### D-027 — Physical encoding

Every `EvidencedValue<T>` is encoded as a non-null tagged JSONB envelope. Timestamps are `TIMESTAMPTZ` in UTC; identifiers are UUID primary keys; names are `snake_case`; controlled vocabularies use explicit constraints. Exact monetary price columns are prohibited. [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md) is a non-executable specification, not a migration.

### D-028 — Accepted technology/provider/cost ADR

**Decision date and official-source access date:** 2026-08-02.

The accepted bounded implementation baseline is:

- Node.js v24 LTS; EOL v20 is prohibited.
- Latest stable Next.js 16.x verified and pinned at scaffold time; Next.js is MIT licensed.
- TypeScript 7.x compatible toolchain pinned at scaffold time; TypeScript 7.0 was announced available on 2026-07-08; Microsoft TypeScript repositories use Apache-2.0.
- PostgreSQL 17 target, subject to managed-provider support verification before provisioning.
- Drizzle ORM and Drizzle Kit, Apache-2.0, with exact compatible versions pinned at scaffold time.
- Supabase Free as the bounded managed-PostgreSQL candidate: $0/month; two active projects; 500 MB database/project; 1 GB storage; 5 GB egress plus 5 GB cached egress; 50,000 MAU; 500,000 Edge Function invocations; low-activity pause risk and restore window; restriction/grace behaviour rather than an assumed automatic paid upgrade. No Supabase project is created by this decision.
- GitHub Actions standard hosted runners for the current public repository, expected ¥0. Private GitHub Free limits and a “Stop usage when budget limit is reached” guard apply if visibility/usage changes; Actions is not universally unlimited.
- Vercel Hobby is only a conditional free hosting candidate. Deployment is prohibited until the owner confirms non-commercial personal-use eligibility under then-current terms. Included-limit pauses are not permission to upgrade.
- Expected selected baseline: **¥0/month**. Billing and automatic paid transitions are prohibited. Any paid transition requires a separate owner-authorized Issue.

Official sources:
- https://github.com/vercel/next.js/blob/canary/license.md
- https://nextjs.org/docs/app/getting-started/installation
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- https://github.com/microsoft/TypeScript
- https://github.com/microsoft/typescript-go
- https://nodejs.org/en/about/previous-releases
- https://www.postgresql.org/support/versioning/
- https://www.postgresql.org/about/licence/
- https://github.com/drizzle-team/drizzle-orm
- https://github.com/drizzle-team/drizzle-orm/releases
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://supabase.com/docs/guides/platform/billing-faq
- https://supabase.com/docs/guides/platform/cost-control
- https://docs.github.com/en/actions/concepts/billing-and-usage
- https://docs.github.com/en/billing/reference/product-usage-included
- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/plans
- https://vercel.com/docs/limits/fair-use-guidelines

This resolves architectural PD-001, PD-003, PD-005, and the design portion of PD-008. It does not authorize provisioning, deployment, executable migrations, or backup-readiness claims.

### D-029 — Provider-neutral application boundaries and projection

The domain core owns entities/value objects, evidence states, classification, normalization, publication, reanalysis, deterministic seeded-random, and erasure rules. Replaceable ports cover product/scenario, registry, evidence/history, projection, fixtures, and later persistence. Services own classification/separation, normalization, publication, search, reanalysis, observability/cost, migration/rollback/backup checks, and restricted erasure. Provider SDK/row types remain in adapters.

`searchable_scenario` is a provider-neutral application projection, not a source-of-truth table. It may later be a database view, materialized view, or application query. Relationship rows are independently gated and omitted when unresolved; an ineligible relationship does not suppress an otherwise eligible scenario unless a scenario-level gate fails.

### D-030 — Product-FK-scoped `hold_age_unknown` purge

`HoldAgeUnknownPurgeService` targets exactly one immutable `booth_product.id`. Owned snapshots/history are selected by `source_snapshot.booth_product_id` and equivalent explicit foreign keys only. URL, shop, creator, or descriptive identity is never an ownership key. The transaction removes/sanitizes prohibited payload and hashes, records target non-payload IDs/versions and counts, verifies completion, and retains only a non-reconstructable tombstone. It may not mutate ordinary permitted history or another product’s rows.

### D-031 — Backup/recovery remains a provisioning gate

Supabase Free is not claimed to provide PITR for this project. Before production persistence, a later owner-authorized Issue must select a mechanism available at the approved cost; document scope, frequency, retention, storage, encryption, and access controls; document restore steps; complete a successful non-production restore test; prove recovery storage cannot resurrect `hold_age_unknown`-purged content; and obtain explicit approval for any paid capability. Until then, no backup readiness, PITR, disaster-recovery completion, or production persistence readiness may be claimed.

### D-032 — Exact-SHA, two-step BOOTH preflight and bounded pilot

**Decision date:** 2026-08-04.

The Stage 8 pilot is manual, read-only, credential-free, and bound to one immutable reviewed source SHA. Only the repository default branch or fixed same-repository branch `fix/stage8-issue-79-collection-pilot` may dispatch the workflow. Network mode requires a lowercase 40-hex `candidate_sha` equal to `github.sha`; arbitrary branches, stale SHA inputs, symbolic-branch-only authorization, automatic triggers, schedules, Secrets, OIDC, cookies, proxies, browser automation, and repository-write permission are prohibited.

The only current listing endpoint is `https://booth.pm/ja/browse/TRPG?adult=none&type=digital`, with at most one listing request. An explicit first run retrieves current robots, guideline, and Terms inputs and stops before listing access unless the exact resulting policy digest has already been independently reviewed. A second run may request the listing only from the same reviewed source SHA with the matching digest. Policy redirects are same-origin and bounded; listing redirects are never followed. The run is single-concurrency, has strict connect/read/total timeouts and byte ceilings, no retries, and stops on restrictive or unavailable policy evidence, SHA/digest mismatch, 401/403/429/5xx, unexpected status/type, challenge/login/age/adult signals, timeout, network error, or changed behavior.

Evidence is minimized to fixed URLs, status/type, request/redirect counts and timing, raw/normalized hashes and versions, endpoint/policy-review decisions, transport limits, exact source ref/SHA, workflow ref, run ID, and stop reason. Full bodies/descriptions, exact prices, cookies, sensitive headers, images/files, and adult/uncertain descriptive content are prohibited. The workflow uses `contents: read` only and uploads a digest-bound artifact for independent coordinator verification and durable Issue #79 recording. A correctly stopped preflight is acceptable evidence and is not immediately retried. This decision authorizes neither production collection nor a full crawl.

### D-033 — Reviewed non-exact free-first ordering

**Decision date:** 2026-08-06.

The confirmed Free-first sort uses only `booth_product.is_free: EvidencedValue<Boolean>` and never exact price. A row enters the leading free group only when the value is `known(true)` with approved review, high/medium confidence, non-empty evidence, complete content/check provenance, no conflict, and no hold. Approved AI-origin evidence remains subject to the same explicit approval rule.

Eligible `known(false)` remains distinguishable from explicit `unknown` and omitted/ineligible states in the provider-neutral public projection, but none is labelled “paid”. Unknown, not-applicable, hold, missing, rejected, needs-more-evidence, low/unresolved-confidence, empty-evidence, conflicted, incomplete-provenance, and unapproved-AI values never enter the leading group and are never coerced to false. Free-first changes ordering only, preserves publication eligibility and result membership, and uses the existing stable Japanese title/ID order inside each group.

The existing nullable PostgreSQL JSONB envelope is sufficient. SQL null maps to omitted, repository round trips preserve true/false/unknown/missing, and `hold_age_unknown` purge continues to clear the field. No schema migration, exact-price field, currency value, paid/free filter, popularity signal, rating, or recommendation is authorized. This resolves former PD-009 through Issue #101.
### D-034 — Reviewed initial canonical registry v1

**Decision date:** 2026-08-06.

`registry-2026-08-06.1` is the first accepted provider-neutral identity registry. It contains four immutable `system_family` records, four reviewed `edition` records, eight bounded `book` records, and twenty-three approved alias records. The inclusion set is architecture-driven: multiple editions, an editionless Web-rule system, a revised rulebook, and a family/edition with multiple core volumes. It is not a popularity, rating, recommendation, sales, or completeness claim.

Canonical IDs remain separate from Japanese labels. Source-observed aliases preserve original text and carry official evidence URL/location, confidence, review state, observation dates, normalizer version, and generated comparison key. `system-normalizer-v1` applies the accepted NFC, width, case, whitespace, and punctuation pipeline without rewriting source text. Resolution is target-type-aware; cross-type matches remain `ambiguous`, same-type collisions become `hold_alias_conflict`, and unregistered text returns `no_match`. No resolver may guess a preferred edition or book.

Version 1 accepts identity facts only from the first-party KADOKAWA CoC pages, TEAM DICETOUS Emoklore pages, 冒険企画局 Shinobigami pages, and Group SNE/KADOKAWA Sword World pages listed in [REGISTRY_INITIAL_V1.md](REGISTRY_INITIAL_V1.md). It stores no exact price, currency, image, copied description, popularity signal, user data, or BOOTH product record.

The registry is repository data and deterministic code only. It is not a PostgreSQL seed, hosted resource, live collector input, or authorization to replace the synthetic fixture Preview. Collection, persistence seeding, and public-filter integration each require a later reviewed Issue. This resolves former PD-007 through Issue #105.
---

## Pending Decisions

Pending decisions are not authorized implementation details.

### PD-002 — BOOTH collection mechanism

Choose the exact API/scraping/RSS/other access mechanism only after the Stage 1b robots.txt preflight clears intended endpoints. Production additionally requires direct review of the current master and individual terms, pilot evidence, and a separate production authorization. D-013 and D-021 remain binding.

### PD-004 — AI provider and model

Select an AI provider/model only in a separate Issue with enforceable daily/monthly limits, privacy review, reproducible evaluation, and a rule that candidates never auto-publish.

### PD-006 — Rating and recommendation

Rating/recommendation sorting is post-MVP and requires separate product, moderation, and data-model design.


### PD-010 — Backup/recovery mechanism

Select and test the recovery mechanism required by D-031 before production persistence. The solution must fit the approved cost, have documented retention/access/restore behaviour, and be incapable of restoring prohibited purged content.

---

## Resolved Pending-Decision Map

| Former pending item | Resolution |
|---|---|
| PD-001 technology stack | Resolved architecturally by D-028; exact versions pinned at scaffold/provisioning time. |
| PD-003 database provider/schema | Physical schema resolved by D-027 and [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md); Supabase remains an unprovisioned bounded candidate under D-028. |
| PD-005 deployment/hosting | Vercel Hobby accepted only as a conditional candidate under D-028; deployment still requires eligibility confirmation and a separate Issue. |
| PD-008 provider-specific model design | Design resolved by D-027–D-030; executable ORM/migration/provisioning remains later implementation. |
| PD-007 initial registry contents | Resolved by D-034 and [REGISTRY_INITIAL_V1.md](REGISTRY_INITIAL_V1.md); collection, hosted seeding, and public UI integration remain separate later Issues. |

No resolved entry authorizes an external resource, billing, Secret, deployment, live collection, or production data.

## PD-011 — Execute persistence locally before hosted provisioning

**Status:** Accepted

**Date:** 2026-08-05

**Issue:** #85

### Decision

Implement the MVP persistence boundary as committed PostgreSQL migrations plus a provider-neutral Drizzle repository adapter, and validate it with in-memory PGlite before creating any hosted database.

The accepted repository-only slice contains product/scenario identity and evidenced envelopes, product-owned source snapshots, append-only normalization history, a restricted product-FK `hold_age_unknown` purge, non-reconstructable purge tombstones, and logical dump/restore tests before and after purge.

Supabase Free remains the future hosted candidate. Creating/selecting a project, linking the CLI, supplying credentials, running remote migrations, enabling billing, or deploying is a separate human-action gate and is not implied by this decision.

### Rationale

This separates schema/recovery correctness from provider credentials and cost, preserves the domain/publication boundary, and proves that recovery material cannot resurrect content removed by the binding age-unknown purge before any remote resource exists.

### Dependency decision

Production dependencies must audit clean; high and critical findings anywhere in the lockfile block acceptance. The current stable Drizzle Kit chain retains four moderate development-only esbuild-loader findings. They are accepted temporarily because migration generation/checking runs only in isolated CI with no externally reachable development server. Drizzle Studio is prohibited. The exception expires when a compatible stable upstream release removes the chain.

### Consequences

- PGlite is a local/test harness, not the production database provider.
- The committed SQL migration is append-only once merged; corrections use a new migration.
- Public search still consumes domain graphs through the existing fail-closed projection rather than querying raw provider rows directly.
- Repository-local dump/restore evidence does not claim managed backup/PITR readiness.
- No hosted resource, Secret, billing, or deployment is created by Stage 9.
