# Logical Data Model

## Status

Technology-neutral logical schema for the TRPG BOOTH search helper MVP. This document defines entity boundaries, field names, logical types, cardinalities, uniqueness, required/optional status, invariant/check rules, state contracts, source-to-canonical distinctions, current projections, and immutable history structures. It does not define SQL tables, ORM mappings, API shapes, application types, migrations, generated types, or any executable artifact. Provider-specific implementation is deferred to the architecture stage (Stage 4).

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [DECISIONS.md](DECISIONS.md) | [ROADMAP.md](ROADMAP.md) | [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md)

Governing decisions: D-004, D-010 through D-026 in [DECISIONS.md](DECISIONS.md).

---

## 1. Scope and Notation

### 1.1 What This Document Defines

This document defines the **logical, technology-neutral schema** for the two searchable public layers (BOOTH product and individual scenario) and their supporting normalization, tag, provenance, and history structures.

This document does **not** create:
- SQL tables, migrations, ORM schemas, or generated types
- Application code, API endpoints, or UI components
- Network clients, collectors, scheduled jobs, or deployment artifacts
- A production database or hosted resource
- Test fixtures, canonical registry records, or populated data

No actual TRPG systems, editions, books, products, shops, or creators are introduced. The canonical registry remains empty.

### 1.2 Notation Conventions

| Notation | Meaning |
|---|---|
| `entity_name` | A logical entity (record type) |
| `field: LogicalType` | A field and its logical type |
| **Required** | Field must always be present for a valid record |
| **Optional** | Field may be absent; absence has a defined meaning |
| `EvidencedValue<T>` | A typed evidenced value (see Section 2) |
| `list<T>` | An ordered or unordered collection of zero or more T values |
| `ref<entity>` | A logical foreign-key reference to another entity |
| `ImmutableID` | An internal identifier that never changes once assigned; provider-specific form (UUID, opaque string, etc.) is deferred to Stage 4 |
| `Timestamp` | An ISO 8601 datetime with timezone (UTC preferred) |
| `Duration` | A non-negative duration; logical unit is minutes; exact storage unit is a Stage 4 decision |
| Source-observed | Text or value taken verbatim from the source without modification |
| Canonical/normalized | A reviewed, registry-controlled value resolved from source-observed text |

### 1.3 Source-Observed versus Canonical Values

Every entity distinguishes two classes of data:

- **Source-observed**: verbatim text or values from BOOTH product pages, preserved without alteration. These fields do not change when a canonical representation changes. They are the evidence record.
- **Canonical/normalized**: reviewed, registry-controlled values resolved through the normalization pipeline defined in [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md).

When resolution fails or is pending, the source-observed text is retained and the canonical reference is explicitly in the `target_unresolved` state. Source-observed fields are never replaced with guessed canonical values.

### 1.4 Current Projections versus Immutable History

Each entity has a **current projection** (the latest known state) and an **append-only history** of prior source snapshots and normalization results. History is never overwritten. When content or a relevant version changes, a new normalized result record is appended alongside the old one; both are retained. See Section 8.

---

## 2. Evidenced-Value State Contract

This section defines the reusable logical contract applied to every field whose value may be known, unknown, held, or not applicable. The same contract is used across all entities in this model. Provider-specific encoding (enum, tagged union, nullable column with check constraint, etc.) is deferred to Stage 4.

### 2.1 EvidencedValue&lt;T&gt; Structure

| Field | Type | Required | Description |
|---|---|---|---|
| `state` | `known \| unknown \| hold \| not_applicable` | Required | Determines value presence and interpretation |
| `value` | T | Only when `state = known` | The concrete typed value; absent in all other states |
| `confidence` | `high \| medium \| low \| unresolved` | Required | Confidence in the value or resolution |
| `hold_reason` | HoldReasonCode | Only when `state = hold` | Controlled reason code; absent in other states |
| `conflict_reason` | ConflictReasonCode \| null | Optional | Present when conflicting evidence contributed to an unknown or hold state |
| `source_evidence` | list&lt;SourceEvidenceRef&gt; | Required (non-empty when `state = known`) | Pointers to source observations supporting this value |
| `review_state` | `unreviewed \| approved \| rejected \| needs_more_evidence` | Required | Human review disposition |
| `content_version` | string | Required | Hash or version of source content at analysis time; for contexts where body content is prohibited (e.g., `hold_age_unknown`), must be a non-body-derived access/outcome version identifier (e.g., `access_outcome:<status_code>`) rather than a page-body hash |
| `normalizer_version` | string \| null | Required when normalization applies | Version of normalization rules that produced this value |
| `registry_version` | string \| null | Required when canonical resolution applies | Registry snapshot version used at resolution time |
| `checked_at` | Timestamp | Required | When the source observation producing this value was made |
| `reviewed_at` | Timestamp \| null | Optional | Timestamp of the most recent human review; null when unreviewed |

### 2.2 State Invariants

| State | value | hold_reason | source_evidence | Semantics |
|---|---|---|---|---|
| `known` | **Present and valid** | Absent | **Non-empty** | Field is known with supporting evidence |
| `unknown` | **Absent** | Absent | May be empty | Field is genuinely unknown; no sufficient evidence was found |
| `hold` | **Absent** | **Present** | May be non-empty | Field cannot be published; hold reason requires resolution |
| `not_applicable` | **Absent** | Absent | May be empty | Field is structurally absent under an explicit typed parent state; distinct from unknown |

**Critical invariants:**
- `known` requires a valid value **and** at least one `source_evidence` entry with a real source observation.
- `unknown` and `hold` **prohibit** guessed values. No inference, zero, empty string, false, or default may substitute for an absent value.
- `not_applicable` is semantically distinct from `unknown`. It is used only when the field is structurally absent under an explicit parent state (for example, a field that applies only to collection scenarios is `not_applicable` for a `single_scenario` product, not `unknown`).
- Public search **never** treats `unknown` or `hold` as zero, false, empty string, or a default filter category.
- An AI-derived value in `state = known` requires `review_state = approved` before publication.

### 2.3 SourceEvidenceRef Structure

| Field | Type | Required | Description |
|---|---|---|---|
| `source_snapshot_id` | ref&lt;source_snapshot&gt; | Required | The source observation record this evidence comes from |
| `evidence_type` | EvidenceTypeCode | Required | Kind of evidence |
| `evidence_pointer` | string | Required | Non-spoiler pointer to the location within the source (e.g., `title`, `tag_list_item`, `description_first_paragraph`) |
| `extraction_method` | `explicit_source \| approved_alias \| deterministic_rule \| ai_candidate` | Required | How the value was derived |
| `model_id` | string \| null | Only when `ai_candidate` | AI model identifier and version |
| `prompt_template_version` | string \| null | Only when `ai_candidate` | Prompt template version |
| `generation_date` | Timestamp \| null | Only when `ai_candidate` | Date the AI candidate was generated |

**EvidenceTypeCode controlled values:** `product_title`, `description_excerpt`, `tag`, `structured_field`, `included_file_reference`, `category_path`, `shop_page_excerpt`, `other`.

**Spoiler safety:** When evidence can only be expressed using content that would spoil the scenario's plot, the spoiler text is not stored. `evidence_pointer` is set to `spoiler_content_present` instead. The field is held (`state = hold`, `hold_reason = hold_spoiler_bearing_evidence`). A non-spoiler evidence path is always preferred when available.

---

## 3. Core Product Layer: `booth_product`

One `booth_product` record corresponds to exactly one BOOTH product page. This is the root anchor for all downstream scenario, component, and normalization records.

### 3.1 Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Internal immutable identifier; never changes even when title, URL formatting, sales state, or content change |
| `source_platform` | `booth` | Required | Fixed to `booth` for MVP; non-BOOTH platforms are out of scope for MVP |
| `source_product_id` | string | Required, Unique | BOOTH's numeric item identifier (the integer in `/ja/items/<numeric-id>`); the record-level uniqueness key |
| `canonical_url` | URL | Required | Canonical BOOTH product URL derived from `source_product_id`; normalized to the stable form; not stored as user-supplied input |
| `observed_title` | string | Required when `all_ages_state.value = all_ages_confirmed`; **prohibited** when `all_ages_state.state = hold` (`hold_age_unknown`) | Exact observed product title text verbatim; never normalized; see Section 3.5 |
| `creator_observed_name` | string | Required when `all_ages_state.value = all_ages_confirmed`; **prohibited** when `all_ages_state.state = hold` (`hold_age_unknown`) | Exact observed creator or shop name verbatim; no linked account entity or user model; see Section 3.5 |
| `creator_source_url` | URL \| null | Optional when `all_ages_state.value = all_ages_confirmed`; **prohibited** when `all_ages_state.state = hold` (`hold_age_unknown`) | Observed public shop or creator URL from the source; null when not observed; see Section 3.5 |
| `classification` | EvidencedValue&lt;ProductClassCode&gt; | Required when `all_ages_state.value = all_ages_confirmed`; **prohibited** when `all_ages_state.state = hold` (`hold_age_unknown`) | Product classification using the D-011 controlled vocabulary (see 3.2); see Section 3.5 |
| `sales_state` | SalesStateCode | Required when `all_ages_state.value = all_ages_confirmed`; **prohibited** when `all_ages_state.state = hold` (`hold_age_unknown`) | Current sales lifecycle state (see 3.2); see Section 3.5 |
| `all_ages_state` | EvidencedValue&lt;AllAgesStateCode&gt; | Required | All-ages eligibility determination (see 3.2 and 3.5); when `value = all_ages_confirmed`, `source_evidence` must be non-empty, `confidence` must be present, `review_state = approved` is required for publication, and all EvidencedValue timestamps must be present; unsupported or `rejected` confirmation cannot authorize publication |
| `discovery_method` | string | Required | How the product was initially discovered (e.g., `keyword`, `category`, `tag`, `new_item`, `direct`) |
| `first_seen_at` | Timestamp | Required | When this record was first created |
| `last_checked_at` | Timestamp | Required | When the source page was most recently accessed |
| `content_version` | string | Required when `all_ages_state.value = all_ages_confirmed` (body-derived hash); **Required as non-body-derived access/outcome version only** when `all_ages_state.state = hold` (`hold_age_unknown`) — body-derived page-body hashes must not be stored; use `access_outcome:<status_code>` or equivalent non-body form | Hash or version identifier of the source content at last analysis; see Section 3.5 |
| `current_record_updated_at` | Timestamp | Required | When the current record projection was last modified |

**Excluded fields — never stored:** product images, exact prices, payment details, download links, authentication tokens, adult/R-18/R-18G content, any field requiring login or age-gate bypass.

### 3.2 Controlled Vocabularies

**ProductClassCode** (D-011):

| Code | Meaning |
|---|---|
| `scenario_single` | Product contains exactly one standalone playable scenario |
| `scenario_collection` | Product contains multiple distinct playable scenarios |
| `mixed_scenario_and_material` | Product contains both playable scenario(s) and supplementary material |
| `material_only` | Product contains only supplementary material; no standalone playable scenario |
| `rulebook_or_system` | Product is a TRPG rulebook or core system document |
| `supplement` | Product is a supplement (not a standalone playable scenario) |
| `replay_or_reading_material` | Product is a replay record or reading material |
| `update_or_dlc_only` | Product is an update, patch, or DLC with no standalone playable scenario |
| `non_trpg` | Product does not belong to the TRPG domain |
| `hold_unknown` | Classification cannot be determined; held for review |

**SalesStateCode:**

| Code | Meaning |
|---|---|
| `available` | Product is listed and available for purchase or free download |
| `sold_out` | Product is listed but currently sold out or temporarily unavailable (distinguishable from `sales_ended` when source indicates this state) |
| `sales_ended` | Product has ended sales (`販売終了`); excluded from normal public search |
| `disappeared` | Product URL no longer returns a valid product page (e.g., 404); retained in internal history |
| `unknown` | Sales state could not be determined from available evidence |

**AllAgesStateCode:**

| Code | Meaning |
|---|---|
| `all_ages_confirmed` | Product is confirmed all-ages; represented as `EvidencedValue.state = known`, `value = all_ages_confirmed`; requires non-empty `source_evidence`, complete EvidencedValue metadata (`confidence`, `review_state`, `content_version`, `checked_at`), and `review_state = approved` before publication; unsupported or `rejected` confirmation cannot pass |
| `hold_age_unknown` | Age rating evidence is missing, ambiguous, or conflicting; represented as `EvidencedValue.state = hold`, `hold_reason = hold_age_unknown`; strict hold applied per D-002 and D-012; see Section 3.5 for the complete list of prohibited and permitted fields while the hold is active |

Note: R-18 and R-18G products are rejected at the collection boundary before any descriptive content is extracted. There is no stored state for adult content.

### 3.3 Uniqueness and Identity

`source_product_id` is the uniqueness key. One source product maps to exactly one current `booth_product` identity even when:
- The product title changes.
- The URL formatting changes.
- The sales state transitions (e.g., `available` → `sold_out` → `sales_ended` → `disappeared`).
- The product classification changes due to new evidence.
- The source content changes.

When a product disappears and reappears, it is treated as a state change on the existing record, not a new record, unless evidence shows the numeric BOOTH item ID itself has changed.

### 3.4 Sales-State Transitions and History

- `booth_product` records are retained even when `sales_state = sales_ended` or `sales_state = disappeared`.
- Ended and disappeared records are excluded from public search but retained in internal history for data continuity and reconciliation.
- Every state transition is traceable through the `source_snapshot` history (Section 8).
- Reappearance requires a new evidence check; prior states are not silently overwritten.

### 3.5 hold_age_unknown Record Invariants

When `all_ages_state.state = hold` with `hold_reason = hold_age_unknown`, the following invariants apply strictly to the `booth_product` record and every record linked to it. These prohibitions are active from the moment the hold is established until the hold is resolved by replacing `all_ages_state` with a confirmed, approved `all_ages_confirmed` value backed by sufficient source evidence.

**Permitted fields only.** A `hold_age_unknown` product record retains only minimal non-descriptive product identity, access and outcome metadata, timestamps, and restricted hold evidence as permitted by D-012:

| Field | Status under `hold_age_unknown` |
|---|---|
| `id` | Retained — non-descriptive internal identity |
| `source_platform` | Retained — non-descriptive platform marker |
| `source_product_id` | Retained — non-descriptive BOOTH item identifier |
| `canonical_url` | Retained — derived from `source_product_id`; no descriptive content |
| `all_ages_state` | Retained — the hold evidence record itself |
| `discovery_method` | Retained — access/outcome metadata |
| `first_seen_at` | Retained — timestamp |
| `last_checked_at` | Retained — timestamp |
| `current_record_updated_at` | Retained — timestamp |
| `observed_title` | **Prohibited — must not be stored or retained** |
| `creator_observed_name` | **Prohibited — must not be stored or retained** |
| `creator_source_url` | **Prohibited — must not be stored or retained** |
| `classification` | **Prohibited — must not be stored or retained** |
| `sales_state` | **Prohibited — must not be stored or retained** |
| `content_version` | **Permitted only as a non-body-derived access/outcome version identifier** (e.g., `access_outcome:<status_code>`); body-derived page-body hashes must not be stored |

**Child record prohibitions while hold is active:**
- No `product_component` records may be created or retained for a `hold_age_unknown` parent product.
- No `scenario` records may be created or retained for a `hold_age_unknown` parent product.
- No `source_snapshot` body-content excerpts, body-derived content hashes, or description fragments may be stored for a `hold_age_unknown` product.
- No descriptive, classification, image, or body-derived data of any kind may appear in any record linked to a `hold_age_unknown` product.

**Transition to hold_age_unknown.** When a `booth_product` that previously carried `all_ages_state.value = all_ages_confirmed` later becomes age-uncertain and transitions to `hold_age_unknown`, the following applies immediately and without exception:

- The product and all child `scenario` records are immediately removed from the `searchable_scenario` public projection.
- All prohibited fields and child records — including `observed_title`, `creator_observed_name`, `creator_source_url`, `classification`, `sales_state`, all `product_component` records, all linked `scenario` records, all `source_snapshot` body-content excerpts, body-derived content hashes, description fragments, body-derived content hash values, and any other prohibited payload listed in the table above — must be purged or irreversibly redacted. These prohibited payloads are not retained merely because they existed before the hold was established.
- After redaction, only the minimal non-descriptive tombstone fields are retained: immutable IDs, `source_platform`, `source_product_id`, `canonical_url`, timestamps, `all_ages_state` (the hold evidence record itself), `discovery_method`, `current_record_updated_at`, hold reason, redaction event metadata, and a non-body-derived access/outcome `content_version`.
- **The append-only rule applies to permitted evidence/history only.** The append-only invariant (Section 11.3) governs permitted audit records and `source_snapshot` history entries for permitted content. It does not override the adult-content and age-uncertainty erasure requirements. Records retaining prohibited descriptive or body-derived content after `hold_age_unknown` is established are not preserved by the append-only rule.
- A controlled **redaction tombstone event** is appended to the product's history at the time of the transition. This event records: the transition timestamp, `hold_reason = hold_age_unknown`, the identifiers and version references of the purged records (for audit traceability, without reproducing prohibited content), the actor or automated process that triggered the hold and purge, confirmation that prohibited content was purged or irreversibly redacted, the categories of content purged (without reproducing any prohibited payload), non-body-derived access/outcome versions (e.g., `access_outcome:<status_code>`), and the permitted minimal tombstone metadata listed above. **The tombstone event must not store: observed titles, creator or shop text, product descriptions, images, body excerpts, spoiler text, body-derived hashes, or any canonical value derived from prohibited content.** The redaction tombstone event is itself immutable and append-only once written.
- A later resolution to `all_ages_confirmed` requires a fresh source observation and new evidence check. Purged descriptive content must not be reconstructed from prior history records, stale `source_snapshot` data, or any other cached or previously retained source.

**Hold resolution.** These prohibitions remain in effect until `all_ages_state` is replaced by a confirmed, approved `all_ages_confirmed` value with non-empty source evidence and `review_state = approved`. Resolution requires a new source observation that provides sufficient, unambiguous all-ages evidence. On resolution, prohibited fields may be populated from a fresh source observation; prior body content is not reconstructed from memory or cache.

---

## 4. Individual Scenario Layer: `scenario`

One `scenario` record represents one individually searchable playable scenario. A `booth_product` classified as `scenario_single` maps to exactly one `scenario`. Products classified as `scenario_collection` or `mixed_scenario_and_material` may map to one or more.

### 4.1 Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Internal immutable identifier |
| `booth_product_id` | ref&lt;booth_product&gt; | Required | Exactly one parent product for MVP |
| `observed_title` | EvidencedValue&lt;string&gt; | Required | Exact observed scenario title verbatim; `state = unknown` when title genuinely unavailable; `state = hold` when title cannot be reliably separated from a collection |
| `separation_state` | SeparationStateCode | Required | How this scenario was or was not separated from its parent product |
| `work_composition` | EvidencedValue&lt;WorkCompositionCode&gt; | Required | How the work is structured as observed in source |
| `min_pl` | EvidencedValue&lt;PositiveInteger&gt; | Required | Minimum player count (PL); value must be ≥ 1 when `state = known` |
| `max_pl` | EvidencedValue&lt;PositiveInteger&gt; | Required | Maximum player count (PL); value must be ≥ `min_pl.value` when both `state = known` |
| `gm_kp_required` | EvidencedValue&lt;Boolean&gt; | Required | Whether a dedicated GM/KP is required; independently evidenced |
| `gm_less` | EvidencedValue&lt;Boolean&gt; | Required | Whether the scenario can be played without a dedicated GM; independently evidenced |
| `kpc_present` | EvidencedValue&lt;Boolean&gt; | Required | Whether a KPC (Keeper Player Character) role exists; independently evidenced |
| `progression_method` | EvidencedValue&lt;ProgressionMethodCode&gt; | Required | How the scenario advances |
| `handout_structure` | EvidencedValue&lt;HandoutStructureCode&gt; | Required | Handout presence and structure |
| `first_seen_at` | Timestamp | Required | When this scenario record was first created |
| `last_checked_at` | Timestamp | Required | When source evidence was most recently checked |
| `content_version` | string | Required | Hash or version of source content at last analysis |
| `current_record_updated_at` | Timestamp | Required | When the current record projection was last modified |

**Multi-value fields stored as child records (see Sections 4.3 and 4.4):**
- `scenario_play_time` — play time ranges per modality
- `scenario_conversation_method` — observed conversation methods
- `scenario_play_environment` — observed play environments

**Publication eligibility** is independent from product retention. The `searchable_scenario` projection (Section 10) applies its own gates to scenarios regardless of the parent product's sales or hold state.

### 4.2 Controlled Vocabularies

**SeparationStateCode:**

| Code | Meaning |
|---|---|
| `single_scenario` | Parent product is `scenario_single`; no separation is needed or possible |
| `separated` | Successfully separated individual entry from a collection or mixed product |
| `unseparated` | Collection contents not yet individually separated; publication is blocked |
| `ambiguous` | Separation state cannot be determined from available evidence; publication is blocked |

**WorkCompositionCode:**

| Code | Meaning |
|---|---|
| `standalone` | Independently playable without other entries in a series |
| `series_part` | Part of a named series; other parts may or may not be required |
| `collection_entry` | An entry within a scenario collection product |
| `unknown` | Work composition is not determinable from available evidence |

**ProgressionMethodCode:**

| Code | Meaning |
|---|---|
| `linear` | Scenario follows a fixed sequence |
| `branching` | Scenario includes player-choice branches |
| `open` | Scenario has minimal predetermined structure |
| `unknown` | Progression method not determinable from available evidence |

**HandoutStructureCode:**

| Code | Meaning |
|---|---|
| `none` | No handouts included |
| `player_handouts` | Player-facing handouts included |
| `gm_only` | GM-only materials without player handouts |
| `player_and_gm` | Both player handouts and GM materials included |
| `unknown` | Handout structure not determinable from available evidence |

### 4.3 Play Time: `scenario_play_time`

Play time is recorded as separate child records per play modality. Different modalities (online, offline, conversation-mode) are **never** flattened into one inferred combined range.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Internal record identifier |
| `scenario_id` | ref&lt;scenario&gt; | Required | Parent scenario |
| `modality` | PlayModalityCode | Required | The play modality this range applies to |
| `collection_state` | PlayTimeCollectionStateCode | Required | Collection status for this play-time record; determines valid states for `min_duration` and `max_duration` |
| `min_duration` | EvidencedValue&lt;Duration&gt; | Required | Minimum play time for this modality; must have `state = unknown` when `collection_state = checked_unknown` |
| `max_duration` | EvidencedValue&lt;Duration&gt; | Required | Maximum play time for this modality; must have `state = unknown` when `collection_state = checked_unknown` |

**PlayModalityCode:** `online`, `offline`, `conversation_mode`, `general` (used when source states no modality distinction).

**PlayTimeCollectionStateCode:**

| Code | Meaning |
|---|---|
| `observed` | Play time value(s) were observed in source; at least one of `min_duration` or `max_duration` has `state = known` |
| `checked_unknown` | Play time was explicitly checked in source but could not be determined from available evidence; both `min_duration.state` and `max_duration.state` must be `unknown` |
| `not_collected` | Play time has not yet been checked for this scenario or modality |
| `not_applicable` | Play time does not apply to this scenario or modality; semantically equivalent to `not_applicable` in the EvidencedValue contract |

**Constraints:**
- When both `min_duration` and `max_duration` have `state = known`, `min_duration.value ≤ max_duration.value`.
- Every scenario must have at least one `scenario_play_time` record. Zero rows must not represent unknown, unchecked, or not-applicable play time.
- When play time was explicitly checked but could not be determined, a record with `collection_state = checked_unknown` must be stored; both `min_duration.state` and `max_duration.state` must be `unknown` in that record.
- `collection_state` explicitly distinguishes `observed` (value found in source), `checked_unknown` (checked but not determinable), `not_collected` (not yet checked), and `not_applicable` (structurally inapplicable); zero rows must not implicitly mean any of these states.
- Records for different modalities are independent and are not aggregated or merged.

### 4.4 Multi-Value Evidence Fields

**`scenario_conversation_method`** — one record per independently observed conversation method:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Internal record identifier |
| `scenario_id` | ref&lt;scenario&gt; | Required | |
| `method` | EvidencedValue&lt;ConversationMethodCode&gt; | Required | One observed or derived conversation method |

**ConversationMethodCode:** `text`, `voice`, `video`, `unknown`.

**`scenario_play_environment`** — one record per independently observed play environment:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Internal record identifier |
| `scenario_id` | ref&lt;scenario&gt; | Required | |
| `environment` | EvidencedValue&lt;PlayEnvironmentCode&gt; | Required | One observed or derived play environment |

**PlayEnvironmentCode:** `online`, `offline`, `vr`, `unknown`.

A scenario may have multiple `scenario_conversation_method` and `scenario_play_environment` records when source evidence indicates multiple applicable values. Each record is independently evidenced.

---

## 5. Subordinate Source Layer: `product_component`

`product_component` represents an observed variant or component within a `booth_product` — for example, a distinct scenario variant, a material-only add-on, or a separately described component within a mixed product. This is a subordinate, internal source-representation entity.

### 5.1 Why `product_component` Does Not Create a Third Public Layer

A single BOOTH product page may expose multiple observed variants or components (e.g., a scenario variant and a room-material variant on the same product page). `product_component` preserves the exact observed source structure without collapsing variants into the scenario layer.

This subordinate structure does **not** add a third public search layer because:
- `product_component` records are internal source-representation structures only.
- They are never directly searchable or published to users.
- The public model remains exactly two layers: `booth_product` (Layer 1) and `scenario` (Layer 2).
- A `product_component` may link to an existing `scenario` record, but the `searchable_scenario` projection — not the component link — governs whether that scenario is visible in public search.
- Material-only, update/DLC, and unclassified components can be represented without creating spurious scenario records.

### 5.2 Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Internal record identifier |
| `booth_product_id` | ref&lt;booth_product&gt; | Required | Parent product |
| `observed_component_wording` | string | Required | Exact observed variant or component label text verbatim |
| `component_classification` | EvidencedValue&lt;ComponentClassCode&gt; | Required | Classification of this component |
| `scenario_id` | ref&lt;scenario&gt; \| null | Optional | Link to associated scenario record; null when component is material-only, update/DLC, unknown, or link not yet resolved |
| `source_evidence` | list&lt;SourceEvidenceRef&gt; | Required | Source evidence for this component's presence and wording |

**ComponentClassCode:**

| Code | Meaning |
|---|---|
| `playable_scenario` | Component is a standalone playable scenario |
| `scenario_collection` | Component is a set of multiple playable scenarios |
| `material` | Component is supplementary material only (no playable scenario) |
| `update_or_dlc` | Component is an update or DLC with no standalone playable scenario |
| `unknown` | Component type cannot be determined from available evidence |
| `other` | Component type falls outside the above controlled values |

**Constraints:**
- `scenario_id` must be null when `component_classification.value` ∈ { `material`, `update_or_dlc`, `unknown`, `other` } or when the link is not yet resolved.
- A scenario may be linked to at most one `product_component` per parent product (link uniqueness within the product's component set).
- `component_classification` follows the full `EvidencedValue` state contract.

---

## 6. Normalization Entities

These entities implement the minimum contract defined in [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Section 11. No canonical system, edition, alias, or book records are populated by this document; the registry remains empty until reviewed additions are made through future Issues.

### 6.1 `system_family`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Immutable; created only through reviewed registry addition; never AI-generated |
| `display_label_ja` | string | Required | Japanese canonical display label (BCP 47: `ja`) |
| `display_label_en` | string \| null | Optional | English display label when available |
| `redirect_to` | ref&lt;system_family&gt; \| null | Optional | When deprecated or merged into another entity; null for active entities |
| `deprecated_at` | Timestamp \| null | Optional | When deprecated; null when active |
| `deprecation_reason` | string \| null | Optional | Reason for deprecation or merge; null when active |
| `created_at` | Timestamp | Required | When added to the registry |
| `registry_version_added` | string | Required | Registry version at which this entity was added |

**Redirect invariant:** The redirect chain from any deprecated `system_family` must be finite and acyclic. Old identifiers are never deleted.

### 6.2 `edition`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Immutable; created only through reviewed registry addition |
| `system_family_id` | ref&lt;system_family&gt; | Required | Parent system family; must reference a non-deprecated family |
| `display_label_ja` | string | Required | Japanese canonical display label |
| `display_label_en` | string \| null | Optional | |
| `redirect_to` | ref&lt;edition&gt; \| null | Optional | When deprecated or merged; null for active entities |
| `deprecated_at` | Timestamp \| null | Optional | |
| `deprecation_reason` | string \| null | Optional | |
| `created_at` | Timestamp | Required | |
| `registry_version_added` | string | Required | |

**Constraint:** When a `ruleset_reference` or `compatibility_claim` carries both `system_family_id` and `edition_id`, the edition's own `system_family_id` must equal the referenced family.

### 6.3 `observed_alias`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Internal record identifier |
| `original_source_text` | string | Required | Verbatim source text; never altered |
| `comparison_key` | string | Required | Normalized form produced by the pipeline in [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Section 3.2 |
| `alias_kind` | AliasKindCode | Required | See [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Section 3.3 |
| `target_entity_type` | `system_family \| edition \| book` | Required | Entity type this alias may refer to |
| `candidate_id` | ImmutableID \| null | Optional | Candidate canonical entity ID; null when unresolved |
| `source_url` | URL | Required | Source URL or source-record identifier |
| `evidence_location` | string | Required | Non-spoiler pointer (e.g., `title`, `tag`, `description_excerpt`) |
| `confidence` | `high \| medium \| low \| unresolved` | Required | Confidence in the alias-to-entity mapping |
| `conflict_status` | `clear \| hold_alias_conflict` | Required | |
| `first_observed` | Timestamp | Required | |
| `last_observed` | Timestamp | Required | |
| `content_version` | string | Required | Hash or version of source content at the time this alias was extracted; required for stale-result detection alongside `normalizer_version` and `registry_version` |
| `normalizer_version` | string | Required | Normalizer pipeline version that produced `comparison_key` |
| `registry_version` | string | Required, non-null | Registry snapshot version active at analysis time; always recorded for every alias normalization result, including unresolved results and cases where no candidate matched or resolution was not attempted; use the current registry snapshot in effect at analysis time, recording an explicit empty/minimal registry version identifier when the registry contains no entries; never null |
| `review_state` | `unreviewed \| approved \| rejected \| needs_more_evidence` | Required | |

**Approved mapping:** `review_state = approved` with a non-null `candidate_id` constitutes an approved canonical mapping. This is a separate reviewed decision from the raw alias record. Two aliases sharing the same `comparison_key` but mapping to different candidates produce `conflict_status = hold_alias_conflict` and require human review.

**Reanalysis key:** Reanalysis is skipped only when all three of `content_version`, `normalizer_version`, and `registry_version` are unchanged since the last analysis. A change to any one invalidates the key and requires a new `normalization_history` entry. A registry version change invalidates all alias normalization results — resolved, unresolved, and not-attempted — because an alias that was unresolved against a prior registry snapshot may resolve against a newer one.

### 6.4 `ruleset_reference`

One `ruleset_reference` per system/edition claim observed in source content for a scenario. These are raw evidence records; resolution to canonical entities is separate.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Internal record identifier |
| `scenario_id` | ref&lt;scenario&gt; | Required | The scenario this claim belongs to |
| `original_source_text` | string | Required | Verbatim system/edition claim from source |
| `resolution_state` | `resolved \| target_unresolved` | Required | Whether a canonical target was found |
| `system_family_id` | ref&lt;system_family&gt; \| null | Only when `resolved` | Resolved canonical system family; null when `target_unresolved` |
| `edition_id` | ref&lt;edition&gt; \| null | Optional | Resolved canonical edition when explicit evidence exists; null otherwise |
| `edition_state` | `edition_known \| edition_unknown \| target_unresolved` | Required | Edition resolution status |
| `confidence` | `high \| medium \| low \| unresolved` | Required | |
| `conflict_reason` | ConflictReasonCode \| null | Optional | |
| `hold_reason` | HoldReasonCode \| null | Optional | |
| `source_evidence` | list&lt;SourceEvidenceRef&gt; | Required | |
| `content_version` | string | Required | |
| `normalizer_version` | string | Required | |
| `registry_version` | string | Required | |
| `checked_at` | Timestamp | Required | |
| `review_state` | `unreviewed \| approved \| rejected \| needs_more_evidence` | Required | |
| `reviewed_at` | Timestamp \| null | Optional | |

**Constraints:**
- When `resolution_state = resolved`: `system_family_id` must be non-null; if `edition_id` is non-null, it must belong to the referenced `system_family`.
- When `resolution_state = target_unresolved`: `system_family_id` and `edition_id` must be null; no guessed canonical IDs are permitted.
- `edition_state = edition_unknown` is the default when a `system_family` is resolved but no explicit edition evidence exists in source. Publication date, popularity, shop affiliation, price, filename, or ambiguous keywords are not sufficient to assign an edition (see [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Section 4.3).

### 6.5 `compatibility_claim`

One `compatibility_claim` per explicit compatibility relationship between a scenario and a system/edition, as observed in source content.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Internal record identifier |
| `scenario_id` | ref&lt;scenario&gt; | Required | The scenario this claim belongs to |
| `original_source_text` | string | Required | Verbatim compatibility claim from source |
| `relationship_kind` | CompatibilityRelationshipKind | Required | One of six controlled kinds (D-017) |
| `resolution_state` | `resolved \| target_unresolved` | Required | |
| `system_family_id` | ref&lt;system_family&gt; \| null | Only when `resolved` | Null when `target_unresolved` |
| `edition_id` | ref&lt;edition&gt; \| null | Optional | Null when no explicit edition evidence; must belong to the referenced family when non-null |
| `edition_state` | `edition_known \| edition_unknown \| target_unresolved` | Required | |
| `confidence` | `high \| medium \| low \| unresolved` | Required | |
| `conflict_reason` | ConflictReasonCode \| null | Optional | |
| `hold_reason` | HoldReasonCode \| null | Optional | |
| `source_evidence` | list&lt;SourceEvidenceRef&gt; | Required | |
| `content_version` | string | Required | |
| `normalizer_version` | string | Required | |
| `registry_version` | string | Required | |
| `checked_at` | Timestamp | Required | |
| `review_state` | `unreviewed \| approved \| rejected \| needs_more_evidence` | Required | |
| `reviewed_at` | Timestamp \| null | Optional | |

**CompatibilityRelationshipKind** (D-017): `native`, `explicitly_compatible`, `conversion_provided`, `dual_or_multi_edition`, `derived_candidate`, `unknown`.

**Constraints:**
- `derived_candidate` relationships are never auto-published; `review_state = approved` is required before any public display.
- Non-native relationships (`explicitly_compatible`, `conversion_provided`, `dual_or_multi_edition`, `derived_candidate`) are never displayed to users as native support.
- When `target_unresolved`: `system_family_id` and `edition_id` must be null; no guessed IDs.

### 6.6 `book`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Immutable; created only through reviewed registry addition |
| `book_kind` | BookKindCode | Required | See [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Section 6.2 |
| `system_family_id` | ref&lt;system_family&gt; \| null | Optional | Associated system family when applicable |
| `display_label_ja` | string | Required | Japanese canonical display label |
| `display_label_en` | string \| null | Optional | |
| `redirect_to` | ref&lt;book&gt; \| null | Optional | When deprecated or merged; old identifiers are never deleted |
| `deprecated_at` | Timestamp \| null | Optional | |
| `deprecation_reason` | string \| null | Optional | |
| `created_at` | Timestamp | Required | |
| `registry_version_added` | string | Required | |

### 6.7 `book_requirement`

One `book_requirement` per scenario-book relationship. Scoped at the individual scenario level; different scenarios within a single product may have different book requirements.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Internal record identifier |
| `scenario_id` | ref&lt;scenario&gt; | Required | Individual scenario scope; not at the product level |
| `observed_title_text` | string | Required | Exact observed title text verbatim; preserved even when canonical identity is unresolved |
| `book_id` | ref&lt;book&gt; \| null | Optional | Null when `book_identity_state ≠ resolved` |
| `book_identity_state` | `resolved \| hold_book_conflict \| unresolved` | Required | |
| `requirement_kind` | RequirementKindCode | Required | See [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) Section 6.3 |
| `group_id` | string \| null | Optional | Non-null when `requirement_kind = required_one_of`; groups books in the same "one of these" set |
| `conflict_status` | `clear \| hold_book_conflict` | Required | |
| `source_evidence` | list&lt;SourceEvidenceRef&gt; | Required | |
| `content_version` | string | Required | |
| `normalizer_version` | string | Required | |
| `registry_version` | string | Required | |
| `checked_at` | Timestamp | Required | |
| `review_state` | `unreviewed \| approved \| rejected \| needs_more_evidence` | Required | |
| `reviewed_at` | Timestamp \| null | Optional | |

**Constraints:**
- `required_one_of` groups must have at least two member `book_requirement` records sharing the same `group_id`. A single-member case uses `requirement_kind = required` instead.
- `book_id` must be null when `book_identity_state ≠ resolved`.
- When `book_identity_state = hold_book_conflict`: `conflict_status = hold_book_conflict` and `book_id` is null.
- A book must not be automatically assigned a canonical identity based solely on a short ambiguous acronym without additional distinguishing evidence.

---

## 7. Tags

### 7.1 `tag`

Canonical, controlled tag identity. The tag catalogue is empty at this stage; a future Issue populates it through the reviewed registry process.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Immutable; created through reviewed registry addition |
| `category` | TagCategoryCode | Required | One of the five initial categories |
| `canonical_name` | string | Required | Machine-safe canonical name; unique within `category` |
| `display_label_ja` | string | Required | Japanese display label |
| `display_label_en` | string \| null | Optional | |
| `provenance` | `controlled` | Required | Fixed to `controlled`; all canonical tags are human-reviewed |
| `created_at` | Timestamp | Required | |
| `registry_version_added` | string | Required | |

**TagCategoryCode** — five initial categories:

| Code | Description |
|---|---|
| `theme` | Narrative or genre themes |
| `tone` | Emotional or tonal qualities |
| `content_warning` | Potentially sensitive content flags |
| `mechanic` | Special mechanical rules or requirements |
| `setting` | World or setting descriptors |

No production tag catalogue is created by this document.

### 7.2 `scenario_tag`

The relationship between a scenario and a tag, with full provenance and review metadata.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Internal record identifier |
| `scenario_id` | ref&lt;scenario&gt; | Required | |
| `tag_id` | ref&lt;tag&gt; | Required | |
| `provenance` | `source \| derived` | Required | How this tag assignment was produced |
| `source_wording_observed` | string \| null | Only when `provenance = source` | Exact source text from which this tag was inferred; preserves original wording |
| `source_evidence` | list&lt;SourceEvidenceRef&gt; | Required (non-empty when `derived`) | |
| `confidence` | `high \| medium \| low \| unresolved` | Required when `derived` | |
| `conflict_state` | `clear \| hold_alias_conflict \| hold_conflicting_field_evidence` | Required | |
| `hold_reason` | HoldReasonCode \| null | Optional | Present when tag assignment is held |
| `review_state` | `unreviewed \| approved \| rejected \| needs_more_evidence` | Required | |
| `is_ai_derived` | Boolean | Required | `true` when any source evidence has `extraction_method = ai_candidate` |
| `spoiler_suspect` | Boolean | Required | When `true`: excluded from all public publication without exception |
| `content_version` | string \| null | Required when `provenance = derived` | Hash or version of source content at analysis time; required for stale-result detection; null when `provenance = source` and no normalization key is tracked |
| `classifier_version` | string \| null | Only when `derived` | Version of the classifier that produced this tag assignment |
| `registry_version` | string \| null | Required when `provenance = derived` and canonical tag resolution applies | Registry snapshot version used when resolving this tag assignment; null when no registry resolution was performed |
| `prompt_template_version` | string \| null | Only when AI-derived | |
| `model_id` | string \| null | Only when AI-derived | |
| `checked_at` | Timestamp | Required | |
| `reviewed_at` | Timestamp \| null | Optional | |

**Invariants:**
- `spoiler_suspect = true` tags are **never** published, regardless of `review_state`.
- `is_ai_derived = true` tags require `review_state = approved` before publication; they remain candidates until human approval.
- `provenance = source` tags with `conflict_state = clear`, `spoiler_suspect = false`, and `review_state` not `rejected` may be published without waiting for explicit approval.
- **Reanalysis key (derived tags):** Reanalysis is skipped only when all three of `content_version`, `classifier_version`, and `registry_version` are unchanged since the last analysis. A change to any one invalidates the key and requires a new `normalization_history` entry with `target_type = scenario_tag`.

---

## 8. Provenance and Immutable History

### 8.1 `source_snapshot`

One `source_snapshot` per access to a source URL. Provides the evidence anchor for every derived value.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Internal immutable identifier |
| `source_url` | URL | Required | URL of the source page accessed |
| `checked_at` | Timestamp | Required | When this access occurred |
| `response_status` | string | Required | HTTP status code or access outcome (e.g., `200`, `404`, `rate_limited`, `age_gate_present`) |
| `content_version` | string | Required | Hash or version identifier of the page content at this access time; for `hold_age_unknown` access records where body content is prohibited, must be a non-body-derived access/outcome version identifier (e.g., `access_outcome:<status_code>`) rather than a body hash |
| `extraction_method_summary` | string | Required | Summary of how data was extracted (e.g., `html_parse`, `structured_field_extraction`) |

**Evidence content policy:**
- Non-spoiler excerpts and pointers only; no full product descriptions are stored.
- No adult/R-18/R-18G content is ever stored; such pages are rejected before any content is extracted.
- Spoiler-bearing excerpts are not stored; a `spoiler_content_present` pointer is stored instead.
- For `hold_age_unknown` products: no body-content excerpts, body-derived content hashes, or description fragments may be stored; `content_version` must be a non-body-derived access/outcome version identifier only.

### 8.2 `normalization_history`

Append-only records of old and new normalized results when content or a relevant version changes. History is **never** overwritten or deleted.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | ImmutableID | Required | Internal record identifier |
| `target_type` | string | Required | Entity type of the normalized record (e.g., `ruleset_reference`, `compatibility_claim`, `book_requirement`, `scenario_tag`, `observed_alias`) |
| `target_id` | ImmutableID | Required | ID of the affected record |
| `reanalysis_trigger` | ReanalysisTriggerCode | Required | What triggered this new analysis |
| `content_version_old` | string | Required | Content version before reanalysis |
| `content_version_new` | string | Required | Content version at reanalysis |
| `normalizer_version_old` | string | Required | Normalizer version before reanalysis |
| `normalizer_version_new` | string | Required | Normalizer version at reanalysis |
| `registry_version_old` | string | Required | Registry version before reanalysis |
| `registry_version_new` | string | Required | Registry version at reanalysis |
| `old_result_snapshot` | structured record | Required | Snapshot of normalized field values before reanalysis |
| `new_result_snapshot` | structured record | Required | Snapshot of normalized field values after reanalysis |
| `changed_at` | Timestamp | Required | When reanalysis occurred |
| `reason_detail` | string \| null | Optional | Additional detail on why reanalysis was triggered |

**ReanalysisTriggerCode:** `content_changed`, `normalizer_version_changed`, `registry_version_changed`, `alias_approved`, `canonical_entity_added`, `manual_trigger`.

**Reanalysis avoidance key:** Reanalysis is skipped only when **all three** are unchanged since the last analysis: `content_version`, `normalizer_version`, `registry_version`. A change to any one invalidates the key and requires a new `normalization_history` entry. Both old and new records are retained.

**Non-null version constraint:** All six version fields — `content_version_old`, `content_version_new`, `normalizer_version_old`, `normalizer_version_new`, `registry_version_old`, `registry_version_new` — are required and always non-null. For any reanalysis where the prior state originated from an initial normalization run, the `_old` fields carry the version values recorded on the analyzed entity at the time of that initial run (which are themselves non-null per the entity invariants, including the `observed_alias.registry_version` non-null requirement). No null value is permitted in any version field of a `normalization_history` record, including the first reanalysis of a previously unresolved or not-attempted alias result. This ensures registry version changes reproducibly invalidate and retrigger all affected alias normalization results regardless of their prior resolution state.

**Queryability contract:** The history structure must support:
- Finding every AI-derived candidate across all normalized entity types.
- Finding every held or unresolved field.
- Finding every field produced by a given normalizer or registry version.
- Triggering and tracing reanalysis when any key component changes.

---

## 9. Quality and Hold Reasons

Hold and quality reasons are controlled vocabularies. Each reason is classified by scope and by whether it blocks public publication.

| Reason Code | Scope | Blocks Publication | Description |
|---|---|---|---|
| `hold_age_unknown` | Record-level (`booth_product`) | **Yes — blocks all publication from this product** | Age rating evidence missing, ambiguous, or conflicting; D-002 and D-012; see Section 3.5 for complete field prohibitions while this hold is active |
| `hold_unknown_classification` | Record-level (`booth_product`) | **Yes — blocks scenario publication from this product** | Product classification is `hold_unknown` |
| `hold_collection_split` | Record-level (`scenario`) | **Yes — blocks this scenario** | Collection contents not individually separated (`unseparated` or `ambiguous` separation state) |
| `hold_alias_conflict` | Field-level (`observed_alias`, normalization fields) | Field only; other fields may publish independently | Two alias records with the same comparison key resolve to different candidates |
| `hold_book_conflict` | Relationship-level (`book_requirement`) | Relationship only; other scenario fields may publish | Conflicting or insufficient book identification evidence |
| `hold_compatibility_conflict` | Field-level (`compatibility_claim`) | Field only | Conflicting compatibility evidence |
| `hold_conflicting_field_evidence` | Field-level (any `EvidencedValue`) | Field only | Multiple sources disagree and cannot be auto-resolved |
| `hold_insufficient_evidence` | Field-level (any `EvidencedValue`) | Field only | Evidence present but below the confidence threshold for publication |
| `hold_spoiler_bearing_evidence` | Field-level (any `EvidencedValue`) | Field only; excluded from public | Only spoiler-bearing evidence is available; evidence text is not stored |
| `hold_ai_candidate_pending` | Field-level or relationship-level | Field or relationship only | AI-generated candidate awaiting human review |
| `hold_target_unresolved` | Field-level (`ruleset_reference`, `compatibility_claim`) | Field only; scenario may otherwise publish | Cannot resolve to a canonical system/edition/book; no guessed IDs |

**Notes:**
- Record-level holds block publication of the entire `booth_product` or `scenario`.
- Field-level and relationship-level holds block only the affected field or relationship; other independently evidenced fields may publish.
- A held scenario record is retained in internal history and may be reclassified when new evidence becomes available.
- Ending a scenario's sales state does not delete its holds; holds remain until explicitly resolved.

---

## 10. Search Visibility Projection: `searchable_scenario`

`searchable_scenario` is a **deterministic logical projection** — not a stored entity. It defines the conditions under which a `scenario` appears in public search results. All applicable gates must pass. No scenario is included by default.

### 10.1 Eligibility Gates

| Gate | Condition | Failure result |
|---|---|---|
| **Classification gate** | `parent.classification.value` ∈ { `scenario_single`, `scenario_collection`, `mixed_scenario_and_material` } AND `parent.classification.review_state = approved` AND `parent.classification.confidence ∈ { high, medium }` AND `parent.classification.conflict_reason = null` AND `parent.classification.hold_reason` is absent AND `parent.classification.source_evidence` is non-empty | Excluded from search; an unreviewed, rejected, low-confidence, unresolved, or conflicted classification cannot authorize publication even if the value field matches an eligible code |
| **All-ages gate** | `parent.all_ages_state.value = all_ages_confirmed` AND `parent.all_ages_state.review_state = approved` AND `parent.all_ages_state.source_evidence` is non-empty | Excluded from search; unsupported or `rejected` all-ages confirmation cannot pass this gate |
| **Sales-state gate** | `parent.sales_state` ∈ { `available`, `sold_out` } | Excluded from search |
| **Separation gate** | `scenario.separation_state` ∈ { `single_scenario`, `separated` } | Excluded from search |
| **Record-level hold gate** | No blocking record-level hold on this `scenario` or its parent `booth_product` | Excluded from search when required fields are `hold` |
| **Required field gate** | Required public fields have `state ∈ { known, unknown }` (not `hold`) | Excluded from search when required fields are `hold` |
| **AI approval gate** | No AI-derived field is published without `review_state = approved` | Unapproved AI field omitted; scenario may still appear without that field if other gates pass |
| **Spoiler gate** | No `scenario_tag` with `spoiler_suspect = true` appears in public results | Spoiler-suspect tags omitted; scenario may appear without them |
| **Rejected records gate** | No `review_state = rejected` normalization, alias, ruleset, compatibility, book, or tag record may appear in the public projection; `approved` is required for canonical mapping, AI-derived values, and normalization contract fulfillment; absence of a blocking hold alone is insufficient for publication where `approved` is required | Rejected record excluded from projection; other approved records for the same scenario are unaffected |

### 10.2 Explicit Exclusions

The following are explicitly excluded from normal public search results. Their records are retained in internal history.

| Exclusion | Reason |
|---|---|
| Products classified `material_only`, `update_or_dlc_only`, `non_trpg`, `rulebook_or_system`, `supplement`, `replay_or_reading_material` | Not playable scenario content |
| Products with `classification.review_state ≠ approved` | Classification must be approved; an unreviewed or rejected classification cannot authorize publication |
| Products with `classification.confidence ∈ { low, unresolved }` | Low or unresolved classification confidence does not meet the publication threshold |
| Products with `classification.conflict_reason ≠ null` or `classification.hold_reason` present | Unresolved conflict or hold on classification blocks publication |
| Products with `all_ages_state.value = hold_age_unknown` (i.e., `all_ages_state.state = hold`) | D-002 and D-012 strict hold |
| Products with `all_ages_state.review_state ≠ approved` | All-ages confirmation must be approved; unsupported or rejected confirmation cannot authorize publication |
| Products with `sales_state ∈ { sales_ended, disappeared, unknown }` | Ended-product exclusion; unknown state cannot confirm eligibility |
| Scenarios with `separation_state ∈ { unseparated, ambiguous }` | Collection contents not yet individually separated |
| Scenarios with a blocking record-level hold | Not ready for publication |
| `scenario_tag` records with `spoiler_suspect = true` | Spoiler exclusion |
| AI-derived tag and normalization candidates without `review_state = approved` | Not yet human-reviewed |
| `review_state = rejected` normalization, alias, ruleset, compatibility, book, and tag records | Rejected records are never part of public projections; absence of a blocking hold is insufficient for publication without `approved` status where required |

### 10.3 Published Projection Fields

When all gates pass, the public projection includes (but is not limited to):

| Field | Source |
|---|---|
| Parent BOOTH product URL | `booth_product.canonical_url` |
| Product title | `booth_product.observed_title` |
| Creator name | `booth_product.creator_observed_name` |
| Scenario title | `scenario.observed_title.value` (or `unknown` indicator when `state = unknown`) |
| Player count (min/max) | `scenario.min_pl.value`, `scenario.max_pl.value` (or unknown indicator) |
| GM/KP required, GM-less, KPC | `scenario.gm_kp_required.value`, `gm_less.value`, `kpc_present.value` (or unknown indicator) |
| Play time ranges | `scenario_play_time` records, per modality; not flattened |
| Conversation method(s) | `scenario_conversation_method` records |
| Play environment(s) | `scenario_play_environment` records |
| Progression method | `scenario.progression_method.value` |
| Handout structure | `scenario.handout_structure.value` |
| Approved tags | `scenario_tag` records with `review_state = approved` and `spoiler_suspect = false` |
| Normalization fields | `ruleset_reference`, `compatibility_claim`, `book_requirement` records with no blocking hold and `review_state ≠ rejected` |

**Never published:** product images, exact prices, payment details, download links, adult/R-18/R-18G content, spoiler-bearing evidence text.

### 10.4 Unknown Values in Filters

When a filter field has `state = unknown`, the scenario:
- Is included in results that do not filter by that field.
- Displays an explicit unknown indicator (e.g., 「不明」) rather than any default value.
- Is **never** treated as zero, false, empty string, or a specific default category.

### 10.5 Sort Inputs

The following sort inputs are confirmed for the public projection. Algorithms and exact implementation are deferred to Stage 4 and later.

| Sort | Status | Notes |
|---|---|---|
| Discovery (editorial/algorithmic) | Confirmed | Algorithm deferred to Stage 4+ |
| New (publication date) | Confirmed | Source date from product page; `booth_product.first_seen_at` as fallback |
| Last-checked | Confirmed | `booth_product.last_checked_at` |
| Title (alphabetical) | Confirmed | `scenario.observed_title.value` |
| Seeded random | Confirmed | Algorithm deferred to Stage 4+ |
| Free-first | **Confirmed — pending indicator definition (PD-009)** | **Exact price is never stored or exposed.** The architecture/collection stage must define a permitted non-exact free/paid indicator (e.g., a boolean `is_free` derived from source evidence without storing exact price) or revise this requirement before implementation. Implementing this sort by silently storing exact price is prohibited. |

---

## 11. Constraints and Lifecycle

### 11.1 Cardinality Constraints

| Relationship | Cardinality |
|---|---|
| `booth_product` → `scenario` | Zero to many |
| `scenario` → `booth_product` | Exactly one (for MVP) |
| `booth_product` → `product_component` | Zero to many |
| `product_component` → `booth_product` | Exactly one |
| `product_component` → `scenario` | Zero to one; null when component is not a linked playable scenario |
| `scenario` → `ruleset_reference` | Zero to many |
| `scenario` → `compatibility_claim` | Zero to many |
| `scenario` → `book_requirement` | Zero to many |
| `scenario` → `scenario_play_time` | One to many (at least one; one per distinct modality); zero rows are not permitted |
| `scenario` → `scenario_conversation_method` | Zero to many |
| `scenario` → `scenario_play_environment` | Zero to many |
| `scenario` → `scenario_tag` | Zero to many |
| `edition` → `system_family` | Exactly one |
| `book_requirement` `required_one_of` group | At least two members per group |

### 11.2 Value Constraints

| Constraint | Applies when |
|---|---|
| `min_pl.value ≤ max_pl.value` | Only when both `state = known`; not enforced when either is `unknown` or `hold` |
| `min_duration.value ≤ max_duration.value` | Per `scenario_play_time` record; only when both `state = known` |
| `edition.system_family_id` matches resolved target | An edition referenced in `ruleset_reference` or `compatibility_claim` must belong to the same family referenced by those records |
| `required_one_of` group has ≥ 2 members | Always; single-member cases use `required` instead |
| `system_family_id` and `edition_id` are null when `target_unresolved` | Always; no guessed canonical IDs are permitted |
| `source_product_id` is unique | Always; one source product maps to one `booth_product` record |
| Component-to-scenario link unique within a product | One `product_component` per `scenario` per `booth_product` |

### 11.3 Lifecycle and History

- **Ended and disappeared products** are retained in internal history. Records are never deleted solely because the current listing disappears.
- **History is append-only for permitted records.** Source snapshots and normalization history entries for permitted content are never overwritten, modified post-creation, or deleted. This rule applies to permitted audit evidence only and does not override the adult-content and age-uncertainty erasure requirements; see Section 3.5 for the complete `hold_age_unknown` purge/redaction and tombstone contract.
- **State transitions** are traceable through `source_snapshot` and `normalization_history` records.
- **Re-classification** of a `booth_product` does not delete prior classification evidence; old and new results are retained in `normalization_history`.
- **Normal rollback** is a revert or fix-forward within the allowed documentation paths. History is never rewritten.

### 11.4 No Destructive Overwrites

- No source-observed field (`original_source_text`, `observed_title_text`, `observed_component_wording`, `observed_title`) may be silently overwritten after initial recording.
- No `source_snapshot` or `normalization_history` record may be deleted or overwritten.
- When a field value changes due to new evidence, the change is recorded in `normalization_history`; both old and new results are retained.
- Canonical entity deprecation and merges use `redirect_to`; old identifiers are never deleted or repurposed.

---

## 12. Cross-References

| Document | Relevant Sections for This Model |
|---|---|
| [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | Two-layer model; PL rules; play-time rules; tag system; sorting options; scenario fields |
| [DECISIONS.md](DECISIONS.md) | D-004 (two-layer model); D-011 (classification vocabulary); D-012 (all-ages hold); D-014–D-021 (normalization decisions); D-022–D-026 (Stage 3 modelling decisions) |
| [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) | §1 entity boundaries; §3 alias normalization; §4 edition handling; §5 compatibility vocabulary; §6 book and requirement model; §7 extraction precedence; §8 provenance fields; §9 registry governance; §10 search/display contract; §11 Stage 3 minimum contract |
| [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | Collection thresholds; AI output gate; metadata fields; sales lifecycle |
| [LEGAL_AND_COMPLIANCE.md](LEGAL_AND_COMPLIANCE.md) | All-ages boundary; excluded content; authorized scope |
| [ROADMAP.md](ROADMAP.md) | Stage 3 (this document); Stage 4 (next: architecture/technology decision) |
