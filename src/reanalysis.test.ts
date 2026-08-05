import { describe, expect, it } from "vitest";

import {
  assertReanalysisVersionKey,
  planReanalysis,
  sameReanalysisVersionKey,
  type ReanalysisVersionKey,
} from "./reanalysis";

const key = (
  contentVersion = "content-v1",
  normalizerVersion = "normalizer-v1",
  registryVersion = "registry-v1",
): ReanalysisVersionKey => ({
  contentVersion,
  normalizerVersion,
  registryVersion,
});

describe("deterministic reanalysis planning", () => {
  it("plans an initial analysis without creating a reanalysis trigger", () => {
    expect(planReanalysis(null, key())).toEqual({
      state: "initial_analysis",
      next: key(),
    });
    expect(() => planReanalysis(null, key(), "manual_trigger")).toThrow(
      /initial analysis/iu,
    );
  });

  it("skips only when all three version components are unchanged", () => {
    expect(planReanalysis(key(), key())).toMatchObject({ state: "skip" });
    expect(sameReanalysisVersionKey(key(), key())).toBe(true);
    expect(sameReanalysisVersionKey(key(), key("content-v2"))).toBe(false);
  });

  it.each([
    [key("content-v2"), "content_changed", ["content_version"]],
    [
      key("content-v1", "normalizer-v2"),
      "normalizer_version_changed",
      ["normalizer_version"],
    ],
    [
      key("content-v1", "normalizer-v1", "registry-v2"),
      "registry_version_changed",
      ["registry_version"],
    ],
  ] as const)(
    "plans the automatic trigger for one changed dimension",
    (next, trigger, dimensions) => {
      expect(planReanalysis(key(), next)).toMatchObject({
        state: "reanalyze",
        trigger,
        changedDimensions: dimensions,
      });
    },
  );

  it("records every changed dimension and uses the broadest automatic invalidation", () => {
    const plan = planReanalysis(key(), key("content-v2", "normalizer-v2", "registry-v2"));
    expect(plan).toMatchObject({
      state: "reanalyze",
      trigger: "registry_version_changed",
      changedDimensions: [
        "content_version",
        "normalizer_version",
        "registry_version",
      ],
      reasonDetail:
        "changed=content_version,normalizer_version,registry_version;trigger=automatic",
    });
  });

  it("allows an explicit manual trigger with an unchanged key", () => {
    expect(planReanalysis(key(), key(), "manual_trigger")).toMatchObject({
      state: "reanalyze",
      trigger: "manual_trigger",
      changedDimensions: [],
      reasonDetail: "changed=none;trigger=manual_trigger",
    });
  });

  it.each([
    ["content_changed", key("content-v1", "normalizer-v2")],
    ["normalizer_version_changed", key("content-v2")],
    ["registry_version_changed", key("content-v2")],
  ] as const)(
    "rejects an explicit %s trigger when its own version dimension is unchanged",
    (trigger, next) => {
      expect(() => planReanalysis(key(), next, trigger)).toThrow(
        /requires a .+-version change/iu,
      );
    },
  );

  it.each(["alias_approved", "canonical_entity_added"] as const)(
    "requires a registry-version change for %s",
    (trigger) => {
      expect(() => planReanalysis(key(), key(), trigger)).toThrow(
        /requires a registry-version change/iu,
      );
      expect(
        planReanalysis(
          key(),
          key("content-v1", "normalizer-v1", "registry-v2"),
          trigger,
        ),
      ).toMatchObject({ state: "reanalyze", trigger });
    },
  );

  it.each([
    key(""),
    key(" content-v1"),
    key("content-v1 "),
    key("content\u0000v1"),
    key("x".repeat(257)),
  ])("rejects invalid or ambiguous version identifiers", (invalid) => {
    expect(() => assertReanalysisVersionKey(invalid)).toThrow(
      /invalid reanalysis version field/iu,
    );
  });

  it("returns detached version-key objects", () => {
    const previous = key();
    const next = key("content-v2");
    const plan = planReanalysis(previous, next);
    previous.contentVersion = "caller-mutated-old";
    next.contentVersion = "caller-mutated-new";
    expect(plan).toMatchObject({
      previous: { contentVersion: "content-v1" },
      next: { contentVersion: "content-v2" },
    });
  });
});
