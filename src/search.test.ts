import { describe, expect, it } from "vitest";
import { fixtureRepository } from "../fixtures";
import type { EvidencedValue, Product, SalesState, Scenario } from "./domain";
import { project } from "./publication";
import { EMPTY_QUERY, search } from "./search";

describe("sales-state search boundary", () => {
  const visibleProduct = (): Product => {
    const product = fixtureRepository
      .products()
      .find((candidate) => candidate.id === "visible");
    if (!product) throw new Error("missing visible product");
    return product;
  };

  const visibleScenario = (): Scenario => {
    const scenario = fixtureRepository
      .scenarios()
      .find((candidate) => candidate.id === "visible");
    if (!scenario) throw new Error("missing visible scenario");
    return scenario;
  };

  it("rejects non-applicable and structurally invalid sales states", () => {
    const product = visibleProduct();
    const scenario = visibleScenario();
    const source = product.salesState;
    if (source.state !== "known") {
      throw new Error("missing known sales-state fixture");
    }

    const notApplicable: EvidencedValue<SalesState> = {
      state: "not_applicable",
      confidence: source.confidence,
      reviewState: source.reviewState,
      evidence: source.evidence,
      contentVersion: source.contentVersion,
      checkedAt: source.checkedAt,
    };
    const invalid = {
      ...source,
      value: "unexpected_runtime_state",
    } as unknown as EvidencedValue<SalesState>;

    for (const salesState of [notApplicable, invalid]) {
      const unsafeProduct = { ...product, salesState };
      expect(project(unsafeProduct, scenario)).toEqual({
        publish: false,
        reason: "sales_state_evidence",
      });
      expect(
        search({
          products: () => [unsafeProduct],
          scenarios: () => [scenario],
        }),
      ).toEqual([]);
    }
  });

  it("puts only reviewed known-true records first and preserves all other states", () => {
    const baseline = search(fixtureRepository);
    const freeFirst = search(fixtureRepository, {
      ...EMPTY_QUERY,
      sort: "free-first",
    });
    const stableTitle = (
      a: (typeof baseline)[number],
      b: (typeof baseline)[number],
    ) => a.title.localeCompare(b.title, "ja") || a.id.localeCompare(b.id);
    const rank = (row: (typeof baseline)[number]) =>
      row.isFree.state === "known" && row.isFree.value === true ? 0 : 1;
    const expected = [...baseline].sort(
      (a, b) => rank(a) - rank(b) || stableTitle(a, b),
    );

    expect(freeFirst.map((row) => row.id)).toEqual(
      expected.map((row) => row.id),
    );
    expect([...freeFirst].map((row) => row.id).sort()).toEqual(
      [...baseline].map((row) => row.id).sort(),
    );
    expect(freeFirst.slice(0, 2).every((row) => rank(row) === 0)).toBe(true);
    expect(freeFirst.slice(2).every((row) => rank(row) === 1)).toBe(true);

    const byId = new Map(freeFirst.map((row) => [row.id, row.isFree]));
    expect(byId.get("relation")).toEqual({ state: "known", value: false });
    expect(byId.get("unknown")).toEqual({ state: "unknown" });
    expect(byId.get("long")).toEqual({ state: "omitted" });
  });
});
