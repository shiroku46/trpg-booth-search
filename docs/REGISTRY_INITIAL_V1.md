# Initial Reviewed TRPG Registry v1

Issue: #105

## Status

`registry-2026-08-06.1` is the first reviewed, provider-neutral repository registry for system families, editions, books, and approved aliases.

It is bounded identity data. It is not a popularity list, recommendation set, BOOTH collection result, hosted-database seed, or authorization to replace the synthetic fixture Preview.

Executable files:

- `registry/initial-v1.json` — immutable reviewed manifest;
- `src/registry.ts` — comparison-key normalizer, validator, and fail-closed resolver;
- `src/registry.test.ts` — identity, reference, evidence-domain, collision, and fixture-boundary tests.

## Inclusion principle

The initial entries were selected to exercise different normalization cases rather than to rank systems:

1. a family with multiple explicitly named editions and common edition labels;
2. an editionless system whose official core rules are published on the Web;
3. a current revised core rulebook;
4. a family/edition split with an official abbreviation and multiple core-rulebook volumes.

No omission means that another system is unsupported in product policy. A later reviewed registry change may add records without changing existing immutable IDs.

## Reviewed entity counts

| Entity | Count |
|---|---:|
| System families | 4 |
| Editions | 4 |
| Books | 8 |
| Approved aliases | 23 |

## System families and editions

| System-family ID | Japanese label | Reviewed editions |
|---|---|---|
| `sf-cthulhu-trpg` | クトゥルフ神話TRPG | `ed-cthulhu-classic` クラシック版; `ed-cthulhu-new` 新版 |
| `sf-emoklore-trpg` | エモクロアTRPG | none; no edition is invented |
| `sf-shinobigami` | 忍術バトルRPG シノビガミ | `ed-shinobigami-revised` 改訂版 |
| `sf-sword-world` | ソード・ワールド | `ed-sword-world-2-5` 2.5 |

The CoC edition aliases `旧版`, `6版`, and `7版`, the Shinobigami revised wording, and the Sword World forms `ソード・ワールド2.5` and `SW2.5` are stored as separate approved alias records rather than folded into display labels.

## Books

| Book ID | Japanese label | Family / edition | Medium |
|---|---|---|---|
| `bk-cthulhu-classic-rulebook` | クトゥルフ神話TRPG | CoC / クラシック版 | print |
| `bk-cthulhu-new-rulebook` | 新クトゥルフ神話TRPG ルールブック | CoC / 新版 | print |
| `bk-emoklore-web-rulebook` | エモクロアTRPG公式ルールブック | エモクロアTRPG / editionless | Web |
| `bk-shinobigami-revised-rulebook` | 忍術バトルRPG シノビガミ 基本ルールブック 改訂版 | シノビガミ / 改訂版 | print |
| `bk-sword-world-2-5-rulebook-1` | ソード・ワールド2.5 ルールブックI | ソード・ワールド / 2.5 | print |
| `bk-sword-world-2-5-rulebook-2` | ソード・ワールド2.5 ルールブックII | ソード・ワールド / 2.5 | print |
| `bk-sword-world-2-5-rulebook-3` | ソード・ワールド2.5 ルールブックIII | ソード・ワールド / 2.5 | print |
| `bk-sword-world-2-5-rulebook-dx` | ソード・ワールド2.5 ルールブックDX | ソード・ワールド / 2.5 | print |

These are book identities only. The manifest does not claim that every scenario requires every listed book, does not create scenario-book requirements, and does not treat the DX title as a silent substitute relationship.

## Official evidence boundary

Facts were reviewed on 2026-08-06 against first-party publisher or rights-holder pages only.

### KADOKAWA — クトゥルフ神話TRPG

- https://product.kadokawa.co.jp/cthulhu/about.html
- https://product.kadokawa.co.jp/cthulhu/coc-rule-book/

The registry stores the family, the official `クラシック版` / `新版` distinction, the explicitly presented `旧版` / `6版` / `7版` labels, and the two core-book identities.

### TEAM DICETOUS — エモクロアTRPG

- https://emoklore.dicetous.com/
- https://emoklore.dicetous.com/rulebook/

The registry stores an editionless system and a Web-medium core rulebook. The rules site remains an evidence URL; its text is not copied into the repository.

### 冒険企画局 — シノビガミ

- https://bouken.jp/prod/ttrpg/207/
- https://bouken.jp/pd/sg/product_sgbasic2.html
- https://bouken.jp/pd/sg/support.html

The registry stores the system family, the reviewed revised edition, the current revised core-book identity, and the official short family label.

### Group SNE / KADOKAWA — ソード・ワールド

- https://www.groupsne.co.jp/products/sw/
- https://www.kadokawa.co.jp/product/321803001653/
- https://www.kadokawa.co.jp/product/321803001657/
- https://www.kadokawa.co.jp/product/321803001658/
- https://www.kadokawa.co.jp/product/322501000164/

The registry stores the family/2.5 edition boundary, the official `SW2.5` abbreviation, and the four bounded core-book identities. It does not copy product descriptions or commercial fields.

## Comparison-key contract

`system-normalizer-v1` applies these steps without modifying `originalSourceText`:

1. NFC normalization;
2. full-width ASCII/digit and ideographic-space folding;
3. Unicode lowercase conversion;
4. whitespace collapse and trim;
5. documented folding of hyphen, quote, and middle-dot variants;
6. final whitespace cleanup.

The comparison key assists matching only. Source-observed text remains intact in every alias record.

## Resolution contract

Resolution is target-aware:

- one reviewed target returns `resolved`;
- no target returns `no_match`;
- multiple candidates of different entity types return `ambiguous` unless a target type is supplied;
- multiple candidates within one entity type return `hold_alias_conflict`;
- the resolver never selects a preferred edition or book from publication date, popularity, price, filename, shop identity, or missing evidence.

For example, `クトゥルフ神話TRPG` is both a system-family label and a book title. Unscoped resolution is intentionally ambiguous; scoped resolution can select either the family or book target without rewriting the source text.

## Fixture and deployment boundary

The current Preview remains synthetic:

- `SYSTEM_OPTIONS`, `EDITION_OPTIONS`, and `BOOK_OPTIONS` keep their synthetic values;
- the real registry is not imported by `src/search.ts`;
- no real system label is exposed in fixture screenshots;
- no CSS, Design B snapshot, route, search result, Vercel setting, provider, Secret, or hosted database is changed;
- no network request is made by registry validation or alias resolution.

Connecting this registry to collection, PostgreSQL seed rows, or public filters requires a separate reviewed Issue.

## Prohibited data

The manifest contains no exact price, currency, product image, copied description, popularity score, rating, recommendation, affiliate data, login state, or BOOTH product record. Evidence URLs are bounded identity provenance only.

## Change control

Future changes must:

- preserve existing immutable IDs;
- bump `registryVersion` for any manifest change;
- bump `normalizerVersion` only when comparison-key behavior changes;
- retain prior labels as alias history when canonical labels change;
- validate redirect chains before redirects are introduced;
- use reviewed first-party evidence;
- add or update tests before merge.
