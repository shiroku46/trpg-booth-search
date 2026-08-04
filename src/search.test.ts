import { describe, expect, it } from "vitest";
import { fixtureRepository } from "../fixtures";
import type { EvidencedValue, Product, SalesState, Scenario } from "./domain";
import { project } from "./publication";
import { search } from "./search";

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
});
