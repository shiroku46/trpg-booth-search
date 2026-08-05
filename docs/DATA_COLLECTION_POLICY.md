# Data Collection Policy

## Status

Confirmed policy requirements and Stage 1 research findings (2026-08-01). Items marked **[PENDING RESEARCH]** require the applicable staged preflight: a current `robots.txt` check before any bounded listing/detail collection run, direct review of the full current master and individual terms before production collection, and pilot evidence before broader implementation. Documentation-only design is not blocked by either preflight. See [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md) for the dated evidence record.

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [DECISIONS.md](DECISIONS.md) | [ROADMAP.md](ROADMAP.md) | [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) | [ARCHITECTURE.md](ARCHITECTURE.md) | [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md)

---

## Coverage Goal

The long-term goal is broad coverage of all-ages TRPG scenarios available on BOOTH. This goal does not promise 100% completeness. Coverage improves incrementally over time.

---

## Collection Thresholds

- **No popularity threshold**: Products are not filtered by sales volume, download count, or ranking.
- **No recency threshold**: Products are not filtered by publication date or last-updated date.
- **No sales threshold**: Free products and paid products are treated equally.

---

## Discovery Entry Points

Stage 1 documentation research (2026-08-01) identified the following public discovery entry points. These are an observed HTML interface, not a documented public API, and may change without notice. See [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md) for sources.

| Entry Point | Pattern | Notes |
|---|---|---|
| Keyword search | `/ja/search/<query>` | Broad; contains non-scenario products |
| Category browse | `/ja/browse/TRPG` | TRPG subcategory under games |
| Tag filter | `/ja/items?tags[]=<tag>` | Scenario-oriented tags reduce noise |
| New-item listing | `/ja/items` | Bounded page count; use for incremental discovery |
| Canonical product page | `/ja/items/<numeric-id>` | Detail fetch for classification |

Initial discovery uses a deduplicated union of the TRPG category, selected scenario-oriented tags, selected system/scenario keywords, and bounded new-item pages. The broad TRPG keyword result alone is not used as the sole source; it contains scenarios, artwork, BGM, room assets, books, and other unrelated products. Category/tag/keyword membership is candidate evidence only, not final classification. See D-010 in [DECISIONS.md](DECISIONS.md).

---

## Collection Approach

The following are requirements, not implementation decisions. Documentation-only mechanism design may proceed. Before any bounded listing or detail collection run, a direct technical preflight must retrieve and evaluate the current `robots.txt` for the intended endpoint. Direct review of the full current BOOTH master and individual terms is additionally required before production collection. See D-021 in [DECISIONS.md](DECISIONS.md).

| Requirement | Detail |
|---|---|
| **Low-load initial discovery** | Initial collection must use low-load access patterns; no aggressive crawling |
| **Incremental changes** | After initial discovery, only changed or new products are re-fetched; no unconditional full re-fetch |
| **Periodic reconciliation** | A scheduled reconciliation pass checks for deleted or ended products |
| **No daily unconditional refetch** | Every product must not be unconditionally re-fetched on a daily basis |

The specific access pattern, rate limits, and scheduling are **[PENDING RESEARCH]** pending the robots.txt preflight and pilot evidence. A robots.txt preflight must be completed before any listing or detail collection run begins. Full current master and individual terms review remains a separate prerequisite for production collection. See D-021 in [DECISIONS.md](DECISIONS.md) for the current endpoint/run-level fail-closed boundary.

---

## Content Extraction Approach

### Rules-First

Content extraction follows explicit rules first:
- Field values extracted by deterministic rules from BOOTH product data (title, description, tags, metadata) are preferred.
- Rule-based extraction does not require AI and does not have confidence uncertainty.

### AI for Ambiguous Candidates Only

AI is used only for ambiguous candidate generation — cases where rule-based extraction cannot reliably determine a field value. AI is not used as the primary extraction mechanism for fields that can be extracted by rules.

---

## AI Output Publication Gate

AI-generated field values are not automatically published. The following outputs are held pending manual review or are excluded from publication:

| Output type | Disposition |
|---|---|
| Low-confidence output | Held; not published automatically |
| Conflicting output (multiple sources disagree) | Held; not published automatically |
| Spoiler-suspect output | Excluded; not published |

---

## Reanalysis Avoidance

- Each collected product record stores a **content version** or **content hash** derived from the source content.
- Re-analysis (including AI extraction) is skipped when the content version/hash has not changed since the last analysis.
- This prevents unnecessary AI cost and processing for unchanged products.

### AI Budget Limits

- A **daily AI budget** limit is enforced; collection pauses if the daily limit is reached.
- A **monthly AI budget** limit is enforced; collection pauses if the monthly limit is reached.
- Budget limits are measurable and observable. See [ARCHITECTURE.md](ARCHITECTURE.md) for cost requirements.

---

## Metadata Fields

Every collected record stores the following metadata:

| Field | Description |
|---|---|
| `source_evidence` | The specific source content used to derive each field value |
| `confidence` | Confidence level for AI-derived fields |
| `conflict` | Flag indicating multiple sources produced conflicting values |
| `hold` | Flag indicating the record is held pending review |
| `unknown` | Flag indicating a field value is genuinely unknown (not inferred as zero or null) |
| `last_checked` | Timestamp of the most recent access to the source product page |
| `content_version` | Hash or version identifier of the source content at last analysis |

---

## All-Ages Boundary

- Only all-ages content is collected, stored, or published.
- R-18 and R-18G products are excluded at every stage: collection, storage, and publication.
- The all-ages boundary is enforced before any data enters the database.
- The collector must request only all-ages surfaces and reject, without entering or persisting content from, any age-gated, R-18/R-18G-labelled, conflicting, or uncertain product.
- If age evidence is missing or conflicts, set `hold_age_unknown`; do not store descriptive content or publish the result.

See D-012 in [DECISIONS.md](DECISIONS.md).

---

## Stop Conditions

The following conditions require an immediate stop of all collection activity. These are pilot limits derived from Stage 1 research (2026-08-01); see D-013 in [DECISIONS.md](DECISIONS.md).

| Condition | Response |
|---|---|
| HTTP 401 or 403 | Stop immediately; do not retry without a new pilot decision |
| HTTP 429 (rate limited) | Stop immediately; apply exponential backoff; do not exceed daily ceiling |
| robots.txt unavailable or newly restrictive | Stop immediately; fail closed until a new preflight is recorded |
| CAPTCHA or challenge response | Stop immediately |
| Repeated 5xx errors | Stop with exponential backoff; do not exceed daily ceiling |
| Changed access behaviour | Stop; document the change; do not resume without a new decision |

No automatic retries may exceed the daily request ceiling. No parallel workers, rotating identities, proxy evasion, browser automation to bypass controls, or login/session cookies are permitted.

---

## Pilot Request Limits

The following are project pilot limits, not official BOOTH allowances. They must be revisited after the robots.txt preflight and the first 20-request pilot. Full current master and individual terms review remains required before production collection but is not a prerequisite for documentation-only design or a separately cleared bounded pilot. See D-013 and D-021 in [DECISIONS.md](DECISIONS.md).

| Limit | Value |
|---|---|
| First pilot ceiling | At most 20 listing/detail requests total |
| Later research ceiling | At most 100 requests/day before a new decision |
| Concurrency | One concurrent request |
| Inter-request delay | Minimum 10 seconds with jitter |
| Request method | Unauthenticated public GET/HEAD only |

---

## Sales Lifecycle

Stage 1 documentation research (2026-08-01) confirmed that public BOOTH results can include `販売終了` (sales ended) or out-of-stock products.

- Store sales lifecycle state separately from scenario classification.
- Exclude ended products from normal public search.
- Retain minimal internal history and last-checked evidence for ended products.
- Reappearance or state changes require a new evidence check.
- Do not delete history solely because the current listing disappears.

---

## Product Classification Evidence Schema

Every collected and classified record stores the following evidence fields. See D-011 in [DECISIONS.md](DECISIONS.md).

| Field | Description |
|---|---|
| `source_url` | The URL from which evidence was retrieved |
| `evidence_type` | Type of evidence (e.g., `product_title`, `description_excerpt`, `tag_list`, `category_path`) |
| `evidence_excerpt` | Short non-spoiler excerpt supporting the classification; no full product descriptions |
| `confidence` | Confidence level for each derived field |
| `conflict` | Flag indicating multiple sources produced conflicting classification evidence |
| `classifier_version` | Version identifier of the classifier that produced the output |
| `checked_time` | Timestamp of the access that produced the evidence |
| `content_version` | Hash or version identifier of the source content at the time of analysis |
| `hold` | Flag indicating the record is held pending review (covers `hold_age_unknown` and other hold states) |
| `unknown` | Flag indicating a field value is genuinely unknown, not inferred as zero or null |

---

## Compliance Requirements

- **Collection permission**: Low-load collection of public BOOTH product information for search/information-analysis purposes is permitted in principle under the current official BOOTH guideline (https://booth.pm/guidelines; clarification: https://booth.pm/announcements/898; amendment effective 2026-07-08: https://booth.pm/announcements/950). This is not legal approval or a guarantee for any specific implementation. See D-021 in [DECISIONS.md](DECISIONS.md).
- **Terms of service**: BOOTH terms of service must be followed. The full current master and BOOTH individual terms at `policies.pixiv.net` could not be verified during Stage 1 research and remain unverified. Unverified terms status is a material run-level risk input; it does not independently block bounded prototype design or planning. Each collection run must stop when a concrete prohibition, access-control boundary, or unresolved material compliance risk specific to the intended endpoint applies. Direct full-terms review is required before production collection. See [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) and D-021 in [DECISIONS.md](DECISIONS.md).
- **robots.txt**: BOOTH robots.txt must be read and respected. The current robots.txt could not be retrieved during Stage 1 research and remains unverified. A direct technical preflight must retrieve and record the current body, retrieval time, response status, content hash, and applicable directives before any listing or detail collection run begins. If robots.txt is unavailable or restrictive for an intended endpoint, that run must remain disabled or stop immediately.
- **Access controls**: No bypass of BOOTH access controls, login walls, age gates, CAPTCHA, anti-bot defenses, or rate limiting mechanisms.
- **Rate limits**: Collection must operate within BOOTH's published or observed rate limits.

No production collection or full crawl is authorized by this document.

---

## Stage 8 exact-SHA pilot addendum

**Binding update date:** 2026-08-04. This addendum narrows the first implemented pilot without replacing the earlier collection, classification, sales-lifecycle, and compliance requirements above.

### Current endpoint, trigger, and permission boundary

- The only implemented listing endpoint is `https://booth.pm/ja/browse/TRPG?adult=none&type=digital`.
- The workflow is manual `workflow_dispatch` only and defaults to dry-run with zero network requests.
- Only the default branch and fixed candidate branch `fix/stage8-issue-79-collection-pilot` are accepted sources.
- Network mode requires a lowercase 40-hex `candidate_sha` equal to the dispatched `github.sha`; checkout and durable metadata must identify that same exact SHA.
- Global permissions are empty and the job has `contents: read` only. Secret, OIDC, cookie, session, proxy, browser automation, JavaScript execution, rotating identity, alternate host, schedule, automatic trigger, and repository-write permission are prohibited.

### Two-step current-policy gate

Before listing access, one explicit run retrieves only current robots, BOOTH guideline, and the official Terms destination. It records exact fixed URLs, final URL, status/type, timestamp, request and redirect counts, byte length, raw/normalized SHA-256, parser/normalizer versions, robots decision, and machine-readable `exact_hash_review_required` decisions for guideline and Terms.

A blank digest stops after preflight and before listing access. Only after that exact artifact and source SHA are reviewed may a second dispatch of the same exact source SHA supply the matching policy digest and make the one fixed listing request. Blank, malformed, stale, or mismatched SHA/digest inputs fail closed.

### Request, redirect, timeout, and stop rules

| Control | Stage 8 binding value |
|---|---|
| Current listing requests | zero for preflight-only; at most one after exact digest review |
| Concurrency | one |
| Delay | minimum 10 seconds plus bounded jitter between listing requests; vacuous for the single-request plan |
| Policy redirects | same-origin and bounded |
| Listing redirects | never followed |
| Connect/read timeout | 10 seconds each |
| Total request timeout | 30 seconds |
| Response size | bounded separately for policy and listing content |
| Retries | none |

The run stops on restrictive/malformed/unavailable robots, unreviewed or changed policy evidence, 401/403/429, any 5xx, unexpected type/status, any listing redirect, challenge/login/age/adult signal, timeout, network/TLS/HTTP failure, size breach, endpoint mismatch, or changed access behavior. Partial preflight failure retains only exact attempted fixed URLs, completed non-sensitive hash records, and a bounded stop reason.

### Evidence minimization and durable record

The read-only workflow uploads `evidence.json`, `evidence.sha256`, and `run-metadata.json`. Permitted evidence is limited to fixed URLs, status/type, request/redirect counts and timing, hashes and versions, endpoint/policy-review decisions, status distribution, transport limits, exact source ref/SHA, candidate SHA, workflow ref, run ID, and stop reason.

Full response bodies/descriptions, exact prices, images/files/downloads, creator profiles, cookies, authorization or sensitive headers, Secrets, and adult/uncertain descriptive content remain prohibited. The coordinator independently verifies the artifact digest and exact run metadata, then may publish only the minimized record to Issue #79. No BOOTH network request has yet been executed by the Stage 8 candidate, and this addendum does not authorize production collection or a full crawl.
