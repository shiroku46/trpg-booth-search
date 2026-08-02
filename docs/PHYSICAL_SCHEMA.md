# Physical Schema

## Status

Non-executable, implementation-ready specification. Translates the logical data model in `DATA_MODEL.md` into provider-specific PostgreSQL column types, constraints, indexes, append-only invariants, and redaction/tombstone structures. No SQL migration, generated code, ORM mapping file, or database connection is created in this document.

Database target: PostgreSQL 17 (managed via Supabase Free; provisioning deferred to a later dedicated Issue per D-029).
ORM and migration tooling: Drizzle ORM + Drizzle Kit (Apache-2.0; exact package versions pinned at scaffold time).

Cross-links: [DATA_MODEL.md](DATA_MODEL.md) | [ARCHITECTURE.md](ARCHITECTURE.md) | [DECISIONS.md](DECISIONS.md)

Governing decisions: D-029, D-030, D-035, D-036, D-039, and all Stage 3 decisions (D-022–D-026).

---

## 1. Conventions

### 1.1 Type Map

| Logical Type | Physical Type | Notes |
|---|---|---|
| `ImmutableID` | `UUID` | Generated with `gen_random_uuid()` at insert; never changed post-insert |
| `Timestamp` | `TIMESTAMPTZ` | UTC preferred; non-null unless the logical model marks the field optional |
| `Duration` (minutes) | `INTEGER` | Non-negative; present inside EvidencedValue JSONB only when state = known |
| `string` | `TEXT` | Never empty string in place of NULL for meaningful fields |
| `URL` | `TEXT` | Validated at application layer |
| `Boolean` | `BOOLEAN` | Inside EvidencedValue JSONB only when state = known |
| `PositiveInteger` | `INTEGER` | CHECK ≥ 1 enforced when value is present in EvidencedValue JSONB |
| Enum codes | `TEXT` | CHECK constraint enumerates allowed values |
| `EvidencedValue<T>` | `JSONB NOT NULL` | See Section 2; never SQL NULL |

All table names: `snake_case`. All column names: `snake_case`. Schema: `public`.

### 1.2 Primary Keys

Every table uses a single `UUID PRIMARY KEY` column named `id`. Assigned at insert time by `gen_random_uuid()`. Never reused, reassigned, or changed after creation.

### 1.3 Foreign Keys

All foreign key references are explicit and enforce referential integrity. Default ON DELETE behavior is RESTRICT unless noted. FK constraint names follow `{table}_{column}_fkey`.

---

## 2. EvidencedValue\<T\> Physical Representation

Every `EvidencedValue<T>` field from the logical model is stored as a single `JSONB NOT NULL` column. SQL NULL is prohibited for the column itself; absence of a known value is encoded as a JSON object with `state: "unknown"`, not as SQL NULL. This enforces D-023: `EvidencedValue<T>` never uses ambiguous null/default inference.

### 2.1 Required JSONB Structure

```
{
  "state":            "known" | "unknown" | "hold" | "not_applicable",  // required; always present
  "value":            <T>,                        // present ONLY when state = "known"; absent otherwise
  "confidence":       "high" | "medium" | "low" | "unresolved",        // required; always present
  "hold_reason":      "<HoldReasonCode>",         // present ONLY when state = "hold"; absent otherwise
  "conflict_reason":  "<ConflictReasonCode>" | null,  // optional
  "source_evidence":  [ ... SourceEvidenceRef ],  // required array; non-empty when state = "known"
  "review_state":     "unreviewed" | "approved" | "rejected" | "needs_more_evidence",  // required
  "content_version":  "<string>",                 // required; non-null
  "normalizer_version": "<string>" | null,        // required when normalization applies
  "registry_version": "<string>" | null,          // required when canonical resolution applies
  "checked_at":       "<ISO8601 UTC string>",     // required; TIMESTAMPTZ value as string
  "reviewed_at":      "<ISO8601 UTC string>" | null  // optional
}
```

**State invariants:**

| State | `value` | `hold_reason` | `source_evidence` |
|---|---|---|---|
| `known` | Present and valid | Absent | Non-empty |
| `unknown` | Absent | Absent | May be empty |
| `hold` | Absent | Present | May be non-empty |
| `not_applicable` | Absent | Absent | May be empty |

**PostgreSQL CHECK constraint pattern** (applied to each EvidencedValue column `ev`):
```
CHECK ((ev->>'state') IN ('known','unknown','hold','not_applicable'))
```

The state-to-value and state-to-hold_reason invariants are additionally enforced at the application layer before every insert and update.

### 2.2 SourceEvidenceRef Elements

Each element of the `source_evidence` JSON array has the structure:

```
{
  "source_snapshot_id":       "<UUID>",          // required; references source_snapshot.id
  "evidence_type":            "<EvidenceTypeCode>",  // required
  "evidence_pointer":         "<string>",         // required; non-spoiler location pointer
  "extraction_method":        "explicit_source" | "approved_alias" | "deterministic_rule" | "ai_candidate",
  "model_id":                 "<string>" | null,  // only when ai_candidate
  "prompt_template_version":  "<string>" | null,  // only when ai_candidate
  "generation_date":          "<ISO8601>" | null  // only when ai_candidate
}
```

Referential integrity for `source_snapshot_id` is enforced at the application layer (not via a PostgreSQL FK on a JSONB array element).

### 2.3 `all_ages_state` Special Contract

For `booth_product.all_ages_state`, only two JSONB state values are permitted. The generic `"unknown"` and `"not_applicable"` states are prohibited for this column.

```
CHECK ((all_ages_state->>'state') IN ('known','hold'))
CHECK (
  (all_ages_state->>'state') <> 'known'
  OR (all_ages_state->>'value') = 'all_ages_confirmed'
)
CHECK (
  (all_ages_state->>'state') <> 'hold'
  OR (all_ages_state->>'hold_reason') = 'hold_age_unknown'
)
```

---

## 3. Physical Table Specifications

### 3.1 `booth_product`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | `gen_random_uuid()` at insert |
| `source_platform` | TEXT | NOT NULL, CHECK (`source_platform` = `'booth'`) | Fixed for MVP |
| `source_product_id` | TEXT | NOT NULL, UNIQUE | BOOTH numeric item ID; uniqueness key |
| `canonical_url` | TEXT | NOT NULL | Derived from source_product_id; not user-supplied |
| `all_ages_state` | JSONB | NOT NULL | EvidencedValue<AllAgesStateCode>; restricted to known/hold; see Section 2.3 |
| `observed_title` | TEXT | NULL | Must be NULL when `(all_ages_state->>'state') = 'hold'` |
| `creator_observed_name` | TEXT | NULL | Must be NULL when hold_age_unknown |
| `creator_source_url` | TEXT | NULL | Must be NULL when hold_age_unknown |
| `classification` | JSONB | NULL | EvidencedValue<ProductClassCode>; NULL when hold_age_unknown; see classification invariants below |
| `sales_state` | TEXT | NULL, CHECK (`sales_state` IN (`'available'`,`'sold_out'`,`'sales_ended'`,`'disappeared'`,`'unknown'`)) | NULL when hold_age_unknown |
| `discovery_method` | TEXT | NOT NULL | e.g., `'keyword'`, `'category'`, `'tag'`, `'new_item'`, `'direct'` |
| `first_seen_at` | TIMESTAMPTZ | NOT NULL | Record creation timestamp |
| `last_checked_at` | TIMESTAMPTZ | NOT NULL | Most recent source access timestamp |
| `content_version` | TEXT | NOT NULL | Body-derived hash when all_ages_confirmed; `access_outcome:<code>` form when hold_age_unknown |
| `is_free` | JSONB | NULL | EvidencedValue<Boolean>; NULL = not yet collected; see Section 8 |
| `current_record_updated_at` | TIMESTAMPTZ | NOT NULL | Updated on every record change |

**hold_age_unknown multi-column constraint:**
```
CHECK (
  (all_ages_state->>'state') <> 'hold'
  OR (
    observed_title IS NULL
    AND creator_observed_name IS NULL
    AND creator_source_url IS NULL
    AND classification IS NULL
    AND sales_state IS NULL
  )
)
```

**classification version invariants (DATA_MODEL.md Section 3.6):** When `classification` is NOT NULL, the JSONB must contain non-null `content_version`, `normalizer_version`, and `registry_version`. `normalizer_version` uses the sentinel string `deterministic_v<N>` or `manual_v<N>` when no automated classifier applies. `registry_version` uses `registry_not_consulted_v<N>` when classification does not consult the canonical registry. Enforced at application layer before every insert and update.

---

### 3.2 `scenario`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | |
| `booth_product_id` | UUID | NOT NULL, FK → `booth_product(id)` | Exactly one parent product for MVP |
| `observed_title` | JSONB | NOT NULL | EvidencedValue<string>; state ∈ {known, unknown, hold} |
| `separation_state` | TEXT | NOT NULL, CHECK (IN (`'single_scenario'`,`'separated'`,`'unseparated'`,`'ambiguous'`)) | |
| `work_composition` | JSONB | NOT NULL | EvidencedValue<WorkCompositionCode> |
| `min_pl` | JSONB | NOT NULL | EvidencedValue<PositiveInteger>; value ≥ 1 when state = known |
| `max_pl` | JSONB | NOT NULL | EvidencedValue<PositiveInteger>; value ≥ min_pl.value when both known (app layer) |
| `gm_kp_required` | JSONB | NOT NULL | EvidencedValue<Boolean> |
| `gm_less` | JSONB | NOT NULL | EvidencedValue<Boolean> |
| `kpc_present` | JSONB | NOT NULL | EvidencedValue<Boolean> |
| `progression_method` | JSONB | NOT NULL | EvidencedValue<ProgressionMethodCode> |
| `handout_structure` | JSONB | NOT NULL | EvidencedValue<HandoutStructureCode> |
| `first_seen_at` | TIMESTAMPTZ | NOT NULL | |
| `last_checked_at` | TIMESTAMPTZ | NOT NULL | |
| `content_version` | TEXT | NOT NULL | |
| `current_record_updated_at` | TIMESTAMPTZ | NOT NULL | |

**EvidencedValue state CHECK** (one per column):
```
CHECK ((observed_title->>'state') IN ('known','unknown','hold'))
CHECK ((work_composition->>'state') IN ('known','unknown','hold','not_applicable'))
-- (same pattern for all EvidencedValue columns)
```

---

### 3.3 `scenario_play_time`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | |
| `scenario_id` | UUID | NOT NULL, FK → `scenario(id)` | |
| `modality` | TEXT | NOT NULL, CHECK (IN (`'online'`,`'offline'`,`'conversation_mode'`,`'general'`)) | |
| `collection_state` | TEXT | NOT NULL, CHECK (IN (`'observed'`,`'checked_unknown'`,`'not_collected'`,`'not_applicable'`)) | |
| `min_duration` | JSONB | NOT NULL | EvidencedValue<Duration (INTEGER minutes)> |
| `max_duration` | JSONB | NOT NULL | EvidencedValue<Duration (INTEGER minutes)> |

**Uniqueness:** `UNIQUE (scenario_id, modality)` — one row per modality per scenario.

**Collection-state constraints (application layer):**
- `observed`: at least one of min_duration or max_duration has state = known.
- `checked_unknown` or `not_collected`: both min_duration.state = unknown and max_duration.state = unknown.
- `not_applicable`: both min_duration.state = not_applicable and max_duration.state = not_applicable.

---

### 3.4 `scenario_conversation_method`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | |
| `scenario_id` | UUID | NOT NULL, FK → `scenario(id)` | |
| `method` | JSONB | NOT NULL | EvidencedValue<ConversationMethodCode>; value ∈ {`'text'`,`'voice'`,`'video'`} when known |

---

### 3.5 `scenario_play_environment`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | |
| `scenario_id` | UUID | NOT NULL, FK → `scenario(id)` | |
| `environment` | JSONB | NOT NULL | EvidencedValue<PlayEnvironmentCode>; value ∈ {`'online'`,`'offline'`,`'vr'`} when known |

---

### 3.6 `product_component`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | |
| `booth_product_id` | UUID | NOT NULL, FK → `booth_product(id)` | |
| `observed_component_wording` | TEXT | NOT NULL | Verbatim observed label text; never altered |
| `component_classification` | JSONB | NOT NULL | EvidencedValue<ComponentClassCode> |
| `scenario_id` | UUID | NULL, FK → `scenario(id)` | NULL when not a linked playable scenario |
| `source_evidence` | JSONB | NOT NULL | JSON array of SourceEvidenceRef |

**Uniqueness:** At most one `product_component` may link to the same `scenario_id` per `booth_product_id` where `scenario_id IS NOT NULL`. Enforced at application layer.

---

### 3.7 `system_family`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | Created only through reviewed registry addition |
| `display_label_ja` | TEXT | NOT NULL | Japanese canonical display label |
| `display_label_en` | TEXT | NULL | English label when available |
| `redirect_to` | UUID | NULL, FK → `system_family(id)` | Non-null when deprecated; NULL for active entities |
| `deprecated_at` | TIMESTAMPTZ | NULL | NULL for active entities |
| `deprecation_reason` | TEXT | NULL | NULL when active |
| `created_at` | TIMESTAMPTZ | NOT NULL | When added to registry |
| `registry_version_added` | TEXT | NOT NULL | Registry version at which this entity was added |

**Redirect chain invariant:** Finite and acyclic redirect chains only. Enforced at application layer on every insert of a `redirect_to` value.

---

### 3.8 `edition`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | Created only through reviewed registry addition |
| `system_family_id` | UUID | NOT NULL, FK → `system_family(id)` | Must reference a non-deprecated family |
| `display_label_ja` | TEXT | NOT NULL | |
| `display_label_en` | TEXT | NULL | |
| `redirect_to` | UUID | NULL, FK → `edition(id)` | Non-null when deprecated |
| `deprecated_at` | TIMESTAMPTZ | NULL | |
| `deprecation_reason` | TEXT | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `registry_version_added` | TEXT | NOT NULL | |

---

### 3.9 `observed_alias`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | |
| `original_source_text` | TEXT | NOT NULL | Verbatim source text; never altered |
| `comparison_key` | TEXT | NOT NULL | Normalized form from pipeline |
| `alias_kind` | TEXT | NOT NULL | AliasKindCode per SYSTEM_NORMALIZATION.md Section 3.3 |
| `target_entity_type` | TEXT | NOT NULL, CHECK (IN (`'system_family'`,`'edition'`,`'book'`)) | |
| `candidate_id` | UUID | NULL | Candidate canonical entity ID; NULL when unresolved |
| `source_url` | TEXT | NOT NULL | Source URL or source-record identifier |
| `evidence_type` | TEXT | NOT NULL | EvidenceTypeCode |
| `evidence_pointer` | TEXT | NOT NULL | Non-spoiler location pointer |
| `extraction_method` | TEXT | NOT NULL, CHECK (IN (`'explicit_source'`,`'approved_alias'`,`'deterministic_rule'`,`'ai_candidate'`)) | |
| `confidence` | TEXT | NOT NULL, CHECK (IN (`'high'`,`'medium'`,`'low'`,`'unresolved'`)) | |
| `conflict_status` | TEXT | NOT NULL, CHECK (IN (`'clear'`,`'hold_alias_conflict'`)) | |
| `hold_reason` | TEXT | NULL | Present when normalization is held |
| `first_observed` | TIMESTAMPTZ | NOT NULL | |
| `last_observed` | TIMESTAMPTZ | NOT NULL | |
| `checked_at` | TIMESTAMPTZ | NOT NULL | |
| `reviewed_at` | TIMESTAMPTZ | NULL | |
| `content_version` | TEXT | NOT NULL | Non-null; required for stale-result detection |
| `normalizer_version` | TEXT | NOT NULL | Non-null |
| `registry_version` | TEXT | NOT NULL | **Always non-null.** Use `registry_empty_v0` or `registry_not_consulted_v<N>` sentinel when no entries exist |
| `review_state` | TEXT | NOT NULL, CHECK (IN (`'unreviewed'`,`'approved'`,`'rejected'`,`'needs_more_evidence'`)) | |
| `model_id` | TEXT | NULL | Only when extraction_method = ai_candidate |
| `prompt_template_version` | TEXT | NULL | Only when ai_candidate |
| `generation_date` | TIMESTAMPTZ | NULL | Only when ai_candidate |

**`registry_version` non-null invariant:** Enforced by `TEXT NOT NULL` column constraint. Use an explicit non-null sentinel string (e.g., `registry_empty_v0`) when no registry entries exist.

---

### 3.10 `ruleset_reference`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | |
| `scenario_id` | UUID | NOT NULL, FK → `scenario(id)` | |
| `original_source_text` | TEXT | NOT NULL | Verbatim system/edition claim from source |
| `resolution_state` | TEXT | NOT NULL, CHECK (IN (`'resolved'`,`'target_unresolved'`)) | |
| `system_family_id` | UUID | NULL, FK → `system_family(id)` | Non-null only when resolved |
| `edition_id` | UUID | NULL, FK → `edition(id)` | Optional even when resolved |
| `edition_state` | TEXT | NOT NULL, CHECK (IN (`'edition_known'`,`'edition_unknown'`,`'target_unresolved'`)) | |
| `confidence` | TEXT | NOT NULL, CHECK (IN (`'high'`,`'medium'`,`'low'`,`'unresolved'`)) | |
| `conflict_reason` | TEXT | NULL | |
| `hold_reason` | TEXT | NULL | |
| `source_evidence` | JSONB | NOT NULL | JSON array of SourceEvidenceRef |
| `content_version` | TEXT | NOT NULL | |
| `normalizer_version` | TEXT | NOT NULL | |
| `registry_version` | TEXT | NOT NULL | Always non-null |
| `checked_at` | TIMESTAMPTZ | NOT NULL | |
| `review_state` | TEXT | NOT NULL, CHECK (IN (`'unreviewed'`,`'approved'`,`'rejected'`,`'needs_more_evidence'`)) | |
| `reviewed_at` | TIMESTAMPTZ | NULL | |

**State-consistency constraints:**
```
CHECK ((resolution_state <> 'resolved') OR (system_family_id IS NOT NULL))
CHECK ((resolution_state <> 'target_unresolved') OR (system_family_id IS NULL AND edition_id IS NULL))
CHECK ((edition_id IS NULL) OR (edition_state = 'edition_known'))
CHECK ((edition_state <> 'edition_unknown') OR (resolution_state = 'resolved' AND edition_id IS NULL))
CHECK ((edition_state <> 'target_unresolved') OR (resolution_state = 'target_unresolved'))
```

---

### 3.11 `compatibility_claim`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | |
| `scenario_id` | UUID | NOT NULL, FK → `scenario(id)` | |
| `original_source_text` | TEXT | NOT NULL | |
| `relationship_kind` | TEXT | NOT NULL, CHECK (IN (`'native'`,`'explicitly_compatible'`,`'conversion_provided'`,`'dual_or_multi_edition'`,`'derived_candidate'`,`'unknown'`)) | |
| `resolution_state` | TEXT | NOT NULL, CHECK (IN (`'resolved'`,`'target_unresolved'`)) | |
| `system_family_id` | UUID | NULL, FK → `system_family(id)` | |
| `edition_id` | UUID | NULL, FK → `edition(id)` | |
| `edition_state` | TEXT | NOT NULL, CHECK (IN (`'edition_known'`,`'edition_unknown'`,`'target_unresolved'`)) | |
| `confidence` | TEXT | NOT NULL, CHECK (IN (`'high'`,`'medium'`,`'low'`,`'unresolved'`)) | |
| `conflict_reason` | TEXT | NULL | |
| `hold_reason` | TEXT | NULL | |
| `source_evidence` | JSONB | NOT NULL | JSON array of SourceEvidenceRef |
| `content_version` | TEXT | NOT NULL | |
| `normalizer_version` | TEXT | NOT NULL | |
| `registry_version` | TEXT | NOT NULL | Always non-null |
| `checked_at` | TIMESTAMPTZ | NOT NULL | |
| `review_state` | TEXT | NOT NULL, CHECK (IN (`'unreviewed'`,`'approved'`,`'rejected'`,`'needs_more_evidence'`)) | |
| `reviewed_at` | TIMESTAMPTZ | NULL | |

Same state-consistency constraints as `ruleset_reference` (Section 3.10).

---

### 3.12 `book`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | Created only through reviewed registry addition |
| `book_kind` | TEXT | NOT NULL | BookKindCode per SYSTEM_NORMALIZATION.md Section 6.2 |
| `system_family_id` | UUID | NULL, FK → `system_family(id)` | Associated system family when applicable |
| `display_label_ja` | TEXT | NOT NULL | |
| `display_label_en` | TEXT | NULL | |
| `redirect_to` | UUID | NULL, FK → `book(id)` | When deprecated; old IDs never deleted |
| `deprecated_at` | TIMESTAMPTZ | NULL | |
| `deprecation_reason` | TEXT | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `registry_version_added` | TEXT | NOT NULL | |

---

### 3.13 `book_requirement`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | |
| `scenario_id` | UUID | NOT NULL, FK → `scenario(id)` | Individual scenario scope |
| `observed_title_text` | TEXT | NOT NULL | Verbatim observed title; preserved even when unresolved |
| `book_id` | UUID | NULL, FK → `book(id)` | Non-null only when book_identity_state = resolved |
| `book_identity_state` | TEXT | NOT NULL, CHECK (IN (`'resolved'`,`'hold_book_conflict'`,`'unresolved'`)) | |
| `requirement_kind` | JSONB | NOT NULL | EvidencedValue<RequirementKindCode> |
| `group_id` | TEXT | NULL | Non-null when requirement_kind.value = required_one_of |
| `conflict_status` | TEXT | NOT NULL, CHECK (IN (`'clear'`,`'hold_book_conflict'`)) | |
| `source_evidence` | JSONB | NOT NULL | JSON array of SourceEvidenceRef |
| `content_version` | TEXT | NOT NULL | |
| `normalizer_version` | TEXT | NOT NULL | |
| `registry_version` | TEXT | NOT NULL | |
| `checked_at` | TIMESTAMPTZ | NOT NULL | |
| `review_state` | TEXT | NOT NULL, CHECK (IN (`'unreviewed'`,`'approved'`,`'rejected'`,`'needs_more_evidence'`)) | |
| `reviewed_at` | TIMESTAMPTZ | NULL | |

**Consistency constraints:**
```
CHECK ((book_identity_state <> 'resolved') OR (book_id IS NOT NULL))
CHECK ((book_identity_state = 'resolved') OR (book_id IS NULL))
CHECK ((conflict_status = 'clear') OR (book_identity_state = 'hold_book_conflict'))
```

---

### 3.14 `tag`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | Created only through reviewed registry addition |
| `category` | TEXT | NOT NULL, CHECK (IN (`'theme'`,`'tone'`,`'content_warning'`,`'mechanic'`,`'setting'`)) | |
| `canonical_name` | TEXT | NOT NULL | Machine-safe canonical name |
| `display_label_ja` | TEXT | NOT NULL | |
| `display_label_en` | TEXT | NULL | |
| `provenance` | TEXT | NOT NULL, CHECK (`provenance` = `'controlled'`) | Fixed; all canonical tags are human-reviewed |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `registry_version_added` | TEXT | NOT NULL | |

**Uniqueness:** `UNIQUE (category, canonical_name)`.

---

### 3.15 `scenario_tag`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | |
| `scenario_id` | UUID | NOT NULL, FK → `scenario(id)` | |
| `tag_id` | UUID | NOT NULL, FK → `tag(id)` | |
| `provenance` | TEXT | NOT NULL, CHECK (IN (`'source'`,`'derived'`)) | |
| `source_wording_observed` | TEXT | NULL | Only when provenance = source; exact observed source text |
| `source_evidence` | JSONB | NOT NULL | JSON array of SourceEvidenceRef; non-empty when derived |
| `confidence` | TEXT | NULL, CHECK (`confidence` IN (`'high'`,`'medium'`,`'low'`,`'unresolved'`) OR `confidence` IS NULL) | Required when derived |
| `conflict_state` | TEXT | NOT NULL, CHECK (IN (`'clear'`,`'hold_alias_conflict'`,`'hold_conflicting_field_evidence'`)) | |
| `hold_reason` | TEXT | NULL | |
| `review_state` | TEXT | NOT NULL, CHECK (IN (`'unreviewed'`,`'approved'`,`'rejected'`,`'needs_more_evidence'`)) | |
| `is_ai_derived` | BOOLEAN | NOT NULL | TRUE when any source evidence has extraction_method = ai_candidate |
| `spoiler_suspect` | BOOLEAN | NOT NULL | TRUE = excluded from all public publication without exception |
| `content_version` | TEXT | NULL | Required when provenance = derived |
| `classifier_version` | TEXT | NULL | Only when derived |
| `registry_version` | TEXT | NULL | Required and non-null when provenance = derived; see constraint below |
| `prompt_template_version` | TEXT | NULL | Only when AI-derived |
| `model_id` | TEXT | NULL | Only when AI-derived |
| `checked_at` | TIMESTAMPTZ | NOT NULL | |
| `reviewed_at` | TIMESTAMPTZ | NULL | |

**Derived-tag non-null constraints:**
```
CHECK ((provenance <> 'derived') OR (registry_version IS NOT NULL))
CHECK ((provenance <> 'derived') OR (content_version IS NOT NULL))
CHECK ((provenance <> 'derived') OR (classifier_version IS NOT NULL))
```

The always-non-null reanalysis key `(content_version, classifier_version, registry_version)` for derived tags is guaranteed by the above constraints.

---

### 3.16 `source_snapshot`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | |
| `source_url` | TEXT | NOT NULL | URL of the source page accessed |
| `checked_at` | TIMESTAMPTZ | NOT NULL | When this access occurred |
| `response_status` | TEXT | NOT NULL | HTTP status code or access outcome string |
| `content_version` | TEXT | NOT NULL | Body-derived hash for permitted content; `access_outcome:<code>` for hold_age_unknown access |
| `extraction_method_summary` | TEXT | NOT NULL | How data was extracted (e.g., `html_parse`) |

**Append-only:** No UPDATE or DELETE on this table except under the `HoldAgeUnknownPurgeService` contract (Section 9). Application layer and access control enforce this invariant.

---

### 3.17 `normalization_history`

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | |
| `target_type` | TEXT | NOT NULL | Entity type name (e.g., `'ruleset_reference'`, `'scenario_tag'`) |
| `target_id` | UUID | NOT NULL | ID of the affected record |
| `reanalysis_trigger` | TEXT | NOT NULL, CHECK (IN (`'content_changed'`,`'normalizer_version_changed'`,`'registry_version_changed'`,`'alias_approved'`,`'canonical_entity_added'`,`'manual_trigger'`)) | |
| `content_version_old` | TEXT | NOT NULL | **Always non-null** |
| `content_version_new` | TEXT | NOT NULL | **Always non-null** |
| `normalizer_version_old` | TEXT | NOT NULL | **Always non-null** |
| `normalizer_version_new` | TEXT | NOT NULL | **Always non-null** |
| `registry_version_old` | TEXT | NOT NULL | **Always non-null** |
| `registry_version_new` | TEXT | NOT NULL | **Always non-null** |
| `old_result_snapshot` | JSONB | NOT NULL | Normalized field values before reanalysis |
| `new_result_snapshot` | JSONB | NOT NULL | Normalized field values after reanalysis |
| `changed_at` | TIMESTAMPTZ | NOT NULL | |
| `reason_detail` | TEXT | NULL | |

All six version columns are `TEXT NOT NULL`. No null value is permitted in any version column, including for the first reanalysis of a previously unresolved record. This implements the non-null version constraint from DATA_MODEL.md Section 8.2.

**Append-only:** No UPDATE or DELETE on this table for permitted records, except under the `HoldAgeUnknownPurgeService` contract (Section 9).

---

### 3.18 `hold_age_unknown_purge_event` (Redaction Tombstone)

| Column | Physical Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY NOT NULL | |
| `booth_product_id` | UUID | NOT NULL, FK → `booth_product(id)` | The product that transitioned to hold_age_unknown |
| `purge_triggered_at` | TIMESTAMPTZ | NOT NULL | When the purge was initiated |
| `hold_established_at` | TIMESTAMPTZ | NOT NULL | When hold_age_unknown was established on the product |
| `purged_entity_types` | TEXT[] | NOT NULL | Categories of content purged; must not contain prohibited payload text |
| `purged_record_count` | INTEGER | NOT NULL | Count of records deleted or updated |
| `retained_fields` | TEXT[] | NOT NULL | Non-descriptive tombstone fields retained |
| `actor` | TEXT | NOT NULL | Service or process identifier (e.g., `'HoldAgeUnknownPurgeService'`) |
| `audit_note` | TEXT | NULL | Brief description; must not contain any prohibited payload |
| `tombstone_written_at` | TIMESTAMPTZ | NOT NULL | When this tombstone record was written |

**Invariants:**
- This table is itself append-only. Tombstone records are never modified or deleted after writing.
- The tombstone must NOT store: observed titles, creator text, product descriptions, body excerpts, spoiler text, body-derived hashes, or any canonical value derived from prohibited content.
- The tombstone is immutable audit metadata only.

---

## 4. Index Strategy

Indexes support confirmed search inputs, filter facets, and sort options from DATA_MODEL.md Section 10.5 and PRODUCT_REQUIREMENTS.md. All indexes are B-tree unless otherwise noted.

### 4.1 `booth_product`

| Index Name | Columns / Expression | Notes |
|---|---|---|
| (implicit UNIQUE) | `source_product_id` | Identity lookup; already unique |
| `bp_all_ages_state_state_idx` | `(all_ages_state->>'state')` | All-ages gate filter (expression index) |
| `bp_sales_state_idx` | `sales_state` | Sales-state gate filter |
| `bp_last_checked_at_idx` | `last_checked_at DESC` | Last-checked sort |
| `bp_first_seen_at_idx` | `first_seen_at DESC` | New-product sort |
| `bp_is_free_idx` | `(is_free->>'state'), (is_free->>'value')` | Free-first sort filter (expression index) |

### 4.2 `scenario`

| Index Name | Columns / Expression | Notes |
|---|---|---|
| `sc_booth_product_id_idx` | `booth_product_id` | Parent product FK lookup |
| `sc_separation_state_idx` | `separation_state` | Separation gate filter |
| `sc_min_pl_idx` | `(min_pl->>'state'), (min_pl->>'value')` | PL range filter (expression index) |
| `sc_max_pl_idx` | `(max_pl->>'state'), (max_pl->>'value')` | PL range filter (expression index) |
| `sc_observed_title_fts_idx` | `to_tsvector('japanese', COALESCE(observed_title->>'value',''))` | GIN; full-text title search |

### 4.3 `scenario_play_time`

| Index Name | Columns | Notes |
|---|---|---|
| `spt_scenario_modality_idx` | `(scenario_id, modality)` UNIQUE | One row per modality per scenario |
| `spt_collection_state_idx` | `collection_state` | Observed play-time filter |

### 4.4 `ruleset_reference` / `compatibility_claim`

| Index Name | Columns | Notes |
|---|---|---|
| `rr_scenario_id_idx` | `scenario_id` | Scenario lookup |
| `rr_system_family_id_idx` | `system_family_id` | System family filter |
| `cc_scenario_id_idx` | `scenario_id` | Scenario lookup |
| `cc_system_family_id_idx` | `system_family_id` | System family filter |

### 4.5 `scenario_tag`

| Index Name | Columns | Notes |
|---|---|---|
| `st_scenario_id_idx` | `scenario_id` | Scenario lookup |
| `st_tag_id_idx` | `tag_id` | Tag filter |
| `st_spoiler_exclude_idx` | `spoiler_suspect` WHERE `spoiler_suspect = TRUE` | Partial index; spoiler exclusion fast path |
| `st_review_state_idx` | `(scenario_id, review_state)` | AI-approval gate filter |

### 4.6 `observed_alias`

| Index Name | Columns | Notes |
|---|---|---|
| `oa_comparison_key_idx` | `comparison_key` | Alias lookup and conflict detection |
| `oa_target_entity_idx` | `(target_entity_type, candidate_id)` | Canonical alias lookup |
| `oa_registry_version_idx` | `registry_version` | Registry-version invalidation scan |
| `oa_extraction_method_idx` | `extraction_method` | AI candidate queries |

### 4.7 `normalization_history`

| Index Name | Columns | Notes |
|---|---|---|
| `nh_target_idx` | `(target_type, target_id)` | History lookup by entity |
| `nh_changed_at_idx` | `changed_at DESC` | Chronological history |
| `nh_trigger_idx` | `reanalysis_trigger` | Trigger-type queries |

---

## 5. Append-Only Invariants

### 5.1 Append-Only Tables

| Table | Enforcement | Exception |
|---|---|---|
| `source_snapshot` | Application layer; no UPDATE/DELETE exposed | `HoldAgeUnknownPurgeService` (Section 9) |
| `normalization_history` | Application layer; no UPDATE/DELETE exposed | `HoldAgeUnknownPurgeService` (Section 9) |
| `hold_age_unknown_purge_event` | Application layer; unconditional; no exceptions | None |

### 5.2 Enforcement Mechanism

Application-layer write guards prevent UPDATE and DELETE on append-only tables through the standard data-access boundary. PostgreSQL row-level security (RLS) may provide a defense-in-depth layer. The `HoldAgeUnknownPurgeService` (Section 9) is the sole exception and must operate through a dedicated, audited code path.

---

## 6. Content-Version and Normalization-History Representation

### 6.1 Content Version Formats

| Context | Format | Example |
|---|---|---|
| Normal all_ages_confirmed product body | Body-derived page hash | `sha256:<hex64>` |
| hold_age_unknown product access | Non-body access/outcome version | `access_outcome:200`, `access_outcome:404` |
| EvidencedValue at normalization time | Content version at analysis time | `sha256:<hex64>` |
| Initial / empty registry sentinel | Non-null placeholder | `registry_empty_v0` |

### 6.2 Reanalysis Key

The three-part reanalysis avoidance key `(content_version, normalizer_version, registry_version)` is always non-null for every normalization result. Reanalysis is required when any one of the three changes. Both old and new `normalization_history` records are always retained for permitted content (D-026).

---

## 7. Seeded-Random Sort Physical Boundary

The seeded-random sort option operates at the query layer only. No additional column, table, or stored value is defined in the physical schema for this sort. The seed is derived from request-time parameters (e.g., current date portion) and applied at query time using PostgreSQL's `setseed()` and `random()` functions in an `ORDER BY` clause, or an equivalent deterministic ordering strategy. Implementation is deferred to the dedicated Stage 5+ scaffold; this section defines the physical boundary only.

---

## 8. `is_free`: EvidencedValue\<Boolean\> (Resolves PD-009)

`is_free` is stored as `JSONB NULL` on `booth_product` (Section 3.1). It represents whether the product appears to be available at zero cost based on explicit source signals, without storing or exposing exact prices.

**Rules:**
- `is_free` is never derived from parsed exact price data. It is derived only from explicit source signals (e.g., a "free download" badge, a ¥0 display label without price parsing).
- When source evidence is ambiguous or absent, `is_free` is either NULL (not yet collected) or `{"state":"unknown",...}` — never defaulted to false.
- Exact price is permanently excluded at all layers (DATA_MODEL.md Section 3.1; PRODUCT_REQUIREMENTS.md).
- The `free-first` sort uses `(is_free->>'state') = 'known' AND (is_free->>'value') = 'true'` as its primary ordering predicate. Records with `state = 'unknown'` appear below known-free records, and records with `value = false` appear last. The unknown state is never treated as false.

This resolves PD-009 (free-first sort non-exact indicator).

---

## 9. HoldAgeUnknownPurgeService

### 9.1 Purpose and Scope

When a `booth_product` transitions to `hold_age_unknown` (`all_ages_state.state = 'hold'`, `hold_reason = 'hold_age_unknown'`), all prohibited payloads must be irreversibly purged or sanitized per DATA_MODEL.md Section 3.5. The `HoldAgeUnknownPurgeService` is the **only** service contract permitted to issue restricted UPDATE and DELETE operations on otherwise append-only records.

This is the narrow compliance exception to D-026 and DATA_MODEL.md Section 3.5. It does not permit ordinary mutation of permitted-content history. It does not weaken D-002, D-012, D-026, or DATA_MODEL.md Section 3.5. It must not be callable from ordinary application paths.

### 9.2 Authorized Operations

Under the `HoldAgeUnknownPurgeService` contract, the following operations are authorized when the triggering `booth_product.all_ages_state` is confirmed as `hold_age_unknown`:

1. **UPDATE `booth_product`** (hold product row only):
   - Set `observed_title = NULL`
   - Set `creator_observed_name = NULL`
   - Set `creator_source_url = NULL`
   - Set `classification = NULL`
   - Set `sales_state = NULL`
   - Set `content_version` to the non-body-derived access/outcome version string

2. **DELETE `product_component` rows** where `booth_product_id` = hold product ID.

3. **DELETE `scenario` rows** (and all cascade-linked child records: `scenario_play_time`, `scenario_conversation_method`, `scenario_play_environment`, `ruleset_reference`, `compatibility_claim`, `book_requirement`, `scenario_tag`) where `booth_product_id` = hold product ID.

4. **UPDATE or DELETE `source_snapshot` rows** linked to the hold product where those rows contain prohibited body-content excerpts or body-derived content hashes. After update: `content_version` must be the access/outcome form; body content must not be reconstructable.

5. **DELETE `normalization_history` rows** where `old_result_snapshot` or `new_result_snapshot` contains prohibited descriptive or body-derived content for the hold product.

6. **INSERT `hold_age_unknown_purge_event`** tombstone record (Section 3.18) after all purge operations complete.

### 9.3 Unauthorized Operations

The `HoldAgeUnknownPurgeService` must NOT:

- Modify or delete `source_snapshot` or `normalization_history` records not linked to the hold product.
- Delete the `booth_product` row itself (the non-descriptive tombstone columns are retained).
- Remove non-sensitive immutable audit metadata: `id`, `source_platform`, `source_product_id`, `canonical_url`, `discovery_method`, `first_seen_at`, `last_checked_at`, `current_record_updated_at`, `all_ages_state` (the hold record itself).
- Reconstruct, return, or log any prohibited content.
- Operate on any row not directly associated with the hold product.

### 9.4 Purge Atomicity

All purge operations in a single `HoldAgeUnknownPurgeService` execution must be atomic: either all succeed or none are committed. A failed partial purge must be rolled back and retried. The tombstone record (Section 3.18) is inserted only after all other operations succeed within the same transaction.

### 9.5 Hold Resolution

On resolution of `hold_age_unknown` to `all_ages_confirmed`, prohibited fields may be populated from a fresh source observation only. Purged content must not be reconstructed from any prior history record, stale `source_snapshot` data, or previously retained payload. The `hold_age_unknown_purge_event` tombstone record is retained permanently and is not deleted on resolution.

---

## 10. `searchable_scenario` View Physical Notes

The `searchable_scenario` projection (DATA_MODEL.md Section 10) is a deterministic logical view. In PostgreSQL, it is implemented as a VIEW (or a refreshed MATERIALIZED VIEW for performance) joining `booth_product`, `scenario`, and related tables and applying all eligibility gates as WHERE predicates.

The view must never bypass or soften the all-ages gate, classification gate, sales-state gate, separation gate, hold gate, required-field gate, AI-approval gate, spoiler gate, or any other gate named in DATA_MODEL.md Section 10.1. The view is the sole public search eligibility mechanism (D-025).

Exact view DDL is specified at scaffold time (Stage 5+), not in this document.

---

## 11. Cross-References

| Document | Relevant Sections |
|---|---|
| [DATA_MODEL.md](DATA_MODEL.md) | Complete logical schema (governing source for all entities and invariants) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Provider-neutral boundaries; technology decisions; cost controls |
| [DECISIONS.md](DECISIONS.md) | D-022–D-026 (Stage 3); D-029–D-039 (Stage 4) |
| [SYSTEM_NORMALIZATION.md](SYSTEM_NORMALIZATION.md) | Normalization entity structure; alias kinds; book kinds |
