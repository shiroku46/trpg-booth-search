import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import type {
  EvidencedValue,
  Product,
  Scenario,
  ScenarioTags,
} from "../domain";
import { EMPTY_QUERY } from "../search";
import {
  applyCommittedMigrations,
  createPersistenceDatabase,
} from "./database";
import {
  PostgresProductScenarioRepository,
  type StoredGraphInput,
} from "./repository";
import { PostgresReviewedSearchSource } from "./reviewed-search-source";

const clients: PGlite[] = [];
const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";
const SCENARIO_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SCENARIO_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BASE_TIME = "2026-08-06T00:00:00Z";

function known<T>(value: T): EvidencedValue<T> {
  return {
    state: "known",
    value,
    confidence: "high",
    reviewState: "approved",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
    contentVersion: "content-v1",
    checkedAt: BASE_TIME,
  };
}

function tags(): ScenarioTags {
  const list = known<readonly string[]>(["synthetic"]);
  return {
    genre: list,
    tone: list,
    setting: list,
    structure: list,
    content: list,
  };
}

function graph(
  productId: string,
  scenarioId: string,
  title: string,
): StoredGraphInput {
  const product: Product = {
    id: productId,
    canonicalUrl: `https://booth.pm/ja/items/${productId.slice(0, 8)}`,
    title: `商品-${title}`,
    salesState: known("available"),
    sourcePublicationDate: known("2026-08-01T00:00:00Z"),
    firstSeenAt: BASE_TIME,
    lastCheckedAt: BASE_TIME,
    allAges: known("all_ages_confirmed"),
    classification: {
      ...known("scenario_single"),
      normalizerVersion: "normalizer-v1",
      registryVersion: "registry-v1",
    },
  };
  const scenario: Scenario = {
    id: scenarioId,
    productId,
    title: known(title),
    playerCount: known({ minimumPlayers: 2, maximumPlayers: 4 }),
    edition: known("テスト版"),
    playTimeMinutes: known({ minimumMinutes: 120, maximumMinutes: 180 }),
    modality: known("online"),
    tags: tags(),
    requiredBooks: [],
    compatibility: [],
    separationApproved: true,
    relationships: [],
  };
  return {
    product,
    sourceProductId: productId.slice(0, 8),
    contentVersion: "content-v1",
    currentRecordUpdatedAt: BASE_TIME,
    scenarios: [scenario],
    normalizationHistory: [],
  };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("Stage 24 persistence reviewed-search source", () => {
  it("binds explicit products defensively and does not mutate storage", async () => {
    const client = new PGlite();
    clients.push(client);
    await applyCommittedMigrations(client);
    const { db } = createPersistenceDatabase(client);
    const repository = new PostgresProductScenarioRepository(db);
    await repository.saveGraph(graph(PRODUCT_A, SCENARIO_A, "Alpha"));
    await repository.saveGraph(graph(PRODUCT_B, SCENARIO_B, "Beta"));
    const beforeA = await repository.loadGraph(PRODUCT_A);
    const beforeB = await repository.loadGraph(PRODUCT_B);

    const requests = [{ productId: PRODUCT_A, targets: [] }];
    const source = new PostgresReviewedSearchSource(db, requests);
    requests[0]!.productId = PRODUCT_B;
    requests.push({ productId: PRODUCT_B, targets: [] });

    const result = await source.search({
      ...EMPTY_QUERY,
      keyword: "  Alpha  ",
      tags: { ...EMPTY_QUERY.tags },
    });

    expect(result.query.keyword).toBe("Alpha");
    expect(result.rows.map((row) => row.title)).toEqual(["Alpha"]);
    expect(result.publicationReport).toMatchObject([
      { state: "projected", productId: PRODUCT_A },
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.rows)).toBe(true);
    expect(Object.isFrozen(result.publicationReport)).toBe(true);
    expect(await repository.loadGraph(PRODUCT_A)).toEqual(beforeA);
    expect(await repository.loadGraph(PRODUCT_B)).toEqual(beforeB);
  });

  it("is deterministic for equivalent explicit product ordering", async () => {
    const client = new PGlite();
    clients.push(client);
    await applyCommittedMigrations(client);
    const { db } = createPersistenceDatabase(client);
    const repository = new PostgresProductScenarioRepository(db);
    await repository.saveGraph(graph(PRODUCT_A, SCENARIO_A, "Alpha"));
    await repository.saveGraph(graph(PRODUCT_B, SCENARIO_B, "Beta"));

    const forward = new PostgresReviewedSearchSource(db, [
      { productId: PRODUCT_A, targets: [] },
      { productId: PRODUCT_B, targets: [] },
    ]);
    const reverse = new PostgresReviewedSearchSource(db, [
      { productId: PRODUCT_B, targets: [] },
      { productId: PRODUCT_A, targets: [] },
    ]);
    const query = {
      ...EMPTY_QUERY,
      sort: "random" as const,
      seed: "stage24-source",
      tags: { ...EMPTY_QUERY.tags },
    };

    expect(await reverse.search(query)).toEqual(await forward.search(query));
  });
});
