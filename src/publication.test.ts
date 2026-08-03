import assert from "node:assert/strict";
import test from "node:test";
import { fixtureRepository } from "../fixtures/index.ts";
import { HashSeededRandom, search } from "./search.ts";

test("publishes only eligible scenarios and permits explicit unknown", () => {
  const rows = search(fixtureRepository);
  assert.deepEqual(rows.map((row) => row.id), ["relation", "unknown", "visible"]);
  assert.equal("playerCount" in (rows.find((row) => row.id === "unknown") ?? {}), false);
});

test("omits an invalid relationship without hiding its scenario", () => {
  assert.deepEqual(search(fixtureRepository).find((row) => row.id === "relation")?.systems, []);
});

test("never exposes exact price", () => {
  for (const row of search(fixtureRepository)) assert.equal("price" in row, false);
});

test("is repeatable for a seed", () => {
  const random = new HashSeededRandom();
  const rows = search(fixtureRepository);
  assert.deepEqual(random.order(rows, "seed"), random.order(rows, "seed"));
});

test("performs no network access", () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => {
    calls += 1;
    throw new Error("network access is prohibited");
  }) as typeof fetch;
  try {
    search(fixtureRepository);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
