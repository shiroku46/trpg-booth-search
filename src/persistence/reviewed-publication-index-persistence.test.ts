import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import type {
  EvidencedValue,
  Product,
  Scenario,
  ScenarioTags,
} from "../domain";
import type { ReviewApplicationTarget } from "../review-application";
import {
  applyCommittedMigrations,
  createPersistenceDatabase,
} from "./database";
import {
  PostgresProductScenarioRepository,
  type StoredGraphInput,
} from "./repository";
import { PostgresReviewedPublicationIndexService } from "./reviewed-publication-index-service";

const clients: PGlite[] = [];
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const SCENARIO_ID = "22222222-2222-4222-8222-222222222222";
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

function storedGraph(): StoredGraphInput {
  const product: Product = {
    id: PRODUCT_ID,
    canonicalUrl: "https://booth.pm/ja/items/1234567",
    title: "永続化商品",
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
    id: SCENARIO_ID,
    productId: PRODUCT_ID,
    title: known("永続化シナリオ"),
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
    sourceProductId: "1234567",
    contentVersion: "content-v1",
    currentRecordUpdatedAt: BASE_TIME,
    scenarios: [scenario],
    normalizationHistory: [],
  };
}

const target = (): ReviewApplicationTarget => ({
  productId: PRODUCT_ID,
  entityType: "scenario",
  entityId: SCENARIO_ID,
  fieldPath: "edition",
  versionKey: {
    contentVersion: "content-v1",
    normalizerVersion: "normalizer-v1",
    registryVersion: "registry-v1",
  },
});

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("Stage 19 persistence-backed publication index", () => {
  it("resolves explicit products and exact targets without mutating storage", async () => {
    const client = new PGlite();
    clients.push(client);
    await applyCommittedMigrations(client);
    const { db } = createPersistenceDatabase(client);
    const repository = new PostgresProductScenarioRepository(db);
    await repository.saveGraph(storedGraph());
    const service = new PostgresReviewedPublicationIndexService(db);
    const before = await repository.loadGraph(PRODUCT_ID);

    const result = await service.loadPublicationIndex([
      { productId: PRODUCT_ID, targets: [target()] },
      {
        productId: "33333333-3333-4333-8333-333333333333",
        targets: [],
      },
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.title).toBe("永続化シナリオ");
    expect(result.report).toMatchObject([
      {
        state: "projected",
        productId: PRODUCT_ID,
        targetReport: [{ state: "omitted", reason: "unapplied" }],
        scenarios: [{ state: "published", scenarioId: SCENARIO_ID }],
      },
      {
        state: "missing_product",
        productId: "33333333-3333-4333-8333-333333333333",
      },
    ]);
    expect(await repository.loadGraph(PRODUCT_ID)).toEqual(before);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects duplicate product requests and cross-product targets", async () => {
    const client = new PGlite();
    clients.push(client);
    await applyCommittedMigrations(client);
    const { db } = createPersistenceDatabase(client);
    const service = new PostgresReviewedPublicationIndexService(db);

    await expect(
      service.loadPublicationIndex([
        { productId: PRODUCT_ID, targets: [] },
        { productId: PRODUCT_ID, targets: [] },
      ]),
    ).rejects.toThrow("duplicate product request");

    await expect(
      service.loadPublicationIndex([
        {
          productId: PRODUCT_ID,
          targets: [
            {
              ...target(),
              productId: "33333333-3333-4333-8333-333333333333",
            },
          ],
        },
      ]),
    ).rejects.toThrow("does not belong to requested product");
  });
});
