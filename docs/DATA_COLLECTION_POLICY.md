# Data Collection Policy

## Status

Binding MVP collection policy, updated for Stage 8 on 2026-08-04. This document authorizes only the reviewed manual preflight and bounded pilot mechanism. It does not authorize production collection, a recurring schedule, credentials, billing, deployment, or a full crawl.

Cross-links: [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md) | [DECISIONS.md](DECISIONS.md) | [ROADMAP.md](ROADMAP.md) | [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md)

## Coverage and exclusion

The long-term product goal is broad discovery of public, all-ages TRPG scenarios on BOOTH. Completeness is not guaranteed.

- no popularity, ranking, price, sales-volume, or recency threshold;
- free and paid products are treated equally, but exact price is not persisted;
- R-18, R-18G, gated, conflicting, and age-uncertain content is excluded before descriptive persistence;
- purchase, payment, downloads, images, files, cart, checkout, creator profiles, login, and account state remain on BOOTH and outside this system.

## Stage 8 collection boundary

The only currently authorized candidate endpoint is:

`https://booth.pm/ja/browse/TRPG?adult=none&type=digital`

The prototype may not accept an arbitrary URL, follow a URL discovered in fetched content, use another BOOTH host, or enter an item/detail surface during the current pilot.

### Trigger and permission boundary

- manual `workflow_dispatch` only;
- default mode is dry-run and performs zero network requests;
- no `push`, `pull_request`, `schedule`, repository-dispatch, issue-comment, or automatic retry trigger;
- global permissions are empty and the pilot job has `contents: read` only;
- no Secret, OIDC, cookie, session, proxy, browser automation, JavaScript execution, rotating identity, or alternate hostname;
- single concurrency and no cancellation/replacement of an in-progress run.

## Required preflight

Before any listing request, the same explicit run retrieves the current:

1. `https://booth.pm/robots.txt`;
2. `https://booth.pm/guidelines`;
3. `https://policies.pixiv.net/` Terms destination.

For each input it records final URL, status, content type, UTC retrieval time, byte length, raw SHA-256, normalized SHA-256, and parser/normalizer version. Unavailable, malformed, oversized, cross-origin, restrictive, or materially ambiguous policy evidence stops before listing access.

A policy digest is derived from immutable preflight hashes, exact endpoint decisions, and parser version. A listing request requires an exact reviewed digest supplied in a second explicit dispatch. A blank, malformed, stale, or mismatched digest stops before listing access.

## robots.txt rules

The Stage 8 parser must:

- select the declared product-token group before wildcard groups;
- match path and query;
- support `*` and terminal `$`;
- apply percent-encoding and UTF-8 octet semantics;
- choose the longest rule and prefer `Allow` on an exact tie;
- fail closed on malformed syntax/encoding, no applicable group, unavailable data, or a deny decision.

A plain-prefix-only parser is not acceptable.

## Request budget and pacing

| Control | Binding value |
|---|---|
| Current listing requests | exactly 0 for preflight-only; at most 1 after exact digest approval |
| Issue ceiling | never more than 20 listing/detail requests without a new reviewed implementation |
| Concurrency | 1 |
| Delay | minimum 10 seconds plus bounded jitter between listing requests |
| Current delay behavior | vacuous because the fixed plan contains one listing request |
| Redirects | bounded and same-origin only |
| Timeouts | strict socket timeout and workflow timeout |
| Body size | strict preflight/page byte ceilings |
| Retries | none |

No daily or production cadence is authorized by Stage 8.

## Immediate stop conditions

The complete run stops without retry on:

- robots unavailable, malformed, ambiguous, newly restrictive, or cross-origin;
- Terms/guideline input unavailable, cross-origin, unexpected, or materially ambiguous;
- HTTP 401, 403, 429, any 5xx, or another unexpected status;
- CAPTCHA, anti-bot challenge, login wall, age gate, R-18/R-18G signal, or all-ages uncertainty;
- unexpected content type, response-size breach, endpoint mismatch, or redirect outside the exact host/endpoint boundary;
- changed access behavior or any result that cannot be classified safely.

A correctly stopped preflight is acceptable pilot evidence. It must not be bypassed or immediately repeated through the same failing path.

## Evidence minimization

Permitted pilot evidence:

- canonical fixed URL;
- status and content type;
- request sequence/count and elapsed time;
- checked time;
- raw byte length and SHA-256;
- normalized-content version and SHA-256;
- robots endpoint decision and declared user agent;
- policy digest;
- stop state/reason;
- confirmation that forbidden data was not persisted.

Prohibited evidence:

- full response body or full description;
- exact price;
- images, product files, downloads, creator profile data;
- cookies, authorization values, sensitive headers, Secrets, tokens;
- adult, gated, or age-uncertain descriptive content.

## Content versioning

Exact source bytes and normalized content are hashed separately. Normalization is explicit and versioned:

- strict UTF-8;
- Unicode NFC;
- CRLF/CR converted to LF;
- trailing spaces/tabs removed per line;
- no semantic HTML rewriting or lossy extraction.

Equivalent documented whitespace/newline forms produce the same normalized version. Materially changed input produces a different normalized hash. Invalid encoding or oversized input fails closed. An unchanged normalized hash allows reanalysis to be skipped without invoking AI.

## Durable pilot record

The read-only workflow uploads `evidence.json` and `evidence.sha256` as a bounded artifact. The GitHub coordinator must independently verify the artifact and publish the minimized record, digest, exact workflow/main SHA, run ID, and review decision as a durable Issue #79 comment. The coordinator must not publish response bodies or forbidden fields.

No repository-write permission is needed in the network job. A later write-capable publisher requires a separate exact-scope review and may consume only verified immutable evidence bytes.

## Classification and publication remain separate

The pilot validates access, stop behavior, hashing, and evidence boundaries only. It does not publish product or scenario records. Later classification remains deterministic rules-first, AI candidate-only for unresolved fields, and subject to all existing hold/conflict/spoiler/sales/publication gates.

## Completion gates

Stage 8 requires all of the following on one unchanged exact head:

- exact allowed-path, rename, and collision audit;
- workflow trigger/permission/input audit;
- public export guard and repository validator;
- complete Python unittest suite and workflow YAML validation;
- `git diff --check`;
- exact-head CI and Unit Tests success with no BOOTH request from CI/PR events;
- two independent coordinator review passes;
- all P1/P2 Threads resolved;
- a reviewed explicit preflight stop record or reviewed-digest one-request pilot record;
- final live base/head/default/mergeability recheck and expected-head-SHA merge.

No production collection or full crawl is authorized by this policy.
