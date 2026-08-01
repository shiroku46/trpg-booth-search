# Legal and Compliance

> **Status**: This document records current constraints and open questions. It does not claim that legal review, terms research, or compliance approvals have already been completed. Required research is pending the Stage 1 Issue (see [ROADMAP.md](ROADMAP.md)).

---

## BOOTH terms and robots.txt

- BOOTH's current official terms of service and robots.txt **must be checked from their current official sources** before any production collection begins.
- This check has not yet been completed. Issue #10 does not perform BOOTH requests, scraping, or legal conclusions.
- Only a small number of low-load research requests are authorized in the next Issue (Stage 1 research). These are not production collection.
- No full crawl or production scraping is authorized by this documentation change.

---

## Purchase, payment, and download

- Purchase, payment, and download of products remain on BOOTH.
- This application is a discovery helper, not a marketplace. It does not process payments, handle downloads, or replicate BOOTH's transactional functions.

---

## Compliance subjects (open questions)

The following are tracked as active compliance subjects. None of these have been resolved by Issue #10. Each requires a dedicated research, legal review, or architecture decision before the relevant feature is implemented.

| Subject | Status | Notes |
|---|---|---|
| BOOTH terms of service | **Pending research** | Must be verified from current official source before production collection. See Stage 1 in [ROADMAP.md](ROADMAP.md). |
| BOOTH robots.txt | **Pending research** | Must be verified before any automated access. |
| R-18 / R-18G exclusion | **Confirmed requirement** | Strict all-ages boundary enforced at all layers. See [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md). |
| Privacy | **Open** | No personal data collection is planned for MVP. Scope and requirements TBD. |
| Copyright and attribution | **Open** | Displaying extracted metadata and tags from BOOTH products requires review of copyright and attribution requirements. |
| Data retention | **Open** | Retention period and deletion policy for collected product records TBD. |
| Takedown and contact process | **Open** | A process for handling takedown requests or author contact must be defined before production launch. |
| AI-generated content | **Open** | Legal status of AI-derived tags and metadata requires review before publication. |

---

## Advertising and affiliate links

- No advertising or affiliate integration is included in the MVP.
- See [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) — MVP exclusions.

---

## `shiroku46/luluportal` isolation

- `shiroku46/luluportal` is a read-only reference for this project.
- This application must not share any of the following with luluportal:
  - Code or libraries
  - Database or database credentials
  - Authentication or session infrastructure
  - Environment variables or Secrets
  - Deployment or hosting configuration
  - Issues, Pull Requests, workflows, or repository settings
- Any reference to luluportal in design or documentation is structural reference only. See [ARCHITECTURE.md](ARCHITECTURE.md) and [DECISIONS.md — D-007](DECISIONS.md#d-007----isolation-from-shiroku46luluportal).

---

## What is not authorized by this document

- No production scraping, crawling, or bulk data collection.
- No BOOTH requests of any kind in Issue #10.
- No legal conclusions about BOOTH terms or Japanese copyright law.
- No claims that legal review has been completed.
