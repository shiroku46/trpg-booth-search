# Physical Schema

## Status and scope

This document is a **non-executable physical-schema specification** for the MVP. It translates the logical model in [`DATA_MODEL.md`](DATA_MODEL.md) into PostgreSQL-oriented tables, columns, constraints, indexes, publication projections, history rules, and the narrow `hold_age_unknown` compliance-purge boundary.

It is not a SQL migration, ORM schema, generated type file, database connection, deployment plan, or authorization to provision a database. Provider provisioning, credentials, billing, migrations, and production data remain deferred to later Issues.

Provisional implementation target for later stages:

- PostgreSQL 17, subject to managed-provider support verification at provisioning time;
- Drizzle ORM and Drizzle Kit, licensed Apache-2.0, with exact versions pinned only when the application is scaffolded;
- Supabase Free as a possible managed PostgreSQL provider, but no project is created in Stage 4;
- no assumption that Supabase Free includes Point-in-Time Recovery (PITR).

The physical model must preserve all Stage 3 boundaries, especially strict all-ages eligibility, explicit unknown/hold states, source provenance, append-only permitted history, and the narrow irreversible sanitization exception for `hold_age_unknown`.

---

## 1. Conventions

### 1.1 Names and identifiers

- Schema name: `public` when provisioned.
- Table and column names: `snake_case`.
- Every entity uses `id UUID PRIMARY KEY`.
- IDs are immutable after insertion and are never reused.
- Timestamps use `TIMESTAMPTZ` and are stored in UTC.
- User-facing source text uses `TEXT`; empty strings never substitute for unknown.
- Controlled vocabulary values use `TEXT` plus explicit check constraints.
- Exact monetary prices are prohibited.

### 1.2 Foreign keys

- Foreign keys are explicit.
- Default deletion behavior is `RESTRICT`.
- Cascades are allowed only where this document explicitly authorizes them.
- `source_url` is descriptive/access metadata and is **never** an ownership key.

### 1.3 Evidenced values

Every logical `EvidencedValue<T>` is stored as `JSONB NOT NULL`, except fields that are structurally absent under an explicit parent state and are documented as nullable.

Required envelope:

```text
{
  state: known | unknown | hold | not_applicable,
  value: T,                         # present only for known
  confidence: high | medium | low | unresolved,
  hold_reason: HoldReasonCode,       # present only for hold
  conflict_reason: ConflictReasonCode | null,
  source_evidence: SourceEvidenceRef[],
  review_state: unreviewed | approved | rejected | needs_more_evidence,
  content_version: string,
  normalizer_version: string | null,
  registry_version: string | null,
  checked_at: timestamp,
  reviewed_at: timestamp | null
}
```

State invariants:

| State | `value` | `hold_reason` | Evidence |
|---|---|---|---|
| `known` | required and valid | absent | non-empty |
| `unknown` | absent | absent | may be empty |
| `hold` | absent | required | may be non-empty |
| `not_applicable` | absent | absent | may be empty |

A value is `publishable_core_value(v)` only when all of the following hold:

1. `state = known` and a valid value is present;
2. confidence is `high` or `medium`;
3. source evidence is non-empty;
4. conflict and hold reasons are absent;
5. required content, normalizer/classifier, registry, and timestamp metadata are complete;
6. review state is `unreviewed` or `approved` for non-AI evidence;
7. review state is `approved` whenever any evidence item has `extraction_method = ai_candidate`.

Rejected, needs-more-evidence, low/unresolved, evidence-empty, conflicted, held, incomplete, and unapproved-AI values never publish and never drive filters.

### 1.4 Source evidence references

Each source-evidence element contains:

```text
{
  source_snapshot_id: UUID,
  evidence_type: EvidenceTypeCode,
  evidence_pointer: string,
  extraction_method: explicit_source | approved_alias | deterministic_rule | ai_candidate,
  model_id: string | null,
  prompt_template_version: string | null,
  generation_date: date | null
}
```

JSON-array references are validated by the application service before write. The referenced snapshot must belong to the same `booth_product_id` as the product/scenario graph being written.

---

## 2. Product and scenario tables

### 2.1 `booth_product`

| Column | Type | Required | Constraint / meaning |
|---|---|---:|---|
| `id` | UUID | yes | primary key |
| `source_platform` | TEXT | yes | exactly `booth` |
| `source_product_id` | TEXT | yes | unique with source platform |
| `canonical_url` | TEXT | yes | canonical BOOTH product URL |
| `all_ages_state` | JSONB | yes | only known/confirmed or hold/`hold_age_unknown` |
| `observed_title` | TEXT | conditional | null while age hold is active |
| `creator_observed_name` | TEXT | conditional | null while age hold is active |
| `creator_source_url` | TEXT | conditional | null while age hold is active |
| `classification` | JSONB | conditional | evidenced product class; null while age hold is active; every non-null result requires non-null processor and registry version keys |
| `sales_state` | TEXT | conditional | available, sold_out, sales_ended, disappeared, unknown; null on age hold |
| `discovery_method` | TEXT | yes | controlled discovery route |
| `source_publication_date` | JSONB | yes | `EvidencedValue<Date>` from the BOOTH product page; explicit unknown when unavailable; null only during `hold_age_unknown` |
| `first_seen_at` | TIMESTAMPTZ | yes | first observation and deterministic fallback for New sorting whenever `source_publication_date` is not publishable |
| `last_checked_at` | TIMESTAMPTZ | yes | most recent access attempt |
| `content_version` | TEXT | yes | body hash for permitted content; non-body access/outcome version on age hold |
| `is_free` | JSONB | no | non-exact `EvidencedValue<Boolean>`; exact price prohibited |
| `current_record_updated_at` | TIMESTAMPTZ | yes | current-projection update time |

Uniqueness:

```text
UNIQUE (source_platform, source_product_id)
```

`all_ages_state` permits exactly two representations:

- known value `all_ages_confirmed` with approved, high/medium, conflict-free evidence and complete provenance;
- hold with reason `hold_age_unknown` and no guessed value.

`hold_age_unknown` physical invariant:

```text
when all_ages_state.state = hold:
  observed_title is null
  creator_observed_name is null
  creator_source_url is null
  classification is null
  sales_state is null
  source_publication_date is null
  is_free is null
  content_version is a non-body-derived access/outcome version
```

The `is_free IS NULL` requirement is mandatory. The full `is_free` evidenced object and its non-permitted evidence/provenance must be removed atomically when the hold is established.

Classification version invariant:

- every non-null `classification` envelope requires a non-null processor key in `normalizer_version` and a non-null `registry_version`;
- deterministic-rule and manually reviewed classifications use explicit, stable sentinel values such as `deterministic-rule-v1`, `manual-review-v1`, or `registry-not-consulted`, rather than null;
- these keys remain present for known, unknown, rejected, conflicted, and otherwise non-publishable classification results so every reclassification can write non-null old/new processor and registry versions to `normalization_history`.

Classification publication invariant:

- product classification is stricter than the generic non-AI publication rule: an eligible classification must have `review_state = approved` in addition to satisfying `publishable_core_value`;
- `unreviewed`, `rejected`, and `needs_more_evidence` classifications can never authorize a product or any child scenario for public search, even when all other envelope fields are complete.

Recommended indexes:

- unique `(source_platform, source_product_id)`;
- `(classification expression, sales_state)` for internal eligibility checks;
- a publishable `source_publication_date.value` expression index plus `first_seen_at` fallback support for New sorting;
- `first_seen_at`, `last_checked_at`;
- partial index for records whose all-ages state is confirmed.

### 2.2 `scenario`

| Column | Type | Required | Constraint / meaning |
|---|---|---:|---|
| `id` | UUID | yes | primary key |
| `booth_product_id` | UUID | yes | FK to one parent product |
| `observed_title` | JSONB | yes | evidenced string |
| `separation_state` | TEXT | yes | single_scenario, separated, unseparated, ambiguous |
| `work_composition` | JSONB | yes | evidenced controlled code |
| `min_pl` | JSONB | yes | evidenced positive integer |
| `max_pl` | JSONB | yes | evidenced positive integer |
| `gm_kp_required` | JSONB | yes | evidenced boolean |
| `gm_less` | JSONB | yes | evidenced boolean |
| `kpc_present` | JSONB | yes | evidenced boolean |
| `progression_method` | JSONB | yes | evidenced controlled code |
| `handout_structure` | JSONB | yes | evidenced controlled code |
| `first_seen_at` | TIMESTAMPTZ | yes | |
| `last_checked_at` | TIMESTAMPTZ | yes | |
| `content_version` | TEXT | yes | source content version |
| `current_record_updated_at` | TIMESTAMPTZ | yes | |

Cardinality: one product has zero or many scenarios; every scenario has exactly one product.

Whenever both player-count envelopes have `state = known`, `min_pl.value <= max_pl.value` is required regardless of confidence, review state, conflict state, hold state, or current publication eligibility. An inverted known/known player-count range is physically invalid and must be rejected before storage. Public display and filtering remain restricted to values satisfying `publishable_core_value`. Zero, null, false, and empty string never encode unknown.

Recommended indexes:

- `booth_product_id`;
- expressions for publishable min/max PL;
- `first_seen_at`, `last_checked_at`;
- normalized title sort key prepared at application boundary, not stored as a source rewrite.

### 2.3 `scenario_play_time`

| Column | Type | Required | Constraint / meaning |
|---|---|---:|---|
| `id` | UUID | yes | primary key |
| `scenario_id` | UUID | yes | FK |
| `modality` | TEXT | yes | online, offline, conversation_mode, general |
| `collection_state` | TEXT | yes | observed, checked_unknown, not_collected, not_applicable |
| `min_duration` | JSONB | yes | evidenced non-negative minutes |
| `max_duration` | JSONB | yes | evidenced non-negative minutes |

Uniqueness:

```text
UNIQUE (scenario_id, modality)
```

Totality and range invariants:

- every `scenario` must have at least one `scenario_play_time` row; zero rows are invalid and must be rejected by a deferred constraint or mandatory transactional repository-service validation;
- when no concrete modality duration is available, the scenario must have an explicit `general` row with `collection_state = checked_unknown`, `not_collected`, or `not_applicable` as supported by the observation state;
- whenever both duration envelopes have `state = known`, `min_duration.value <= max_duration.value` is required regardless of confidence, review state, conflict state, hold state, or current publication eligibility; an inverted known/known range is physically invalid and must be rejected before storage.

Collection-state invariant:

- `observed`: at least one duration satisfies `publishable_core_value`; neither duration may be not-applicable;
- `checked_unknown`: both durations are unknown with no value;
- `not_collected`: both durations are unknown with no value;
- `not_applicable`: both durations are not-applicable with no value.

Only publishable known bounds from `observed` records enter public search.

### 2.4 `scenario_conversation_method`

| Column | Type | Required | Constraint / meaning |
|---|---|---:|---|
| `id` | UUID | yes | primary key |
| `scenario_id` | UUID | yes | FK |
| `method` | JSONB | yes | evidenced `text`, `voice`, or `video` |

Multiple independently evidenced rows are allowed. A unique content/version key prevents exact duplicate observations.

### 2.5 `scenario_play_environment`

| Column | Type | Required | Constraint / meaning |
|---|---|---:|---|
| `id` | UUID | yes | primary key |
| `scenario_id` | UUID | yes | FK |
| `environment` | JSONB | yes | evidenced `online`, `offline`, or `vr` |

Multiple independently evidenced rows are allowed.

### 2.6 `product_component`

| Column | Type | Required | Constraint / meaning |
|---|---|---:|---|
| `id` | UUID | yes | primary key |
| `booth_product_id` | UUID | yes | FK |
| `observed_component_wording` | TEXT | yes | verbatim source wording |
| `component_classification` | JSONB | yes | playable_scenario, scenario_collection, material, update_dlc, unknown, other |
| `scenario_id` | UUID | no | optional FK to one scenario |
| `source_evidence` | JSONB | yes | evidence-reference array |

A scenario may be linked by at most one component belonging to the same product. Components are internal source structure and do not create a third public-search layer.

---

## 3. Canonical-system and normalization tables

### 3.1 `system_family`

Columns: `id`, `display_label_ja`, optional `display_label_en`, optional `redirect_to`, optional `deprecated_at`, optional `deprecation_reason`, `created_at`, and `registry_version_added`.

Redirect chains must be finite and acyclic. No production registry rows are populated in Stage 4.

### 3.2 `edition`

Columns: `id`, required `system_family_id`, Japanese and optional English labels, redirect/deprecation fields, `created_at`, and `registry_version_added`.

Every edition belongs to exactly one family. An edition target must belong to the same family selected by the referencing record.

### 3.3 `observed_alias`

| Column | Type | Required | Meaning |
|---|---|---:|---|
| `id` | UUID | yes | primary key |
| `original_source_text` | TEXT | yes | exact source wording; never rewritten |
| `comparison_key` | TEXT | yes | normalized comparison form produced by the approved normalizer |
| `alias_kind` | TEXT | yes | controlled `AliasKindCode` |
| `source_snapshot_id` | UUID | yes | FK to the exclusively owned snapshot |
| `source_url` | TEXT | yes | exact observed source URL; descriptive provenance, never ownership |
| `evidence_type` | TEXT | yes | controlled `EvidenceTypeCode` for this alias observation |
| `evidence_pointer` | TEXT | yes | non-spoiler source location/pointer within the snapshot |
| `first_observed_at` | TIMESTAMPTZ | yes | first time this exact alias observation was recorded |
| `last_observed_at` | TIMESTAMPTZ | yes | most recent confirmation; must be `>= first_observed_at` |
| `resolution_state` | TEXT | yes | resolved, target_unresolved, no_match, not_attempted |
| `target_entity_type` | TEXT | yes | exactly `system_family`, `edition`, or `book`; retained in every resolution state so registry reanalysis remains reproducible |
| `system_family_id` | UUID | conditional | non-null for resolved system-family and edition targets |
| `edition_id` | UUID | conditional | non-null only for resolved edition targets; must belong to the referenced family |
| `book_id` | UUID | conditional | non-null only for resolved book targets |
| `confidence` | TEXT | yes | controlled value |
| `conflict_status` | TEXT | yes | exactly `clear` or `hold_alias_conflict` |
| `hold_reason` | TEXT | no | additional hold reason distinct from comparison-key collision |
| `review_state` | TEXT | yes | |
| `extraction_method` | TEXT | yes | |
| `content_version` | TEXT | yes | non-null |
| `normalizer_version` | TEXT | yes | non-null |
| `registry_version` | TEXT | yes | non-null, including not-consulted snapshot sentinel |
| `checked_at` | TIMESTAMPTZ | yes | |
| `reviewed_at` | TIMESTAMPTZ | no | |
| AI metadata fields | TEXT/DATE | conditional | required for AI candidates |

Evidence and lifecycle invariants:

- `source_snapshot_id` must reference a snapshot exclusively owned by the same `booth_product_id` as the observation; shared URL, shop identity, or creator identity may not be used to infer this ownership;
- `source_url` must equal the source URL recorded by that snapshot for this evidence event, but remains descriptive provenance and never determines ownership;
- `evidence_type` and `evidence_pointer` are required independently of the snapshot ID so the evidence kind and exact non-spoiler location remain reproducible;
- `first_observed_at <= last_observed_at`, and updates may advance only `last_observed_at` for the same exact observation identity;
- indexes support `(source_snapshot_id, evidence_type)`, `(source_url, first_observed_at)`, and `(comparison_key, alias_kind)`.

Resolution invariants:

- A resolved system-family alias (`target_entity_type = system_family`) requires `system_family_id` non-null; `edition_id` and `book_id` must both be null.
- A resolved edition alias (`target_entity_type = edition`) requires `system_family_id` and `edition_id` both non-null, with the edition belonging to the referenced family; `book_id` must be null.
- A resolved book alias (`target_entity_type = book`) requires `book_id` non-null; a family is required only when the canonical book itself is scoped to a family; `edition_id` must be null.
- `target_unresolved`, `no_match`, and `not_attempted` retain non-null `target_entity_type` to identify the intended registry, while prohibiting all canonical target IDs (`system_family_id`, `edition_id`, and `book_id` must all be null).

Publication and review rules are deterministic and fail closed: any combination of IDs or states that does not satisfy exactly one resolution invariant above is invalid and may not publish.

Collision invariant:

- aliases sharing the same `comparison_key` but resolving to different canonical candidates must have `conflict_status = hold_alias_conflict`;
- a held collision cannot be an approved canonical mapping and cannot publish until human review resolves the candidate conflict;
- an approved mapping requires `review_state = approved`, `conflict_status = clear`, eligible confidence, no `hold_reason`, and exactly one valid canonical target for `target_entity_type`;
- indexes support `(comparison_key, alias_kind)`, `conflict_status`, `review_state`, and the complete content/normalizer/registry reanalysis key.

### 3.4 `ruleset_reference`

Columns: `id`, `scenario_id`, exact `observed_text`, `source_snapshot_id`, `resolution_state`, `edition_state`, optional family and edition IDs, confidence/conflict/hold/review fields, extraction metadata, complete version triple, and timestamps.

Deterministic equivalence:

- family-only resolution: `edition_state = edition_unknown`, family ID present, edition ID null;
- family-and-edition resolution: resolved family and edition, both IDs present, and edition belongs to family;
- unresolved: no canonical IDs.

Publication requires approved, high/medium, evidenced, conflict-free, hold-free, resolved data.

### 3.5 `compatibility_claim`

Same target and provenance shape as `ruleset_reference`, plus controlled `relationship_kind`:

- `native`;
- `explicitly_compatible`;
- `conversion_provided`;
- `dual_or_multi_edition`;
- `derived_candidate`;
- `unknown`.

`derived_candidate` claims require `review_state = approved` before any publication or public display.

Only resolved, approved, evidenced, conflict-free and hold-free claims publish.

### 3.6 `book`

Columns: `id`, required `book_kind` using the complete `BookKindCode` vocabulary, canonical Japanese and optional English labels, optional family/edition scope, redirect/deprecation fields, creation timestamp, and registry version.

`book_kind` is never inferred from a default or null. It must represent the logical controlled value explicitly, including the logical unknown kind where evidence does not establish a more specific category.

No production book rows are populated in Stage 4.

### 3.7 `book_requirement_group`

| Column | Type | Required | Meaning |
|---|---|---:|---|
| `id` | UUID | yes | primary key |
| `scenario_id` | UUID | yes | FK |
| `group_kind` | TEXT | yes | `required_one_of` |
| `created_at` | TIMESTAMPTZ | yes | |

A published `required_one_of` group contains at least two publishable members, and every counted member must have `requirement_kind.value = required_one_of` satisfying its publication predicate. A `book_requirement` whose kind is `required`, `optional`, or any value other than `required_one_of` must have `group_id IS NULL` and cannot count toward the group. Conversely, a publishable `required_one_of` member must have a non-null `group_id` pointing to a group owned by the same scenario.

### 3.8 `book_requirement`

Columns: `id`, `scenario_id`, optional `group_id`, independently evidenced `requirement_kind`, exact observed book text, identity state, optional canonical `book_id`, conflict status, hold/review state, source evidence, complete version metadata, and timestamps.

`book_identity_state = resolved` is equivalent to non-null `book_id`. Unresolved/conflict states require `book_id` to be null. Publication requires approved, evidenced, conflict-free, hold-free identity and independently publishable requirement kind. `group_id` is valid only when the independently publishable `requirement_kind.value` is `required_one_of`; all other kinds require `group_id IS NULL`.

---

## 4. Tags

### 4.1 `tag`

| Column | Type | Required | Meaning |
|---|---|---:|---|
| `id` | UUID | yes | primary key |
| `category` | TEXT | yes | theme, tone, content_warning, mechanic, or setting |
| `canonical_name` | TEXT | yes | machine-safe canonical identity, unique within category |
| `display_label_ja` | TEXT | yes | Japanese display label |
| `display_label_en` | TEXT | no | optional English display label |
| `provenance` | TEXT | yes | fixed value `controlled` |
| `redirect_to` | UUID | no | optional canonical redirect |
| `deprecated_at` | TIMESTAMPTZ | no | optional deprecation time |
| `deprecation_reason` | TEXT | no | optional reason |
| `registry_version` | TEXT | yes | registry version that contains the identity |
| `created_at` | TIMESTAMPTZ | yes | immutable creation time |

Uniqueness:

```text
UNIQUE (category, canonical_name)
```

Initial categories are theme, tone, content_warning, mechanic, and setting. `canonical_name` is the stable machine key; display labels never substitute for identity. Every row has `provenance = controlled`. Stage 4 does not populate a production catalogue.

### 4.2 `scenario_tag`

| Column | Type | Required | Meaning |
|---|---|---:|---|
| `id` | UUID | yes | primary key |
| `scenario_id` | UUID | yes | FK |
| `tag_id` | UUID | yes | non-null FK to one canonical `tag` |
| `source_observed_wording` | TEXT | conditional | verbatim source wording |
| `provenance` | TEXT | yes | source or derived |
| `is_ai_derived` | BOOLEAN | yes | explicit |
| `spoiler_suspect` | BOOLEAN | yes | true rows never publish |
| evidence/review/conflict/hold fields | mixed | yes | |
| `content_version` | TEXT | yes | non-null |
| `classifier_version` | TEXT | conditional | required for derived |
| `registry_version` | TEXT | yes | non-null, including empty-reviewed snapshot sentinel |
| AI model/prompt/date fields | mixed | conditional | required for AI candidates |

Every stored `scenario_tag` is a relationship to an existing canonical tag and therefore requires non-null `tag_id`. An unresolved or candidate-only tag observation remains in the derivation/review input state and must not be inserted into `scenario_tag` until a canonical target is resolved. A null-target row is invalid and can never publish.

Source tags may publish unreviewed only when clear, non-spoiler, hold-free, evidenced, non-AI, otherwise eligible, and linked to a canonical tag. Every AI-derived tag requires approval. Derived tags require approval and complete classifier/version metadata.

Recommended unique/index keys:

- `(scenario_id, tag_id, provenance, content_version, classifier_version, registry_version)` where applicable;
- indexes on category, spoiler flag, review state, and hold/conflict state.

---

## 5. Provenance and history

### 5.1 `source_snapshot`

| Column | Type | Required | Meaning |
|---|---|---:|---|
| `id` | UUID | yes | primary key |
| `booth_product_id` | UUID | yes | **exclusive owner FK** to `booth_product` |
| `source_url` | TEXT | yes | accessed URL; never an ownership key |
| `checked_at` | TIMESTAMPTZ | yes | access attempt time |
| `outcome_code` | TEXT | yes | success, not_found, forbidden, rate_limited, age_gate, other controlled state |
| `http_status` | INTEGER | no | non-secret response status |
| `content_version` | TEXT | yes | body-derived for permitted content; access/outcome version after age hold |
| `extraction_method_summary` | TEXT | yes | controlled, auditable summary of the extraction route, such as structured field, HTML parse, manual review, or outcome-only/no-payload processing; never source payload |
| `evidence_pointer_policy` | TEXT | yes | non-spoiler pointer mode |
| `created_at` | TIMESTAMPTZ | yes | immutable insertion time |

Ownership and provenance rules:

1. every snapshot belongs to exactly one product through non-null `booth_product_id`;
2. purge selection uses only this FK;
3. `source_url`, shop identity, creator identity, and evidence traversal never infer ownership;
4. one product's purge can never update or delete another product's snapshots;
5. every access stores a non-null controlled `extraction_method_summary` identifying how extraction was attempted, including explicit outcome-only/no-payload values when no permitted body was processed;
6. after an age-hold sanitization, any retained summary must remain non-payload and must not reveal removed source content.

Ordinary permitted snapshots are append-only. The only exception is the narrowly scoped age-hold purge in Section 8.

Indexes:

- `(booth_product_id, checked_at desc)`;
- `(booth_product_id, content_version)`;
- `(outcome_code, checked_at)`;
- `(extraction_method_summary, checked_at)` for provenance audits.

### 5.2 `normalization_history`

| Column | Type | Required | Meaning |
|---|---|---:|---|
| `id` | UUID | yes | primary key |
| `booth_product_id` | UUID | yes | owner product for deterministic purge scope |
| `entity_type` | TEXT | yes | normalized entity category |
| `entity_id` | UUID | yes | referenced record ID |
| `old_result` | JSONB | yes | permitted prior normalized result |
| `new_result` | JSONB | yes | permitted replacement result |
| old/new content versions | TEXT | yes | non-null |
| old/new normalizer/classifier versions | TEXT | yes | non-null |
| old/new registry versions | TEXT | yes | non-null |
| `change_reason` | TEXT | yes | controlled reason |
| `created_at` | TIMESTAMPTZ | yes | immutable |

Permitted history is append-only and never overwritten. The complete content/processor/registry key determines reanalysis invalidation.

### 5.3 `redaction_tombstone`

| Column | Type | Required | Meaning |
|---|---|---:|---|
| `id` | UUID | yes | primary key |
| `booth_product_id` | UUID | yes | affected product |
| `purge_reason` | TEXT | yes | exactly `hold_age_unknown` for this exception |
| `purge_state` | TEXT | yes | pending, completed, failed |
| `purge_started_at` | TIMESTAMPTZ | yes | |
| `purge_completed_at` | TIMESTAMPTZ | conditional | required when completed |
| `responsible_actor_or_process` | TEXT | yes | non-secret process identifier |
| `sanitized_record_count` | INTEGER | yes | non-negative |
| `created_at` | TIMESTAMPTZ | yes | immutable |

A completed tombstone requires `purge_state = completed`, non-null completion time, and count parity with its child references.

### 5.4 `redaction_tombstone_record_ref`

| Column | Type | Required | Meaning |
|---|---|---:|---|
| `id` | UUID | yes | primary key |
| `redaction_tombstone_id` | UUID | yes | FK |
| `entity_type` | TEXT | yes | sanitized table/entity category |
| `record_id` | UUID | yes | non-payload identifier of sanitized record |
| `permitted_content_version` | TEXT | no | only non-body-derived access/outcome version |
| `permitted_processor_version` | TEXT | no | non-sensitive version reference where applicable |
| `permitted_registry_version` | TEXT | no | reviewed registry version where applicable |
| `sanitized_at` | TIMESTAMPTZ | yes | |

Uniqueness:

```text
UNIQUE (redaction_tombstone_id, entity_type, record_id)
```

The number of child references must equal `sanitized_record_count` before a tombstone can become completed.

The `permitted_content_version`, `permitted_processor_version`, and `permitted_registry_version` columns must be populated with the non-body-derived version values present in the sanitized record at the time of sanitization, whenever such values exist. Together with `record_id`, `entity_type`, and `sanitized_at`, these non-payload metadata columns form the non-reconstructable completion audit trail. A tombstone is a valid completion record only when `purge_state = completed`, `purge_completed_at` is non-null, and the child-reference count equals `sanitized_record_count`.

Prohibited tombstone content includes titles, creator/shop text, descriptions, excerpts, canonical values derived from prohibited payloads, spoiler text, exact prices, body-derived hashes, prompts, model output, or any material capable of reconstructing the removed content.

---

## 6. Public-search projection

`searchable_scenario` is a provider-neutral application projection and may later be implemented as a query/view. It is not a source-of-truth table.

A scenario appears only when:

1. parent classification is an eligible scenario-bearing class, satisfies `publishable_core_value`, and has `review_state = approved`;
2. parent all-ages state is known, confirmed, approved, high/medium confidence, evidenced, conflict-free and hold-free;
3. parent sales state is available or sold out;
4. scenario separation state is single or separated;
5. no record-level blocking hold exists;
6. every required core field is either an explicit `unknown` state allowed by that field's contract or a `known` value satisfying `publishable_core_value`; `hold`, disallowed `not_applicable`, rejected, needs-more-evidence, conflicted, low/unresolved, evidence-empty, incomplete, and unapproved-AI required fields exclude the scenario;
7. spoiler-suspect and unapproved AI-derived data are omitted.

Ruleset, compatibility, book-requirement, alias, and tag relationships are projected independently. A relationship row is included only when it satisfies its entity-specific publication predicate. An unresolved, conflicted, held, rejected, needs-more-evidence, low-confidence, evidence-empty, or unapproved relationship is omitted without making an otherwise eligible scenario disappear.

Projection fields include the parent canonical BOOTH URL, source-observed product and scenario titles where eligible, creator name, player count, GM/KP facts, KPC, modality-specific time bounds, conversation method, play environment, progression, handouts, eligible tags, normalized ruleset/compatibility/book requirements, discovery/source-publication/first-seen/last-checked timestamps, and the non-exact `is_free` value only when publishable.

The projection never exposes images, exact prices, payment/download data, adult/age-uncertain records, material-only records, unresolved collection entries, body hashes, hidden evidence, or unapproved AI candidates.

Sort/index support is required for discovery order, newest first, last checked, title, seeded-random application ordering, and free-first. Newest first uses `booth_product.source_publication_date.value` only when that envelope satisfies `publishable_core_value`; whenever the date is held, conflicted, rejected, low-confidence, incomplete, evidence-empty, unknown, not applicable, or otherwise non-publishable, ordering falls back deterministically to `booth_product.first_seen_at`. Seeded random is computed at the application/query boundary and does not store a mutable random rank.

---

## 7. Mutation and transaction policy

### 7.1 Normal writes

- Current projections may be updated through validated repository services.
- Source snapshots and normalization history for permitted content are append-only.
- Normal rollback is a new migration/revert or fix-forward; shared history is never rewritten.
- Candidate code never receives production credentials in CI.

### 7.2 Reanalysis

Reanalysis is required when any part of the complete invalidation key changes:

```text
(content_version, normalizer_or_classifier_version, registry_version)
```

Skipping reanalysis is allowed only when the complete key is unchanged.

### 7.3 Restricted age-hold exception

The `hold_age_unknown` transition is the sole exception that may delete or irreversibly sanitize prohibited historical payload. It cannot be reused for ordinary correction, cleanup, retention reduction, or convenience.

---

## 8. `HoldAgeUnknownPurgeService`

The later implementation must perform one restricted database transaction with fail-closed behavior.

Preconditions:

- target product is identified by immutable `booth_product.id`;
- new evidence requires `all_ages_state = hold` and `hold_reason = hold_age_unknown`;
- caller has the dedicated internal compliance capability;
- no arbitrary table or product selector is accepted;
- all target snapshots are selected exclusively by `source_snapshot.booth_product_id`.

Required atomic sequence:

1. lock the target product and its owned rows;
2. create a pending `redaction_tombstone`;
3. enumerate every row that will be deleted or sanitized and create one non-payload `redaction_tombstone_record_ref` for each;
4. remove product components and scenarios and all scenario-owned relationship rows;
5. remove or irreversibly sanitize product-owned source snapshots containing body-derived hashes or prohibited payload;
6. remove or irreversibly sanitize product-owned normalization history and evidence payload derived from prohibited content;
7. clear `observed_title`, creator fields, classification, sales state, `source_publication_date`, and the entire `is_free` evidenced object;
8. remove every non-permitted evidence/provenance reference, including evidence formerly attached to `is_free`;
9. set `all_ages_state` to the explicit hold representation;
10. replace `content_version` with a non-body-derived access/outcome version;
11. verify that no prohibited payload or body-derived hash remains for the product;
12. verify that child-reference count equals `sanitized_record_count`;
13. set `purge_state = completed` and `purge_completed_at` in the same transaction;
14. commit only if all checks pass; otherwise roll back every mutation and retain a non-completed failure audit record outside the candidate data transaction where permitted.

The service must not:

- select snapshots by URL;
- traverse a shared shop page as ownership;
- modify another product's rows;
- preserve exact price or `is_free` evidence;
- preserve body-derived hashes in a replacement row;
- store removed payload inside logs or tombstones;
- weaken ordinary append-only history.

Operational logs may include product ID, tombstone ID, counts, non-payload record IDs, state transitions, and non-body-derived hashes of the audit envelope. They must not include removed content.

---

## 9. Backup and recovery readiness

The selected Supabase Free baseline does **not** claim PITR. Stage 4 therefore records backup/recovery as an unresolved provisioning gate.

Before any database provisioning or production persistence, a later owner-authorized Issue must:

1. select a recovery mechanism genuinely available at the approved cost;
2. document scope, frequency, retention, encryption/access controls, and storage location;
3. document a restore procedure;
4. run and record a successful restore test against non-production data;
5. confirm that recovery storage does not retain payload prohibited by a later `hold_age_unknown` purge;
6. obtain explicit approval for any paid capability.

Until this gate is closed, the project must not claim backup readiness, PITR availability, disaster-recovery completion, or production persistence readiness.

---

## 10. Stage 5 handoff gate

Stage 5 remains blocked until all Stage 4 outputs are merged and Issue #39 is complete. The gate requires, at minimum:

- this physical schema on `main`;
- provider-neutral application boundaries, domain entities, and repository interfaces on `main`;
- a confirmed technology stack/provider/cost ADR using dated official evidence;
- synchronized `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and `docs/ROADMAP.md` that no longer describe the selected Stage 4 choices as merely provisional;
- the Stage 4 CI, review, Thread-resolution, expected-head merge, and parent-Issue completion record.

Only after that gate is closed may Stage 5 scaffold a minimal fixture-backed Next.js/TypeScript application and quality gates. Stage 5 may implement the already-approved provider-neutral domain types and repository interfaces, but it may not defer their definition from Stage 4 or silently redefine the Stage 4 boundaries. It may not:

- create a Supabase project or database;
- run SQL migrations;
- connect to live BOOTH;
- deploy;
- enable authentication or billing;
- add production/canonical data;
- claim backup readiness.

The application must start with fixed all-ages fixtures, keep adapters replaceable, and enforce the same publication and hold boundaries before rendering or filtering.

---

## 11. Required later validation

Before a provider-specific schema becomes executable, later Issues must verify:

- every Stage 3 entity and invariant maps to a concrete table/constraint/service check;
- all JSONB envelope checks are implemented and tested;
- every scenario has at least one explicit play-time state row and known bounds cannot be inverted;
- canonical tags preserve `canonical_name`, controlled provenance, creation time, and category-scoped uniqueness;
- every stored scenario-tag relationship has a non-null canonical target;
- ownership and purge boundaries cannot cross products;
- `is_free` is cleared on age hold;
- tombstone references have count parity and contain no reconstructable payload;
- permitted history remains append-only outside the narrow exception;
- indexes support confirmed filters and sorts, including source publication date with first-seen fallback whenever the source date is non-publishable;
- migration rollback/fix-forward behavior is tested;
- selected provider versions and limits remain current;
- the unresolved backup/recovery gate is closed before production persistence.
