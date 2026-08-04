# BOOTH Collection Research

## Status

- **Last official-source review:** 2026-08-04
- **Stage:** Stage 8 bounded preflight and pilot design
- **Network status:** no BOOTH request has been executed by the Stage 8 candidate
- **Scope:** public, unauthenticated, all-ages, low-load research only
- **Not authorized:** production collection, recurring crawl, login/session use, adult surfaces, downloads, images, checkout, database persistence, deployment, billing, or access-control bypass

This record supports a fail-closed prototype. It is not legal advice, blanket permission, or a guarantee that any endpoint remains available.

## Current official evidence

| Source | Observed fact | Review date |
|---|---|---|
| `https://booth.pm/guidelines` | The current page states that information-analysis scraping intended to improve user convenience or healthy creative activity may be performed, while BOOTH may restrict activity that creates extreme load, infringes rights, or causes harm. The page records a 2026-07-08 revision. | 2026-08-04 |
| `https://booth.pm/announcements/863` | The 2025-10-10 notice says ordinary-range third-party applications that complement BOOTH, including independent search/recommendation using public information, are welcomed in principle, subject to stability and Terms compliance. | 2026-08-04 |
| `https://booth.pm/announcements/950` | The 2026-06-23 notice announced a guideline change effective 2026-07-08 covering products whose main purpose is redirection or announcements. | 2026-08-04 |
| `https://policies.pixiv.net/` | Official Terms destination linked by BOOTH. The research client did not obtain a reviewable current terms body in this pass. | 2026-08-04 |
| `https://booth.pm/robots.txt` | Mandatory live preflight input. No current body is recorded in this repository and no permission is inferred. | 2026-08-04 |

The guidelines permit a narrow information-analysis purpose in principle but preserve BOOTH's right to restrict scraping. Terms compliance and live robots decisions remain independent run gates.

## Stage 8 fixed plan

The candidate is restricted to one exact all-ages listing endpoint:

`https://booth.pm/ja/browse/TRPG?adult=none&type=digital`

The workflow is manual `workflow_dispatch` only and defaults to dry-run. It has no schedule, push/PR trigger, Secret, OIDC, cookie, proxy, browser automation, JavaScript execution, or credentialed session.

### Two-step authorization

1. **Current-policy preflight:** an explicit network dispatch retrieves only current robots, guideline, and Terms inputs. With no approved digest, it must stop before listing access.
2. **One listing request:** only after the exact preflight evidence and computed policy digest are reviewed may a second explicit dispatch provide that digest and request the single fixed listing endpoint.

A stopped preflight is valid evidence when the stop boundary works correctly. The same stopped route must not be immediately repeated.

## Robots interpretation contract

The parser uses the following fail-closed boundary:

- declared product-token group preferred over `*`;
- `Allow` and `Disallow` rules matched against path plus query;
- `*` wildcard and terminal `$` supported;
- percent-encoded unreserved octets compare with their literal form;
- reserved octets remain percent-encoded and hex comparison is normalized;
- non-ASCII literal text is compared as UTF-8 percent-encoded octets;
- longest matching rule wins and `Allow` wins an exact specificity tie;
- malformed encoding, malformed rules, no applicable group, oversized body, unavailable robots, cross-origin redirect, or restrictive result stops the run.

This contract is deliberately stricter than a plain-prefix parser and is covered by deterministic offline tests.

## Network boundary

- exact HTTPS hosts only: `booth.pm` for BOOTH pages and `policies.pixiv.net` for the Terms preflight;
- unauthenticated public `GET` only in the current implementation;
- fixed URLs in code, never arbitrary workflow input or fetched-content navigation;
- maximum one current listing request, below the Issue ceiling of 20;
- one concurrent request;
- minimum 10 seconds plus at most 2 seconds jitter between listing requests; the delay is intentionally vacuous for the current single-request plan;
- 10-second socket timeout, bounded redirect count, and strict response byte ceilings;
- no automatic retry or alternate identity;
- immediate stop on 401, 403, 429, 5xx, unexpected status/type, redirect boundary, CAPTCHA/challenge, login/age signal, R-18/R-18G signal, or size breach.

## Content versioning and evidence minimization

The prototype records separate SHA-256 values for exact source bytes and deterministic normalized UTF-8 content. Normalization is versioned and limited to NFC normalization, newline equivalence, and trailing horizontal whitespace removal. Invalid encoding and oversized input fail closed.

Permitted evidence is limited to URLs, status/content type, timing, sequence, byte length, hashes, parser/normalizer versions, checked time, endpoint decision, request count, and stop reason. It does not persist full response bodies, descriptions, images, creator profiles, exact price, cookies, sensitive headers, product files, or adult/uncertain content.

## Durable evidence route

The workflow remains `contents: read` and uploads a compact artifact. After an explicitly authorized run, the coordinator must:

1. download the exact run artifact;
2. verify `evidence.json` against `evidence.sha256` and the reviewed exact workflow/main SHA;
3. confirm the forbidden-field and request-count boundaries;
4. publish only the minimized evidence JSON, digest, run ID, exact SHA, and review decision as a durable comment on Issue #79.

No fetched content or candidate code is executed while repository write credentials are present. A write-capable workflow job is therefore unnecessary for the current pilot and must not be added without a new exact-head review.

## Acceptance record still required

Stage 8 is not complete until all offline gates and both exact-head coordinator reviews pass, all Threads are resolved, and one explicitly authorized preflight produces either:

- a reviewed stop record before listing access; or
- a reviewed policy digest followed by no more than the one fixed all-ages listing request.

No repository document currently claims that robots or Terms have cleared the listing endpoint.
