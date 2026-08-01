# Legal and Compliance

## Status

Current constraints and open questions. Stage 1 documentation research (2026-08-01) recorded official guideline findings. Items marked **[OPEN]** or **[UNVERIFIED]** remain unresolved. **No production collection is approved.** See [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md) for the dated evidence record.

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [DECISIONS.md](DECISIONS.md) | [ROADMAP.md](ROADMAP.md) | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | [ARCHITECTURE.md](ARCHITECTURE.md) | [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md)

---

## BOOTH Guidelines — Current Findings (2026-08-01)

Stage 1 documentation research reviewed the following official sources. These findings are not legal approval, a stability guarantee, or permission to bypass any access control.

| Finding | Source |
|---|---|
| Service Master Terms were updated on 2026-06-22; full current terms hosted at `policies.pixiv.net` | https://booth.pm/announcements/949 |
| Current BOOTH Guidelines were amended on 2026-07-08 and may change again | https://booth.pm/announcements/950 |
| Guidelines prohibit crawler collection when it infringes or risks infringing rights, causes or risks damage, or places extreme load on the service | https://booth.pm/guidelines |
| Guidelines state that scraping for information analysis may be performed when its purpose is improving user convenience or contributing to healthy creative activity, notwithstanding the general prohibition | https://booth.pm/guidelines, https://booth.pm/announcements/898 |
| BOOTH may restrict scraping when it considers server load, rights impact, or damage risk present | https://booth.pm/guidelines |

These statements support only a conservative research/prototype path. They are not legal approval, an availability guarantee, or permission to bypass robots.txt, access controls, rate limits, or service responses.

---

## BOOTH Terms and robots.txt — Unresolved Status

**The full current master terms and BOOTH individual terms at `policies.pixiv.net` could not be verified during Stage 1 research (2026-08-01).** The research client could not render these pages even though official BOOTH pages link to them.

**The current robots.txt at `https://booth.pm/robots.txt` could not be retrieved during Stage 1 research (2026-08-01).** Do not infer allow or disallow from this retrieval failure.

Both remain **[UNVERIFIED]**. Fail closed: no production collector, broad prototype, or scheduled collection may run until both are directly reviewed and recorded. See D-009 in [DECISIONS.md](DECISIONS.md).

Before any network prototype begins:
- A direct technical preflight must retrieve and record the current robots.txt body, retrieval time, response status, content hash, and applicable directives.
- The full current master terms and BOOTH individual terms at `policies.pixiv.net` must be directly reviewed and their findings recorded.

---

## Authorized Scope

| Activity | Authorization |
|---|---|
| Stage 1 documentation research: public, unauthenticated, low-load review | Completed 2026-08-01; no network prototype conducted |
| robots/full-terms preflight before any network prototype | Required; not yet completed |
| Network pilot (20-request ceiling) | Authorized only after robots/full-terms preflight; not yet started |
| Full crawl of BOOTH | Not authorized |
| Production collection or scraping | Not authorized |
| Purchase, payment, download handling | Not performed — remains on BOOTH |
| Access to adult/R-18G content | Not authorized; strict hold behaviour enforced |

---

## Compliance Subjects

The following are tracked compliance questions. None marked [OPEN] or [UNVERIFIED] are considered resolved.

| Subject | Status | Notes |
|---|---|---|
| BOOTH master terms of service | **[UNVERIFIED]** | Full text at `policies.pixiv.net` could not be rendered during Stage 1 research; production collection blocked until reviewed |
| BOOTH individual terms | **[UNVERIFIED]** | Full text at `policies.pixiv.net` could not be rendered during Stage 1 research; production collection blocked until reviewed |
| BOOTH robots.txt | **[UNVERIFIED]** | Retrieval failed during Stage 1 research; production collection blocked until retrieved and recorded |
| BOOTH scraping guideline allowance | Partial finding | Guidelines state a conditional research/convenience allowance; this is not legal approval; see guideline findings above |
| R-18/R-18G content boundary | Confirmed boundary | Excluded from all collection, storage, and publication; strict hold on uncertain content |
| User privacy | **[OPEN]** | No user data collected in MVP; revisit if accounts are added |
| Copyright of collected data | **[OPEN]** | Scope and limits of displaying BOOTH product metadata require review |
| Attribution requirements | **[OPEN]** | Whether and how creators must be credited requires review |
| Data retention | **[OPEN]** | How long collected product records may be retained requires policy |
| Takedown and contact process | **[OPEN]** | Process for responding to creator takedown requests requires definition |
| AI-generated content rights | **[OPEN]** | Rights implications of AI-derived tags and metadata require review |

---

## Advertising and Affiliate

No advertising integration is included in the MVP. No affiliate links are included in the MVP.

These are confirmed exclusions, not pending decisions. See [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md).

---

## luluportal Isolation

`shiroku46/luluportal` is a **read-only structural reference** for this project. The following are hard requirements with no exceptions:

| Requirement | Detail |
|---|---|
| No shared code | No code is copied, imported, or shared between repositories |
| No shared database | No database, schema, migration, or data is shared |
| No shared authentication | No auth provider, session, or credential is shared |
| No shared environment variables | No environment variable values or names are shared |
| No shared deployment | No hosting account, deployment pipeline, or infrastructure is shared |
| No cross-repository Issues | No Issues in this repository reference luluportal Issues or vice versa for implementation |
| No cross-repository Pull Requests | No Pull Requests span both repositories |
| No shared workflows | No GitHub Actions workflows are shared or referenced across repositories |
| No shared settings | No repository settings, secrets, or permissions are shared |

This isolation is a hard requirement. See [DECISIONS.md — D-008](DECISIONS.md#d-008--luluportal-is-read-only-reference-full-isolation-required).

---

## What This Document Does Not Authorize

This document does not:
- Confirm that BOOTH terms permit automated data collection.
- Confirm that BOOTH robots.txt permits any specific crawl pattern.
- Authorize production collection, scraping, or crawling.
- Constitute legal advice or a legal opinion.
- Represent that the guideline conditional allowance is a grant of legal permission.
- Represent that pricing, free tiers, or hosting limits have been reviewed for compliance.

**No production collection is approved.** The robots/full-terms preflight (D-009 in [DECISIONS.md](DECISIONS.md)) must be completed and recorded in a separate Issue before any network prototype may begin. Subsequent production collection requires further review of the full current terms and any additional legal assessment.
