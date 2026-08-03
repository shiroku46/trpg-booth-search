import { describe, expect, it, vi } from "vitest";
import { fixtureRepository } from "../fixtures";
import { search, HashSeededRandom } from "./search";
describe("fail-closed publication", () => {
  it("publishes only eligible scenarios and permits a valid explicit unknown", () => {
    const rows = search(fixtureRepository);
    expect(rows.map((x) => x.id)).toEqual(["relation", "unknown", "visible"]);
    expect(rows.find((x) => x.id === "unknown")).not.toHaveProperty(
      "playerCount",
    );
  });
  it("rejects unapproved classifications and invalid unknown envelopes", () => {
    const ids = search(fixtureRepository).map((x) => x.id);
    expect(ids).not.toContain("unapproved-classification");
    expect(ids).not.toContain("invalid-unknown");
  });
  it("omits an invalid relationship without hiding its scenario", () => {
    expect(
      search(fixtureRepository).find((x) => x.id === "relation")?.systems,
    ).toEqual([]);
  });
  it("never exposes exact price", () => {
    for (const row of search(fixtureRepository))
      expect(row).not.toHaveProperty("price");
  });
  it("is repeatable for a seed", () => {
    const random = new HashSeededRandom();
    const rows = search(fixtureRepository);
    expect(random.order(rows, "seed")).toEqual(random.order(rows, "seed"));
  });
  it("performs no network access", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    search(fixtureRepository);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
