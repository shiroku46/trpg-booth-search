# Decisions

## Status

This document records accepted decisions and explicit pending decisions for the TRPG BOOTH search helper. Provisional technology, BOOTH collection methods, current terms, robots rules, pricing, and free-tier limits are **not** recorded as decided here — they remain pending research.

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [ROADMAP.md](ROADMAP.md) | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) | [ARCHITECTURE.md](ARCHITECTURE.md) | [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md)

---

## Accepted Decisions

### D-001 — BOOTH-only source for MVP

| Field | Value |
|---|---|
| **Decision** | The MVP collects data from BOOTH only. No other marketplace or platform is included. |
| **Reason** | Focused scope reduces implementation complexity and legal surface area for the initial product. |
| **Rejected alternatives** | Multi-platform (DLsite, pixivFANBOX, etc.) from launch — deferred, not rejected permanently. |
| **Impact** | All data collection, search, and display logic is designed around BOOTH's structure. Future platform extension requires a new research Issue. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #10 product requirements: "MVP source and scope: BOOTH only" |
| **Conditions for revisiting** | A future Issue explicitly authorizes additional platforms after legal and technical research. |

---

### D-002 — All-ages content only; strict R-18/R-18G exclusion

| Field | Value |
|---|---|
| **Decision** | Only all-ages TRPG scenarios are collected, stored, and published. R-18 and R-18G content is excluded at every layer. |
| **Reason** | Simplifies legal compliance, reduces moderation burden, and sets a clear safe boundary for MVP. |
| **Rejected alternatives** | Optional adult-content toggle — deferred, not rejected permanently. |
| **Impact** | All-ages boundary must be enforced at collection, storage, and display layers. See [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md). |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #10 product requirements: "MVP exclusions: R-18/R-18G" |
| **Conditions for revisiting** | A future Issue explicitly authorizes adult content after separate legal review and platform policy confirmation. |

---

### D-003 — Purchase, payment, and download remain on BOOTH

| Field | Value |
|---|---|
| **Decision** | This application is discovery-only. Purchase, payment, and download flows are not replicated. Users navigate to BOOTH to transact. |
| **Reason** | Avoids legal liability for payment processing, respects BOOTH's terms, and reduces scope. |
| **Rejected alternatives** | Embedded purchase flow — not planned. |
| **Impact** | Every scenario search result includes a direct link to the BOOTH product page. No internal checkout or download handling. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #10 product requirements: "direct navigation from scenario search results to the parent BOOTH product page" |
| **Conditions for revisiting** | Not expected to be revisited. |

---

### D-004 — Two-layer product/scenario model

| Field | Value |
|---|---|
| **Decision** | Data is modelled as a BOOTH-product layer (one record per BOOTH page) and an individual-scenario layer (one or more records per product). |
| **Reason** | BOOTH products can contain scenario collections. Separating layers allows accurate scenario-level search while preserving product-level provenance. |
| **Rejected alternatives** | Flat single-layer model — rejected because it cannot represent multi-scenario products accurately. |
| **Impact** | Database schema, collection logic, and search queries must account for the two-layer relationship. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #10 product requirements: "BOOTH-product and individual-scenario two-layer model" |
| **Conditions for revisiting** | Evidence that the two-layer model causes significant query or maintenance burden without proportional benefit. |

---

### D-005 — No accounts, login, or per-user state in MVP

| Field | Value |
|---|---|
| **Decision** | The MVP has no user authentication, accounts, favorites, or personal lists. |
| **Reason** | Reduces complexity, avoids privacy obligations for user data, and keeps MVP scope minimal. |
| **Rejected alternatives** | Optional login with saved searches — deferred, not rejected permanently. |
| **Impact** | No authentication infrastructure is required for MVP. All state is session-local or URL-based. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #10 product requirements: "MVP exclusions: accounts, login, favorites" |
| **Conditions for revisiting** | A future Issue explicitly scopes user accounts after privacy review. |

---

### D-006 — Japanese-only MVP

| Field | Value |
|---|---|
| **Decision** | The application UI and all content is Japanese-only for MVP. Internationalization (i18n) is out of scope. |
| **Reason** | Target audience is Japanese-language TRPG players. BOOTH content is predominantly in Japanese. Adding i18n infrastructure before content exists is premature. |
| **Rejected alternatives** | English UI with Japanese content — rejected. Bilingual from launch — deferred. |
| **Impact** | All UI strings, search, and metadata are in Japanese. No translation layer is built. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #10 product requirements: "Japanese-only MVP" |
| **Conditions for revisiting** | Demonstrated demand from non-Japanese users, or a future Issue scoping localization. |

---

### D-007 — VRCFinder as structural reference only; retro archive-room visual direction

| Field | Value |
|---|---|
| **Decision** | VRCFinder is used only as a structural reference for search interaction patterns. The visual design direction is a distinct retro Japanese archive-room aesthetic. |
| **Reason** | VRCFinder demonstrates effective faceted search UX for similar content. The retro archive design differentiates this product and suits TRPG culture. |
| **Rejected alternatives** | Adopting VRCFinder's visual design — rejected. Modern SaaS design — rejected for MVP. |
| **Impact** | Design work must follow the archive-room direction, not imitate VRCFinder visually. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #10 product requirements: "VRCFinder as a structural reference only and the distinct retro Japanese archive-room design direction" |
| **Conditions for revisiting** | User research showing the archive design reduces usability without compensating benefit. |

---

### D-008 — luluportal is read-only reference; full isolation required

| Field | Value |
|---|---|
| **Decision** | `shiroku46/luluportal` is read-only structural reference only. No code, database, auth, environment variables, deployment, Issues, Pull Requests, workflows, or settings are shared. |
| **Reason** | Prevents accidental coupling, data leakage, and permission bleed between separate products. |
| **Rejected alternatives** | Shared infrastructure — rejected. Shared authentication — rejected. |
| **Impact** | This repository is fully independent. No cross-repository references in code, configuration, or CI. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #10 legal and compliance requirements |
| **Conditions for revisiting** | Not expected to be revisited. Isolation is a hard requirement. |

---

### D-009 — Historical fail-closed robots/full-terms preflight decision

> **Superseded operationally by D-021 (2026-08-01).** The original combined-gate decision is retained below as history only. The current rule is: `robots.txt` preflight gates each bounded listing/detail collection run; direct review of the full current master and individual terms gates production collection; neither blocks documentation-only design.

| Field | Value |
|---|---|
| **Historical decision — superseded** | No production collector, broad prototype, or scheduled collection may run until a direct technical preflight retrieves and records the current robots.txt body, retrieval time, response status, content hash, and applicable directives; and until both the full current BOOTH master terms and individual terms at `policies.pixiv.net` have been directly reviewed. |
| **Reason** | robots.txt retrieval failed during Stage 1 documentation research. The full current terms at `policies.pixiv.net` could not be rendered. Both remained unverified when this historical decision was recorded. |
| **Rejected alternatives** | Inferring allow/disallow from a failed retrieval — rejected; absence of retrieval is not permission. |
| **Current operational impact** | D-021 supersedes the combined gate. A current robots.txt preflight is required before a bounded listing/detail pilot and the run stops if the intended endpoint is unavailable or restricted. Direct review of the full current master and individual terms is required before production collection. Documentation-only design is not blocked by either preflight. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Stage 1 documentation research, 2026-08-01. robots.txt attempt: https://booth.pm/robots.txt (retrieval failed). Full terms linked from BOOTH to https://policies.pixiv.net/ (could not be rendered). See [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md). |
| **Conditions for revisiting** | D-021 is the active boundary. Record robots.txt evidence before the bounded pilot and review the full current terms before production collection; revise the corresponding gate independently when each evidence item is completed or when official policy changes. |

---

### D-010 — Union discovery entry points for TRPG scenario collection

| Field | Value |
|---|---|
| **Decision** | Initial discovery uses a deduplicated union of: the TRPG category (`/ja/browse/TRPG`), selected scenario-oriented tags (`/ja/items?tags[]=<tag>`), selected system/scenario keywords (`/ja/search/<query>`), and bounded new-item pages (`/ja/items`). The broad TRPG keyword result alone is not used as the sole source. |
| **Reason** | The broad TRPG keyword result contains scenarios, artwork, BGM, room assets, books, and other unrelated products. A union of category, tag, keyword, and new-item entry points improves recall without relying on a single noisy source. Category/tag/keyword membership is candidate evidence only, not final classification. |
| **Rejected alternatives** | Broad keyword-only discovery — rejected; insufficient precision for TRPG scenarios. Single entry-point discovery — rejected; misses products not indexed by one path. |
| **Impact** | Collection logic must query multiple entry points and deduplicate. The observed URL parameter contract is not a public API and may change; the collector must handle parameter changes without assuming stability. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Stage 1 documentation research, 2026-08-01. Entry points observed at: https://booth.pm/ja/search/TRPG, https://booth.pm/ja/browse/TRPG, https://booth.pm/ja/items?tags%5B%5D=trpg, https://booth.pm/ja/items. See [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md). |
| **Conditions for revisiting** | robots.txt or terms restrict specific entry points; or new official entry points are identified in a later research Issue. |

---

### D-011 — Rules-first product classification with two-layer mixed products

| Field | Value |
|---|---|
| **Decision** | Product classification uses a two-layer model: a BOOTH-product layer (one record per BOOTH page) and an individual-scenario/material layer (one or more child records per product). Classification runs deterministic rules first; AI generates candidates only for fields that remain ambiguous after rules. Candidate classes are: `scenario_single`, `scenario_collection`, `mixed_scenario_and_material`, `material_only`, `rulebook_or_system`, `supplement`, `replay_or_reading_material`, `update_or_dlc_only`, `non_trpg`, `hold_unknown`. A product with both scenario and material evidence remains one product record with separate child or variant classification. |
| **Reason** | Observed official BOOTH pages prove that category/tag membership alone is insufficient: a scenario product can include ancillary session assets; a TRPG-discovery product can be material-only (APNG/session effects); a single product can expose scenario variants and a separate room-material variant. The rules-first approach reduces AI cost and prevents low-confidence or conflicting output from being published. |
| **Rejected alternatives** | Tag-only classification — rejected; proved insufficient by observed examples. Flat single-class model — rejected; cannot represent mixed products. AI-first classification — rejected; rules can resolve most cases deterministically. |
| **Impact** | The classifier must implement all candidate classes. No low-confidence, conflicting, age-uncertain, spoiler-suspect, DLC-only, or material-only candidate is automatically published. Every derived field records source URL, evidence type, short non-spoiler evidence, confidence, conflict state, classifier version, checked time, and content version/hash. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Stage 1 documentation research, 2026-08-01. Scenario example: https://booth.pm/ja/items/2274429. Material-only example: https://booth.pm/ja/items/4186217. Mixed scenario/material-variant example: https://booth.pm/ja/items/647539. See [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md). |
| **Conditions for revisiting** | Evidence that the candidate class set is materially incomplete or that rules-first classification causes significant maintenance burden without proportional benefit. |

---

### D-012 — Strict all-ages hold behaviour: reject rather than store or publish uncertain content

| Field | Value |
|---|---|
| **Decision** | The collector must request only all-ages surfaces and reject, without entering or persisting content from, any age-gated, R-18/R-18G-labelled, conflicting, or uncertain product. If age evidence is missing or conflicts, set `hold_age_unknown`; do not store descriptive content or publish the result. |
| **Reason** | The BOOTH Guidelines require R-18 designation for content unsuitable for minors. Adult/R-18G product pages expose an age gate. The age-gate existence was confirmed without entering or collecting adult content. Strict hold behaviour prevents accidental storage or publication of adult content due to missing or ambiguous labels. |
| **Rejected alternatives** | Store but do not publish uncertain content — rejected; storage of uncertain adult content creates unnecessary risk. Infer all-ages from absence of R-18 label — rejected; missing label is not confirmation. |
| **Impact** | All collection, storage, and publication code must check age evidence before any descriptive content is stored. `hold_age_unknown` records are excluded from public search results and require a new evidence check before reclassification. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Stage 1 documentation research, 2026-08-01. Guidelines: https://booth.pm/guidelines. Age-gate confirmed at: https://booth.pm/ja/items/6260963 (gate only; no adult content entered or collected). See [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md). |
| **Conditions for revisiting** | A future Issue explicitly authorizes adult content handling after separate legal review and platform policy confirmation. |

---

### D-013 — Conservative 20-request pilot cadence as project limit, not official BOOTH allowance

| Field | Value |
|---|---|
| **Decision** | The first network pilot is bounded at most 20 listing/detail requests total. The later research ceiling before a new decision is at most 100 requests/day. All requests are unauthenticated public GET/HEAD only, one concurrent, minimum 10 seconds between requests with jitter. Stop conditions include 401, 403, 429, robots failure/restriction, CAPTCHA, challenge, repeated 5xx, or changed access behaviour. No parallel workers, rotating identities, proxy evasion, browser automation, or login/session cookies are permitted. |
| **Reason** | No official numeric request rate was found in the reviewed BOOTH sources. These values are deliberately conservative and reversible. They establish a bounded, observable first pilot that minimises risk while generating evidence for a future cadence decision. |
| **Rejected alternatives** | Higher initial request rates — rejected; no official rate limit found, so the conservative value is the correct fail-closed default. Unlimited retries — rejected; retries must not exceed the daily ceiling. |
| **Impact** | These values are pilot limits, not production limits. They must be revisited after a current robots.txt preflight and the 20-request pilot. They do not authorize production collection; direct review of the full current master and individual terms remains required before production collection. The client must use a stable user agent and contact URL/email once a public contact is available; cache responses and use content hashes; and apply exponential backoff on stop conditions. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Stage 1 documentation research, 2026-08-01. No official rate was found in: https://booth.pm/guidelines, https://booth.pm/announcements/898, https://booth.pm/announcements/949, https://booth.pm/announcements/950. See [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md). |
| **Conditions for revisiting** | A direct robots.txt preflight is completed and the 20-request pilot completes without stop conditions. A new Issue documents the pilot evidence and proposes revised cadence values. Full current terms review is tracked independently as the production-collection prerequisite. |

---

### D-014 — Separate `system_family` and `edition` entities

| Field | Value |
|---|---|
| **Decision** | TRPG systems are modelled as two distinct entity types: `system_family` (broad game family) and `edition` (a specific version within a family). They are never collapsed into one free-text field. |
| **Reason** | A scenario may reference a system family without specifying an edition. Collapsing family and edition into a single field forces a guess when no edition is stated, violating the fail-closed requirement. Keeping them separate allows `edition_unknown` as a first-class value. |
| **Rejected alternatives** | Single system/edition field — rejected; cannot represent the family-only case without inference. Free-text system field — rejected; prevents reliable faceted search and deduplication. |
| **Impact** | The data model (Stage 3) must implement `system_family` and `edition` as separate entity types with distinct identifiers and a foreign-key relationship. See [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Sections 1.1–1.2. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #17 normalization requirements; [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) system and rulebook structure. |
| **Conditions for revisiting** | Evidence that the two-entity model causes significant maintenance burden without proportional search benefit. |

---

### D-015 — Preservation of observed aliases verbatim with approved canonical mapping

| Field | Value |
|---|---|
| **Decision** | Every observed alias record preserves the original source text verbatim. The comparison key (produced by a documented normalization pipeline) is stored separately. An approved canonical mapping is a distinct reviewed decision and does not replace the original text. Two aliases with the same comparison key may remain in `hold_alias_conflict`. |
| **Reason** | Destroying or altering source text prevents future re-evaluation when normalization rules or canonical entities change. Keeping the original text and the normalized key separate maintains both exact provenance and matching utility. |
| **Rejected alternatives** | Store only the normalized form — rejected; loses original evidence and prevents audit. Auto-resolve comparison-key collisions to the most-frequent candidate — rejected; conflicts require human review, not a frequency heuristic. |
| **Impact** | The alias record structure defined in [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Section 3.1 is mandatory for Stage 3. The normalizer pipeline (Section 3.2) produces the comparison key and must be versioned. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #17 normalization requirements; [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) evidence preservation requirements. |
| **Conditions for revisiting** | A clearly superior alias model is proposed with full evidence-preservation and audit-trail equivalents. |

---

### D-016 — Fail-closed edition inference: `edition_unknown` without explicit evidence

| Field | Value |
|---|---|
| **Decision** | The edition field is `edition_unknown` whenever explicit source evidence does not name the edition. Publication date, file name, shop, price, popularity, or a single ambiguous keyword are never sufficient to assign an edition. |
| **Reason** | Inferring an edition from indirect signals produces confident-looking but unverified data that misleads users and corrupts search filters. The fail-closed default prevents silent inference. |
| **Rejected alternatives** | Infer edition from publication date — rejected; multiple editions may be active simultaneously. Infer from popularity heuristic — rejected; popular edition is not the same as stated edition. Default to a community-consensus edition — rejected; this constitutes an unverified inference. |
| **Impact** | The extraction pipeline must implement the prohibited inference bases defined in [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Section 4.3 as hard stops. `edition_unknown` must be a first-class displayable value (Section 10.2). |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #17 normalization requirements; fail-closed principle established in D-009, D-012. |
| **Conditions for revisiting** | A specific inference rule is proposed with documented evidence requirements and a successful audit of false-positive rate against reviewed ground-truth records. |

---

### D-017 — Controlled compatibility relationship vocabulary

| Field | Value |
|---|---|
| **Decision** | Compatibility between a scenario and a system/edition is expressed using exactly the six relationship kinds defined in [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Section 5.1: `native`, `explicitly_compatible`, `conversion_provided`, `dual_or_multi_edition`, `derived_candidate`, `unknown`. No other relationship kinds are used. |
| **Reason** | Without a controlled vocabulary, compatibility claims from source content are reworded or promoted, presenting compatible systems as native support. Explicit vocabulary prevents overstatement and preserves what the source actually said. |
| **Rejected alternatives** | Boolean "compatible/not compatible" — rejected; loses the distinction between native, conversion-required, and AI-derived candidates. Free-text relationship field — rejected; prevents reliable filtering and display rules. |
| **Impact** | Every non-native relationship requires evidence (Section 5.2). `derived_candidate` is never auto-published (Section 5.4). Display rules (Section 10.4) must use relationship-specific wording. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #17 normalization requirements; [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) system and rulebook structure. |
| **Conditions for revisiting** | A new relationship kind is proposed in a dedicated Issue with evidence that the existing vocabulary cannot express it. |

---

### D-018 — Separate book identity and scenario-scoped book requirement relationships

| Field | Value |
|---|---|
| **Decision** | Book identity (`book` entity) and the scenario-book relationship (`book_requirement` entity) are separate records. Book requirements are scoped to individual scenarios, not BOOTH products. Multiple requirements may form a `required_one_of` group. The observed title text is always preserved even when canonical identity is unresolved. |
| **Reason** | A single `book` entity is referenced by many scenarios. A single scenario may require multiple books. Flattening these into one record prevents accurate search filtering and makes it impossible to distinguish "required," "optional," and "one-of" groups. |
| **Rejected alternatives** | Store book title as a free-text field on the scenario — rejected; prevents deduplication and faceted filtering by book. Aggregate book requirements at product level — rejected; different scenarios within a product may have different requirements. |
| **Impact** | The data model (Stage 3) must implement `book` and `book_requirement` as separate entities with the requirement kinds and group mechanics defined in [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Sections 6.2–6.5. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #17 normalization requirements; [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) required and optional rulebook fields. |
| **Conditions for revisiting** | Evidence that the two-entity model causes significant query complexity without proportional benefit for the MVP search feature set. |

---

### D-019 — Versioned, reviewed registry governance starting from an empty registry

| Field | Value |
|---|---|
| **Decision** | The canonical entity registry starts empty. New entities are added only through reviewed Issues or Pull Requests. The registry uses semantic versioning (or equivalent). History is immutable and append-only. No silent remapping of previously published data occurs. Metrics (unknown rate, conflict rate, hold rate, alias-hit rate, manual-review rate) are tracked. |
| **Reason** | Populating a registry with unreviewed or AI-generated entries at the start produces a catalogue that looks complete but contains unverified facts. Starting empty and growing through review ensures every entry has evidence and human approval behind it. |
| **Rejected alternatives** | Pre-populate with a community-curated list from external sources — rejected; introduces unverified external facts at specification stage. Allow AI to seed the initial registry — rejected; AI may not create canonical identifiers or entities. |
| **Impact** | Which actual systems and books seed the first reviewed registry is explicitly pending (see PD-007). The governance rules in [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Sections 9.2–9.7 apply from the first registry entry. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #17 normalization requirements; AI boundary established in D-011. |
| **Conditions for revisiting** | A registry-seeding proposal is accepted in a future Issue after external facts are independently researched and documented. |

---

### D-020 — Rules-first classification with AI candidates only for ambiguous fields

| Field | Value |
|---|---|
| **Decision** | System, edition, and book fields follow the four-level extraction precedence defined in [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Section 7.1: (1) explicit structured/labelled source statements, (2) exact approved alias mappings, (3) deterministic contextual rules with documented evidence requirements, (4) AI-generated candidates for still-ambiguous fields only. AI candidates are never auto-published. Fields that cannot be resolved by any level are held for human review. |
| **Reason** | Applying AI at every stage is costly, inconsistent, and produces confident-looking output for fields that could be resolved deterministically. Restricting AI to the residual ambiguous set reduces cost and improves consistency. |
| **Rejected alternatives** | AI-first with rule post-processing — rejected; rules are cheaper and more reproducible; AI should not be invoked before rules are exhausted. Allow AI to auto-publish medium-confidence candidates — rejected; medium confidence is not sufficient without human review given the fail-closed requirements. |
| **Impact** | The extraction pipeline must implement levels 1–3 before invoking AI. AI output is recorded with the provenance fields in [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Section 8.1 and is always `derived_candidate` until reviewed. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #17 normalization requirements; rules-first principle established in D-011; [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) AI output publication gate. |
| **Conditions for revisiting** | Evidence that the rules-first approach causes significant maintenance burden for a specific field type, with a concrete proposal for a validated AI boundary. |

---

### D-021 — Correct overbroad collection-policy prohibition; endpoint/run-level fail-closed boundary

| Field | Value |
|---|---|
| **Decision** | Low-load collection of public BOOTH product information for search/information-analysis purposes is permitted in principle under the current official BOOTH guideline (https://booth.pm/guidelines; clarification announcement: https://booth.pm/announcements/898; guideline amendment effective 2026-07-08: https://booth.pm/announcements/950). BOOTH scraping is not categorically prohibited. A TRPG-oriented search helper that analyzes publicly visible product information and links users back to BOOTH is within the type of user-convenience and creative-activity-supporting information analysis contemplated by the official guideline. |
| **Supersedes** | D-009 operationally: the robots.txt preflight requirement before each collection run is retained; the blanket combined gate requiring both robots.txt and full terms before a bounded pilot is superseded. Robots.txt gates the bounded listing/detail pilot. Direct full current master/individual terms review gates production collection. Neither blocks documentation-only design. |
| **Corrected rule — fail-closed at endpoint/run level** | The project may design and later run a bounded low-load prototype. Each specific endpoint or collection run must stop or remain disabled when **any** of the following applies: (1) verified robots restriction for the intended endpoint or URL pattern; (2) HTTP 401, 403, or 429 response; (3) CAPTCHA, anti-bot challenge, or other access-control signal; (4) repeated 5xx errors; (5) age gate or access-control boundary for the target resource; (6) known or likely rights infringement or harmful load; (7) unresolved material compliance risk specific to the intended endpoint. Uncertainty about one source (for example, unrendered terms at `policies.pixiv.net`) does not silently authorize risky access, but does not prohibit unrelated safe public-page prototype work indefinitely. |
| **Reason** | D-009 was recorded when both robots.txt and the full current terms were unverified. Its overbroad wording blocked all prototype design and planning, not only runs with concrete risk signals. The official BOOTH guideline and its clarification announcement (https://booth.pm/announcements/898) confirm that information-analysis scraping for user convenience and healthy creative activity is generally permitted. Unavailable robots.txt rendering or incomplete rendering of every terms page must not create a repository-wide indefinite ban on all low-load development prototypes. |
| **Supporting context** | The existence of third-party BOOTH reference or search sites is supporting context only, not itself legal permission. The primary basis is the official BOOTH guideline and official announcements. |
| **Official sources** | BOOTH Guidelines: https://booth.pm/guidelines. Scraping-guideline clarification announcement: https://booth.pm/announcements/898. Terms update announcement effective 2026-06-22: https://booth.pm/announcements/949. Guideline amendment announcement effective 2026-07-08: https://booth.pm/announcements/950. |
| **Retained unchanged** | All-ages exclusion (D-002, D-012); purchase/payment/download remains on BOOTH (D-003); low-load safeguards and conservative request budget (D-013) — project limits, not official BOOTH allowances; no circumvention of access controls, age gates, CAPTCHA, anti-bot defenses, or rate limits; auditable evidence; luluportal isolation (D-008). |
| **Does not authorize** | Full crawl, production collection, bulk download, authentication bypass, or circumvention of any access control. No R-18, R-18G, or uncertain adult content. This correction authorizes planning and bounded future execution; actual network collection implementation begins in its later dedicated prototype stage. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #19. BOOTH Guidelines: https://booth.pm/guidelines. Clarification: https://booth.pm/announcements/898. Guideline amendment effective 2026-07-08: https://booth.pm/announcements/950. Terms update effective 2026-06-22: https://booth.pm/announcements/949. |
| **Conditions for revisiting** | Official BOOTH guidelines change materially to prohibit information-analysis collection; or a robots.txt preflight reveals explicit prohibitions covering the intended endpoints. |

---

## Pending Decisions

The following decisions are explicitly deferred pending research or a later Issue. They must not be treated as decided.

### PD-001 — Technology stack selection

> **Resolved in Stage 4.** See D-027 (Next.js 16.x / TypeScript 7.0 / Node.js v24 LTS), D-028 (Vercel Hobby), D-029 (Supabase Free + PostgreSQL 17), D-030 (Drizzle ORM, Apache-2.0), D-031 (GitHub Actions).

| Field | Value |
|---|---|
| **Subject** | Frontend framework, backend runtime, database, hosting platform, and CI provider |
| **Resolved by** | D-027 through D-031 in Stage 4 (Issue #39, 2026-08-02). |
| **See also** | [ARCHITECTURE.md](ARCHITECTURE.md), [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md) |

---

### PD-002 — BOOTH collection method and access pattern

| Field | Value |
|---|---|
| **Subject** | How BOOTH product data is retrieved: API, scraping, RSS, or other mechanism |
| **Blocked by** | For a bounded listing/detail pilot: a current robots.txt preflight and absence of concrete endpoint/run stop conditions under D-021. For production collection: direct review of the full current BOOTH master and individual terms, plus the pilot evidence and a production authorization decision. Documentation-only mechanism design is not blocked. |
| **Decision criteria** | Must comply with current BOOTH terms and robots.txt; must use low-load access patterns; must respect the endpoint/run stop conditions in D-021 and the pilot limits in D-013. |
| **Progress** | Stage 1 documentation research (2026-08-01) recorded public discovery entry points, conservative pilot limits, and stop conditions. The specific collection mechanism remains pending. A bounded pilot may be designed now and may run only after robots.txt preflight clears its intended endpoints; production remains gated separately by full current terms review. See [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md). |
| **See also** | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md), [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md), D-010, D-013, D-021 |

---

### PD-003 — Database provider and schema

> **Resolved in Stage 4.** See D-029 (PostgreSQL 17 + Supabase Free) and PHYSICAL_SCHEMA.md.

| Field | Value |
|---|---|
| **Subject** | Which database provider to use and what the initial schema looks like |
| **Resolved by** | D-029 (Stage 4, 2026-08-02): PostgreSQL 17 via Supabase Free; physical schema in PHYSICAL_SCHEMA.md. |
| **See also** | [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md), D-029, D-030 |

---

### PD-004 — AI provider and model for tag derivation

| Field | Value |
|---|---|
| **Subject** | Which AI provider and model to use for ambiguous tag candidate generation |
| **Blocked by** | PD-001 (technology selection), cost measurement requirements |
| **Decision criteria** | Daily and monthly AI budget limits must be enforceable; low-confidence output must not be auto-published |
| **See also** | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) |

---

### PD-005 — Deployment and hosting provider

> **Resolved in Stage 4.** See D-028 (Vercel Hobby). Deployment gate remains pending owner non-commercial confirmation (PD-011).

| Field | Value |
|---|---|
| **Subject** | Where the application is deployed and hosted |
| **Resolved by** | D-028 (Stage 4, 2026-08-02): Vercel Hobby; ¥0; manual upgrade only; non-commercial personal use restriction; deployment gate pending owner confirmation (PD-011). |
| **See also** | D-028, PD-011 |

---

### PD-006 — Rating and recommendation features

| Field | Value |
|---|---|
| **Subject** | Whether and how rating and recommendation sorting are implemented |
| **Blocked by** | MVP delivery; post-MVP feature planning |
| **Decision criteria** | Deferred from MVP sorting options (see [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md)); requires separate design and data model work |
| **See also** | [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) |

---

### PD-007 — Registry population: initial set of systems, editions, and books

| Field | Value |
|---|---|
| **Subject** | Which actual TRPG systems, editions, and rulebooks are included in the first reviewed registry; what evidence and review process is used to admit them |
| **Blocked by** | [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) normalization specification (D-019); a future dedicated research Issue that independently researches external facts about individual systems and books |
| **Decision criteria** | Each entry must have an identified source URL or source-record identifier; must be reviewed and approved through a Pull Request; must not introduce unverified external facts; the initial set is deliberately minimal |
| **Note** | No systems, editions, or books are pre-populated in this Issue. The normalization specification does not authorize any registry entries. A future Issue performs the research and proposes the initial reviewed set. |
| **See also** | [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Section 9, D-019 |

---

## Stage 3 Decisions

The following decisions were accepted in Issue #21 (Stage 3 — BOOTH-Product / Individual-Scenario Data Model, 2026-08-01).

### D-022 — Technology-neutral logical schema before provider-specific implementation

| Field | Value |
|---|---|
| **Decision** | Stage 3 defines a logical, technology-neutral schema only. SQL table definitions, ORM mappings, database-vendor-specific types, UUID implementation, index design, physical partitioning, and migration tooling are explicitly deferred to the architecture and database stages. |
| **Reason** | The logical data model shapes and constrains implementation choices. Defining the logical structure first allows the architecture stage to make informed, reversible technology decisions without being locked into a particular database vendor, ORM, or physical schema before trade-offs are understood. |
| **Rejected alternatives** | Define SQL schema directly in Stage 3 — rejected; premature commitment before the architecture decision record is produced. |
| **Impact** | [DATA_MODEL.md](DATA_MODEL.md) defines field names, logical types, cardinalities, uniqueness, required/optional status, and invariant/check rules. Provider-specific encoding for all of these is a Stage 4 decision. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #21 acceptance criteria; [ROADMAP.md](ROADMAP.md) Stage 3 scope constraints; PD-001, PD-003. |
| **Conditions for revisiting** | Not expected to be revisited; provider-specific details are addressed in Stage 4. |

---

### D-023 — Explicit evidenced-value state envelope rather than null/default inference

| Field | Value |
|---|---|
| **Decision** | Every field whose value may be known, unknown, held, or not applicable uses a typed state envelope (`EvidencedValue<T>`). Null, zero, false, and empty string are never used to represent "unknown." The states `unknown`, `hold`, and `not_applicable` are first-class values that prohibit guessed or inferred values. Public search never treats `unknown` or `hold` as zero, false, empty string, or a default filter category. |
| **Reason** | Implicit inference from absent or default values produces confident-looking but unverified data that misleads users and corrupts search filters. An explicit state contract prevents this at the model level and is auditable without application-layer conventions. |
| **Rejected alternatives** | Use null for unknown — rejected; null is ambiguous and cannot distinguish structural absence (`not_applicable`) from evidence absence (`unknown`) or a blocked state (`hold`). Use zero for unknown player count — rejected; zero is a false value that corrupts PL filters. |
| **Impact** | Every field in [DATA_MODEL.md](DATA_MODEL.md) that may be unknown or held uses the `EvidencedValue<T>` structure defined in Section 2. Provider-specific encoding (enum, tagged union, nullable column with check constraint) is a Stage 4 decision. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #21 acceptance criteria (Section 4); D-016 (fail-closed edition inference); [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) PL and play-time unknown handling. |
| **Conditions for revisiting** | A specific field type is demonstrated to require a different state model; requires a new Issue with full evidence-preservation and audit-trail equivalents. |

---

### D-024 — Subordinate product components for source variants while retaining two public layers

| Field | Value |
|---|---|
| **Decision** | `product_component` is a subordinate, internal source-representation entity belonging to one `booth_product`. It preserves observed variant/component structure from the source without creating a third public search layer. The public model remains exactly two layers: `booth_product` (Layer 1) and `scenario` (Layer 2). `product_component` records are never directly searchable or published to users. A `product_component` may link to an existing `scenario` record, but the `searchable_scenario` projection — not the component link — governs public visibility. |
| **Reason** | A single BOOTH product page may expose multiple distinct variants (e.g., a scenario variant and a room-material variant). Preserving this source structure allows accurate representation of mixed products without collapsing variants into the scenario layer or inventing a public component layer. Material-only and update/DLC components can be modelled without spuriously creating scenario records. |
| **Rejected alternatives** | Create a third public search layer for components — rejected; unnecessary for MVP discovery goals and creates user-facing complexity. Ignore product component structure — rejected; loses source fidelity for mixed products and makes it impossible to audit which components were considered. |
| **Impact** | `product_component` is defined in [DATA_MODEL.md](DATA_MODEL.md) Section 5. It does not appear in search results or public API responses. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #21 acceptance criteria (Section 5); D-011 mixed-product evidence (https://booth.pm/ja/items/647539); [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) two-layer model. |
| **Conditions for revisiting** | Evidence that the subordinate component model causes significant maintenance burden without proportional accuracy benefit. |

---

### D-025 — Deterministic searchable-scenario projection as the sole public gate

| Field | Value |
|---|---|
| **Decision** | Public search eligibility is determined exclusively by a deterministic `searchable_scenario` logical projection with explicitly named gates (classification, all-ages, sales-state, separation, hold, required-field, AI-approval, spoiler, and normalization publication gates). No scenario is included by default. All applicable gates must pass. The projection is the sole and complete mechanism governing public publication eligibility; no ad-hoc field-by-field eligibility checks in application code are permitted to bypass or supplement it. |
| **Reason** | Implicit eligibility rules spread across application code lead to unintentional publication of held, uncertain, or adult-adjacent content. An explicit named projection with documented gates is auditable, testable, and resistant to drift as the codebase evolves. The all-ages gate, sales-state gate, and AI-approval gate in particular must be enforced uniformly. |
| **Rejected alternatives** | Field-by-field eligibility checks in application code — rejected; risks divergence between gatekeeping layers and makes the complete eligibility contract non-obvious. Default-include with explicit exclusion rules — rejected; any gap in exclusion rules silently publishes held content. |
| **Impact** | The `searchable_scenario` projection is defined as a logical contract in [DATA_MODEL.md](DATA_MODEL.md) Section 10. Its implementation in application code and queries is a Stage 4+ decision. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #21 acceptance criteria (Section 10); D-002 (all-ages exclusion); D-012 (strict hold); D-011 (classification); [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) AI output gate. |
| **Conditions for revisiting** | A specific gate is demonstrated to be incorrect or incomplete; requires a new Issue updating [DATA_MODEL.md](DATA_MODEL.md) Section 10. |

---

### D-026 — Append-only source and derivation history for permitted records

| Field | Value |
|---|---|
| **Decision** | Source snapshots and normalization history records for **permitted, non-sensitive content** are append-only. When content, normalizer version, or registry version changes, a new `normalization_history` record is appended alongside the old record; both are retained. Source-observed text is never altered post-creation. Normal rollback is a revert or fix-forward; history is never rewritten. **Exception — `hold_age_unknown` sanitizing purge and irreversible redaction:** The append-only rule applies only to permitted audit records and does not override the adult-content and age-uncertainty erasure requirements established in D-002 and D-012. When a `booth_product` transitions to `hold_age_unknown`, all prohibited descriptive and body-derived content — including observed titles, creator text, product descriptions, body excerpts, body-derived content hashes, and any other prohibited payload listed in [DATA_MODEL.md](DATA_MODEL.md) Section 3.5 — must be purged or irreversibly redacted. Prohibited payloads are **not** preserved by the append-only rule. The redaction tombstone event (which records audit metadata without reproducing prohibited content) is itself immutable and append-only once written. No binding retention rule may simultaneously require prohibited descriptive or body-derived content to be retained. |
| **Reason** | Immutable history enables: reproducing which source and version produced a value; finding all AI-derived candidates; finding all held or unresolved fields; triggering and tracing reanalysis. Mutable history destroys these capabilities and creates audit liability. The append-only model is also required for reanalysis avoidance: the three-part key (content version, normalizer version, registry version) is meaningless if old records can be overwritten. The explicit `hold_age_unknown` exception prevents a conflict between the append-only rule and the adult-content and age-uncertainty erasure requirements; without this exception, an absolute append-only rule would simultaneously require retention of content that D-002, D-012, and the age-uncertainty purge contract mandate be destroyed. |
| **Rejected alternatives** | Overwrite prior records when content changes — rejected; destroys provenance and prevents reanalysis audit. Delete ended or disappeared product records — rejected; history must be retained for data continuity and reconciliation. Retain prohibited descriptive or body-derived content under the append-only rule — rejected; this would conflict with D-002, D-012, and [DATA_MODEL.md](DATA_MODEL.md) Section 3.5 erasure requirements; no binding rule may simultaneously require prohibited content to be retained. |
| **Impact** | `source_snapshot` and `normalization_history` entities are defined in [DATA_MODEL.md](DATA_MODEL.md) Section 8. Destructive operations on **permitted** records are prohibited at all implementation layers. The `hold_age_unknown` sanitizing-purge and irreversible-redaction contract in [DATA_MODEL.md](DATA_MODEL.md) Section 3.5 takes precedence over the append-only rule for prohibited payloads; after purge, the permitted non-descriptive redaction tombstone is the retained and immutable record. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Issue #21 acceptance criteria (Section 8); [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) reanalysis avoidance; [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Sections 7.3 and 9.3. |
| **Conditions for revisiting** | Not expected to be revisited. Append-only history for permitted records is a hard audit requirement. The `hold_age_unknown` purge contract is a hard compliance requirement. |

---

## Stage 3 Pending Decisions

### PD-008 — Provider-specific implementation of the logical data model

> **Resolved in Stage 4.** See [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md) and D-029, D-030, D-035, D-036.

| Field | Value |
|---|---|
| **Subject** | Provider-specific encoding of the logical schema defined in [DATA_MODEL.md](DATA_MODEL.md): SQL column types, UUID vs. other ImmutableID implementations, index design, ORM mapping strategy, database vendor selection, physical table partitioning, and migration tooling |
| **Resolved by** | D-029 (PostgreSQL 17 + Supabase Free), D-030 (Drizzle ORM + Drizzle Kit, Apache-2.0), D-035 (index strategy), D-036 (content-version/history). Physical schema specified in [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md). |
| **See also** | [DATA_MODEL.md](DATA_MODEL.md), D-022, D-029, D-030 |

---

### PD-009 — Free-first sort: non-exact free/paid indicator definition

> **Resolved in Stage 4.** See D-034.

| Field | Value |
|---|---|
| **Subject** | How to implement the confirmed `free-first` sort option without storing or exposing exact prices |
| **Resolved by** | D-034: `is_free` as `EvidencedValue<Boolean>` on `booth_product`; derived from explicit source signals (e.g., free-download badge) without price parsing; unknown state never treated as false; exact price permanently excluded. |
| **See also** | [DATA_MODEL.md](DATA_MODEL.md) Section 10.5; [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md) Section 8 |

---

## Stage 4 Decisions

The following decisions were accepted in Issue #39 (Stage 4 — Architecture and Technology Decision, 2026-08-02).

### D-027 — Technology stack: Next.js 16.x, TypeScript 7.0, Node.js v24 LTS

| Field | Value |
|---|---|
| **Decision** | Select Next.js 16.x (latest stable, exact version pinned at scaffold time) as the frontend framework; TypeScript 7.0 as the language; Node.js v24 LTS as the runtime. |
| **Next.js license** | MIT. Source: https://github.com/vercel/next.js/blob/canary/license.md (accessed 2026-08-02). |
| **TypeScript 7.0 license** | Apache-2.0 (not MIT). Sources: https://github.com/microsoft/typescript (accessed 2026-08-02); https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ (accessed 2026-08-02). TypeScript 7.0 was announced available on 2026-07-08. TypeScript 7.0 is implemented in Go; https://github.com/microsoft/typescript-go (accessed 2026-08-02). |
| **Node.js v24 LTS** | Selected. EOL Node.js v20 is prohibited even though Next.js documents Node.js 20.9 as its minimum. Source: https://nodejs.org/en/about/previous-releases (accessed 2026-08-02). |
| **Reason** | Next.js provides App Router, server components, and a mature TypeScript integration. TypeScript 7.0 offers the latest type safety. Node.js v24 LTS is the current supported LTS; v20 is EOL and must not be used. |
| **Rejected alternatives** | Other frameworks — not evaluated for MVP; Next.js is the confirmed candidate from ARCHITECTURE.md. Node.js v20 — prohibited (EOL). |
| **Impact** | Next.js 16.x version is pinned in the lockfile at scaffold time. TypeScript 7.0 Apache-2.0 license applies; no MIT claim for TypeScript is made. Node.js v24 LTS is required in CI and local development. |
| **Decision date** | 2026-08-02 |
| **Evidence** | Issue #39 technology requirements; official sources above, all accessed 2026-08-02. |
| **Resolves** | PD-001 (technology stack — frontend, language, runtime). |
| **Conditions for revisiting** | A later Issue proposes a framework change with evidence of benefit exceeding migration cost. |

---

### D-028 — Hosting: Vercel Hobby (non-commercial gate)

| Field | Value |
|---|---|
| **Decision** | Select Vercel Hobby as the hosting and deployment platform for the Next.js application. |
| **Cost** | $0/month (¥0). Hobby plan pauses at included limits rather than auto-charging. Manual upgrade only; no automatic paid-plan transition. |
| **Restriction** | Vercel Hobby is restricted to non-commercial personal use. |
| **Gate** | Deployment remains prohibited until the owner explicitly confirms this project qualifies as non-commercial under Vercel's current definition. |
| **Sources** | https://vercel.com/docs/plans/hobby (accessed 2026-08-02); https://vercel.com/docs/plans (accessed 2026-08-02); https://vercel.com/docs/limits/fair-use-guidelines (accessed 2026-08-02). |
| **Reason** | Vercel Hobby is the zero-cost hosting option for Next.js. It does not auto-upgrade or auto-charge. |
| **Rejected alternatives** | Other hosts (Railway, Render, etc.) — not evaluated; Vercel is the confirmed candidate. Vercel Pro — requires payment; out of scope. |
| **Impact** | No deployment is created in Stage 4. The Stage 5 scaffold includes local development only; production deployment is deferred to the provisioning Issue after owner non-commercial confirmation. |
| **Decision date** | 2026-08-02 |
| **Evidence** | Issue #39 technology requirements; official Vercel documentation above. |
| **Resolves** | PD-005 (hosting and deployment provider). |
| **Conditions for revisiting** | Owner confirms commercial use; a separate Issue selects a qualifying paid hosting plan. |

---

### D-029 — Database: PostgreSQL 17 via Supabase Free (provisioning gate)

| Field | Value |
|---|---|
| **Decision** | Select PostgreSQL 17 as the database engine, managed via Supabase Free. |
| **Supabase Free plan (official facts, accessed 2026-08-02):** | $0/month (¥0); two active free projects; 500 MB database per project; 1 GB file storage; 5 GB egress plus 5 GB cached egress; 50,000 MAU; 500,000 Edge Function invocations. A low-activity free project may pause after a 7-day period; restorable within 90 days. Quota exceedance uses notifications, grace period, and service restrictions — does not automatically upgrade to a paid plan. Upgrade requires explicit plan action. |
| **PostgreSQL version** | 17, unless the provisioning Issue demonstrates a safer supported managed version. |
| **Gate** | Provisioning remains prohibited until a later dedicated provisioning Issue. |
| **Sources** | https://supabase.com/pricing (accessed 2026-08-02); https://supabase.com/docs/guides/platform/billing-on-supabase (accessed 2026-08-02); https://supabase.com/docs/guides/platform/free-project-pausing (accessed 2026-08-02); https://supabase.com/docs/guides/platform/billing-faq (accessed 2026-08-02); https://supabase.com/docs/guides/platform/cost-control (accessed 2026-08-02). |
| **Reason** | Supabase Free provides a managed PostgreSQL instance with sufficient capacity for the MVP data volume (estimated well within 500 MB). It does not auto-charge. |
| **Rejected alternatives** | Self-hosted PostgreSQL — requires separate infrastructure; more operational overhead for MVP. Other managed providers — not evaluated; Supabase is the confirmed candidate. |
| **Impact** | Stage 5 fixture-backed scaffold requires no database. Database provisioning is deferred. |
| **Decision date** | 2026-08-02 |
| **Evidence** | Issue #39 technology requirements; official Supabase documentation above. |
| **Resolves** | PD-001 (database platform), PD-003 (database provider). |
| **Conditions for revisiting** | Supabase changes free-tier terms materially, or provisioning Issue identifies a safer alternative. |

---

### D-030 — ORM and migration tooling: Drizzle ORM + Drizzle Kit (Apache-2.0)

| Field | Value |
|---|---|
| **Decision** | Select Drizzle ORM and Drizzle Kit as the ORM and migration tooling for PostgreSQL. |
| **License** | Apache-2.0 (not MIT). The prior incorrect MIT claim is withdrawn; no license-verification gate based on the MIT claim is retained. Source: https://github.com/drizzle-team/drizzle-orm (accessed 2026-08-02). |
| **Capabilities confirmed** | PostgreSQL support; Drizzle Kit migration tooling; active releases. Source: https://github.com/drizzle-team/drizzle-orm/releases (accessed 2026-08-02). |
| **Exact versions** | Pinned in the lockfile at scaffold time; not hard-coded in this ADR. |
| **Reason** | Drizzle ORM provides type-safe PostgreSQL queries with direct DDL control and Drizzle Kit migration generation. Apache-2.0 license is compatible with this project. |
| **Rejected alternatives** | Prisma — different migration model; not evaluated. Raw SQL — lower type safety; more maintenance burden. |
| **Impact** | Drizzle ORM is used only in the database layer. No ORM schema or migration files are created in Stage 4 (documentation only). |
| **Decision date** | 2026-08-02 |
| **Evidence** | Issue #39 technology requirements; official Drizzle repository above. |
| **Resolves** | Part of PD-001 (ORM/migration tooling); part of PD-008. |
| **Conditions for revisiting** | A later Issue proposes an alternative ORM with evidence of material benefit. |

---

### D-031 — CI: GitHub Actions (public repository, ¥0)

| Field | Value |
|---|---|
| **Decision** | Use GitHub Actions for CI, running on standard GitHub-hosted runners. |
| **Cost for public repositories** | Standard GitHub-hosted runners are free for public repositories. Expected CI cost: ¥0. |
| **Private-repository note** | For private repositories on GitHub Free, included usage is 2,000 minutes/month and 500 MB Actions storage. Private-repository overage can charge unless a spend limit budget is configured with "Stop usage when budget limit is reached." This repository is public at research time; the ¥0 cost applies while the repository remains public. Not all Actions usage is universally unlimited. |
| **Sources** | https://docs.github.com/en/actions/concepts/billing-and-usage (accessed 2026-08-02); https://docs.github.com/en/billing/reference/product-usage-included (accessed 2026-08-02). |
| **Reason** | GitHub Actions is the existing CI provider for this repository. No additional provider is needed for MVP. |
| **Impact** | CI runs on standard runners at ¥0 while the repository remains public. If the repository is made private, cost controls must be reviewed before Actions usage continues without a budget gate. |
| **Decision date** | 2026-08-02 |
| **Evidence** | Issue #39 technology requirements; official GitHub documentation above. |
| **Resolves** | Part of PD-001 (CI provider). |
| **Conditions for revisiting** | Repository is made private; a budget gate is required before CI use continues without review. |

---

### D-032 — Provider-neutral application boundary layout

| Field | Value |
|---|---|
| **Decision** | Define domain entities, value objects, repository interfaces, services/use cases, and adapters as provider-neutral boundaries before any provider-specific implementation. The boundary layout is defined in ARCHITECTURE.md. |
| **Reason** | Provider-neutral boundaries prevent coupling to a specific database or framework before the layout is settled. D-022 mandated this sequencing. |
| **Impact** | All repository interfaces, service contracts, and adapter types are defined without referencing PostgreSQL, Drizzle, or Supabase. Provider-specific implementations are in the adapter layer only. |
| **Decision date** | 2026-08-02 |
| **Evidence** | Issue #39 architecture requirements; D-022. |
| **Conditions for revisiting** | Not expected; this is a structural sequencing decision. |

---

### D-033 — Fixture-first search scaffold (no live BOOTH access in Stage 5)

| Field | Value |
|---|---|
| **Decision** | Stage 5 implements search backed by static JSON fixtures only. No live database, no BOOTH access, and no collection pipeline runs in Stage 5. All search and gate logic is validated against fixture data in memory before any infrastructure is provisioned. |
| **Reason** | Fixture-first validation of the `searchable_scenario` projection gates and search UX patterns is safer and cheaper than provisioning infrastructure before the interaction model is confirmed. |
| **Rejected alternatives** | Connect to live Supabase before fixtures — rejected; premature provisioning before UX is validated. |
| **Impact** | The `FixtureAdapter` is an in-memory adapter only. Fixtures are not production or canonical data. |
| **Decision date** | 2026-08-02 |
| **Evidence** | Issue #39 architecture requirements. |
| **Conditions for revisiting** | Not expected; fixtures are a temporary scaffold only. |

---

### D-034 — `is_free` as `EvidencedValue<Boolean>` (resolves PD-009)

| Field | Value |
|---|---|
| **Decision** | Implement the `free-first` sort option using `is_free: EvidencedValue<Boolean>` on `booth_product`. `is_free` is derived from explicit source signals (e.g., a free-download badge) without storing or parsing exact prices. When source evidence is ambiguous or absent, `is_free.state = 'unknown'` — never defaulted to false. Exact price is permanently excluded. |
| **Reason** | The `free-first` sort is a confirmed product requirement. Exact price storage is permanently prohibited. An explicit EvidencedValue state avoids the null/default inference prohibited by D-023. |
| **Rejected alternatives** | Exact price field — permanently prohibited. Boolean without EvidencedValue — rejected; cannot distinguish unknown from false (D-023). |
| **Impact** | `is_free` is a JSONB NOT NULL column (NULL when not yet collected) on `booth_product`. The `free-first` sort treats `state = 'known', value = true` as first; `state = 'unknown'` appears below; `value = false` appears last. Unknown is never treated as false in any filter or sort. |
| **Decision date** | 2026-08-02 |
| **Evidence** | Issue #39 requirements; DATA_MODEL.md Section 10.5 (PD-009); PRODUCT_REQUIREMENTS.md sort options. |
| **Resolves** | PD-009. |
| **Conditions for revisiting** | Not expected; EvidencedValue<Boolean> satisfies all constraints and is consistent with D-023. |

---

### D-035 — Index strategy for confirmed search/filter/sort inputs

| Field | Value |
|---|---|
| **Decision** | Define indexes for all confirmed search inputs, filter facets, and sort options per DATA_MODEL.md Section 10.5. Index specification is in PHYSICAL_SCHEMA.md Section 4. |
| **Reason** | Indexes on search/filter/sort columns are required for acceptable query performance. Expression indexes on JSONB EvidencedValue state fields (e.g., `(all_ages_state->>'state')`) are used where JSONB columns are queried by gate filters. |
| **Impact** | Exact index DDL is produced at scaffold time (Stage 5+). |
| **Decision date** | 2026-08-02 |
| **Evidence** | Issue #39 architecture requirements; DATA_MODEL.md Section 10.5. |
| **Resolves** | Part of PD-008. |
| **Conditions for revisiting** | Actual query plans at Stage 5+ may require additional or adjusted indexes. |

---

### D-036 — Content-version and normalization-history physical representation

| Field | Value |
|---|---|
| **Decision** | `content_version` is a non-empty TEXT string. Body-derived hashes use the format `sha256:<hex>`. Access/outcome versions for hold_age_unknown use the format `access_outcome:<status_code>`. The reanalysis avoidance key `(content_version, normalizer_version, registry_version)` is always non-null; all three columns are TEXT NOT NULL. `normalization_history` uses six TEXT NOT NULL version columns — no null version field is permitted, including for the first reanalysis of a previously unresolved record. |
| **Reason** | The three-part key must be unambiguous to reproducibly trigger and avoid reanalysis. Non-null columns enforce this at the database layer. |
| **Impact** | See PHYSICAL_SCHEMA.md Sections 3.9, 3.17, and 6 for column definitions. |
| **Decision date** | 2026-08-02 |
| **Evidence** | Issue #39 requirements; DATA_MODEL.md Sections 6.3 and 8.2. |
| **Resolves** | Part of PD-008. |
| **Conditions for revisiting** | A different versioning scheme is proposed that satisfies the same non-null and reanalysis-avoidance requirements. |

---

### D-037 — Seeded-random sort strategy boundary

| Field | Value |
|---|---|
| **Decision** | The seeded-random sort operates at the query layer only. No additional physical column, table, or stored value is required for seeded-random. The seed is derived from request-time parameters at query time using PostgreSQL's `setseed()` and `random()` functions or an equivalent deterministic ordering strategy. Implementation is deferred to Stage 5+. |
| **Reason** | Seeded random requires no persistent state; the seed is derived from the request and produces a deterministic per-request order. No schema change is needed. |
| **Impact** | The physical schema has no seeded-random-specific columns. Implementation is deferred. |
| **Decision date** | 2026-08-02 |
| **Evidence** | Issue #39 requirements; DATA_MODEL.md Section 10.5. |
| **Conditions for revisiting** | Implementation at Stage 5+ may revise the exact query strategy. |

---

### D-038 — Rollback, migration, backup, observability, and erasure boundaries

| Field | Value |
|---|---|
| **Decision** | Define the operational boundaries for rollback, migration, backup, observability, and erasure. |
| **Rollback** | Revert commit or bounded fix-forward within allowed paths only. Shared history is never rewritten. |
| **Migration** | Drizzle Kit generates migration SQL for review. No migration runs in Stage 5 fixture scaffold. Provisioning is deferred to a later dedicated Issue. |
| **Backup** | Supabase Free PITR is the baseline. Scope and retention verified at provisioning time. No additional backup in Stage 4. |
| **Observability** | Supabase and Vercel dashboards track free-tier usage. Application logging is structured JSON to stdout. No paid observability provider in MVP. |
| **Erasure** | `HoldAgeUnknownPurgeService` is the sole authorized erasure path for prohibited payloads (D-039). All other data-erasure operations require a separate owner-authorized Issue. |
| **Decision date** | 2026-08-02 |
| **Evidence** | Issue #39 requirements; ARCHITECTURE.md operational boundaries. |
| **Conditions for revisiting** | Supabase free-tier backup scope or retention changes; a paid observability tool is required for production. |

---

### D-039 — HoldAgeUnknownPurgeService: narrow compliance exception to append-only rule

| Field | Value |
|---|---|
| **Decision** | Define the `HoldAgeUnknownPurgeService` as the sole authorized narrow exception to the append-only rule (D-026). When a `booth_product` transitions to `hold_age_unknown`, this service is the only code path permitted to issue restricted UPDATE and DELETE operations on otherwise append-only records to irreversibly purge or sanitize prohibited payloads. |
| **Scope** | May only: update `booth_product` prohibited columns to NULL; delete `product_component`, `scenario`, and cascade-linked child records for the hold product; update or delete `source_snapshot` rows with prohibited body content for the hold product; delete `normalization_history` rows with prohibited content for the hold product; insert the `hold_age_unknown_purge_event` tombstone record. |
| **Prohibited** | May not modify records not linked to the hold product; may not delete the `booth_product` row; may not remove non-sensitive audit metadata; may not reconstruct or return prohibited content; may not operate on permitted content records. |
| **Atomicity** | All purge operations are atomic within one database transaction. Tombstone is inserted only after all other operations succeed. |
| **Exception constraint** | Does not permit ordinary mutation of permitted history. Does not weaken D-002, D-012, D-026, or DATA_MODEL.md Section 3.5. |
| **Decision date** | 2026-08-02 |
| **Evidence** | Issue #39 P1 redaction correction requirements; DATA_MODEL.md Section 3.5; D-026. |
| **Resolves** | The P1 redaction compliance requirement from Issue #39. |
| **Conditions for revisiting** | Not expected; this is a hard compliance requirement driven by D-002 and D-012. |

---

### D-040 — Stage 5 scaffold handoff scope

| Field | Value |
|---|---|
| **Decision** | Stage 5 is bounded to the minimal fixture-backed application scaffold: Next.js 16.x project with TypeScript 7.0 and Node.js v24 LTS; static JSON fixture files (not production data); search UI backed by fixtures in memory; unit test infrastructure; CI integration. No database provisioning, no Vercel deployment, no authentication, no Secrets, no environment variables, no live BOOTH requests, and no canonical registry population are included in Stage 5. |
| **Reason** | A bounded scaffold scope prevents scope creep and keeps Stage 5 focused on validating the interaction model before infrastructure is provisioned. |
| **Impact** | Stage 5 Issue must reference this decision and must not exceed the listed scope. |
| **Decision date** | 2026-08-02 |
| **Evidence** | Issue #39 requirements; ROADMAP.md Stage 4. |
| **Conditions for revisiting** | Not expected without a separate owner-authorized Issue expanding the Stage 5 scope. |

---

## Stage 4 Pending Decisions

### PD-010 — Supabase provisioning and production database setup

| Field | Value |
|---|---|
| **Subject** | Provisioning the Supabase Free project, running Drizzle Kit migrations, and establishing the production database for MVP |
| **Blocked by** | D-029 (database selection); owner confirmation of Vercel non-commercial qualification (D-028); a dedicated provisioning Issue |
| **Decision criteria** | Must stay within Supabase Free tier (500 MB); must apply PHYSICAL_SCHEMA.md column types and constraints exactly; must not weaken any DATA_MODEL.md invariant |
| **See also** | [PHYSICAL_SCHEMA.md](PHYSICAL_SCHEMA.md), D-029, D-030 |

---

### PD-011 — Vercel non-commercial qualification confirmation

| Field | Value |
|---|---|
| **Subject** | Owner confirmation that this project qualifies as non-commercial personal use under Vercel Hobby's current terms, enabling production deployment |
| **Blocked by** | Owner review of current Vercel Hobby terms (D-028); required before any deployment |
| **Decision criteria** | Owner reads current Vercel Hobby terms at https://vercel.com/docs/plans/hobby and confirms project qualifies; a separate Issue documents the confirmation |
| **See also** | D-028 |
