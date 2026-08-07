# BOOTH Collection Research

## Research Metadata

| Field | Value |
|---|---|
| **Research date** | 2026-08-01 |
| **Scope** | Public, unauthenticated, low-load review only |
| **Sources** | Official BOOTH and pixiv policy sources only |
| **Excluded activities** | No crawl, bulk collection, account access, purchase, download, image collection, database, deployment, authentication, billing, or production traffic |

---

## Official Sources Reviewed

| Source | URL |
|---|---|
| Current BOOTH Guidelines | https://booth.pm/guidelines |
| Guideline scraping clarification announcement | https://booth.pm/announcements/898 |
| Master-terms update announcement effective 2026-06-22 | https://booth.pm/announcements/949 |
| Guideline amendment announcement effective 2026-07-08 | https://booth.pm/announcements/950 |
| Official master/individual terms destination linked by BOOTH | https://policies.pixiv.net/ |
| Keyword search sample | https://booth.pm/ja/search/TRPG |
| TRPG category browse | https://booth.pm/ja/browse/TRPG |
| TRPG tag filter | https://booth.pm/ja/items?tags%5B%5D=trpg |
| New-item listing | https://booth.pm/ja/items |
| Scenario example | https://booth.pm/ja/items/2274429 |
| Material-only example | https://booth.pm/ja/items/4186217 |
| Mixed scenario/material-variant example | https://booth.pm/ja/items/647539 |
| R-18G age-gate example (gate only; no adult content entered or collected) | https://booth.pm/ja/items/6260963 |
| robots.txt endpoint (attempted; retrieval failed) | https://booth.pm/robots.txt |

---

## Official Findings

The findings below are derived from the sources listed above. Each finding records its source. **These findings are not legal approval, a stability guarantee, or permission to bypass any access control.**

### Terms and Scraping Boundary

**Source**: https://booth.pm/announcements/949, https://booth.pm/announcements/950, https://booth.pm/guidelines

- The BOOTH announcement (https://booth.pm/announcements/949) states that the Service Master Terms were updated on 2026-06-22; the full current terms are hosted at `policies.pixiv.net`.
- The current BOOTH Guidelines were amended on 2026-07-08 (https://booth.pm/announcements/950) and may change again.
- The Guidelines prohibit crawler collection when it infringes or risks infringing rights, causes or risks damage, or places extreme load on the service. (Source: https://booth.pm/guidelines)
- The Guidelines also state that, notwithstanding the general prohibition, scraping for information analysis may be performed when its purpose is improving user convenience or contributing to healthy creative activity. (Source: https://booth.pm/guidelines, https://booth.pm/announcements/898)
- BOOTH may restrict scraping when it considers server load, rights impact, or damage risk present. (Source: https://booth.pm/guidelines)
- These statements support only a conservative research/prototype path. They are not legal approval, an availability guarantee, or permission to bypass robots.txt, access controls, rate limits, or service responses.
- The full current master and BOOTH individual terms could not be rendered by the research client even though the official BOOTH pages link to them at `policies.pixiv.net`. Unverified terms status is a material run-level risk input; it does not independently block bounded prototype design, planning, or low-load collection of unrelated safe public pages. Each collection endpoint or run must stop when a concrete prohibition, access-control boundary, 401/403/429 response, age gate, or unresolved material compliance risk specific to that endpoint applies. See D-021 in [DECISIONS.md](DECISIONS.md).

### robots.txt Status

**Source**: https://booth.pm/robots.txt (attempted)

- A direct request to `https://booth.pm/robots.txt` was attempted but the current research client could not retrieve the body.
- **Do not infer allow or disallow from this failure.**
- Treat robots status as **unverified** and fail closed at the endpoint and run level. No collection endpoint or run may proceed for BOOTH pages until a direct technical preflight retrieves and records the current body, retrieval time, response status, content hash, and applicable directives. An unavailable or restrictive robots.txt stops the specific run or endpoint; it does not, by itself, create an indefinite repository-wide ban on all low-load development prototype design. See D-021 in [DECISIONS.md](DECISIONS.md).
- The later collector must check robots before every pilot and at a bounded refresh interval, stop if unavailable or newly restrictive, and retain the evidence without bypassing it.

### Public Discovery Entry Points

**Source**: https://booth.pm/ja/search/TRPG, https://booth.pm/ja/browse/TRPG, https://booth.pm/ja/items?tags%5B%5D=trpg, https://booth.pm/ja/items, https://booth.pm/ja/items/2274429

The public surface exposes the following complementary entry points:

| Entry Point | Pattern |
|---|---|
| Keyword search | `/ja/search/<query>` |
| Category browse | `/ja/browse/TRPG` (`TRPG` is a subcategory under games) |
| Tag filter | `/ja/items?tags[]=<tag>` |
| New-item listing and query parameters | `/ja/items` with observed filters/sorts |
| Canonical product page | `/ja/items/<numeric-id>` |
| Public shop page | `<shop>.booth.pm` |

Observed query parameters on search/browse pages include filters for: keywords, OR terms, exclusions, tags, categories/subcategories, events, product type, age restriction, inventory/sales-ended state, recent publication, price, and sorting. The exact current parameter contract is **not documented as a public API** and must be treated as an observed HTML interface that can change.

### Coverage Strategy

**Source**: Project decision informed by https://booth.pm/ja/search/TRPG, https://booth.pm/ja/browse/TRPG, https://booth.pm/ja/items?tags%5B%5D=trpg

*This section records project decisions derived from official observations. It is not an official BOOTH policy.*

- The broad `TRPG` keyword result alone is insufficient: it contains scenarios, artwork, BGM, room assets, books, and other unrelated products.
- Initial discovery should use a deduplicated union of: the TRPG category, selected scenario-oriented tags, selected system/scenario keywords, and bounded new-item pages.
- Category/tag/keyword membership is candidate evidence only, not final classification.
- Do not apply popularity, sales, price, or recency thresholds.
- Do not attempt full historical reconciliation in the first prototype.

### All-Ages Boundary

**Source**: https://booth.pm/guidelines, https://booth.pm/ja/items/6260963 (gate confirmed; no adult content entered or collected)

- Public search and category pages expose an age-restriction filter and observed all-ages result mode.
- Official Guidelines require R-18 designation for content unsuitable for minors and allow BOOTH to add restrictions or make products non-public.
- Adult/R-18G product pages expose an age gate before content.
- The collector must request only all-ages surfaces and reject, without entering or persisting content from, any age-gated, R-18/R-18G-labelled, conflicting, or uncertain product.
- If age evidence is missing or conflicts, set `hold_age_unknown`; do not store descriptive content or publish the result.

### Product and Scenario Classification

**Source**: https://booth.pm/ja/items/2274429 (scenario), https://booth.pm/ja/items/4186217 (material-only), https://booth.pm/ja/items/647539 (mixed scenario/material-variant)

Observed official pages prove that category/tag membership alone is insufficient:

- A scenario product can include ancillary session assets while remaining a playable scenario. (Source: https://booth.pm/ja/items/2274429)
- A product in TRPG discovery can be material-only, such as APNG/session effects. (Source: https://booth.pm/ja/items/4186217)
- A single BOOTH product can expose scenario variants and a separate room-material variant. (Source: https://booth.pm/ja/items/647539)

#### Candidate Classification Classes

| Class | Description |
|---|---|
| `scenario_single` | Single playable scenario |
| `scenario_collection` | Multiple playable scenarios in one product |
| `mixed_scenario_and_material` | Both playable scenario content and session material content |
| `material_only` | Session support material without playable scenario content |
| `rulebook_or_system` | System rulebook or core rules |
| `supplement` | Supplementary rules, options, or expansions |
| `replay_or_reading_material` | Session replay or reading-only material |
| `update_or_dlc_only` | Update or DLC for an existing product |
| `non_trpg` | Not TRPG-related despite appearing in TRPG discovery |
| `hold_unknown` | Insufficient evidence to classify |

#### Evidence Requirements for Classification

Strong scenario evidence includes: explicit playable-scenario wording, supported system/edition, player/GM structure, session or play-time information, synopsis, and scenario file/content statements.

Strong material-only evidence includes: explicit room asset, APNG, BGM, standing art, map, token, effect, or session-support wording without playable scenario content.

A product with both scenario and material evidence must remain one product record with separate scenario/material child or variant classification. Never publish a material-only variant as a scenario.

#### Rules-First Classifier

Rules run first. AI may generate candidates only for fields that remain ambiguous after deterministic rules. No low-confidence, conflicting, age-uncertain, spoiler-suspect, DLC-only, or material-only candidate is automatically published.

Every derived field records: source URL, evidence type, short non-spoiler evidence, confidence, conflict state, classifier version, checked time, and content version/hash.

### Sales Lifecycle

**Source**: https://booth.pm/ja/items (observed inventory/sales-ended filter)

- Public results can include `販売終了` (sales ended) or out-of-stock products and expose an inventory/sales-ended filter.
- Store lifecycle separately from scenario classification.
- Exclude ended products from normal public search while retaining minimal internal history and last-checked evidence.
- Reappearance or state changes require a new evidence check; do not delete history solely because the current listing disappears.

---

## Project Decisions Derived From Research

The following are project decisions informed by the official findings above. They are labelled as project decisions, not official BOOTH policies. See [DECISIONS.md](DECISIONS.md) for full decision records.

### Conservative Prototype Cadence (Project Decision)

No official numeric request rate was found in the reviewed sources. The following deliberately conservative, reversible pilot values are a **project decision**, not an official BOOTH allowance:

| Constraint | Value |
|---|---|
| Request method | Unauthenticated public GET/HEAD only |
| Concurrency | One concurrent request |
| Inter-request delay | Minimum 10 seconds with jitter |
| First pilot ceiling | At most 20 listing/detail requests total |
| Later research ceiling | At most 100 requests/day before a new decision |
| Client identification | Stable user agent and contact URL/email once a public contact is available |
| Caching | Cache responses and use content hashes; do not refetch unchanged pages unconditionally |
| Stop conditions | Exponential backoff and immediate stop on 401, 403, 429, robots failure/restriction, CAPTCHA, challenge, repeated 5xx, or changed access behavior |
| Retries | No automatic retries that exceed the daily ceiling |
| Prohibited | No parallel workers, rotating identities, proxy evasion, browser automation to bypass controls, or login/session cookies |

These values must be revisited after the direct robots/full-terms preflight and the 20-request pilot. They do not authorize production collection.

---

## Unresolved Items

The following items remain unresolved after this research. No listing or detail collection run is approved until robots.txt has been verified for the intended endpoints. Unverified terms status is a material run-level risk input but does not independently block all bounded prototype design or planning.

| Item | Status | Blocker |
|---|---|---|
| robots.txt current body, retrieval time, response status, content hash, and applicable directives | **Unverified** | Direct technical preflight required before any listing or detail collection run |
| Full current master terms at `policies.pixiv.net` | **Unverified** | Could not be rendered by research client; required before production collection |
| BOOTH individual terms at `policies.pixiv.net` | **Unverified** | Could not be rendered by research client; required before production collection |

---

## What This Record Does Not Constitute

- Legal approval to collect BOOTH data.
- Confirmation that robots.txt permits any specific crawl pattern.
- Authorization for production collection, full crawl, or scheduled requests.
- A guarantee that the observed HTML interface or entry points are stable.
- Legal advice or a legal opinion.

---

## Stage 8 exact-SHA preflight and bounded pilot addendum

**Update date:** 2026-08-04. This addendum preserves the earlier research record and narrows the only currently implemented network plan.

### Fixed current plan

- Exact listing endpoint: `https://booth.pm/ja/browse/TRPG?adult=none&type=digital`.
- Manual `workflow_dispatch` only; dry-run is the default and performs zero network requests.
- No schedule, push/PR trigger, Secret, OIDC, cookie, proxy, browser automation, JavaScript execution, credentialed session, or repository-write permission.
- Accepted workflow sources are only the default branch or `fix/stage8-issue-79-collection-pilot`.
- Network mode requires a lowercase 40-hex `candidate_sha` equal to the dispatched `github.sha`; checkout and evidence metadata are bound to that immutable SHA.

### Two-step authorization

1. After all offline gates and both exact-head coordinator reviews pass, an explicit current-policy preflight retrieves only robots, guideline, and Terms inputs. A blank policy digest produces a durable reviewed stop before listing access.
2. Only after the exact artifact, source SHA, endpoint decisions, and policy digest are reviewed may a second dispatch of the same source SHA supply that digest and make the one fixed listing request.

A stale or mismatched candidate SHA or policy digest fails before listing access. A stopped route is valid evidence and is not immediately retried.

### Parser, redirect, and transport boundary

- Robots matching supports declared-agent precedence, path plus query, `*`, terminal `$`, UTF-8/percent-octet semantics, longest match, and `Allow` on exact ties.
- Policy documents are not classified as age/challenge pages merely because they discuss R-18, login, or CAPTCHA; those markers are scanned only on the bounded listing body.
- Policy redirects are same-origin and bounded. Listing redirects are never followed.
- Connect and read timeouts are 10 seconds each; total timeout is 30 seconds per request; response sizes are bounded; retries are disabled.
- 401, 403, 429, 5xx, unexpected type/status, challenge/login/age/adult signals, timeout, network failure, and size breaches stop the run.
- Partial preflight failures retain only completed hash records, exact attempted fixed URLs, and a bounded stop reason.

### Evidence and durability

The read-only workflow uploads `evidence.json`, `evidence.sha256`, and `run-metadata.json`. Permitted evidence is limited to fixed URLs, status/type, timing and request counts, hashes, parser/normalizer versions, endpoint and exact-hash-review decisions, status distribution, transport limits, exact source ref/SHA, workflow ref, run ID, and stop reason. Full bodies, descriptions, images, exact prices, cookies, sensitive headers, product files, and adult/uncertain content are prohibited.

The coordinator must verify the artifact digest and exact run metadata before publishing only the minimized record to Issue #79. No current repository record claims that robots or Terms have cleared the listing endpoint, and no Stage 8 BOOTH network request has yet been executed.

## 2026-08-07 Stage 22 stopped listing and Stage 26 offline diagnostic follow-up

The explicitly authorized Stage 22 one-listing pilot (`31144141606`) reproduced the reviewed current-policy digest and made exactly one fixed all-ages listing request. The response matched the existing challenge/login stop classifier, so the run stopped with `challenge_or_login_gate`, made no detail request, retained no listing record/body, and performed no retry or bypass.

Stage 26 is offline-only. It adds a bounded stop observation for future runs: fixed requested/final URL, status/media type/timing/request counts, byte length, raw/normalized hashes, normalization version, and stable marker IDs. It never stores response text, snippets, headers, cookies, exact price, or DOM content. Because the parser version is bumped, prior policy digests are not reusable for a future network run; any later access must repeat the existing review/authorization boundary.

## Stage 27 strict diagnostic-envelope validation

Stage 27 remains offline-only and adds a second fail-closed boundary around the Stage 26 `stop_observation`. The observation must contain exactly the approved keys and values: the fixed listing URL, HTTP 200 `text/html`, one attempt, zero redirects, bounded non-negative size/timing, lowercase SHA-256 values, a valid normalization pair, and unique known marker IDs in canonical order. Extra keys or malformed values are rejected before durable evidence is written.

## Stage 28 minimal listing discovery handoff

Stage 28 remains offline-only. For a future successfully authorized all-ages listing response, the parser may inspect only anchor `href` values and retain only unique positive numeric BOOTH product IDs plus canonical `https://booth.pm/ja/items/<id>` URLs. Candidate output is numerically sorted and bounded to at most 100 unique products per listing response. External/non-product links are ignored; zero or excessive candidates fail closed.

Anchor text, product titles, descriptions, exact prices, images, shop/creator data, arbitrary attributes, scripts, and response snippets are never part of the discovery candidate. Challenge/login/adult classification remains earlier than candidate extraction, so rejected responses cannot yield product candidates.

