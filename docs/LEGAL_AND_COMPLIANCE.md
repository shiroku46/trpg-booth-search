# Legal and Compliance

## Status

Current constraints and open questions. Research has not been completed. Items marked **[OPEN]** require the next research Issue before any production collection is authorized.

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [DECISIONS.md](DECISIONS.md) | [ROADMAP.md](ROADMAP.md) | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | [ARCHITECTURE.md](ARCHITECTURE.md)

---

## BOOTH Terms and robots.txt

**BOOTH terms of service and robots.txt have not been researched or confirmed as part of this documentation change.**

Before any production collection begins:
- Current BOOTH terms of service must be checked from official BOOTH sources.
- Current BOOTH robots.txt must be checked from the live BOOTH domain.

The next research Issue (Stage 1, see [ROADMAP.md](ROADMAP.md)) authorizes only a **small number of low-load research requests** for this purpose. It does not authorize full crawl or production scraping.

---

## Authorized Scope

| Activity | Authorization |
|---|---|
| Stage 1 research: small number of low-load requests | Authorized in the next Issue |
| Full crawl of BOOTH | Not authorized |
| Production scraping | Not authorized by this documentation change |
| Purchase, payment, download handling | Not performed — remains on BOOTH |

---

## Compliance Subjects

The following are tracked as open compliance questions. None are considered resolved.

| Subject | Status | Notes |
|---|---|---|
| BOOTH terms of service | **[OPEN]** | Must be checked from current official sources before production |
| BOOTH robots.txt | **[OPEN]** | Must be checked from current live domain before production |
| R-18/R-18G content boundary | Confirmed boundary | Excluded from all collection, storage, and publication |
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
- Represent that pricing, free tiers, or hosting limits have been reviewed for compliance.

All of the above require the research Issue (Stage 1) and potentially further legal review before implementation proceeds.
