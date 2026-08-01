# System Normalization Specification

## Status

Normalization specification for TRPG systems, editions, aliases, compatibility claims, rulebooks, supplements, and related entities. This document records accepted normalization rules and contracts for the product.

This document does not populate a production registry, create a database schema, or implement any application type. It does not assert unverified external facts about individual commercial systems, editions, or books. Illustrative placeholders (e.g., `sf-<token>`) are used where examples are necessary.

Cross-links: [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | [DECISIONS.md](DECISIONS.md) | [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md) | [BOOTH_COLLECTION_RESEARCH.md](BOOTH_COLLECTION_RESEARCH.md) | [ROADMAP.md](ROADMAP.md)

---

## 1. Entity Boundaries

This specification defines seven distinct entity types and two first-class state categories. Collapsing any of these into a single free-text field is prohibited.

### 1.1 `system_family`

A broad game or rules family used for discovery grouping. Represents the top-level product line or franchise under which editions and rulesets are organized.

- A `system_family` record exists independently of any specific edition.
- Multiple editions may share the same `system_family`.
- A `system_family` may have zero confirmed editions when only the family is known and no edition has been explicitly evidenced.

### 1.2 `edition`

A specific version or edition within a `system_family`. Editions are distinct entities from the system family and are not flattened into the family label.

- An `edition` must reference a parent `system_family`.
- The absence of edition evidence does not imply the earliest, latest, or most popular edition.
- An unresolved edition is represented as `edition_unknown`, not as an empty string or null.

### 1.3 `ruleset_reference`

The exact system or edition claim observed in source content, preserved verbatim. This is the raw evidence record, not a resolved canonical entity.

- A `ruleset_reference` stores the original source text without modification.
- Resolution to a `system_family` and/or `edition` is attempted separately; the reference text itself is never altered.
- A resolved record must reference exactly one canonical `system_family` and may reference one matching canonical `edition` from that family.
- An unresolved record uses the explicit `target_unresolved` state and must not receive a guessed canonical target.

### 1.4 `compatibility_claim`

An explicit compatibility, conversion, dual-support, or unknown relationship between a scenario or product and a `system_family` or `edition`, as observed in source content. Compatibility claims are preserved as stated and are not rewritten as native support.

- A `compatibility_claim` records what the source states, not what is inferred.
- The controlled relationship vocabulary is defined in Section 5.
- A resolved record must reference exactly one canonical `system_family` and may reference one matching canonical `edition` from that family.
- An unresolved record uses the explicit `target_unresolved` state and must not receive a guessed canonical target.
- A `compatibility_claim` is never automatically promoted to native support without independent, explicit evidence.

### 1.5 `book`

A rulebook, core book, source book, or supplement referenced by a scenario. A `book` is a distinct entity from the scenario-book relationship.

- Book identity (what the book is) is separate from the requirement (how a scenario uses it).
- A `book` entity may be associated with a `system_family` but is not required to be.
- Books whose canonical identity is unresolved retain their observed title text until a reviewed registry addition resolves them.

### 1.6 `book_requirement`

The relationship between a specific scenario and a `book`. This is a separate entity from the `book` itself.

- A `book_requirement` records the kind of relationship (required, optional, etc.) and the observed title text, even when canonical book identity is unresolved.
- Scope is at the individual-scenario level, not the BOOTH-product level; different scenarios within a single product may have different book requirements.
- Multiple `book_requirement` records may form a group expressing "one of these books is required."

### 1.7 `observed_alias`

Source text that may map to a canonical entity (`system_family`, `edition`, or `book`) but remains preserved verbatim for evidence.

- The original source text is never altered or destroyed.
- Alias normalization produces a `comparison_key` for matching but does not replace the original text.
- A single comparison key may yield multiple alias records that remain in conflict.
- An approved alias mapping is a separate, reviewed decision from the raw alias record.

### 1.8 `unknown` and `hold` States

`unknown` and `hold` states are first-class values, not empty strings, null, zero, or absent fields.

| State value | Meaning |
|---|---|
| `edition_unknown` | The edition is genuinely unknown; no explicit evidence exists |
| `target_unresolved` | A ruleset or compatibility target could not be resolved to a canonical system family and must not be guessed |
| `hold_alias_conflict` | Two or more alias records with the same comparison key resolve to different candidates and cannot be auto-resolved |
| `hold_book_conflict` | Conflicting or insufficient evidence prevents automatic book identification |
| `hold_compatibility_conflict` | Conflicting compatibility evidence cannot be auto-resolved |
| `derived_candidate` | A candidate produced by AI; never auto-published |

These values must be represented in storage and displayed appropriately to users, not silently omitted.

---

## 2. Stable Identifiers and Labels

### 2.1 Immutable Internal Identifiers

Every canonical entity (`system_family`, `edition`, `book`) has a unique immutable internal identifier. This identifier:

- Does not depend on display names, source URLs, or external facts.
- Does not change when the canonical display label changes.
- Does not encode the classification hierarchy; parent/child relationships are stored as separate fields.
- Is created only through a reviewed registry addition, never from AI output alone.

### 2.2 Identifier Character Set

Identifiers use a restricted machine-safe character set:

- Allowed characters: lowercase ASCII letters (`a`–`z`), digits (`0`–`9`), and hyphens (`-`).
- Hyphens may not appear at the start or end of an identifier.
- Identifiers must not be empty.
- Maximum length: 64 characters.

Illustrative placeholder forms: `sf-<opaque-token>` for system families, `ed-<opaque-token>` for editions, `bk-<opaque-token>` for books. The opaque token is assigned deterministically at review time.

### 2.3 Display Labels

Display labels are stored separately from identifiers:

- Labels are keyed by BCP 47 locale code (e.g., `ja`, `en`).
- The primary display label for MVP is Japanese (`ja`).
- Additional locale labels are optional and stored alongside the primary label without replacing it.
- Labels may be added or changed without changing the identifier.
- A label change does not create a new entity; only the label field changes.
- Previous labels are preserved in alias history for matching and audit.

### 2.4 Canonical-Label Changes

When the canonical display label of an entity changes:

1. The identifier is unchanged.
2. The previous label is retained as an `observed_alias` record with kind `official_label` for backward compatibility.
3. A registry history entry records the label-change event, date, and reason.
4. No silent remapping of previously published data occurs.

### 2.5 Deprecated and Merged Identifiers

When an entity is deprecated or merged into another:

- The original identifier is never deleted or silently overwritten.
- A `redirect_to` field points to the replacement identifier.
- Any system resolving the original identifier follows the redirect automatically.
- The redirect chain is finite and acyclic.
- The reason for deprecation or merge is recorded in the registry history with a date and evidence reference.

### 2.6 Uniqueness and Collision Handling

Identifiers are assigned to be globally unique within the registry:

- Identifier assignment is deterministic and reviewed; AI may not propose or create identifiers.
- In the event of a collision detected at review time, the collision is logged and held.
- No automatic resolution of a collision is applied.
- Human review resolves the collision before either conflicting identifier is published.

### 2.7 No AI-Generated Identifiers

AI output may suggest candidate display labels as part of candidate generation (see Section 7) but may not create, assign, or alter canonical identifiers. Identifier creation is always a human-reviewed registry action.

---

## 3. Alias Normalization

### 3.1 Alias Record Structure

Every `observed_alias` record contains:

| Field | Description |
|---|---|
| `original_source_text` | The source text exactly as observed, verbatim, with no modification |
| `comparison_key` | Normalized form produced by the documented normalization pipeline (see 3.2) |
| `alias_kind` | Classification of the alias type (see 3.3) |
| `target_entity_type` | The entity type this alias may refer to: `system_family`, `edition`, or `book` |
| `candidate_id` | Candidate canonical identifier; null if unresolved |
| `source_url` | The URL or source-record identifier where this text was observed |
| `evidence_location` | Non-spoiler pointer to where in the source the text appears (e.g., `title`, `tag`, `description_excerpt`) |
| `confidence` | Confidence in the alias-to-entity mapping: `high`, `medium`, `low`, or `unresolved` |
| `conflict_status` | `clear` or `hold_alias_conflict` |
| `first_observed` | ISO 8601 timestamp of the first observation |
| `last_observed` | ISO 8601 timestamp of the most recent observation |
| `normalizer_version` | Version string of the normalizer rules that produced the comparison key |
| `review_state` | `pending`, `approved`, or `rejected` |

### 3.2 Normalization Pipeline

The comparison key is produced by applying the following transformations in order:

1. **Unicode normalization**: apply NFC normalization to the source text.
2. **Width normalization**: convert full-width ASCII characters and digits to their half-width equivalents (NFKC width folding applied to those code points).
3. **Case normalization**: convert to Unicode lowercase.
4. **Whitespace normalization**: collapse all runs of whitespace characters (including ideographic spaces U+3000) to a single ASCII space; trim leading and trailing whitespace.
5. **Punctuation normalization**: normalize typographical variants of common punctuation to their closest ASCII equivalents for matching purposes; this affects only the comparison key and not the original text.

The normalization pipeline assists matching only. It never alters or destroys the `original_source_text`. A future normalizer-version bump requires reprocessing all comparison keys; both old and new version records are retained.

### 3.3 Alias Kinds

| Kind | Meaning |
|---|---|
| `official_label` | A label used on official product materials or official announcements |
| `abbreviation` | A shortened form such as an acronym or initialism |
| `common_variant` | A variant form commonly used in the community but not an abbreviation or transliteration |
| `transliteration` | A phonetic rendering in a different script (e.g., katakana of a foreign-language name) |
| `typographical_variant` | A form that differs only in punctuation, spacing, or Unicode width |
| `unclassified` | Kind has not yet been determined |

### 3.4 Comparison Key Precedence and Conflict Handling

When two or more alias records share the same comparison key:

- They are distinct records; neither is destroyed.
- If they resolve to the same candidate entity, the conflict status is `clear`.
- If they resolve to different candidate entities, the conflict status is `hold_alias_conflict`.
- Exact deterministic mappings (approved canonical mappings) take precedence over unresolved candidate mappings.
- A `hold_alias_conflict` is not auto-resolved; it requires human review before publication.
- A `hold_alias_conflict` on one alias does not prevent the containing scenario from publishing other fields that are independently evidenced.

---

## 4. Edition Handling

Edition handling is fail-closed. The following rules apply without exception.

### 4.1 Explicit Evidence Required

An edition field may be assigned only when explicit source evidence supports it. Explicit evidence means the source content clearly and unambiguously names the specific edition—not a system family, not an inferred version.

### 4.2 Default: `edition_unknown`

When a `system_family` is identified but no explicit edition evidence is present, the edition field is set to `edition_unknown`. This is the expected state for many scenarios and must not be overridden by inference.

### 4.3 Prohibited Inference Bases

The following observations must not be used as the sole basis for assigning an edition:

- Publication date of the scenario or BOOTH product.
- Popularity or sales volume.
- Shop affiliation or shop name.
- Price or free/paid status.
- Filename or file format.
- A single ambiguous keyword that does not unambiguously name an edition.

A combination of such signals may raise confidence for a candidate but cannot substitute for explicit edition evidence when confidence remains below the publication threshold.

### 4.4 Multiple Editions

When source evidence explicitly names multiple editions (e.g., a scenario that natively supports two distinct editions), all named editions are recorded as separate `edition` references without selecting one as preferred.

### 4.5 Compatibility vs. Native Edition Support

Compatibility with an edition (see Section 5) does not automatically mean native edition support. The `compatibility_claim` and the native `system_family`/`edition` field are kept distinct.

### 4.6 Conflicting Edition Evidence

When two or more source signals provide conflicting explicit edition evidence for a field that would otherwise be published:

- The edition field is not automatically published; it is held with `hold_compatibility_conflict`.
- The `system_family` candidate may still be published independently if it is supported by non-conflicting evidence.
- Conflicting edition evidence is preserved in full for human review.
- Human review resolves the conflict before the edition field is published.

### 4.7 Edition Aliases vs. Family Aliases

Edition aliases and system-family aliases are maintained in separate `observed_alias` records. An alias that could refer to either an edition or a family is recorded with `alias_kind: unclassified` until a reviewer determines the correct target entity type.

---

## 5. Compatibility Relationships

### 5.1 Controlled Vocabulary

The following relationship kinds are the only permitted values for `compatibility_claim` records:

| Kind | Meaning |
|---|---|
| `native` | The scenario is natively written for this system/edition; this is the primary intended system |
| `explicitly_compatible` | Source content explicitly states compatibility without providing conversion rules |
| `conversion_provided` | Source content provides or references explicit conversion rules enabling play with this system/edition |
| `dual_or_multi_edition` | Source content explicitly supports two or more editions with equal or near-equal treatment |
| `derived_candidate` | A compatibility relationship suggested by AI from ambiguous evidence; never auto-published |
| `unknown` | Relationship type is not determinable from current evidence |

### 5.2 Evidence Requirements

Every non-native relationship requires documented evidence:

- Source URL or source-record identifier.
- Evidence type (e.g., `product_description_excerpt`, `tag`, `included_file_reference`).
- Non-spoiler evidence pointer.
- Confidence level.

The `derived_candidate` kind additionally requires the model identifier, prompt template version, and generation date.

### 5.3 Non-Native Relationships Must Not Be Presented as Native

No `explicitly_compatible`, `conversion_provided`, `dual_or_multi_edition`, or `derived_candidate` relationship may be displayed to users as native support. Display rules (see Section 10) must preserve the relationship kind.

### 5.4 `derived_candidate` Is Never Auto-Published

A `derived_candidate` compatibility relationship produced by AI is held for human review without exception. It must not appear in public search results or displays until approved.

---

## 6. Rulebooks and Supplements

### 6.1 Book Identity vs. Scenario-Book Relationship

Book identity (the `book` entity) and the relationship between a scenario and a book (the `book_requirement` entity) are separate records. A single `book` entity may be referenced by many `book_requirement` records across many scenarios.

### 6.2 Book Kinds

| Kind | Meaning |
|---|---|
| `core_rulebook` | The primary rulebook required to play the system |
| `required_supplement` | A supplement that must be owned to play the scenario as written |
| `optional_supplement` | A supplement that enriches play but is not strictly required |
| `setting_source_book` | A setting or lore book that the scenario references |
| `alternative_book` | A book that may substitute for another in the same requirement group |
| `unknown` | Kind has not yet been determined |

### 6.3 Requirement Kinds

| Kind | Meaning |
|---|---|
| `required` | This book must be owned to play the scenario |
| `required_one_of` | One of a specified group of books must be owned (see 6.5) |
| `recommended` | This book is recommended but not strictly required |
| `optional` | This book is useful but genuinely optional |
| `provided_with_product` | This book or equivalent content is included with the BOOTH product |
| `unknown` | Requirement level is not determinable from current evidence |

### 6.4 Scenario-Level Scope

Book requirements are recorded at the individual-scenario level, not the BOOTH-product level. A BOOTH product containing multiple scenarios may have different book requirements for each scenario; these must not be aggregated across scenarios.

### 6.5 Groups: `required_one_of`

When source content states that a player must own one book from a list (but not necessarily all), this is represented as a `required_one_of` group:

- All books in the group share a `group_id` and the `required_one_of` requirement kind.
- The group is not flattened into a single `required` record.
- A group must have at least two members to be `required_one_of`; a single-member case uses `required`.

### 6.6 Preservation of Observed Title Text

The `observed_title_text` field of a `book_requirement` record stores the exact title text as observed in source content, even when canonical book identity is unresolved. Canonical identity resolution is a separate step from recording the requirement.

### 6.7 No Identification from Ambiguous Acronym Alone

A book must not be automatically assigned a canonical identity based solely on a short ambiguous acronym without additional distinguishing evidence. When an acronym is the only evidence, the `book_requirement` records the observed text and leaves `candidate_id` null until human review resolves it.

### 6.8 `hold_book_conflict`

When book identification evidence conflicts or is insufficient:

- The `book_requirement` record is not automatically published with a canonical book identity.
- The `conflict_status` is set to `hold_book_conflict`.
- The `observed_title_text` is preserved verbatim.
- Human review resolves the conflict before a canonical book identity is published.

---

## 7. Rules-First Extraction and AI Boundary

### 7.1 Extraction Precedence

Fields are determined using the following precedence, applied in order:

1. **Explicit structured or clearly labelled source statements** — the source content unambiguously names the system, edition, or book using clearly labelled structured text (e.g., a dedicated "対応システム" field or a clearly formatted rulebook list).
2. **Exact approved alias mappings** — the source text exactly matches an alias record whose `review_state` is `approved` in the reviewed registry.
3. **Deterministic contextual rules with documented evidence requirements** — rules that apply when multiple independent signals converge, each meeting a documented minimum evidence threshold.
4. **AI-generated candidates** — used only for fields that remain ambiguous after steps 1–3; candidates are never auto-published.
5. **Human review or hold** — when confidence, conflict, or spoiler safety cannot be resolved by steps 1–4, the field is held for manual review.

### 7.2 AI Boundary

AI output is restricted to candidate generation only:

- AI may not create canonical entities (system families, editions, books).
- AI may not merge identifiers or decide that two records refer to the same entity.
- AI may not decide the official status of any alias or relationship.
- AI may not auto-publish any derived field.
- AI may not create, assign, or alter canonical identifiers (see Section 2.7).

Every AI-generated candidate must record:

- Model identifier and version.
- Prompt template version.
- Source evidence used (source URL and evidence type).
- Confidence score or tier.
- Date of generation.

### 7.3 Reanalysis Avoidance

Reanalysis (including AI extraction) is skipped only when all three values are unchanged since the last analysis:

- The relevant content version/hash.
- The normalizer/classifier version.
- The reviewed registry snapshot/version used for canonical resolution.

Any change to the reviewed registry—including an approved alias, canonical mapping, redirect, merge, label, or registry entry—invalidates the prior analysis key and forces reanalysis of affected resolved and unresolved records. When reanalysis occurs, old and new version records are retained.

---

## 8. Provenance, Confidence, and Spoiler Safety

### 8.1 Required Provenance Fields

Every normalized or AI-derived field stores the following minimum metadata for Stage 3:

| Field | Description |
|---|---|
| `value` | The derived value or candidate |
| `source_url` | Source URL or source-record identifier |
| `evidence_type` | Type of evidence (e.g., `product_title`, `description_excerpt`, `tag`, `structured_field`) |
| `evidence_pointer` | Non-spoiler pointer to the location within the source (e.g., `title`, `tag_list_item`, `description_first_paragraph`) |
| `extraction_method` | How the value was derived: `explicit_source`, `approved_alias`, `deterministic_rule`, or `ai_candidate` |
| `confidence` | `high`, `medium`, `low`, or `unresolved` |
| `conflict_reason` | Reason code if a conflict exists, or null |
| `hold_reason` | Hold reason code if the field is held, or null |
| `content_version` | Hash or version identifier of the source content at analysis time |
| `normalizer_version` | Version of the normalizer/classifier rules used |
| `registry_version` | Version of the reviewed registry snapshot used, including for unresolved results |
| `checked_at` | ISO 8601 timestamp of the access that produced this evidence |
| `reviewed_at` | ISO 8601 timestamp of the most recent human review, or null |
| `reviewer_state` | `unreviewed`, `approved`, `rejected`, or `needs_more_evidence` |

### 8.2 Spoiler Safety

Normalization evidence must not persist or expose spoiler text:

- When evidence can only be expressed using content that would spoil the scenario's plot, the spoiler text is not stored as a normalization evidence field.
- A safe pointer or flag (e.g., `evidence_pointer: spoiler_content_present`) is stored instead of the spoiler text.
- The public field is held for human review when the only available evidence is spoiler-bearing.
- A non-spoiler alternative evidence path is preferred when available.

---

## 9. Registry Governance and Versioning

### 9.1 Initially Empty or Minimal Reviewed Registry

The canonical entity registry starts empty or with a minimal set of reviewed entries. No guessed, inferred, or unreviewed entries populate the initial registry. Which actual systems and books seed the first reviewed registry is a pending decision (see PD-007 in [DECISIONS.md](DECISIONS.md)).

### 9.2 Proposed Additions

New entity additions and alias mapping approvals are proposed through dedicated Issues or Pull Requests:

- Each proposed addition specifies the entity type, candidate identifier form, display label, evidence, and source reference.
- No candidate is added to the reviewed registry without a human reviewer approving the Pull Request.
- Rejected candidates are recorded with the reason for rejection.

### 9.3 Immutable History

The registry maintains immutable history for:

- Entity additions and their approval records.
- Label changes and their dates.
- Deprecations and merges, with their redirect targets and reasons.
- Rejected candidates and rejection reasons.
- Alias approvals and rejections.

History is append-only; records are not silently deleted or overwritten.

### 9.4 Semantic Versioning

Normalization rules and registry snapshots are versioned using semantic versioning (MAJOR.MINOR.PATCH) or an equivalent explicit version scheme:

- **MAJOR**: backward-incompatible changes to identifier format, entity model, or comparison-key algorithm that require full reprocessing.
- **MINOR**: new entity kinds, new alias kinds, new relationship kinds, or new provenance fields.
- **PATCH**: documentation clarifications, new alias records, label corrections, or new approved mappings that do not change the comparison algorithm.

### 9.5 Reproducible Re-Normalization

When normalization rules or the registry change:

- Re-normalization produces old and new version records for every affected field, including previously unresolved results.
- Previously published data is not silently remapped.
- Both `normalizer_version` and `registry_version` are recorded for the old result and the new result.

### 9.6 Metrics

The following metrics are tracked to evaluate normalization quality and guide registry growth priorities:

| Metric | Description |
|---|---|
| Unknown rate | Proportion of system-family fields set to `edition_unknown` after extraction |
| Conflict rate | Proportion of records with any conflict status |
| Hold rate | Proportion of records with any hold status |
| Alias-hit rate | Proportion of `ruleset_reference` records that match an approved alias |
| Manual-review rate | Proportion of records requiring human review before publication |

### 9.7 Criteria for Revisiting

A mapping or split/merge decision is revisited when:

- New source evidence contradicts an accepted decision.
- A registry conflict is reported and cannot be resolved without changing a prior decision.
- The unknown rate, conflict rate, or hold rate for a field type rises above a threshold defined in a future metric decision.
- A community finding or legal requirement necessitates a change in how a system or edition is identified.

---

## 10. Search and Display Contract

This section defines the intended future behavior without implementing it. No search or display code exists at this stage.

### 10.1 Search Behavior

- Search may match canonical labels and approved aliases.
- Aliases do not produce duplicate scenario results; deduplication is applied after alias expansion.
- Redirected identifiers remain resolvable; a search using a deprecated identifier finds the current canonical entity.
- `edition_unknown` is a searchable state, not a silent omission.

### 10.2 Display Behavior

- Canonical labels are used for display.
- Edition and exact source wording may be shown where useful (e.g., in a detail panel).
- `edition_unknown` is displayed as an explicit indicator (e.g., "版不明"), not omitted or replaced with a guess.
- Non-native compatibility relationships are labelled distinctly from native support (e.g., "互換" rather than "対応").

### 10.3 Filter Behavior

Filters distinguish between:

- System family (broad grouping).
- Edition (specific version within a family, including an explicit "edition unknown" option).
- Compatibility type (native, explicitly compatible, etc.).
- Book requirement kind (required, optional, provided, etc.).

### 10.4 User-Visible Wording

User-visible wording must not overstate compatibility or book requirements:

- A scenario whose `compatibility_claim` is `explicitly_compatible` is not described as "designed for" that system.
- A `recommended` book is not described as "required."
- An `edition_unknown` scenario is not described as being for any specific edition.

---

## 11. Stage 3 Handoff: Minimum Contract

This section defines the minimum contract that the next BOOTH-product / individual-scenario data-model Issue must satisfy. No concrete database schema or application types are defined here; Stage 3 defines those.

### 11.1 Entity Keys

The data model must define stable foreign keys for all entity types:

- `system_family.id` — immutable; created by reviewed registry addition only.
- `edition.id` — immutable; references `system_family.id`.
- `book.id` — immutable; created by reviewed registry addition only.
- `observed_alias.id` — internal record identifier for alias records.
- `ruleset_reference.id` — internal record identifier per source observation.
- `compatibility_claim.id` — internal record identifier per claim.
- `book_requirement.id` — internal record identifier per scenario-book relationship.

### 11.2 Relationship Types

The data model must represent:

- `system_family` → `edition` (one-to-many; edition references family).
- `system_family` or `edition` → `observed_alias` (alias references entity type and candidate id).
- `scenario` → `ruleset_reference` (many-to-many; a scenario may reference multiple systems).
- Each resolved `ruleset_reference` → exactly one `system_family` and optionally one `edition` whose parent is that same family.
- Each unresolved `ruleset_reference` → explicit `target_unresolved`, with no canonical target ids populated and no guessed relationship.
- `scenario` → `compatibility_claim` (many-to-many; a scenario may have multiple compatibility relationships).
- Each resolved `compatibility_claim` → exactly one `system_family` and optionally one `edition` whose parent is that same family.
- Each unresolved `compatibility_claim` → explicit `target_unresolved`, with no canonical target ids populated and no guessed relationship.
- `scenario` → `book_requirement` (many-to-many; a scenario may require multiple books).
- `book_requirement` → `book` (optional reference; null when book identity is unresolved).
- `book_requirement` group membership (multiple requirements sharing a `group_id` for `required_one_of`).

### 11.3 Unknown and Hold Enums

The data model must represent the following as explicit typed values (enum, constant, or equivalent), not as null, empty string, or boolean flag:

- `edition_unknown`
- `target_unresolved`
- `hold_alias_conflict`
- `hold_book_conflict`
- `hold_compatibility_conflict`
- `derived_candidate`
- Review states: `unreviewed`, `approved`, `rejected`, `needs_more_evidence`
- Confidence levels: `high`, `medium`, `low`, `unresolved`

### 11.4 Provenance Structure

Every normalized or derived field in the data model must include the provenance fields defined in Section 8.1. The provenance structure must be queryable to support:

- Identifying all AI-derived fields.
- Identifying all fields pending human review.
- Identifying all fields produced by a given normalizer or registry version.
- Triggering reanalysis when the content version, normalizer version, or registry version changes.

### 11.5 Version Fields

The data model must record per field or per record:

- `normalizer_version`: the version of normalization rules that produced each derived field.
- `registry_version`: the version of the reviewed registry at the time a canonical entity was resolved or resolution remained unresolved.
- `content_version`: the hash or version identifier of the source content at analysis time.

These fields enable reproducible re-normalization and reanalysis avoidance as defined in Section 7.3.

### 11.6 What Stage 3 Does Not Define

Stage 3 defines the concrete schema. This specification defines only the normalization contract. Stage 3 must not:

- Create a production database or deployment.
- Populate the registry with unreviewed or AI-generated entities.
- Implement application types, collectors, or APIs.
- Weaken or remove the constraints defined in this specification.
