# BOOTH Collection Research

## Status

- **Last official-source review:** 2026-08-04
- **Stage:** Stage 8 fail-closed preflight and bounded pilot
- **Network status:** no BOOTH request has been executed by the Stage 8 candidate
- **Scope:** public, unauthenticated, all-ages, low-load research only
- **Not authorized:** production collection, recurring crawl, login/session use, adult surfaces, downloads, images, checkout, database persistence, deployment, billing, or access-control bypass

This record supports a fail-closed prototype. It is not legal advice, blanket permission, or a guarantee that any endpoint remains available.

## Current official evidence

| Source | Observed fact | Review date |
|---|---|---|
| `https://booth.pm/guidelines` | The current page states that information-analysis scraping for user convenience or healthy creative activity may be performed, while BOOTH may restrict activity that creates extreme load, infringes rights, or causes harm. The page records a 2026-07-08 revision. | 2026-08-04 |
| `https://booth.pm/announcements/863` | The 2025-10-10 notice says ordinary-range third-party applications that complement BOOTH, including independent search/recommendation using public information, are welcomed in principle, subject to stability and Terms compliance. | 2026-08-04 |
| `https://booth.pm/announcements/950` | The 2026-06-23 notice announced a guideline change effective 2026-07-08 covering products whose main purpose is redirection or announcements. | 2026-08-04 |
| `https://policies.pixiv.net/` | Official Terms destination linked by BOOTH. Exact current bytes must be retrieved and reviewed in the explicit preflight; this repository does not infer approval from a historical copy. | 2026-08-04 |
| `https://booth.pm/robots.txt` | Mandatory live preflight input. No current body is recorded in this repository and no permission is inferred. | 2026-08-04 |

The guideline permits a narrow information-analysis purpose in principle but preserves BOOTH's right to restrict scraping. Current Terms review and the live robots decision remain independent run gates.

## Stage 8 fixed plan

The candidate is restricted to one exact all-ages listing endpoint:

`https://booth.pm/ja/browse/TRPG?adult=none&type=digital`

The workflow is manual `workflow_dispatch` only and defaults to dry-run. It has no schedule, push/PR trigger, Secret, OIDC, cookie, proxy, browser automation, JavaScript execution, or credentialed session.

### Two-step authorization

1. **Current-policy preflight:** an explicit network dispatch retrieves only current robots, guideline, and Terms inputs. With no approved digest, it records bounded hashes and machine-readable review-required decisions, then stops before listing access.
2. **One listing request:** only after the exact preflight evidence and policy digest are reviewed may a second explicit dispatch supply that exact digest and request the single fixed listing endpoint.

A blank, malformed, stale, or mismatched digest stops before listing access. A correctly stopped preflight is valid evidence and must not be bypassed or immediately repeated through the same failing path.

## Robots interpretation contract

The parser uses the following fail-closed boundary:

- declared product-token group preferred over `*`;
- `Allow` and `Disallow` rules matched against path plus query;
- `*` wildcard and terminal `$` supported;
- percent-encoded unreserved octets compare with their literal form;
- reserved octets remain percent-encoded with normalized hexadecimal case;
- non-ASCII literal text is compared as UTF-8 percent-encoded octets;
- longest matching rule wins and `Allow` wins an exact specificity tie;
- malformed encoding, malformed rules, no applicable group, oversized body, unavailable robots, cross-origin redirect, or restrictive result stops the run.

Official robots and policy documents may legitimately contain words such as `R-18`, `login`, or `captcha`. Those text markers are therefore not treated as access challenges during policy retrieval. Age/challenge marker scanning applies only to the bounded listing response.

## Network boundary

- exact HTTPS hosts only: `booth.pm` for BOOTH pages and `policies.pixiv.net` for the Terms preflight;
- unauthenticated public `GET` only in the current implementation;
- fixed URLs in code, never arbitrary workflow input or fetched-content navigation;
- maximum one current listing request, below the Issue ceiling of 20;
- one concurrent request;
- minimum 10 seconds plus at most 2 seconds jitter between listing requests; intentionally vacuous for the current single-request plan;
- 10-second connect and read timeouts, 30-second total timeout per request, bounded redirect count, and strict response byte ceilings;
- no automatic retry or alternate identity;
- immediate stop on 401, 403, 429, 5xx, unexpected status/type, CAPTCHA/challenge, login/age signal, R-18/R-18G signal, or size breach.

Same-origin redirects are permitted only for the fixed policy inputs and remain bounded. The listing request does not follow redirects at all; a redirect is recorded as a stop after the one exact endpoint request, so it cannot cause an implicit request to login, account, adult, or another same-origin path.

Transport failures are converted into bounded non-sensitive stop reasons so the workflow can retain evidence instead of failing before producing an artifact.

## Content versioning and evidence minimization

The prototype records separate SHA-256 values for exact source bytes and deterministic normalized UTF-8 content. Normalization is versioned and limited to NFC normalization, newline equivalence, and trailing horizontal whitespace removal. Invalid encoding and oversized input fail closed.

Permitted evidence is limited to fixed URLs, status/content type, timing, request sequence/count, byte length, hashes, parser/normalizer versions, checked time, endpoint decision, policy-review state, status distribution, transport limits, and stop reason. It does not persist full response bodies, descriptions, images, creator profiles, exact price, cookies, sensitive headers, product files, or adult/uncertain content.

## Durable evidence route

The workflow remains `contents: read` and uploads `evidence.json` plus `evidence.sha256` as a compact artifact. After an explicitly authorized run, the coordinator must:

1. download the exact run artifact;
2. verify `evidence.json` against `evidence.sha256` and the reviewed exact workflow/main SHA;
3. confirm forbidden-field, endpoint, request-count, redirect, and stop boundaries;
4. publish only the minimized evidence JSON, digest, run ID, exact SHA, and review decision as a durable comment on Issue #79.

No fetched content or candidate code is executed while repository write credentials are present. A write-capable workflow job is unnecessary for the current pilot and must not be added without a new exact-head review.

## Acceptance record still required

Stage 8 is not complete until all offline gates and both exact-head coordinator reviews pass, all Threads are resolved, and one explicitly authorized preflight produces either:

- a reviewed stop record before listing access; or
- a reviewed policy digest followed by no more than the one fixed all-ages listing request.

No repository document currently claims that robots or Terms have cleared the listing endpoint.
