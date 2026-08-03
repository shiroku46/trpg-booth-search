import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureRepository } from "../fixtures/index.ts";
import { HashSeededRandom, search } from "./search.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fail-closed publication", () => {
  it("publishes only eligible scenarios and permits explicit unknown", () => {
    const rows = search(fixtureRepository);
    expect(rows.map((row) => row.id)).toEqual(["relation", "unknown", "visible"]);
    expect(rows.find((row) => row.id === "unknown")).not.toHaveProperty("playerCount");
  });

  it("omits an invalid relationship without hiding its scenario", () => {
    expect(search(fixtureRepository).find((row) => row.id === "relation")?.systems).toEqual([]);
  });

  it("never exposes exact price", () => {
    for (const row of search(fixtureRepository)) expect(row).not.toHaveProperty("price");
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
  });
});
