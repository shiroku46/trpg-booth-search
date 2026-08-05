import { PGlite } from "@electric-sql/pglite";
import { pgDump } from "@electric-sql/pglite-tools";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import type {
  BookRequirement,
  ClassificationEnvelope,
  EvidencedValue,
  Modality,
  PlayerCountRange,
  PlayTimeRange,
  Product,
  Relationship,
  SalesState,
  Scenario,
  ScenarioTags,
} from "../domain";
import { project } from "../publication";
import {
  applyCommittedMigrations,
  createPersistenceDatabase,
} from "./database";
import {
  PostgresProductScenarioRepository,
  type StoredGraphInput,
} from "./repository";
import {
  boothProduct,
  normalizationHistory,
  scenario as scenarioTable,
} from "./schema";

const clients: PGlite[] = [];
const NOW = "2026-08-05T00:00:00Z";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

const meta = () =>
  ({
    confidence: "high",
    reviewState: "approved",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
    contentVersion: "synthetic-content-v1",
    checkedAt: NOW,
  }) as const;

const known = <T>(value: T): EvidencedValue<T> => ({
  state: "known",
  value,
  ...meta(),
});

const classification = (): ClassificationEnvelope => ({
  ...known("scenario_single" as const),
  normalizerVersion: "manual-review-v1",
  registryVersion: "registry-not-consulted",
});

const tags = (): ScenarioTags => ({
  genre: known(["ミステリー"]),
  tone: known(["静か"]),
  setting: known(["現代"]),
  structure: known(["探索型"]),
  content: known(["推理中心"]),
});

const relationship = (): Relationship => ({
  system: known("合成システム"),
  aliases: known(["合成別名"]),
});

function graph(options: {
  productId: string;
  scenarioId: string;
  sourceProductId: string;
  sourceUrl?: string;
  productTitle?: string;
  scenarioTitle?: string;
  salesState?: SalesState;
  playerCount?: PlayerCountRange;
  playTime?: PlayTimeRange;
}): StoredGraphInput {
  const sourceUrl =
    options.sourceUrl ?? `https://booth.pm/ja/items/${options.sourceProductId}`;
  const product: Product = {
    id: options.productId,
    canonicalUrl: sourceUrl,
    title: options.productTitle ?? "合成永続化商品",
    salesState: known(options.salesState ?? "available"),
    sourcePublicationDate: known("2026-08-01T00:00:00Z"),
    firstSeenAt: "2026-07-01T00:00:00Z",
    lastCheckedAt: NOW,
    allAges: known("all_ages_confirmed"),
    classification: classification(),
  };
  const scenario: Scenario = {
    id: options.scenarioId,
    productId: options.productId,
    title: known(options.scenarioTitle ?? "合成永続化シナリオ"),
    playerCount: known(
      options.playerCount ?? { minimumPlayers: 2, maximumPlayers: 4 },
    ),
    edition: known("7版"),
    playTimeMinutes: known(
      options.playTime ?? { minimumMinutes: 120, maximumMinutes: 240 },
    ),
    modality: known<Modality>("online"),
    tags: tags(),
    requiredBooks: [
      known<BookRequirement>({
        title: "合成基本ルールブック",
        kind: "required",
      }),
    ],
    compatibility: [known("新版対応")],
    separationApproved: true,
    relationships: [relationship()],
  };
  return {
    product,
    sourceProductId: options.sourceProductId,
    contentVersion: "synthetic-product-v1",
    currentRecordUpdatedAt: NOW,
    isFree: known(false),
    scenarios: [scenario],
    sourceSnapshots: [
      {
        id: options.productId.replace(/^./, "7"),
        productId: options.productId,
        sourceUrl,
        outcome: "http_200",
        statusCode: 200,
        rawSha256: HASH_A,
        normalizedSha256: HASH_B,
        contentVersion: "synthetic-product-v1",
        parserVersion: "synthetic-parser-v1",
        checkedAt: NOW,
      },
    ],
    normalizationHistory: [
      {
        id: options.productId.replace(/^./, "8"),
        productId: options.productId,
        entityType: "scenario",
        entityId: options.scenarioId,
        contentVersion: "synthetic-product-v1",
        normalizerVersion: "manual-review-v1",
        registryVersion: "registry-not-consulted",
        bodyDerivedSha256: HASH_A,
        decision: { state: "approved", synthetic: true },
        createdAt: NOW,
      },
    ],
  };
}

async function freshDatabase() {
  const client = new PGlite();
  clients.push(client);
  await applyCommittedMigrations(client);
  const { db } = createPersistenceDatabase(client);
  return {
    client,
    db,
    repository: new PostgresProductScenarioRepository(db),
  };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("Stage 9 PostgreSQL persistence", () => {
  it("applies migrations and preserves publication decisions through a round trip", async () => {
    const { repository } = await freshDatabase();
    const input = graph({
      productId: "11111111-1111-4111-8111-111111111111",
      scenarioId: "21111111-1111-4111-8111-111111111111",
      sourceProductId: "100001",
    });

    await repository.saveGraph(input);
    const loaded = await repository.loadGraph(input.product.id);

    expect(loaded).not.toBeNull();
    expect(loaded?.product).toEqual(input.product);
    expect(loaded?.scenarios).toEqual(input.scenarios);
    const decision = project(loaded?.product, loaded!.scenarios[0]!);
    expect(decision.publish).toBe(true);
    if (decision.publish) {
      expect(decision.value.title).toBe("合成永続化シナリオ");
      expect(decision.value.productUrl).toBe("https://booth.pm/ja/items/100001");
      expect("price" in decision.value).toBe(false);
    }
  });

  it("enforces source identity, canonical origin, and known range constraints", async () => {
    const { db, repository } = await freshDatabase();
    const input = graph({
      productId: "12222222-2222-4222-8222-222222222222",
      scenarioId: "22222222-2222-4222-8222-222222222222",
      sourceProductId: "100002",
    });
    await repository.saveGraph(input);

    const duplicate = graph({
      productId: "13333333-3333-4333-8333-333333333333",
      scenarioId: "23333333-3333-4333-8333-333333333333",
      sourceProductId: "100002",
    });
    await expect(repository.saveGraph(duplicate)).rejects.toThrow();

    await expect(
      db.insert(boothProduct).values({
        id: "14444444-4444-4444-8444-444444444444",
        sourcePlatform: "booth",
        sourceProductId: "100004",
        canonicalUrl: "https://example.invalid/items/100004",
        observedTitle: "無効URL",
        allAgesState: known("all_ages_confirmed"),
        classification: classification(),
        salesState: known<SalesState>("available"),
        sourcePublicationDate: known("2026-08-01T00:00:00Z"),
        isFree: null,
        firstSeenAt: NOW,
        lastCheckedAt: NOW,
        contentVersion: "synthetic-product-v1",
        currentRecordUpdatedAt: NOW,
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(scenarioTable).values({
        id: "24444444-4444-4444-8444-444444444444",
        boothProductId: input.product.id,
        title: known("逆転範囲"),
        playerCount: known({ minimumPlayers: 5, maximumPlayers: 2 }),
        edition: known("7版"),
        playTimeMinutes: known({ minimumMinutes: 120, maximumMinutes: 60 }),
        modality: known<Modality>("online"),
        tags: tags(),
        requiredBooks: [],
        compatibility: [],
        relationships: [],
        separationApproved: true,
        hold: false,
        firstSeenAt: NOW,
        lastCheckedAt: NOW,
        contentVersion: "synthetic-product-v1",
        currentRecordUpdatedAt: NOW,
      }),
    ).rejects.toThrow();
  });

  it("keeps permitted history append-only outside the restricted purge service", async () => {
    const { db, repository } = await freshDatabase();
    const input = graph({
      productId: "15555555-5555-4555-8555-555555555555",
      scenarioId: "25555555-5555-4555-8555-555555555555",
      sourceProductId: "100005",
    });
    await repository.saveGraph(input);

    await expect(
      db
        .update(normalizationHistory)
        .set({ decision: { state: "mutated" } })
        .where(
          eq(
            normalizationHistory.boothProductId,
            input.product.id,
          ),
        ),
    ).rejects.toThrow(/append-only/u);
  });

  it("dumps and restores the database before and after a product-scoped age purge", async () => {
    const { client, repository } = await freshDatabase();
    const first = graph({
      productId: "16666666-6666-4666-8666-666666666666",
      scenarioId: "26666666-6666-4666-8666-666666666666",
      sourceProductId: "100006",
      productTitle: "消去対象の合成商品",
      scenarioTitle: "消去対象の合成シナリオ",
    });
    const second = graph({
      productId: "17777777-7777-4777-8777-777777777777",
      scenarioId: "27777777-7777-4777-8777-777777777777",
      sourceProductId: "100007",
      productTitle: "保持対象の合成商品",
      scenarioTitle: "保持対象の合成シナリオ",
    });
    second.sourceSnapshots = second.sourceSnapshots?.map((snapshot) => ({
      ...snapshot,
      sourceUrl: first.product.canonicalUrl,
    }));

    await repository.saveGraph(first);
    await repository.saveGraph(second);

    const initialDump = await pgDump({ pg: client });
    const initialSql = await initialDump.text();
    const restoredClient = new PGlite();
    clients.push(restoredClient);
    await restoredClient.exec(initialSql);
    const restoredRepository = new PostgresProductScenarioRepository(
      createPersistenceDatabase(restoredClient).db,
    );
    const restoredGraph = await restoredRepository.loadGraph(first.product.id);
    expect(restoredGraph?.product.title).toBe("消去対象の合成商品");
    expect(project(restoredGraph?.product, restoredGraph!.scenarios[0]!).publish).toBe(
      true,
    );

    const purge = await repository.purgeForAgeUnknown(
      first.product.id,
      "2026-08-05T01:00:00Z",
    );
    expect(purge).toMatchObject({
      productId: first.product.id,
      snapshotCount: 1,
      historyCount: 1,
      scenarioCount: 1,
    });
    expect(await repository.loadGraph(first.product.id)).toBeNull();

    const firstState = await repository.securityState(first.product.id);
    expect(firstState.product?.observedTitle).toBeNull();
    expect(firstState.product?.classification).toBeNull();
    expect(firstState.product?.salesState).toBeNull();
    expect(firstState.product?.sourcePublicationDate).toBeNull();
    expect(firstState.product?.isFree).toBeNull();
    expect(firstState.scenarios[0]?.title).toBeNull();
    expect(firstState.snapshots[0]?.rawSha256).toBeNull();
    expect(firstState.snapshots[0]?.normalizedSha256).toBeNull();
    expect(firstState.histories[0]?.bodyDerivedSha256).toBeNull();
    expect(firstState.tombstones).toHaveLength(1);

    const secondGraph = await repository.loadGraph(second.product.id);
    expect(secondGraph?.product.title).toBe("保持対象の合成商品");
    expect(secondGraph?.scenarios[0]?.title.value).toBe("保持対象の合成シナリオ");
    const secondState = await repository.securityState(second.product.id);
    expect(secondState.snapshots[0]?.rawSha256).toBe(HASH_A);

    const purgedDump = await pgDump({ pg: client });
    const purgedSql = await purgedDump.text();
    expect(purgedSql).not.toContain("消去対象の合成商品");
    expect(purgedSql).not.toContain("消去対象の合成シナリオ");
    expect(purgedSql).not.toContain(HASH_B);

    const purgedRestoredClient = new PGlite();
    clients.push(purgedRestoredClient);
    await purgedRestoredClient.exec(purgedSql);
    const purgedRestoredRepository = new PostgresProductScenarioRepository(
      createPersistenceDatabase(purgedRestoredClient).db,
    );
    const restoredState = await purgedRestoredRepository.securityState(
      first.product.id,
    );
    expect(restoredState.product?.observedTitle).toBeNull();
    expect(restoredState.snapshots[0]?.rawSha256).toBeNull();
    expect(restoredState.histories[0]?.bodyDerivedSha256).toBeNull();
    expect(restoredState.tombstones[0]?.purgeState).toBe("completed");
    expect(
      await purgedRestoredRepository.loadGraph(second.product.id),
    ).not.toBeNull();
  });
});
