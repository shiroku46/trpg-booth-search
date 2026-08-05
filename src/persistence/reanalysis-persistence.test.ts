import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import type {
  EvidencedValue,
  Product,
  Scenario,
  ScenarioTags,
} from "../domain";
import type { ReanalysisVersionKey } from "../reanalysis";
import {
  applyCommittedMigrations,
  createPersistenceDatabase,
} from "./database";
import {
  PostgresReanalysisRepository,
  type RecordAnalysisInput,
  type ReanalysisTarget,
} from "./reanalysis-repository";
import {
  PostgresProductScenarioRepository,
  type StoredGraphInput,
} from "./repository";
import { normalizationHistory } from "./schema";

const clients: PGlite[] = [];
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const SCENARIO_ID = "22222222-2222-4222-8222-222222222222";
const BASE_TIME = "2026-08-06T00:00:00Z";

const key = (
  contentVersion = "content-v1",
  normalizerVersion = "normalizer-v1",
  registryVersion = "registry-v1",
): ReanalysisVersionKey => ({
  contentVersion,
  normalizerVersion,
  registryVersion,
});

function known<T>(value: T, contentVersion = "content-v1"): EvidencedValue<T> {
  return {
    state: "known",
    value,
    confidence: "high",
    reviewState: "approved",
    evidence: [{ pointer: "synthetic", method: "explicit_source" }],
    contentVersion,
    checkedAt: BASE_TIME,
  };
}

function tags(): ScenarioTags {
  return {
    genre: known(["synthetic"]),
    tone: known(["synthetic"]),
    setting: known(["synthetic"]),
    structure: known(["synthetic"]),
    content: known(["synthetic"]),
  };
}

function graph(
  normalizationHistoryInput: StoredGraphInput["normalizationHistory"] = [],
): StoredGraphInput {
  const product: Product = {
    id: PRODUCT_ID,
    canonicalUrl: "https://booth.pm/ja/items/1234567",
    title: "合成商品",
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
    title: known("合成シナリオ"),
    playerCount: known({ minimumPlayers: 2, maximumPlayers: 4 }),
    edition: known("synthetic-edition"),
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
    normalizationHistory: normalizationHistoryInput,
  };
}

async function freshDatabase(initialHistory: StoredGraphInput["normalizationHistory"] = []) {
  const client = new PGlite();
  clients.push(client);
  await applyCommittedMigrations(client);
  const { db } = createPersistenceDatabase(client);
  await new PostgresProductScenarioRepository(db).saveGraph(graph(initialHistory));
  return {
    db,
    repository: new PostgresReanalysisRepository(db),
  };
}

const scenarioTarget: ReanalysisTarget = {
  productId: PRODUCT_ID,
  entityType: "scenario",
  entityId: SCENARIO_ID,
};

function analysisInput(
  id: string,
  nextKey: ReanalysisVersionKey,
  createdAt: string,
  overrides: Partial<RecordAnalysisInput> = {},
): RecordAnalysisInput {
  return {
    id,
    ...scenarioTarget,
    nextKey,
    resultSnapshot: { state: "resolved", label: nextKey.contentVersion },
    createdAt,
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("Stage 14 append-only reanalysis persistence", () => {
  it("records one initial analysis and skips an unchanged three-version key", async () => {
    const { repository } = await freshDatabase();
    const initial = await repository.record(
      analysisInput(
        "30000000-0000-4000-8000-000000000001",
        key(),
        "2026-08-06T00:01:00Z",
      ),
    );
    const skipped = await repository.record(
      analysisInput(
        "30000000-0000-4000-8000-000000000002",
        key(),
        "2026-08-06T00:02:00Z",
      ),
    );

    expect(initial.state).toBe("inserted_initial");
    expect(skipped.state).toBe("skipped");
    const history = await repository.history(scenarioTarget);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      recordKind: "initial_analysis",
      reanalysisTrigger: null,
      previousKey: null,
      currentKey: key(),
      newResultSnapshot: { state: "resolved", label: "content-v1" },
    });
  });

  it.each([
    [key("content-v2"), "content_changed"],
    [key("content-v1", "normalizer-v2"), "normalizer_version_changed"],
    [key("content-v1", "normalizer-v1", "registry-v2"), "registry_version_changed"],
  ] as const)(
    "appends old and new snapshots for the automatic %s transition",
    async (nextKey, trigger) => {
      const { repository } = await freshDatabase([
        {
          id: "31000000-0000-4000-8000-000000000001",
          productId: PRODUCT_ID,
          entityType: "scenario",
          entityId: SCENARIO_ID,
          contentVersion: "content-v1",
          normalizerVersion: "normalizer-v1",
          registryVersion: "registry-v1",
          decision: { state: "unresolved", source: "initial" },
          createdAt: "2026-08-06T00:01:00Z",
        },
      ]);

      const recorded = await repository.record(
        analysisInput(
          "31000000-0000-4000-8000-000000000002",
          nextKey,
          "2026-08-06T00:02:00Z",
        ),
      );
      expect(recorded).toMatchObject({
        state: "inserted_reanalysis",
        plan: { trigger },
      });

      const history = await repository.history(scenarioTarget);
      expect(history).toHaveLength(2);
      expect(history[1]).toMatchObject({
        recordKind: "reanalysis",
        reanalysisTrigger: trigger,
        previousKey: key(),
        currentKey: nextKey,
        oldResultSnapshot: { state: "unresolved", source: "initial" },
        newResultSnapshot: { state: "resolved", label: nextKey.contentVersion },
      });
    },
  );

  it("uses registry invalidation as the primary trigger while retaining every changed dimension", async () => {
    const { repository } = await freshDatabase();
    await repository.record(
      analysisInput(
        "32000000-0000-4000-8000-000000000001",
        key(),
        "2026-08-06T00:01:00Z",
      ),
    );
    const recorded = await repository.record(
      analysisInput(
        "32000000-0000-4000-8000-000000000002",
        key("content-v2", "normalizer-v2", "registry-v2"),
        "2026-08-06T00:02:00Z",
        { reasonDetail: "scheduled version sweep" },
      ),
    );

    expect(recorded).toMatchObject({
      state: "inserted_reanalysis",
      plan: {
        trigger: "registry_version_changed",
        changedDimensions: [
          "content_version",
          "normalizer_version",
          "registry_version",
        ],
      },
    });
    const history = await repository.history(scenarioTarget);
    expect(history[1]?.reasonDetail).toBe(
      "changed=content_version,normalizer_version,registry_version;trigger=automatic;detail=scheduled version sweep",
    );
  });

  it("supports explicit registry events and an auditable unchanged-key manual trigger", async () => {
    const { repository } = await freshDatabase();
    await repository.record(
      analysisInput(
        "33000000-0000-4000-8000-000000000001",
        key(),
        "2026-08-06T00:01:00Z",
      ),
    );
    await expect(
      repository.record(
        analysisInput(
          "33000000-0000-4000-8000-000000000002",
          key(),
          "2026-08-06T00:02:00Z",
          { requestedTrigger: "alias_approved" },
        ),
      ),
    ).rejects.toThrow(/requires a registry-version change/iu);

    await expect(
      repository.record(
        analysisInput(
          "33000000-0000-4000-8000-000000000003",
          key("content-v1", "normalizer-v1", "registry-v2"),
          "2026-08-06T00:03:00Z",
          { requestedTrigger: "alias_approved" },
        ),
      ),
    ).resolves.toMatchObject({
      state: "inserted_reanalysis",
      plan: { trigger: "alias_approved" },
    });

    await expect(
      repository.record(
        analysisInput(
          "33000000-0000-4000-8000-000000000004",
          key("content-v1", "normalizer-v1", "registry-v2"),
          "2026-08-06T00:04:00Z",
          { requestedTrigger: "manual_trigger" },
        ),
      ),
    ).resolves.toMatchObject({
      state: "inserted_reanalysis",
      plan: { trigger: "manual_trigger", changedDimensions: [] },
    });
  });

  it("rejects stale timestamps, invalid snapshots, hashes, and ownership", async () => {
    const { repository } = await freshDatabase();
    await repository.record(
      analysisInput(
        "34000000-0000-4000-8000-000000000001",
        key(),
        "2026-08-06T00:02:00Z",
      ),
    );

    await expect(
      repository.record(
        analysisInput(
          "34000000-0000-4000-8000-000000000002",
          key("content-v2"),
          "2026-08-06T00:01:00Z",
        ),
      ),
    ).rejects.toThrow(/must be newer/iu);
    await expect(
      repository.record(
        analysisInput(
          "34000000-0000-4000-8000-000000000003",
          key("content-v2"),
          "2026-08-06T00:03:00Z",
          {
            resultSnapshot: [] as unknown as Record<string, unknown>,
          },
        ),
      ),
    ).rejects.toThrow(/JSON object/iu);
    await expect(
      repository.record(
        analysisInput(
          "34000000-0000-4000-8000-000000000004",
          key("content-v2"),
          "2026-08-06T00:03:00Z",
          { bodyDerivedSha256: "bad-hash" },
        ),
      ),
    ).rejects.toThrow(/SHA-256/iu);
    await expect(
      repository.record({
        ...analysisInput(
          "34000000-0000-4000-8000-000000000005",
          key("content-v2"),
          "2026-08-06T00:03:00Z",
        ),
        productId: "99999999-9999-4999-8999-999999999999",
      }),
    ).rejects.toThrow(/not owned/iu);
  });

  it("enforces transition shape and append-only history at the database boundary", async () => {
    const { db, repository } = await freshDatabase();
    await repository.record(
      analysisInput(
        "35000000-0000-4000-8000-000000000001",
        key(),
        "2026-08-06T00:01:00Z",
      ),
    );

    await expect(
      db.insert(normalizationHistory).values({
        id: "35000000-0000-4000-8000-000000000002",
        boothProductId: PRODUCT_ID,
        entityType: "scenario",
        entityId: SCENARIO_ID,
        recordKind: "reanalysis",
        reanalysisTrigger: "content_changed",
        contentVersion: "content-v2",
        normalizerVersion: "normalizer-v1",
        registryVersion: "registry-v1",
        decision: { state: "resolved" },
        createdAt: "2026-08-06T00:02:00Z",
      }),
    ).rejects.toThrow();

    await expect(
      db
        .update(normalizationHistory)
        .set({ reasonDetail: "mutated" })
        .where(
          eq(
            normalizationHistory.id,
            "35000000-0000-4000-8000-000000000001",
          ),
        ),
    ).rejects.toThrow();
    await expect(
      db
        .delete(normalizationHistory)
        .where(
          eq(
            normalizationHistory.id,
            "35000000-0000-4000-8000-000000000001",
          ),
        ),
    ).rejects.toThrow();
  });

  it("returns chronologically ordered, detached, frozen history", async () => {
    const { repository } = await freshDatabase();
    const firstSnapshot = { state: "initial", nested: { value: 1 } };
    await repository.record(
      analysisInput(
        "36000000-0000-4000-8000-000000000001",
        key(),
        "2026-08-06T00:01:00Z",
        { resultSnapshot: firstSnapshot },
      ),
    );
    firstSnapshot.nested.value = 99;
    await repository.record(
      analysisInput(
        "36000000-0000-4000-8000-000000000002",
        key("content-v2"),
        "2026-08-06T00:02:00Z",
      ),
    );

    const history = await repository.history(scenarioTarget);
    expect(history.map(({ id }) => id)).toEqual([
      "36000000-0000-4000-8000-000000000001",
      "36000000-0000-4000-8000-000000000002",
    ]);
    expect(history[0]?.newResultSnapshot).toEqual({
      state: "initial",
      nested: { value: 1 },
    });
    expect(Object.isFrozen(history)).toBe(true);
    expect(Object.isFrozen(history[0]?.newResultSnapshot)).toBe(true);
  });
});
