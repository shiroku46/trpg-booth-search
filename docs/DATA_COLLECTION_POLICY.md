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

### Trigger, source, and permission boundary

- manual `workflow_dispatch` only;
- default mode is dry-run and performs zero network requests;
- no `push`, `pull_request`, `schedule`, repository-dispatch, issue-comment, or automatic retry trigger;
- global permissions are empty and the pilot job has `contents: read` only;
- no Secret, OIDC, cookie, session, proxy, browser automation, JavaScript execution, rotating identity, or alternate hostname;
- single concurrency and no cancellation/replacement of an in-progress run;
- only the default branch and fixed candidate branch `fix/stage8-issue-79-collection-pilot` are accepted workflow sources;
- network mode requires a lowercase 40-hex `candidate_sha` input equal to `github.sha`, and checkout must resolve to that exact SHA;
- arbitrary branches, stale SHA inputs, and symbolic-branch-only authorization fail before network access.

## Required preflight

Before any listing request, the same explicit run retrieves the current:

1. `https://booth.pm/robots.txt`;
2. `https://booth.pm/guidelines`;
3. `https://policies.pixiv.net/` Terms destination.

For each input it records final URL, status, content type, UTC retrieval time, request attempts and redirects, byte length, raw SHA-256, normalized SHA-256, and parser/normalizer version. Unavailable, malformed, oversized, cross-origin, restrictive, or materially ambiguous policy evidence stops before listing access.

The policy evidence includes machine-readable decisions:

- the applicable robots decision for every fixed endpoint;
- `exact_hash_review_required` for the current guideline;
- `exact_hash_review_required` for the current Terms destination.

A digest is derived from immutable preflight hashes, exact endpoint decisions, and parser version. A listing request requires an exact reviewed digest supplied in a second explicit dispatch of the same reviewed source SHA. A blank, malformed, stale, or mismatched digest or candidate SHA stops before listing access. Supplying the exact current digest records `approved_exact_digest`; it does not create a reusable or general authorization.

Policy documents are not subjected to listing age/challenge text-marker classification because those official documents and robots rules may legitimately discuss `R-18`, login, or CAPTCHA. Listing responses are scanned across the complete bounded body before evidence is accepted.

## robots.txt rules

The Stage 8 parser must:

- select the declared product-token group before wildcard groups;
- match path and query;
- support `*` and terminal `$`;
- apply percent-encoding and UTF-8 octet semantics;
- choose the longest rule and prefer `Allow` on an exact tie;
- fail closed on malformed syntax/encoding, no applicable group, unavailable data, or a deny decision.

A plain-prefix-only parser is not acceptable.

## Request budget, redirects, pacing, and timeouts

| Control | Binding value |
|---|---|
| Current listing requests | exactly 0 for preflight-only; at most 1 after exact digest approval |
| Issue ceiling | never more than 20 listing/detail requests without a new reviewed implementation |
| Concurrency | 1 |
| Delay | minimum 10 seconds plus bounded jitter between listing requests |
| Current delay behavior | vacuous because the fixed plan contains one listing request |
| Policy redirects | bounded and same-origin only |
| Listing redirects | never followed; any redirect stops after the one exact request |
| Connect/read timeout | 10 seconds each |
| Total timeout | 30 seconds per request |
| Workflow timeout | 15 minutes |
| Body size | strict preflight/page byte ceilings |
| Retries | none |

No daily or production cadence is authorized by Stage 8.

## Immediate stop conditions

The complete run stops without retry on:

- robots unavailable, malformed, ambiguous, newly restrictive, or cross-origin;
- Terms/guideline input unavailable, cross-origin, unexpected, or not approved by the exact current digest;
- HTTP 401, 403, 429, any 5xx, or another unexpected status;
- CAPTCHA, anti-bot challenge, login wall, age gate, R-18/R-18G signal, or all-ages uncertainty on the listing response;
- unexpected content type, response-size breach, endpoint mismatch, any listing redirect, or redirect outside the policy-origin boundary;
- timeout, network/HTTP/TLS failure, changed access behavior, or any result that cannot be classified safely.

A correctly stopped preflight is acceptable pilot evidence. It must not be bypassed or immediately repeated through the same failing path.

## Evidence minimization

Permitted pilot evidence:

- canonical fixed URL;
- status and content type;
- request sequence/count, redirect count, and elapsed time;
- checked time;
- raw byte length and SHA-256;
- normalized-content version and SHA-256;
- robots endpoint decision and declared user agent;
- policy digest and exact-digest review decision;
- status distribution and bounded transport settings;
- exact source ref/SHA, workflow ref, run ID, and evidence digest;
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

The read-only workflow uploads `evidence.json`, `evidence.sha256`, and `run-metadata.json` as a bounded artifact. The GitHub coordinator must independently verify:

- the evidence bytes against the digest;
- source ref, source SHA, candidate SHA input, workflow ref, and run ID against the reviewed dispatch;
- fixed endpoints, request counts, redirect behavior, stop state, and forbidden-field boundaries.

The coordinator may then publish only the minimized record, digest, exact source SHA, run ID, and review decision as a durable Issue #79 comment. It must not publish response bodies or forbidden fields.

No repository-write permission is needed in the network job. A later write-capable publisher requires a separate exact-scope review and may consume only verified immutable evidence bytes.

## Classification and publication remain separate

The pilot validates access, stop behavior, hashing, and evidence boundaries only. It does not publish product or scenario records. Later classification remains deterministic rules-first, AI candidate-only for unresolved fields, and subject to all existing hold/conflict/spoiler/sales/publication gates.

## Completion gates

Stage 8 requires all of the following on one unchanged exact head:

- exact allowed-path, rename, and collision audit;
- workflow trigger/permission/input/source-SHA audit;
- public export guard and repository validator;
- complete Python unittest suite and workflow YAML validation;
- `git diff --check`;
- exact-head CI and Unit Tests success with no BOOTH request from CI/PR events;
- protected coordinator review pass 1: scope, permissions, external effects, and trust boundary;
- protected coordinator review pass 2: correctness, robots parsing, redirect/race/retry/idempotency, and evidence minimization;
- all P1/P2 Threads resolved;
- a reviewed explicit exact-SHA preflight stop record or reviewed-digest one-request pilot record;
- final live base/head/default/mergeability recheck and expected-head-SHA merge.

No production collection or full crawl is authorized by this policy.
