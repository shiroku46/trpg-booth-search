# Data Collection Policy

## Status

Confirmed policy requirements. Items marked **[PENDING RESEARCH]** are subject to the next research Issue before implementation.

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [DECISIONS.md](DECISIONS.md) | [ROADMAP.md](ROADMAP.md) | [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) | [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Coverage Goal

The long-term goal is broad coverage of all-ages TRPG scenarios available on BOOTH. This goal does not promise 100% completeness. Coverage improves incrementally over time.

---

## Collection Thresholds

- **No popularity threshold**: Products are not filtered by sales volume, download count, or ranking.
- **No recency threshold**: Products are not filtered by publication date or last-updated date.
- **No sales threshold**: Free products and paid products are treated equally.

---

## Collection Approach

The following are requirements, not implementation decisions. The specific technical mechanism is subject to the BOOTH research Issue (Stage 1).

| Requirement | Detail |
|---|---|
| **Low-load initial discovery** | Initial collection must use low-load access patterns; no aggressive crawling |
| **Incremental changes** | After initial discovery, only changed or new products are re-fetched; no unconditional full re-fetch |
| **Periodic reconciliation** | A scheduled reconciliation pass checks for deleted or ended products |
| **No daily unconditional refetch** | Every product must not be unconditionally re-fetched on a daily basis |

These requirements are subject to the BOOTH research Issue. The specific access pattern, rate limits, and scheduling are **[PENDING RESEARCH]**.

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

---

## Compliance Requirements

- **Terms of service**: BOOTH terms of service must be followed. Current terms must be checked from official sources before production collection begins. See [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md).
- **robots.txt**: BOOTH robots.txt must be read and respected. Current robots.txt must be checked before production collection begins.
- **Access controls**: No bypass of BOOTH access controls, login walls, or rate limiting mechanisms.
- **Rate limits**: Collection must operate within BOOTH's published or observed rate limits.

No production collection or full crawl is authorized by this document. These requirements apply when collection is implemented after the research Issue.
