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
| **Blocked by** | BOOTH terms and robots.txt research (next Issue, low-load requests only) |
| **Decision criteria** | Must comply with current BOOTH terms and robots.txt; must use low-load access patterns |
| **See also** | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md), [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) |

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
