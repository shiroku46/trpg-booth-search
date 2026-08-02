# Physical Schema

## Status

Implementation-ready specification for the TRPG BOOTH search helper MVP database. This document translates the logical data model defined in [DATA_MODEL.md](DATA_MODEL.md) into provider-specific table definitions, column types, constraints, indexes, and lifecycle rules for PostgreSQL 17 on Supabase.

This document defines tables, columns, logical provider types, keys, foreign keys, uniqueness, checks, indexes, append-only rules, redaction/tombstone behavior, and mapping back to [DATA_MODEL.md](DATA_MODEL.md). It is a specification, not executable SQL or a migration file. No database is provisioned, and no migration is applied, until an authorized provisioning Issue generates and applies the first migration from this specification.

Cross-links: [DATA_MODEL.md](DATA_MODEL.md) | [ARCHITECTURE.md](ARCHITECTURE.md) | [DECISIONS.md](DECISIONS.md) | [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md)

Governing decisions: D-027 through D-037 in [DECISIONS.md](DECISIONS.md).

---

## 1. Encoding Rules

### 1.1 Scalar Types

| Logical type | PostgreSQL type | Notes |
|---|---|---|
| `ImmutableID` | `uuid` | Generated using `gen_random_uuid()` at row insertion; never changed post-creation (D-034) |
| `Timestamp` | `timestamptz` | Stored in UTC; ISO 8601 with timezone |
| `Duration` | `integer` | Non-negative integer representing minutes; application enforces ≥ 0 |
| `URL` | `text` | Validated by application before insertion |
| `Boolean` | `boolean` | Native PostgreSQL boolean |
| `PositiveInteger` | `integer` | Application enforces ≥ 1 for `state = known`; no database-level check required (state controls absence) |
| `string` | `text` | UTF-8 text; no length limit unless noted |
| Controlled vocabulary code | `text` | Application enforces membership in the controlled set; database CHECK constraints on critical state fields where noted |

### 1.2 EvidencedValue\<T\> Encoding

**Decision D-033:** Every `EvidencedValue<T>` field is encoded as a single `jsonb NOT NULL` column. The JSONB document structure is the authoritative representation. No null/default value may be used to represent any EvidencedValue state — the `state` key within the JSONB document is always explicit.

**Required JSONB structure:**

```
{
  "state":           "known" | "unknown" | "hold" | "not_applicable",
  "value":           <T value>,               // REQUIRED when state=known; ABSENT otherwise
  "confidence":      "high" | "medium" | "low" | "unresolved",
  "hold_reason":     "<HoldReasonCode>",       // REQUIRED when state=hold; ABSENT otherwise
  "conflict_reason": "<ConflictReasonCode>" | null,
  "source_evidence": [<SourceEvidenceRef>, ...],  // non-empty when state=known
  "review_state":    "unreviewed" | "approved" | "rejected" | "needs_more_evidence",
  "content_version": "<string>",
  "normalizer_version": "<string>" | null,    // present when normalization applies
  "registry_version":   "<string>" | null,   // present when canonical resolution applies
  "checked_at":      "<ISO 8601 timestamptz>",
  "reviewed_at":     "<ISO 8601 timestamptz>" | null
}
```

**SourceEvidenceRef structure (embedded in source_evidence array):**

```
{
  "source_snapshot_id":    "<uuid>",
  "evidence_type":         "<EvidenceTypeCode>",
  "evidence_pointer":      "<string>",
  "extraction_method":     "explicit_source" | "approved_alias" | "deterministic_rule" | "ai_candidate",
  "model_id":              "<string>" | null,
  "prompt_template_version": "<string>" | null,
  "generation_date":       "<ISO 8601 timestamptz>" | null
}
```

**Invariants enforced by application layer (not database CHECK):**
- `state = 'known'`: `value` present; `source_evidence` non-empty; `hold_reason` absent.
- `state ∈ {'unknown', 'hold', 'not_applicable'}`: `value` absent; no guessed/default substitution.
- `state = 'hold'`: `hold_reason` present; all other states: `hold_reason` absent.
- All required version and timestamp fields are non-null as specified in DATA_MODEL.md Section 2.1.

**Expression indexes** on JSONB state fields are added per table (see per-table index sections).

### 1.3 List\<SourceEvidenceRef\>

Fields typed `list<SourceEvidenceRef>` in the logical model (on entities other than EvidencedValue columns) are encoded as `jsonb NOT NULL` arrays containing SourceEvidenceRef documents. The `source_snapshot_id` UUID within each array element is a logical reference to `source_snapshot.id`; referential integrity is enforced by the application layer, not a database FK constraint on the JSONB element.

### 1.4 Append-Only Tables

Tables whose records must never be updated or deleted for permitted content (DATA_MODEL.md Section 11.3):
- `source_snapshot`
- `normalization_history`

For these tables: no UPDATE or DELETE operations on permitted records are issued by the application. The `hold_age_unknown` purge (Section 10) results in new append-only records (tombstone events in `normalization_history`), not modification of existing rows. Deletion of prohibited payload rows from other tables is authorized by the purge contract; these tables remain append-only.

### 1.5 ReanalysisTriggerCode — Extended Vocabulary

The physical schema extends the logical `ReanalysisTriggerCode` from DATA_MODEL.md Section 8.2 with one additional code required by the redaction contract:

| Code | Source | Description |
|---|---|---|
| `content_changed` | DATA_MODEL.md | Source content version changed |
| `normalizer_version_changed` | DATA_MODEL.md | Normalizer pipeline version changed |
| `registry_version_changed` | DATA_MODEL.md | Registry snapshot version changed |
| `alias_approved` | DATA_MODEL.md | An alias mapping was approved |
| `canonical_entity_added` | DATA_MODEL.md | A new canonical entity was added to the registry |
| `manual_trigger` | DATA_MODEL.md | Manual reanalysis requested |
| `hold_age_unknown_redaction` | Physical schema extension | Records the irreversible `hold_age_unknown` redaction event; used in `normalization_history` tombstone rows only |

---

## 2. Table Specifications

### 2.1 `booth_product`

**Maps to:** `booth_product` entity in DATA_MODEL.md Section 3.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | ImmutableID; primary key |
| `source_platform` | `text` | ✓ | `'booth'` | Fixed to `'booth'` for MVP |
| `source_product_id` | `text` | ✓ | | BOOTH numeric item identifier; uniqueness key |
| `canonical_url` | `text` | ✓ | | Derived from `source_product_id`; never user-supplied |
| `observed_title` | `text` | | | NULL when `all_ages_state` hold_age_unknown; prohibited — must be purged on hold transition |
| `creator_observed_name` | `text` | | | NULL when hold_age_unknown; prohibited — must be purged on hold transition |
| `creator_source_url` | `text` | | | NULL when hold_age_unknown; prohibited — must be purged on hold transition |
| `classification` | `jsonb` | | | `EvidencedValue<ProductClassCode>`; NULL when hold_age_unknown; prohibited — must be purged on hold transition |
| `sales_state` | `text` | | | `SalesStateCode`; NULL when hold_age_unknown; prohibited — must be purged on hold transition; CHECK values: `'available'`, `'sold_out'`, `'sales_ended'`, `'disappeared'`, `'unknown'` |
| `all_ages_state` | `jsonb` | ✓ | | `EvidencedValue<AllAgesStateCode>`; restricted to exactly two representations: `state='known'` with `value='all_ages_confirmed'`, or `state='hold'` with `hold_reason='hold_age_unknown'`; `state='unknown'` and `state='not_applicable'` are prohibited for this field |
| `is_free` | `jsonb` | | | `EvidencedValue<boolean>`; resolves PD-009; NULL when hold_age_unknown; derived from observed price indicators without storing exact price; `state='unknown'` when no price indicator is observable |
| `discovery_method` | `text` | ✓ | | How the product was initially discovered |
| `first_seen_at` | `timestamptz` | ✓ | | When this record was first created |
| `last_checked_at` | `timestamptz` | ✓ | | When the source page was most recently accessed |
| `content_version` | `text` | ✓ | | Body-derived hash when `all_ages_state.state='known'`; non-body-derived access/outcome version (e.g., `'access_outcome:200'`) when `all_ages_state.state='hold'` with `hold_age_unknown` |
| `current_record_updated_at` | `timestamptz` | ✓ | | When the current record projection was last modified |

**Primary key:** `id`

**Unique constraint:** `source_product_id`

**Check constraints (database-enforced):**
- `sales_state` IN (`'available'`, `'sold_out'`, `'sales_ended'`, `'disappeared'`, `'unknown'`, NULL)
- `(all_ages_state->>'state')` IN (`'known'`, `'hold'`)

**Application-enforced invariants (not database CHECK):**
- When `(all_ages_state->>'state') = 'hold'` AND `(all_ages_state->>'hold_reason') = 'hold_age_unknown'`: `observed_title`, `creator_observed_name`, `creator_source_url`, `classification`, `sales_state`, `is_free` must all be NULL; `content_version` must match the pattern `'access_outcome:*'`.
- `all_ages_state` JSON `state` field is never `'unknown'` or `'not_applicable'`.
- `classification` JSON must carry non-null `normalizer_version` and `registry_version` per DATA_MODEL.md Section 3.6.
- `is_free` when present: `value` is `true` or `false` only when derived from explicit observed price evidence; `state='unknown'` when price indicator is absent.

**Indexes:**
- UNIQUE B-tree: `source_product_id`
- B-tree expression: `(all_ages_state->>'state')` — supports all-ages gate filter
- B-tree: `last_checked_at` — supports last-checked sort
- B-tree: `first_seen_at` — supports new sort
- Partial B-tree expression: `((is_free->>'value')::boolean)` WHERE `(is_free->>'state') = 'known'` — supports free-first sort

---

### 2.2 `scenario`

**Maps to:** `scenario` entity in DATA_MODEL.md Section 4.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | ImmutableID; primary key |
| `booth_product_id` | `uuid` | ✓ | | FK → `booth_product.id`; exactly one parent product |
| `observed_title` | `jsonb` | ✓ | | `EvidencedValue<text>`; `state='unknown'` when title unavailable; `state='hold'` when cannot be separated from collection |
| `separation_state` | `text` | ✓ | | `SeparationStateCode`; CHECK: `'single_scenario'`, `'separated'`, `'unseparated'`, `'ambiguous'` |
| `work_composition` | `jsonb` | ✓ | | `EvidencedValue<WorkCompositionCode>` |
| `min_pl` | `jsonb` | ✓ | | `EvidencedValue<integer>`; value ≥ 1 when `state='known'` |
| `max_pl` | `jsonb` | ✓ | | `EvidencedValue<integer>`; value ≥ 1 and ≥ `min_pl.value` when both `state='known'` |
| `gm_kp_required` | `jsonb` | ✓ | | `EvidencedValue<boolean>` |
| `gm_less` | `jsonb` | ✓ | | `EvidencedValue<boolean>` |
| `kpc_present` | `jsonb` | ✓ | | `EvidencedValue<boolean>` |
| `progression_method` | `jsonb` | ✓ | | `EvidencedValue<ProgressionMethodCode>` |
| `handout_structure` | `jsonb` | ✓ | | `EvidencedValue<HandoutStructureCode>` |
| `first_seen_at` | `timestamptz` | ✓ | | When this scenario record was first created |
| `last_checked_at` | `timestamptz` | ✓ | | When source evidence was most recently checked |
| `content_version` | `text` | ✓ | | Hash or version of source content at last analysis |
| `current_record_updated_at` | `timestamptz` | ✓ | | When the current record projection was last modified |

**Primary key:** `id`

**Foreign key:** `booth_product_id` → `booth_product.id`

**Check constraint:** `separation_state` IN (`'single_scenario'`, `'separated'`, `'unseparated'`, `'ambiguous'`)

**Application-enforced invariants:**
- No `scenario` record may be created for a `booth_product` with `all_ages_state.state='hold'` and `hold_reason='hold_age_unknown'` (DATA_MODEL.md Section 3.5).
- When both `min_pl` and `max_pl` have `state='known'`, `min_pl.value ≤ max_pl.value`.
- At least one `scenario_play_time` record must exist per `scenario`; zero rows must not represent unknown or unchecked play time.

**Indexes:**
- B-tree: `booth_product_id` — FK lookup
- B-tree: `separation_state` — searchable_scenario separation gate
- Partial B-tree: `booth_product_id` WHERE `separation_state IN ('single_scenario', 'separated')` — publication gate
- B-tree expression: `((min_pl->>'value')::integer)` WHERE `(min_pl->>'state') = 'known'` — PL filter
- B-tree expression: `((max_pl->>'value')::integer)` WHERE `(max_pl->>'state') = 'known'` — PL filter
- B-tree expression: `(observed_title->>'value')` WHERE `(observed_title->>'state') = 'known'` — title sort

---

### 2.3 `scenario_play_time`

**Maps to:** `scenario_play_time` entity in DATA_MODEL.md Section 4.3.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | ImmutableID; primary key |
| `scenario_id` | `uuid` | ✓ | | FK → `scenario.id` |
| `modality` | `text` | ✓ | | `PlayModalityCode`; CHECK: `'online'`, `'offline'`, `'conversation_mode'`, `'general'` |
| `collection_state` | `text` | ✓ | | `PlayTimeCollectionStateCode`; CHECK: `'observed'`, `'checked_unknown'`, `'not_collected'`, `'not_applicable'` |
| `min_duration` | `jsonb` | ✓ | | `EvidencedValue<integer [minutes]>` |
| `max_duration` | `jsonb` | ✓ | | `EvidencedValue<integer [minutes]>` |

**Primary key:** `id`

**Foreign key:** `scenario_id` → `scenario.id`

**Check constraints:**
- `modality` IN (`'online'`, `'offline'`, `'conversation_mode'`, `'general'`)
- `collection_state` IN (`'observed'`, `'checked_unknown'`, `'not_collected'`, `'not_applicable'`)

**Application-enforced invariants:**
- `collection_state='observed'`: at least one of `min_duration` or `max_duration` satisfies `publishable_core_value`; neither may have `state='not_applicable'`.
- `collection_state='checked_unknown'`: both `min_duration.state` and `max_duration.state` must be `'unknown'` with no value.
- `collection_state='not_applicable'`: both durations have `state='not_applicable'` with no value.
- When both `min_duration` and `max_duration` have `state='known'`: `min_duration.value ≤ max_duration.value`.
- Zero rows for a scenario are not permitted; at least one record must exist.
- Records for different modalities are independent and not aggregated.

**Indexes:**
- B-tree: `scenario_id`
- Composite B-tree: `(scenario_id, modality)` — modality lookup

---

### 2.4 `scenario_conversation_method`

**Maps to:** `scenario_conversation_method` entity in DATA_MODEL.md Section 4.4.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | ImmutableID; primary key |
| `scenario_id` | `uuid` | ✓ | | FK → `scenario.id` |
| `method` | `jsonb` | ✓ | | `EvidencedValue<ConversationMethodCode>`; `value` controlled: `'text'`, `'voice'`, `'video'` |

**Primary key:** `id`

**Foreign key:** `scenario_id` → `scenario.id`

**Indexes:**
- B-tree: `scenario_id`

---

### 2.5 `scenario_play_environment`

**Maps to:** `scenario_play_environment` entity in DATA_MODEL.md Section 4.4.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | ImmutableID; primary key |
| `scenario_id` | `uuid` | ✓ | | FK → `scenario.id` |
| `environment` | `jsonb` | ✓ | | `EvidencedValue<PlayEnvironmentCode>`; `value` controlled: `'online'`, `'offline'`, `'vr'` |

**Primary key:** `id`

**Foreign key:** `scenario_id` → `scenario.id`

**Indexes:**
- B-tree: `scenario_id`

---

### 2.6 `product_component`

**Maps to:** `product_component` entity in DATA_MODEL.md Section 5. Internal source-representation entity; never directly searchable or published.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | ImmutableID; primary key |
| `booth_product_id` | `uuid` | ✓ | | FK → `booth_product.id` |
| `observed_component_wording` | `text` | ✓ | | Exact observed variant/component label verbatim; never altered |
| `component_classification` | `jsonb` | ✓ | | `EvidencedValue<ComponentClassCode>` |
| `scenario_id` | `uuid` | | | FK → `scenario.id`; NULL when component is not a linked playable scenario |

**Primary key:** `id`

**Foreign keys:** `booth_product_id` → `booth_product.id`; `scenario_id` → `scenario.id` (nullable)

**Unique constraint:** `(booth_product_id, scenario_id)` WHERE `scenario_id IS NOT NULL` — one component per scenario per product

**Application-enforced invariants:**
- `scenario_id` must be NULL when `component_classification.value` ∈ {`'material'`, `'update_or_dlc'`, `'unknown'`, `'other'`} or when link is not yet resolved.
- No `product_component` records may be created for a `booth_product` with `hold_age_unknown` active.

**Indexes:**
- B-tree: `booth_product_id`
- B-tree: `scenario_id` WHERE `scenario_id IS NOT NULL`

---

### 2.7 `system_family`

**Maps to:** `system_family` entity in DATA_MODEL.md Section 6.1. Registry table; populated only through reviewed Issues.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | ImmutableID; primary key; never deleted |
| `display_label_ja` | `text` | ✓ | | Japanese canonical display label (BCP 47: `ja`) |
| `display_label_en` | `text` | | | English display label when available |
| `redirect_to` | `uuid` | | | Self-referential FK → `system_family.id`; NULL for active entities; non-null for deprecated/merged |
| `deprecated_at` | `timestamptz` | | | NULL for active entities |
| `deprecation_reason` | `text` | | | NULL for active entities |
| `created_at` | `timestamptz` | ✓ | | When added to the registry |
| `registry_version_added` | `text` | ✓ | | Registry version at which this entity was added |

**Primary key:** `id`

**Foreign key (self):** `redirect_to` → `system_family.id`

**Application-enforced invariants:**
- Redirect chain is finite and acyclic; cycle detection on write.
- Old identifiers are never deleted or repurposed.

**Indexes:**
- B-tree: `redirect_to` WHERE `redirect_to IS NOT NULL`

---

### 2.8 `edition`

**Maps to:** `edition` entity in DATA_MODEL.md Section 6.2. Registry table.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | ImmutableID; primary key; never deleted |
| `system_family_id` | `uuid` | ✓ | | FK → `system_family.id`; must reference a non-deprecated family |
| `display_label_ja` | `text` | ✓ | | |
| `display_label_en` | `text` | | | |
| `redirect_to` | `uuid` | | | Self-referential FK → `edition.id`; NULL for active entities |
| `deprecated_at` | `timestamptz` | | | |
| `deprecation_reason` | `text` | | | |
| `created_at` | `timestamptz` | ✓ | | |
| `registry_version_added` | `text` | ✓ | | |

**Primary key:** `id`

**Foreign keys:** `system_family_id` → `system_family.id`; `redirect_to` → `edition.id`

**Application-enforced invariants:**
- Redirect chain is finite and acyclic.
- Old identifiers are never deleted or repurposed.
- When a `ruleset_reference` or `compatibility_claim` carries both `system_family_id` and `edition_id`, the edition's own `system_family_id` must equal the referenced family.

**Indexes:**
- B-tree: `system_family_id`

---

### 2.9 `observed_alias`

**Maps to:** `observed_alias` entity in DATA_MODEL.md Section 6.3.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | Primary key |
| `original_source_text` | `text` | ✓ | | Verbatim source text; never altered |
| `comparison_key` | `text` | ✓ | | Normalized form from the pipeline in SYSTEM_NORMALIZATION.md Section 3.2 |
| `alias_kind` | `text` | ✓ | | `AliasKindCode` per SYSTEM_NORMALIZATION.md Section 3.3 |
| `target_entity_type` | `text` | ✓ | | CHECK: `'system_family'`, `'edition'`, `'book'` |
| `candidate_id` | `uuid` | | | Candidate canonical entity ID; NULL when unresolved |
| `source_url` | `text` | ✓ | | Source URL or source-record identifier |
| `evidence_type` | `text` | ✓ | | `EvidenceTypeCode` |
| `evidence_pointer` | `text` | ✓ | | Non-spoiler pointer to location within source |
| `extraction_method` | `text` | ✓ | | CHECK: `'explicit_source'`, `'approved_alias'`, `'deterministic_rule'`, `'ai_candidate'` |
| `confidence` | `text` | ✓ | | CHECK: `'high'`, `'medium'`, `'low'`, `'unresolved'` |
| `conflict_status` | `text` | ✓ | | CHECK: `'clear'`, `'hold_alias_conflict'` |
| `hold_reason` | `text` | | | `HoldReasonCode`; NULL unless held |
| `first_observed` | `timestamptz` | ✓ | | When this alias text was first observed |
| `last_observed` | `timestamptz` | ✓ | | When most recently observed |
| `checked_at` | `timestamptz` | ✓ | | When normalization result was last checked |
| `reviewed_at` | `timestamptz` | | | NULL when unreviewed |
| `content_version` | `text` | ✓ | | Hash or version of source content at extraction time |
| `normalizer_version` | `text` | ✓ | | Normalizer pipeline version |
| `registry_version` | `text` | ✓ | | Registry snapshot version; always non-null; explicit empty/minimal version identifier when registry is empty |
| `review_state` | `text` | ✓ | | CHECK: `'unreviewed'`, `'approved'`, `'rejected'`, `'needs_more_evidence'` |
| `model_id` | `text` | | | NULL unless `extraction_method='ai_candidate'` |
| `prompt_template_version` | `text` | | | NULL unless `extraction_method='ai_candidate'` |
| `generation_date` | `timestamptz` | | | NULL unless `extraction_method='ai_candidate'` |

**Primary key:** `id`

**Application-enforced invariants:**
- `registry_version` is always non-null; use an explicit empty/minimal version identifier (e.g., `'registry_empty_v0'`) when the registry contains no entries.
- Reanalysis key: all three of (`content_version`, `normalizer_version`, `registry_version`) must be unchanged to skip reanalysis.

**Indexes:**
- B-tree: `comparison_key` — alias matching
- B-tree: `(target_entity_type, candidate_id)` — canonical resolution
- B-tree: `conflict_status` — conflict resolution queue
- B-tree: `review_state` — review queue
- B-tree: `extraction_method` WHERE `extraction_method = 'ai_candidate'` — AI candidate queue

---

### 2.10 `ruleset_reference`

**Maps to:** `ruleset_reference` entity in DATA_MODEL.md Section 6.4.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | Primary key |
| `scenario_id` | `uuid` | ✓ | | FK → `scenario.id` |
| `original_source_text` | `text` | ✓ | | Verbatim system/edition claim from source; never altered |
| `resolution_state` | `text` | ✓ | | CHECK: `'resolved'`, `'target_unresolved'` |
| `system_family_id` | `uuid` | | | FK → `system_family.id`; non-null only when `resolution_state='resolved'` |
| `edition_id` | `uuid` | | | FK → `edition.id`; non-null only when `edition_state='edition_known'` |
| `edition_state` | `text` | ✓ | | CHECK: `'edition_known'`, `'edition_unknown'`, `'target_unresolved'` |
| `confidence` | `text` | ✓ | | CHECK: `'high'`, `'medium'`, `'low'`, `'unresolved'` |
| `conflict_reason` | `text` | | | `ConflictReasonCode`; NULL when no conflict |
| `hold_reason` | `text` | | | `HoldReasonCode`; NULL unless held |
| `source_evidence` | `jsonb` | ✓ | | `list<SourceEvidenceRef>` |
| `content_version` | `text` | ✓ | | |
| `normalizer_version` | `text` | ✓ | | |
| `registry_version` | `text` | ✓ | | Always non-null |
| `checked_at` | `timestamptz` | ✓ | | |
| `review_state` | `text` | ✓ | | CHECK: `'unreviewed'`, `'approved'`, `'rejected'`, `'needs_more_evidence'` |
| `reviewed_at` | `timestamptz` | | | |

**Primary key:** `id`

**Foreign keys:** `scenario_id` → `scenario.id`; `system_family_id` → `system_family.id`; `edition_id` → `edition.id`

**Application-enforced invariants (DATA_MODEL.md Section 6.4 constraints):**
- `resolution_state='resolved'`: `system_family_id` non-null; if `edition_id` non-null it must belong to the referenced family.
- `edition_state='edition_known'` iff `edition_id` non-null.
- `edition_state='edition_unknown'` iff `resolution_state='resolved'` and `edition_id` null.
- `edition_state='target_unresolved'` iff `resolution_state='target_unresolved'`; both FKs null.

**Indexes:**
- B-tree: `scenario_id`
- B-tree: `review_state`
- B-tree: `system_family_id` WHERE `system_family_id IS NOT NULL`

---

### 2.11 `compatibility_claim`

**Maps to:** `compatibility_claim` entity in DATA_MODEL.md Section 6.5.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | Primary key |
| `scenario_id` | `uuid` | ✓ | | FK → `scenario.id` |
| `original_source_text` | `text` | ✓ | | Verbatim compatibility claim; never altered |
| `relationship_kind` | `text` | ✓ | | `CompatibilityRelationshipKind`; CHECK: `'native'`, `'explicitly_compatible'`, `'conversion_provided'`, `'dual_or_multi_edition'`, `'derived_candidate'`, `'unknown'` |
| `resolution_state` | `text` | ✓ | | CHECK: `'resolved'`, `'target_unresolved'` |
| `system_family_id` | `uuid` | | | FK → `system_family.id` |
| `edition_id` | `uuid` | | | FK → `edition.id` |
| `edition_state` | `text` | ✓ | | CHECK: `'edition_known'`, `'edition_unknown'`, `'target_unresolved'` |
| `confidence` | `text` | ✓ | | CHECK: `'high'`, `'medium'`, `'low'`, `'unresolved'` |
| `conflict_reason` | `text` | | | |
| `hold_reason` | `text` | | | |
| `source_evidence` | `jsonb` | ✓ | | `list<SourceEvidenceRef>` |
| `content_version` | `text` | ✓ | | |
| `normalizer_version` | `text` | ✓ | | |
| `registry_version` | `text` | ✓ | | Always non-null |
| `checked_at` | `timestamptz` | ✓ | | |
| `review_state` | `text` | ✓ | | CHECK: `'unreviewed'`, `'approved'`, `'rejected'`, `'needs_more_evidence'` |
| `reviewed_at` | `timestamptz` | | | |

**Primary key:** `id`

**Foreign keys:** `scenario_id` → `scenario.id`; `system_family_id` → `system_family.id`; `edition_id` → `edition.id`

**Application-enforced invariants:** same edition-state/reference constraints as `ruleset_reference` (DATA_MODEL.md Section 6.5). `derived_candidate` relationship requires `review_state='approved'` before any public display.

**Indexes:**
- B-tree: `scenario_id`
- B-tree: `review_state`

---

### 2.12 `book`

**Maps to:** `book` entity in DATA_MODEL.md Section 6.6. Registry table.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | ImmutableID; primary key; never deleted |
| `book_kind` | `text` | ✓ | | `BookKindCode` per SYSTEM_NORMALIZATION.md Section 6.2 |
| `system_family_id` | `uuid` | | | FK → `system_family.id`; NULL when not associated with a specific family |
| `display_label_ja` | `text` | ✓ | | |
| `display_label_en` | `text` | | | |
| `redirect_to` | `uuid` | | | Self-referential FK → `book.id`; NULL for active entities |
| `deprecated_at` | `timestamptz` | | | |
| `deprecation_reason` | `text` | | | |
| `created_at` | `timestamptz` | ✓ | | |
| `registry_version_added` | `text` | ✓ | | |

**Primary key:** `id`

**Foreign keys:** `system_family_id` → `system_family.id`; `redirect_to` → `book.id`

**Indexes:**
- B-tree: `system_family_id` WHERE `system_family_id IS NOT NULL`

---

### 2.13 `book_requirement`

**Maps to:** `book_requirement` entity in DATA_MODEL.md Section 6.7.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | Primary key |
| `scenario_id` | `uuid` | ✓ | | FK → `scenario.id` |
| `observed_title_text` | `text` | ✓ | | Exact observed title text verbatim; never altered |
| `book_id` | `uuid` | | | FK → `book.id`; non-null only when `book_identity_state='resolved'` |
| `book_identity_state` | `text` | ✓ | | CHECK: `'resolved'`, `'hold_book_conflict'`, `'unresolved'` |
| `requirement_kind` | `jsonb` | ✓ | | `EvidencedValue<RequirementKindCode>` |
| `group_id` | `text` | | | Non-null only when `requirement_kind.value='required_one_of'`; identifies the mutual-exclusion group |
| `conflict_status` | `text` | ✓ | | CHECK: `'clear'`, `'hold_book_conflict'` |
| `source_evidence` | `jsonb` | ✓ | | `list<SourceEvidenceRef>` |
| `content_version` | `text` | ✓ | | |
| `normalizer_version` | `text` | ✓ | | |
| `registry_version` | `text` | ✓ | | Always non-null |
| `checked_at` | `timestamptz` | ✓ | | |
| `review_state` | `text` | ✓ | | CHECK: `'unreviewed'`, `'approved'`, `'rejected'`, `'needs_more_evidence'` |
| `reviewed_at` | `timestamptz` | | | |

**Primary key:** `id`

**Foreign keys:** `scenario_id` → `scenario.id`; `book_id` → `book.id`

**Application-enforced invariants:**
- `book_identity_state='resolved'` iff `book_id` non-null.
- `book_identity_state ∈ {'hold_book_conflict', 'unresolved'}`: `book_id` must be null.
- `required_one_of` groups must have at least two members sharing the same (`scenario_id`, `group_id`) combination with `requirement_kind.value='required_one_of'`.

**Indexes:**
- B-tree: `scenario_id`
- B-tree: `review_state`
- B-tree: `group_id` WHERE `group_id IS NOT NULL`

---

### 2.14 `tag`

**Maps to:** `tag` entity in DATA_MODEL.md Section 7.1. Registry table; catalogue starts empty.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | ImmutableID; primary key |
| `category` | `text` | ✓ | | `TagCategoryCode`; CHECK: `'theme'`, `'tone'`, `'content_warning'`, `'mechanic'`, `'setting'` |
| `canonical_name` | `text` | ✓ | | Machine-safe canonical name; unique within `category` |
| `display_label_ja` | `text` | ✓ | | |
| `display_label_en` | `text` | | | |
| `provenance` | `text` | ✓ | `'controlled'` | Fixed to `'controlled'`; all canonical tags are human-reviewed |
| `created_at` | `timestamptz` | ✓ | | |
| `registry_version_added` | `text` | ✓ | | |

**Primary key:** `id`

**Unique constraint:** `(category, canonical_name)` — unique within category

**Indexes:**
- B-tree: `category`

---

### 2.15 `scenario_tag`

**Maps to:** `scenario_tag` entity in DATA_MODEL.md Section 7.2.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | Primary key |
| `scenario_id` | `uuid` | ✓ | | FK → `scenario.id` |
| `tag_id` | `uuid` | ✓ | | FK → `tag.id` |
| `provenance` | `text` | ✓ | | CHECK: `'source'`, `'derived'` |
| `source_wording_observed` | `text` | | | Non-null only when `provenance='source'`; NULL when `provenance='derived'` |
| `source_evidence` | `jsonb` | ✓ | | `list<SourceEvidenceRef>`; non-empty when `provenance='derived'` |
| `confidence` | `text` | | | `'high'|'medium'|'low'|'unresolved'`; required when `provenance='derived'` |
| `conflict_state` | `text` | ✓ | | CHECK: `'clear'`, `'hold_alias_conflict'`, `'hold_conflicting_field_evidence'` |
| `hold_reason` | `text` | | | `HoldReasonCode`; NULL unless held |
| `review_state` | `text` | ✓ | | CHECK: `'unreviewed'`, `'approved'`, `'rejected'`, `'needs_more_evidence'` |
| `is_ai_derived` | `boolean` | ✓ | | `true` when any source evidence has `extraction_method='ai_candidate'` |
| `spoiler_suspect` | `boolean` | ✓ | | When `true`: excluded from all public publication without exception |
| `content_version` | `text` | | | Required when `provenance='derived'`; NULL allowed when `provenance='source'` and no normalization key is tracked |
| `classifier_version` | `text` | | | NULL unless `provenance='derived'` |
| `registry_version` | `text` | | | Non-null when `provenance='derived'`; explicit empty/minimal version identifier when registry is empty (e.g., `'registry_empty_v0'`); may be NULL for source provenance |
| `prompt_template_version` | `text` | | | NULL unless AI-derived |
| `model_id` | `text` | | | NULL unless AI-derived |
| `checked_at` | `timestamptz` | ✓ | | |
| `reviewed_at` | `timestamptz` | | | NULL when unreviewed |

**Primary key:** `id`

**Foreign keys:** `scenario_id` → `scenario.id`; `tag_id` → `tag.id`

**Application-enforced invariants:**
- `spoiler_suspect=true` tags are never published regardless of `review_state`.
- `is_ai_derived=true` tags require `review_state='approved'` before publication.
- For derived tags, the reanalysis key is the three-tuple (`content_version`, `classifier_version`, `registry_version`); all three must be non-null for derived tags.
- `registry_version` is non-null for all derived tags; explicit empty/minimal version when registry is empty.

**Indexes:**
- B-tree: `scenario_id`
- B-tree: `tag_id`
- Partial B-tree: `(scenario_id, tag_id)` WHERE `spoiler_suspect = false` AND `conflict_state = 'clear'` — publication gate
- B-tree: `review_state`
- B-tree: `is_ai_derived` WHERE `is_ai_derived = true` — AI review queue

---

### 2.16 `source_snapshot`

**Maps to:** `source_snapshot` entity in DATA_MODEL.md Section 8.1. **Append-only**: no UPDATE or DELETE on permitted records.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | ImmutableID; primary key |
| `source_url` | `text` | ✓ | | URL of the source page accessed |
| `checked_at` | `timestamptz` | ✓ | | When this access occurred |
| `response_status` | `text` | ✓ | | HTTP status code or access outcome string |
| `content_version` | `text` | ✓ | | Hash or version of page content at this access; non-body-derived for hold_age_unknown products |
| `extraction_method_summary` | `text` | ✓ | | Summary of how data was extracted |

**Primary key:** `id`

**Append-only rule:** No UPDATE or DELETE operations on this table. Records are immutable once written. Hold_age_unknown products must not have body-content excerpts stored in related records; `content_version` must be non-body-derived.

**Indexes:**
- B-tree: `source_url` — deduplication and lookup
- B-tree: `checked_at`

---

### 2.17 `normalization_history`

**Maps to:** `normalization_history` entity in DATA_MODEL.md Section 8.2. **Append-only**: no UPDATE or DELETE on any row.

| Column | Type | Not Null | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | ImmutableID; primary key |
| `target_type` | `text` | ✓ | | Entity type of the normalized record; e.g., `'ruleset_reference'`, `'compatibility_claim'`, `'book_requirement'`, `'scenario_tag'`, `'observed_alias'`, `'booth_product'` |
| `target_id` | `uuid` | ✓ | | ID of the affected record |
| `reanalysis_trigger` | `text` | ✓ | | Extended `ReanalysisTriggerCode`; includes `'hold_age_unknown_redaction'` for tombstone rows |
| `content_version_old` | `text` | ✓ | | Content version before reanalysis; non-null |
| `content_version_new` | `text` | ✓ | | Content version at reanalysis; non-null |
| `normalizer_version_old` | `text` | ✓ | | Normalizer version before reanalysis; non-null |
| `normalizer_version_new` | `text` | ✓ | | Normalizer version at reanalysis; non-null |
| `registry_version_old` | `text` | ✓ | | Registry version before reanalysis; non-null |
| `registry_version_new` | `text` | ✓ | | Registry version at reanalysis; non-null |
| `old_result_snapshot` | `jsonb` | ✓ | | Full snapshot of normalized field values before reanalysis; discriminated by `target_type` |
| `new_result_snapshot` | `jsonb` | ✓ | | Full snapshot of normalized field values after reanalysis; for tombstone rows: contains tombstone metadata (categories purged, actor, timestamps) without reproducing prohibited payloads |
| `changed_at` | `timestamptz` | ✓ | | When reanalysis occurred |
| `reason_detail` | `text` | | | Additional detail; required for `hold_age_unknown_redaction` rows to document categories of purged content (without reproducing prohibited payload) |

**Primary key:** `id`

**Append-only rule:** No UPDATE or DELETE operations on this table. Tombstone rows written by `HoldAgeUnknownPurgeService` are themselves immutable once written.

**Non-null version constraint:** All six version fields (`content_version_old`, `content_version_new`, `normalizer_version_old`, `normalizer_version_new`, `registry_version_old`, `registry_version_new`) are `NOT NULL`. This is enforced by the `NOT NULL` column constraint.

**Tombstone row structure (`reanalysis_trigger = 'hold_age_unknown_redaction'`):**
- `target_type = 'booth_product'`
- `target_id = <booth_product.id>`
- `old_result_snapshot`: contains only permitted minimal non-descriptive identifiers (id, source_product_id, canonical_url, timestamps); must not contain any prohibited payload.
- `new_result_snapshot`: tombstone metadata JSON recording: transition timestamp, `hold_reason='hold_age_unknown'`, categories of content purged (without reproducing any prohibited payload), actor or automated process identifier, confirmation of purge completion, non-body-derived `content_version` identifier; no observed titles, creator text, descriptions, body excerpts, body-derived hashes, or canonical values derived from prohibited content.
- Both version fields (`_old` and `_new`) carry the content version values from the entity at the time of the transition.

**Indexes:**
- Composite B-tree: `(target_type, target_id)` — history lookup by entity
- B-tree: `changed_at` — chronological queries

---

## 3. Content-Version and Normalization-History Representation

The three-part reanalysis key (`content_version`, `normalizer_version`, `registry_version`) on each normalized entity determines whether reanalysis is skipped or triggered:

- Reanalysis is **skipped** only when all three are unchanged since the last analysis.
- A change to any one — including a `registry_version` change that has not yet been evaluated — triggers a new `normalization_history` entry.
- The reanalysis key fields are always non-null on normalized entities (`observed_alias`, `ruleset_reference`, `compatibility_claim`, `book_requirement`, `scenario_tag`). Initial analysis sets them to the versions in effect at that time; the `_old` fields of the resulting `normalization_history` row are populated from those initial values.

**Content version for `hold_age_unknown` products:**
- All body-derived content hashes are prohibited when `hold_age_unknown` is active.
- `content_version` for such products must use a non-body-derived format: `'access_outcome:<status_code>'` (e.g., `'access_outcome:200'`, `'access_outcome:404'`).
- This applies to the `booth_product.content_version` column and to `source_snapshot.content_version` for snapshots of such products.

---

## 4. Index Strategy for Confirmed Search, Filter, and Sort Inputs

The following indexes support the confirmed `searchable_scenario` projection and public sort inputs. Expression indexes on JSONB fields are noted where the JSONB column contains the relevant value.

| Purpose | Table | Index type | Columns / Expression |
|---|---|---|---|
| Product uniqueness | `booth_product` | UNIQUE B-tree | `source_product_id` |
| All-ages gate | `booth_product` | B-tree expression | `(all_ages_state->>'state')` |
| Last-checked sort | `booth_product` | B-tree | `last_checked_at` |
| New sort | `booth_product` | B-tree | `first_seen_at` |
| Free-first sort | `booth_product` | Partial B-tree expression | `((is_free->>'value')::boolean)` WHERE `(is_free->>'state') = 'known'` |
| Scenario FK lookup | `scenario` | B-tree | `booth_product_id` |
| Separation gate | `scenario` | B-tree | `separation_state` |
| Publishable scenarios (composite) | `scenario` | Partial B-tree | `booth_product_id` WHERE `separation_state IN ('single_scenario', 'separated')` |
| Min PL filter | `scenario` | Partial B-tree expression | `((min_pl->>'value')::integer)` WHERE `(min_pl->>'state') = 'known'` |
| Max PL filter | `scenario` | Partial B-tree expression | `((max_pl->>'value')::integer)` WHERE `(max_pl->>'state') = 'known'` |
| Title sort | `scenario` | Partial B-tree expression | `(observed_title->>'value')` WHERE `(observed_title->>'state') = 'known'` |
| Play time lookup | `scenario_play_time` | B-tree | `scenario_id` |
| Modality lookup | `scenario_play_time` | Composite B-tree | `(scenario_id, modality)` |
| Conversation method lookup | `scenario_conversation_method` | B-tree | `scenario_id` |
| Play environment lookup | `scenario_play_environment` | B-tree | `scenario_id` |
| Tag publication gate | `scenario_tag` | Partial B-tree | `scenario_id` WHERE `spoiler_suspect = false AND conflict_state = 'clear'` |
| Tag lookup | `scenario_tag` | B-tree | `tag_id` |
| Alias matching | `observed_alias` | B-tree | `comparison_key` |
| Alias review queue | `observed_alias` | B-tree | `review_state` |
| History lookup | `normalization_history` | Composite B-tree | `(target_type, target_id)` |
| History chronology | `normalization_history` | B-tree | `changed_at` |
| Snapshot dedup | `source_snapshot` | B-tree | `source_url` |

---

## 5. Append-Only, Redaction, and Tombstone Rules

### 5.1 Append-Only Tables

`source_snapshot` and `normalization_history` are append-only for permitted records. Application code must not issue UPDATE or DELETE statements against these tables for permitted content rows.

### 5.2 hold_age_unknown Purge and Tombstone

When `HoldAgeUnknownPurgeService` executes a `hold_age_unknown` transition:

1. **Delete or null prohibited columns** in `booth_product`: set `observed_title`, `creator_observed_name`, `creator_source_url`, `classification`, `sales_state`, `is_free` to NULL; set `content_version` to the appropriate `access_outcome:*` form.
2. **Delete linked prohibited records**: delete all `product_component` rows for the product; delete all `scenario` rows and their child rows (`scenario_play_time`, `scenario_conversation_method`, `scenario_play_environment`, `ruleset_reference`, `compatibility_claim`, `book_requirement`, `scenario_tag`) for the product.
3. **Delete or null source snapshot content**: for `source_snapshot` records associated with the product (via `source_evidence` references in the purged rows), body-content excerpts and body-derived hashes must not be retained; the snapshot record itself may be retained with a non-body-derived `content_version`.
4. **Append tombstone row** to `normalization_history` with `reanalysis_trigger='hold_age_unknown_redaction'`, structured as described in Section 2.17. This row is itself immutable once written.

The append-only rule applies to permitted audit records only and does not prevent the deletion of prohibited payload records (D-026).

### 5.3 Hold Resolution

When a `booth_product` transitions from `hold_age_unknown` to `all_ages_confirmed`:
- A fresh source observation is required; prior body content is not reconstructed from history or cache.
- Permitted fields may be populated from the new fresh observation.
- The transition is recorded in `normalization_history` with `reanalysis_trigger='content_changed'` or `'manual_trigger'`.

---

## 6. Seeded-Random Strategy Boundary

Decision D-036 establishes the seeded-random sort boundary only. No implementation is created in Stage 4.

**Boundary:**
- The random seed is computed server-side as a deterministic function of the current date and an optional per-session token (anonymous users use date only; no server-side session state is required to be stored).
- The sort order for a given seed is deterministic: the same seed produces the same ordering for the same set of scenario IDs.
- No dedicated column or index is added to the schema for seeded random; the sort is computed at query time using the seed.
- The specific algorithm (e.g., hash-based shuffle) is deferred to the seeded-random implementation stage.

---

## 7. Mapping to DATA_MODEL.md

| Physical table | DATA_MODEL.md entity | Section |
|---|---|---|
| `booth_product` | `booth_product` | Section 3 |
| `scenario` | `scenario` | Section 4 |
| `scenario_play_time` | `scenario_play_time` | Section 4.3 |
| `scenario_conversation_method` | `scenario_conversation_method` | Section 4.4 |
| `scenario_play_environment` | `scenario_play_environment` | Section 4.4 |
| `product_component` | `product_component` | Section 5 |
| `system_family` | `system_family` | Section 6.1 |
| `edition` | `edition` | Section 6.2 |
| `observed_alias` | `observed_alias` | Section 6.3 |
| `ruleset_reference` | `ruleset_reference` | Section 6.4 |
| `compatibility_claim` | `compatibility_claim` | Section 6.5 |
| `book` | `book` | Section 6.6 |
| `book_requirement` | `book_requirement` | Section 6.7 |
| `tag` | `tag` | Section 7.1 |
| `scenario_tag` | `scenario_tag` | Section 7.2 |
| `source_snapshot` | `source_snapshot` | Section 8.1 |
| `normalization_history` | `normalization_history` (extended) | Section 8.2 |

**New field `booth_product.is_free` (EvidencedValue\<boolean\>):** Added in Stage 4 to resolve PD-009 (free-first sort without exact price storage). Derived from observed price indicators in BOOTH source data (e.g., ¥0 or 「無料」 label) without storing the exact price. This is a physical addition not present in DATA_MODEL.md as a named field; it implements the confirmed `free-first` sort requirement from PRODUCT_REQUIREMENTS.md within the `EvidencedValue<T>` state contract defined in DATA_MODEL.md Section 2.

**EvidencedValue\<T\>:** All logical `EvidencedValue<T>` fields are encoded as `jsonb NOT NULL` columns per Section 2 of this document. The JSONB structure is the authoritative representation; no null/default inference is used for any state.

**`ReanalysisTriggerCode` extension:** `hold_age_unknown_redaction` is added for tombstone rows in `normalization_history`. This extends but does not change the logical vocabulary; existing trigger codes are unchanged.

**Unknown states:** Fields with `state='unknown'` are represented by an EvidencedValue JSONB document with `"state":"unknown"` and no `"value"` key. These are never stored as NULL, 0, false, or empty string in the database.

**Hold states:** Fields with `state='hold'` are represented by an EvidencedValue JSONB document with `"state":"hold"` and the required `hold_reason` key. These are never published in public search results.

**`not_applicable` state:** Represented by `"state":"not_applicable"` with no `"value"` key. Semantically distinct from `"unknown"` (structural absence vs. evidence absence).
