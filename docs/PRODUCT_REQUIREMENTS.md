# Product Requirements

> **Status**: Confirmed MVP requirements. See [DECISIONS.md](DECISIONS.md) for accepted and pending decisions, [ROADMAP.md](ROADMAP.md) for the planned delivery sequence, and [ARCHITECTURE.md](ARCHITECTURE.md) for provisional technical candidates.

---

## Purpose

Improve conditional discovery of all-ages TRPG scenarios on BOOTH while purchase, payment, and download remain on BOOTH. This product is a search and discovery helper, not a marketplace replacement.

---

## Discovery Goals

- Reduce concentration on popular items so that less-visible works surface.
- Enable discovery of scenarios for unfamiliar TRPG systems.
- Support finding scenarios by player count and play time.

---

## MVP Source and Scope

- **Source**: BOOTH only.
- **Content**: All-ages TRPG scenarios across systems.
- **Extensibility**: The data model must allow future product-type extension without breaking the existing schema.

---

## MVP Exclusions

The following are explicitly excluded from the MVP:

- R-18 and R-18G content — excluded from collection, storage, and publication (see [DATA_COLLECTION_POLICY.md](DATA_COLLECTION_POLICY.md)).
- User accounts, login, and favorites.
- Internal product-detail pages hosted by this application.
- Product images.
- Exact prices and pricing comparisons.
- Advertising and affiliate links.
- Author submission flows.

---

## Navigation

Search results link directly to the parent BOOTH product page. Navigation to BOOTH is the primary action; no product-detail page is provided within this application for MVP.

---

## Product State Handling

- Products with an ended (discontinued) sales state are excluded from normal search results.
- Ended products are retained in internal history for reconciliation and change tracking.

---

## Player Count Rules

- Minimum and maximum player count (PL) fields are tracked separately.
- The following require separate fields:
  - **GM/KP required**: the scenario requires a dedicated game master or keeper.
  - **GM-less**: the scenario can be run without a dedicated GM.
  - **KPC (Key Player Character)**: the scenario includes a keeper-player character role.

---

## Play Time Rules

- Minimum and maximum play time are tracked separately.
- Play time may be modality-specific (for example, online versus offline may differ).
- Explicit unknown handling is required: a scenario with no stated play time must be distinguishable from one that states a specific range.

---

## Structured Scenario Fields

The following fields are tracked separately:

| Field | Notes |
|---|---|
| Conversation method | For example: voice, text, mixed. |
| Play environment | For example: offline, online, hybrid. |
| Progression method | For example: fixed-path, open-world, branching. |
| Work composition | For example: single scenario, anthology, campaign. |
| Handout | Whether the scenario includes handout materials. |

---

## Tag System

Five initial tag categories are defined. For all tags:

- Provenance is tracked separately: tags may originate from BOOTH metadata, derived extraction, or both.
- Derived tags carry evidence metadata (source, confidence, method).
- Spoiler-suspect content is excluded from tags surfaced in discovery.

The five initial categories and their additional rules:

1. **System tags** — normalized system name, edition, alias, required rulebook, and optional supplement structure (see [Normalized System Structure](#normalized-system-structure) below).
2. **Theme tags** — thematic content descriptors.
3. **Setting tags** — world and genre descriptors.
4. **Tone tags** — mood and emotional register descriptors.
5. **Mechanics tags** — notable mechanical features.

---

## Normalized System Structure

Each system entry includes:

- Normalized system name.
- Edition (when applicable).
- Known aliases and alternative names.
- Required rulebook(s).
- Optional supplements (tracked separately from required).

---

## Sorting Options

The following sort orders are confirmed for MVP:

| Sort | Notes |
|---|---|
| Discovery | Promotes less-visible works. |
| New | By publication date. |
| Last-checked | By the date this application last verified the product. |
| Title | Alphabetical. |
| Seeded random | Reproducible random order keyed by a seed. |
| Free-first | Free products sorted before paid. |

The following are **deferred** (not included in MVP):

- Rating-based sorting.
- Recommendation-based sorting.

---

## Product and Scenario Data Model

A two-layer model is used:

- **BOOTH product**: the top-level unit as it exists on BOOTH (a single purchasable item).
- **Individual scenario**: one or more scenarios contained within a product.

### Collection handling rules

- A scenario collection (a product containing multiple distinct scenarios) is modelled at both layers.
- Conservative handling applies: when scenario boundaries within a product are ambiguous, the product is not split.
- Products that contain only supplemental material (for example, map packs, token sheets) or DLC-only items are excluded from scenario search results.

---

## Design References

- **VRCFinder** is a structural reference only — UI patterns may inform the layout without copying code or data.
- The visual design direction is **retro Japanese archive-room**: typography and aesthetic inspired by late-1990s and early-2000s Japanese archive and catalogue sites, distinct from VRCFinder.

---

## Language and Accessibility

- **Japanese only** for MVP. No multilingual support is planned for MVP.
- Modern accessibility requirements:
  - Keyboard navigation throughout.
  - Mobile-responsive layout.
  - Performance: target fast initial load and minimal layout shift.
  - No blinking or flashing content.
