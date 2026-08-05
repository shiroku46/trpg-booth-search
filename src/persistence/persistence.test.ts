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
const PURGED_RAW_HASH = "c".repeat(64);
const PURGED_NORMALIZED_HASH = "d".repeat(64);

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

const unknown = <T>(): EvidencedValue<T> => ({
  state: "unknown",
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
      expect(decision.value.productUrl).toBe(
        "https://booth.pm/ja/items/100001",
      );
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
      db.insert(boothProduct).values({
        id: "14444444-4444-4444-8444-444444444445",
        sourcePlatform: "booth",
        sourceProductId: "100099",
        canonicalUrl: "https://booth.pm/ja/items/100004",
        observedTitle: "不一致ID",
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

  it("rejects missing keys, unknown states, and invalid JSONB value types", async () => {
    const { db, repository } = await freshDatabase();
    const parent = graph({
      productId: "18888888-8888-4888-8888-888888888888",
      scenarioId: "28888888-8888-4888-8888-888888888888",
      sourceProductId: "100008",
    });
    await repository.saveGraph(parent);

    const productBase = {
      sourcePlatform: "booth",
      observedTitle: "不正制約テスト",
      classification: null,
      sourcePublicationDate: known("2026-08-01T00:00:00Z"),
      firstSeenAt: NOW,
      lastCheckedAt: NOW,
      contentVersion: "synthetic-product-v1",
      currentRecordUpdatedAt: NOW,
    } as const;

    await expect(
      db.insert(boothProduct).values({
        ...productBase,
        id: "19999999-9999-4999-8999-999999999991",
        sourceProductId: "100091",
        canonicalUrl: "https://booth.pm/ja/items/100091",
        allAgesState: { ...meta(), value: "all_ages_confirmed" } as never,
        salesState: known<SalesState>("available"),
        isFree: null,
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(boothProduct).values({
        ...productBase,
        id: "19999999-9999-4999-8999-999999999992",
        sourceProductId: "100092",
        canonicalUrl: "https://booth.pm/ja/items/100092",
        allAgesState: known("all_ages_confirmed"),
        salesState: { ...meta(), state: "bogus" } as never,
        isFree: null,
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(boothProduct).values({
        ...productBase,
        id: "19999999-9999-4999-8999-999999999993",
        sourceProductId: "100093",
        canonicalUrl: "https://booth.pm/ja/items/100093",
        allAgesState: known("all_ages_confirmed"),
        salesState: known<SalesState>("available"),
        isFree: { ...meta(), state: "known", value: "false" } as never,
      }),
    ).rejects.toThrow();

    const scenarioBase = {
      boothProductId: parent.product.id,
      title: known("不正シナリオ"),
      edition: known("7版"),
      playTimeMinutes: known({ minimumMinutes: 60, maximumMinutes: 120 }),
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
    } as const;

    await expect(
      db.insert(scenarioTable).values({
        ...scenarioBase,
        id: "29999999-9999-4999-8999-999999999991",
        playerCount: { ...meta(), state: "bogus" } as never,
        modality: known<Modality>("online"),
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(scenarioTable).values({
        ...scenarioBase,
        id: "29999999-9999-4999-8999-999999999992",
        playerCount: known({ minimumPlayers: 2, maximumPlayers: 4 }),
        modality: { ...meta(), state: "known", value: "hybrid" } as never,
      }),
    ).rejects.toThrow();

    const invalidTagValue = tags();
    invalidTagValue.genre = known([""]);
    await expect(
      db.insert(scenarioTable).values({
        ...scenarioBase,
        id: "29999999-9999-4999-8999-999999999994",
        playerCount: known({ minimumPlayers: 2, maximumPlayers: 4 }),
        modality: known<Modality>("online"),
        tags: invalidTagValue,
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(scenarioTable).values({
        ...scenarioBase,
        id: "29999999-9999-4999-8999-999999999995",
        playerCount: known({ minimumPlayers: 2, maximumPlayers: 4 }),
        modality: known<Modality>("online"),
        requiredBooks: [
          known({ title: "不正書籍", kind: "forbidden" }) as never,
        ],
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(scenarioTable).values({
        ...scenarioBase,
        id: "29999999-9999-4999-8999-999999999996",
        playerCount: known({ minimumPlayers: 2, maximumPlayers: 4 }),
        modality: known<Modality>("online"),
        relationships: [{ system: known(""), aliases: known(["別名"]) }],
      }),
    ).rejects.toThrow();

    const incompleteTags = tags() as Record<string, unknown>;
    delete incompleteTags.content;
    await expect(
      db.insert(scenarioTable).values({
        ...scenarioBase,
        id: "29999999-9999-4999-8999-999999999993",
        playerCount: known({ minimumPlayers: 2, maximumPlayers: 4 }),
        modality: known<Modality>("online"),
        tags: incompleteTags as never,
      }),
    ).rejects.toThrow();
  });

  it("rejects product, snapshot, and history entity ownership mismatches", async () => {
    const { repository } = await freshDatabase();
    const scenarioMismatch = graph({
      productId: "31111111-1111-4111-8111-111111111111",
      scenarioId: "41111111-1111-4111-8111-111111111111",
      sourceProductId: "200001",
    });
    scenarioMismatch.scenarios = scenarioMismatch.scenarios.map((item) => ({
      ...item,
      productId: "31111111-1111-4111-8111-111111111112",
    }));
    await expect(repository.saveGraph(scenarioMismatch)).rejects.toThrow();

    const snapshotMismatch = graph({
      productId: "32222222-2222-4222-8222-222222222222",
      scenarioId: "42222222-2222-4222-8222-222222222222",
      sourceProductId: "200002",
    });
    snapshotMismatch.sourceSnapshots = snapshotMismatch.sourceSnapshots?.map(
      (item) => ({
        ...item,
        productId: "32222222-2222-4222-8222-222222222223",
      }),
    );
    await expect(repository.saveGraph(snapshotMismatch)).rejects.toThrow();

    const entityMismatch = graph({
      productId: "33333333-3333-4333-8333-333333333333",
      scenarioId: "43333333-3333-4333-8333-333333333333",
      sourceProductId: "200003",
    });
    entityMismatch.normalizationHistory =
      entityMismatch.normalizationHistory?.map((item) => ({
        ...item,
        entityId: "43333333-3333-4333-8333-333333333334",
      }));
    await expect(repository.saveGraph(entityMismatch)).rejects.toThrow();
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
        .where(eq(normalizationHistory.boothProductId, input.product.id)),
    ).rejects.toThrow();
  });

  it("preserves sold-out publication and keeps unsafe values fail-closed after persistence", async () => {
    const { repository } = await freshDatabase();

    const soldOut = graph({
      productId: "34444444-4444-4444-8444-444444444444",
      scenarioId: "44444444-4444-4444-8444-444444444444",
      sourceProductId: "200004",
      salesState: "sold_out",
    });
    await repository.saveGraph(soldOut);
    const soldOutLoaded = await repository.loadGraph(soldOut.product.id);
    expect(
      project(soldOutLoaded?.product, soldOutLoaded!.scenarios[0]!).publish,
    ).toBe(true);

    const ended = graph({
      productId: "35555555-5555-4555-8555-555555555555",
      scenarioId: "45555555-5555-4555-8555-555555555555",
      sourceProductId: "200005",
      salesState: "sales_ended",
    });
    await repository.saveGraph(ended);
    const endedLoaded = await repository.loadGraph(ended.product.id);
    expect(
      project(endedLoaded?.product, endedLoaded!.scenarios[0]!),
    ).toMatchObject({
      publish: false,
      reason: "sales_ended",
    });

    const held = graph({
      productId: "36666666-6666-4666-8666-666666666666",
      scenarioId: "46666666-6666-4666-8666-666666666666",
      sourceProductId: "200006",
    });
    held.scenarios = held.scenarios.map((item) => ({ ...item, hold: true }));
    await repository.saveGraph(held);
    const heldLoaded = await repository.loadGraph(held.product.id);
    expect(
      project(heldLoaded?.product, heldLoaded!.scenarios[0]!),
    ).toMatchObject({
      publish: false,
      reason: "hold_or_missing_product",
    });

    const explicitUnknown = graph({
      productId: "37777777-7777-4777-8777-777777777777",
      scenarioId: "47777777-7777-4777-8777-777777777777",
      sourceProductId: "200007",
    });
    explicitUnknown.scenarios = explicitUnknown.scenarios.map((item) => ({
      ...item,
      playerCount: unknown<PlayerCountRange>(),
    }));
    await repository.saveGraph(explicitUnknown);
    const unknownLoaded = await repository.loadGraph(
      explicitUnknown.product.id,
    );
    const unknownDecision = project(
      unknownLoaded?.product,
      unknownLoaded!.scenarios[0]!,
    );
    expect(unknownDecision.publish).toBe(true);
    if (unknownDecision.publish)
      expect(unknownDecision.value.playerCount).toEqual({ state: "unknown" });

    const conflicted = graph({
      productId: "38888888-8888-4888-8888-888888888888",
      scenarioId: "48888888-8888-4888-8888-888888888888",
      sourceProductId: "200008",
    });
    conflicted.scenarios = conflicted.scenarios.map((item) => ({
      ...item,
      title: {
        ...item.title,
        conflictReason: "synthetic_conflict",
      },
    }));
    await repository.saveGraph(conflicted);
    const conflictLoaded = await repository.loadGraph(conflicted.product.id);
    expect(
      project(conflictLoaded?.product, conflictLoaded!.scenarios[0]!),
    ).toMatchObject({
      publish: false,
      reason: "required_core",
    });

    const aiUnreviewed = graph({
      productId: "39999999-9999-4999-8999-999999999999",
      scenarioId: "49999999-9999-4999-8999-999999999999",
      sourceProductId: "200009",
    });
    aiUnreviewed.scenarios = aiUnreviewed.scenarios.map((item) => ({
      ...item,
      title: {
        ...item.title,
        reviewState: "unreviewed",
        evidence: [{ pointer: "synthetic", method: "ai_candidate" }],
      },
    }));
    await repository.saveGraph(aiUnreviewed);
    const aiLoaded = await repository.loadGraph(aiUnreviewed.product.id);
    expect(project(aiLoaded?.product, aiLoaded!.scenarios[0]!)).toMatchObject({
      publish: false,
      reason: "required_core",
    });

    const unsafeRelationship = graph({
      productId: "3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      scenarioId: "4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sourceProductId: "200010",
    });
    unsafeRelationship.scenarios = unsafeRelationship.scenarios.map((item) => ({
      ...item,
      relationships: [
        {
          system: {
            ...known("未承認AIシステム"),
            reviewState: "unreviewed",
            evidence: [{ pointer: "synthetic", method: "ai_candidate" }],
          },
          aliases: known(["未承認別名"]),
        },
      ],
    }));
    await repository.saveGraph(unsafeRelationship);
    const unsafeLoaded = await repository.loadGraph(
      unsafeRelationship.product.id,
    );
    const unsafeDecision = project(
      unsafeLoaded?.product,
      unsafeLoaded!.scenarios[0]!,
    );
    expect(unsafeDecision.publish).toBe(true);
    if (unsafeDecision.publish) {
      expect(unsafeDecision.value.systems).toEqual({ state: "omitted" });
      expect(unsafeDecision.value.systemAliases).toEqual([]);
    }
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
    first.sourceSnapshots = first.sourceSnapshots?.map((snapshot) => ({
      ...snapshot,
      rawSha256: PURGED_RAW_HASH,
      normalizedSha256: PURGED_NORMALIZED_HASH,
    }));
    first.normalizationHistory = first.normalizationHistory?.map((history) => ({
      ...history,
      bodyDerivedSha256: PURGED_RAW_HASH,
    }));

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

    const initialDump = await pgDump({ pg: client, args: ["--data-only"] });
    const initialSql = await initialDump.text();
    const restoredClient = new PGlite();
    clients.push(restoredClient);
    await applyCommittedMigrations(restoredClient);
    await restoredClient.exec(initialSql);
    await restoredClient.exec("SET search_path TO public;");
    const restoredRepository = new PostgresProductScenarioRepository(
      createPersistenceDatabase(restoredClient).db,
    );
    const restoredGraph = await restoredRepository.loadGraph(first.product.id);
    expect(restoredGraph?.product.title).toBe("消去対象の合成商品");
    expect(
      project(restoredGraph?.product, restoredGraph!.scenarios[0]!).publish,
    ).toBe(true);

    const purge = await restoredRepository.purgeForAgeUnknown(
      first.product.id,
      "2026-08-05T01:00:00Z",
    );
    expect(purge).toMatchObject({
      productId: first.product.id,
      snapshotCount: 1,
      historyCount: 1,
      scenarioCount: 1,
    });
    expect(await restoredRepository.loadGraph(first.product.id)).toBeNull();

    const firstState = await restoredRepository.securityState(first.product.id);
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

    const secondGraph = await restoredRepository.loadGraph(second.product.id);
    expect(secondGraph?.product.title).toBe("保持対象の合成商品");
    const secondTitle = secondGraph?.scenarios[0]?.title;
    expect(secondTitle?.state).toBe("known");
    if (secondTitle?.state === "known")
      expect(secondTitle.value).toBe("保持対象の合成シナリオ");
    const secondState = await restoredRepository.securityState(
      second.product.id,
    );
    expect(secondState.snapshots[0]?.rawSha256).toBe(HASH_A);

    const purgedDump = await pgDump({
      pg: restoredClient,
      args: ["--data-only"],
    });
    const purgedSql = await purgedDump.text();
    expect(purgedSql).not.toContain("消去対象の合成商品");
    expect(purgedSql).not.toContain("消去対象の合成シナリオ");
    expect(purgedSql).not.toContain(PURGED_RAW_HASH);
    expect(purgedSql).not.toContain(PURGED_NORMALIZED_HASH);

    const purgedRestoredClient = new PGlite();
    clients.push(purgedRestoredClient);
    await applyCommittedMigrations(purgedRestoredClient);
    await purgedRestoredClient.exec(purgedSql);
    await purgedRestoredClient.exec("SET search_path TO public;");
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
