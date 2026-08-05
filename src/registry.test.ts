import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BOOK_OPTIONS, EDITION_OPTIONS, SYSTEM_OPTIONS } from "./search";
import {
  INITIAL_REGISTRY,
  INITIAL_REGISTRY_VALIDATION,
  normalizeRegistryComparisonKey,
  resolveRegistryAlias,
  type RegistryAlias,
  type RegistryManifest,
  validateRegistry,
} from "./registry";

describe("reviewed initial registry v1", () => {
  it("loads a valid, bounded manifest with exact reviewed counts", () => {
    expect(INITIAL_REGISTRY_VALIDATION).toEqual({ valid: true, errors: [] });
    expect(INITIAL_REGISTRY.registryVersion).toBe("registry-2026-08-06.1");
    expect(INITIAL_REGISTRY.normalizerVersion).toBe("system-normalizer-v1");
    expect(INITIAL_REGISTRY.systemFamilies).toHaveLength(4);
    expect(INITIAL_REGISTRY.editions).toHaveLength(4);
    expect(INITIAL_REGISTRY.books).toHaveLength(8);
    expect(INITIAL_REGISTRY.aliases).toHaveLength(23);
  });

  it("keeps globally unique immutable IDs and valid family references", () => {
    const entities = [
      ...INITIAL_REGISTRY.systemFamilies,
      ...INITIAL_REGISTRY.editions,
      ...INITIAL_REGISTRY.books,
    ];
    const ids = entities.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

    const families = new Set(
      INITIAL_REGISTRY.systemFamilies.map(({ id }) => id),
    );
    const editions = new Map(
      INITIAL_REGISTRY.editions.map((edition) => [edition.id, edition]),
    );
    for (const edition of INITIAL_REGISTRY.editions)
      expect(families.has(edition.systemFamilyId)).toBe(true);
    for (const book of INITIAL_REGISTRY.books) {
      expect(families.has(book.systemFamilyId)).toBe(true);
      if (book.editionId)
        expect(editions.get(book.editionId)?.systemFamilyId).toBe(
          book.systemFamilyId,
        );
    }
  });

  it("normalizes width, case, whitespace, and punctuation without rewriting source text", () => {
    const source = "  ＳＷ２．５　—　ルール  ";
    const preserved = source;
    expect(normalizeRegistryComparisonKey(source)).toBe("sw2.5 - ルール");
    expect(source).toBe(preserved);
    expect(normalizeRegistryComparisonKey("ソード・ワールド")).toBe(
      "ソード ワールド",
    );
    expect(normalizeRegistryComparisonKey("Ａ‐Ｂ")).toBe("a-b");
  });

  it.each([
    ["６版", "edition", "ed-cthulhu-classic"],
    ["7版", "edition", "ed-cthulhu-new"],
    ["シノビガミ", "system_family", "sf-shinobigami"],
    ["ＳＷ２．５", "edition", "ed-sword-world-2-5"],
    ["エモクロアTRPG公式ルールブック", "book", "bk-emoklore-web-rulebook"],
  ] as const)(
    "resolves the reviewed alias %s inside its target boundary",
    (input, targetEntityType, targetId) => {
      expect(resolveRegistryAlias(input, targetEntityType)).toEqual({
        state: "resolved",
        comparisonKey: normalizeRegistryComparisonKey(input),
        targetEntityType,
        targetId,
      });
    },
  );

  it("does not guess when one label is valid across entity types", () => {
    const resolution = resolveRegistryAlias("クトゥルフ神話TRPG");
    expect(resolution.state).toBe("ambiguous");
    if (resolution.state !== "ambiguous") return;
    expect(resolution.candidates).toEqual([
      {
        targetEntityType: "book",
        targetId: "bk-cthulhu-classic-rulebook",
      },
      {
        targetEntityType: "system_family",
        targetId: "sf-cthulhu-trpg",
      },
    ]);
    expect(
      resolveRegistryAlias("クトゥルフ神話TRPG", "system_family"),
    ).toMatchObject({ state: "resolved", targetId: "sf-cthulhu-trpg" });
    expect(resolveRegistryAlias("クトゥルフ神話TRPG", "book")).toMatchObject({
      state: "resolved",
      targetId: "bk-cthulhu-classic-rulebook",
    });
  });

  it("returns no_match for unsupported text", () => {
    expect(resolveRegistryAlias("未登録システム")).toEqual({
      state: "no_match",
      comparisonKey: "未登録システム",
    });
  });

  it("holds same-type comparison-key collisions instead of auto-resolving", () => {
    const registry = JSON.parse(
      JSON.stringify(INITIAL_REGISTRY),
    ) as RegistryManifest;
    const sourceAlias = registry.aliases.find(
      (alias) =>
        alias.targetEntityType === "edition" &&
        alias.originalSourceText === "6版",
    );
    expect(sourceAlias).toBeDefined();
    const conflict: RegistryAlias = {
      ...sourceAlias!,
      targetId: "ed-cthulhu-new",
    };
    registry.aliases.push(conflict);

    const validation = validateRegistry(registry);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain(
      "edition:6版: same-type alias collision requires hold_alias_conflict",
    );
    const resolution = resolveRegistryAlias("6版", "edition", registry);
    expect(resolution.state).toBe("hold_alias_conflict");
    if (resolution.state === "hold_alias_conflict")
      expect(resolution.candidates).toHaveLength(2);
  });

  it("reports an invalid runtime target type instead of throwing", () => {
    const registry = JSON.parse(
      JSON.stringify(INITIAL_REGISTRY),
    ) as RegistryManifest;
    const alias = registry.aliases.find(
      ({ originalSourceText }) => originalSourceText === "シノビガミ",
    );
    expect(alias).toBeDefined();
    (
      alias as unknown as {
        targetEntityType: string;
      }
    ).targetEntityType = "unsupported_target";

    expect(() => validateRegistry(registry)).not.toThrow();
    const validation = validateRegistry(registry);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("alias[4]: invalid target entity type");
    expect(resolveRegistryAlias("シノビガミ", undefined, registry)).toEqual({
      state: "no_match",
      comparisonKey: "シノビガミ",
    });
  });

  it("rejects calendar-invalid ISO-shaped dates", () => {
    const registry = JSON.parse(
      JSON.stringify(INITIAL_REGISTRY),
    ) as RegistryManifest;
    registry.reviewedAt = "2026-02-31";

    const validation = validateRegistry(registry);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("reviewedAt must be an ISO date");
  });

  it("keeps the fixture Preview synthetic and disconnected from real registry data", () => {
    expect(SYSTEM_OPTIONS).toEqual([
      "合成システムA",
      "合成システムB",
      "unknown",
    ]);
    expect(EDITION_OPTIONS).toEqual(["6版", "7版", "unknown"]);
    expect(BOOK_OPTIONS).toEqual(["基本ルールブック", "追加資料集", "unknown"]);
    const searchSource = readFileSync(
      new URL("./search.ts", import.meta.url),
      "utf8",
    );
    expect(searchSource).not.toMatch(/from\s+["'][.]\/registry["']/u);
  });

  it("contains identity evidence only and no commercial or popularity fields", () => {
    const manifestSource = readFileSync(
      new URL("../registry/initial-v1.json", import.meta.url),
      "utf8",
    );
    expect(manifestSource).not.toMatch(
      /["']?(?:price|rating|recommendation|popularity)["']?\s*:/iu,
    );
    expect(manifestSource).not.toMatch(/[¥￥$€£]/u);
    expect(manifestSource).not.toContain("booth.pm");
  });
});
