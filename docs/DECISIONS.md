# Decisions

## Status

This document records accepted decisions and explicit pending decisions for the TRPG BOOTH search helper. Provisional technology, BOOTH collection methods, current terms, robots rules, pricing, and free-tier limits are **not** recorded as decided here — they remain pending research.

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [ROADMAP.md](ROADMAP.md) | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) | [ARCHITECTURE.md](ARCHITECTURE.md)

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

### D-009 — Fail-closed robots/full-terms preflight before any network prototype

| Field | Value |
|---|---|
| **Decision** | No production collector, broad prototype, or scheduled collection may run until a direct technical preflight retrieves and records the current robots.txt body, retrieval time, response status, content hash, and applicable directives; and until both the full current BOOTH master terms and individual terms at `policies.pixiv.net` have been directly reviewed. |
| **Reason** | robots.txt retrieval failed during Stage 1 documentation research. The full current terms at `policies.pixiv.net` could not be rendered. Both remain unverified. Fail-closed behaviour prevents collection that violates terms or robots rules that were not actually reviewed. |
| **Rejected alternatives** | Inferring allow/disallow from a failed retrieval — rejected; absence of retrieval is not permission. |
| **Impact** | robots.txt and full-terms review are hard prerequisites for any network prototype, pilot, or production collection. The collector must check robots before every pilot and at a bounded refresh interval, stop if unavailable or newly restrictive, and retain evidence. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Stage 1 documentation research, 2026-08-01. robots.txt attempt: https://booth.pm/robots.txt (retrieval failed). Full terms linked from BOOTH to https://policies.pixiv.net/ (could not be rendered). See [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md). |
| **Conditions for revisiting** | A direct technical preflight successfully retrieves and records the current robots.txt; and the full master and individual terms are directly reviewed and recorded. A new Issue documents both findings. |

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
| **Impact** | These values are pilot limits, not production limits. They must be revisited after the robots/full-terms preflight and the 20-request pilot. They do not authorize production collection. The client must use a stable user agent and contact URL/email once a public contact is available; cache responses and use content hashes; and apply exponential backoff on stop conditions. |
| **Decision date** | 2026-08-01 |
| **Evidence** | Stage 1 documentation research, 2026-08-01. No official rate was found in: https://booth.pm/guidelines, https://booth.pm/announcements/898, https://booth.pm/announcements/949, https://booth.pm/announcements/950. See [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md). |
| **Conditions for revisiting** | A direct robots/full-terms preflight is completed; and the 20-request pilot completes without stop conditions. A new Issue documents the pilot evidence and proposes revised cadence values. |

---

## Pending Decisions

The following decisions are explicitly deferred pending research or a later Issue. They must not be treated as decided.

### PD-001 — Technology stack selection

| Field | Value |
|---|---|
| **Subject** | Frontend framework, backend runtime, database, hosting platform, and CI provider |
| **Provisional candidates** | Next.js, TypeScript, Vercel, PostgreSQL, Supabase, GitHub Actions |
| **Blocked by** | Architecture research Issue (pricing, free-tier limits, license review, terms confirmation) |
| **Decision criteria** | JPY 0–1,000/month target cost, measurable AI cost and database capacity, no automatic paid-plan escalation, human approval above JPY 1,000 |
| **See also** | [ARCHITECTURE.md](ARCHITECTURE.md) |

---

### PD-002 — BOOTH collection method and access pattern

| Field | Value |
|---|---|
| **Subject** | How BOOTH product data is retrieved: API, scraping, RSS, or other mechanism |
| **Blocked by** | Direct robots/full-terms preflight (see D-009); robots.txt and full current terms at `policies.pixiv.net` remain unverified |
| **Decision criteria** | Must comply with current BOOTH terms and robots.txt; must use low-load access patterns; must respect the stop conditions and pilot limits in D-013 |
| **Progress** | Stage 1 documentation research (2026-08-01) recorded public discovery entry points, conservative pilot limits, and stop conditions. The specific collection mechanism remains pending. See [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md). |
| **See also** | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md), [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md), D-009, D-010, D-013 |

---

### PD-003 — Database provider and schema

| Field | Value |
|---|---|
| **Subject** | Which database provider to use and what the initial schema looks like |
| **Blocked by** | PD-001 (technology selection), Architecture Decision Record confirming pricing and terms |
| **Decision criteria** | Must support two-layer product/scenario model; must be cost-measurable; must fit JPY 0–1,000 target |
| **See also** | [ARCHITECTURE.md](ARCHITECTURE.md) |

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

| Field | Value |
|---|---|
| **Subject** | Where the application is deployed and hosted |
| **Blocked by** | PD-001 (technology selection), pricing and free-tier research |
| **Decision criteria** | Must fit JPY 0–1,000 target; no automatic paid-plan transition; human approval required above JPY 1,000 |
| **See also** | [ARCHITECTURE.md](ARCHITECTURE.md) |

---

### PD-006 — Rating and recommendation features

| Field | Value |
|---|---|
| **Subject** | Whether and how rating and recommendation sorting are implemented |
| **Blocked by** | MVP delivery; post-MVP feature planning |
| **Decision criteria** | Deferred from MVP sorting options (see [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md)); requires separate design and data model work |
| **See also** | [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) |
