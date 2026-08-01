# Data Collection Policy

> **Status**: Confirmed policy requirements. The specific technical implementation and collection method are **pending research** (see [DECISIONS.md — PD-001](DECISIONS.md#pd-001----booth-collection-method) and [ROADMAP.md — Stage 1](ROADMAP.md#stage-1----booth-collection-entry-and-product-classification-research)). No production collection is authorized by this document.

---

## Coverage goal

The long-term coverage goal is to include all publicly listed all-ages TRPG scenario products on BOOTH. This is a goal, not a guarantee — 100% completeness is not promised.

---

## Inclusion criteria

- No popularity, sales volume, or recency threshold. A product is not excluded because it is old, obscure, or has few sales.
- All-ages TRPG scenarios across all systems.

---

## Collection approach requirements

The following are requirements for any future collection implementation. The specific technical method is pending the Stage 1 research Issue (see [ROADMAP.md](ROADMAP.md)).

### Load and access

- Initial discovery must use a low-load approach. No high-frequency polling or aggressive crawling.
- Incremental change detection is required: the collection system must be able to identify new and changed products without refetching the entire catalogue unconditionally.
- Periodic reconciliation is required to detect deletions and corrections.
- **No daily unconditional refetch of every product.** Refetch is triggered by detected change, content version mismatch, or scheduled reconciliation — not by time alone.

### Terms and access controls

- BOOTH's current official terms of service and robots.txt must be reviewed before any production collection begins (see [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md)).
- No bypass of terms, robots.txt, access controls, or rate limits.

---

## Extraction rules

### Rules-first, AI-assisted for ambiguity only

- Structured extraction rules are applied first.
- AI is used only for ambiguous candidate generation (for example: inferring tags from unstructured text when structured signals are absent).
- AI is not used as the primary extraction method for fields that can be reliably extracted by rules.

### AI output constraints

- AI output with low confidence must not be automatically published.
- AI output with conflicting signals must not be automatically published.
- AI output that is suspected to contain spoiler content must not be automatically published.
- All such output is held pending review.

### Reanalysis avoidance

- Content-version or content-hash tracking is used to avoid reanalysing products that have not changed.
- Reanalysis is triggered by a detected content change, not by time alone.

### AI budget

- A daily AI call budget and a monthly AI call budget are tracked.
- Exceeding the budget halts further AI-assisted extraction until the next budget period. It does not trigger automatic paid-plan upgrades (see [ARCHITECTURE.md](ARCHITECTURE.md)).

---

## Metadata fields

Every collected product record must carry the following metadata:

| Field | Description |
|---|---|
| Source evidence | The source(s) from which data was collected (for example: BOOTH product page, BOOTH API). |
| Confidence | Confidence level for each extracted field (high / medium / low / unknown). |
| Conflict | Whether conflicting signals were detected for a field. |
| Hold / unknown | Whether a field is held pending review or is explicitly unknown (not missing). |
| Last-checked | The date and time this product record was last verified against the source. |
| Content-version | A hash or version identifier of the source content at last check, used to detect changes. |

Provenance separation: tags sourced from BOOTH metadata and tags derived by extraction rules or AI are tracked separately. Derived tags carry additional evidence metadata (extraction method, confidence, source text excerpt).

---

## All-ages boundary

- The strict all-ages boundary is enforced at every layer: collection, storage, and publication.
- R-18 and R-18G products are excluded from collection. If an R-18 or R-18G product is encountered during collection, it must not be stored or published.
- See [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) and [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md).

---

## Spoiler policy

- Tags, summaries, and metadata suspected to contain spoiler content are excluded from discovery-facing publication.
- Spoiler-suspect content may be retained internally with a hold flag pending human review.

---

## What is not authorized

- No full crawl or production scraping is authorized by this document or by Issue #10.
- No bypass of BOOTH's terms, robots.txt, access controls, or rate limits.
- No collection of R-18 or R-18G content.
- No automatic publication of low-confidence, conflicting, or spoiler-suspect AI output.
- No automatic triggered escalation to a paid tier based on collection volume (see [ARCHITECTURE.md](ARCHITECTURE.md)).
