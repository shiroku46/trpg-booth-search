import { describe, expect, it } from "vitest";

import {
  RecoveryRehearsalError,
  createRecoveryRehearsalReport,
  validateRecoveryRehearsalReport,
} from "./recovery-rehearsal";

const INPUT = {
  migrationRef: "migrations:0000-0005",
  prePurgeDumpSha256: "a".repeat(64),
  prePurgeRestoreSucceeded: true,
  purgeTargetId: "16666666-6666-4666-8666-666666666666",
  purgeCounts: { snapshotCount: 1, historyCount: 1, scenarioCount: 1 },
  postPurgeDumpSha256: "b".repeat(64),
  postPurgeRestoreSucceeded: true,
  purgedPayloadAbsent: true,
  purgedHashesAbsent: true,
  unaffectedProductPreserved: true,
} as const;

describe("Stage 35 recovery rehearsal report", () => {
  it("creates a deterministic deeply immutable passed report", () => {
    const first = createRecoveryRehearsalReport(INPUT);
    const second = createRecoveryRehearsalReport({
      ...INPUT,
      purgeCounts: { ...INPUT.purgeCounts },
    });

    expect(first).toEqual(second);
    expect(first.result).toBe("passed");
    expect(first.fingerprint).toMatch(/^[0-9a-f]{64}$/u);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.purgeCounts)).toBe(true);
    expect(validateRecoveryRehearsalReport(first)).toEqual(first);
  });

  it("derives failed rather than trusting a caller-supplied result", () => {
    const report = createRecoveryRehearsalReport({
      ...INPUT,
      postPurgeRestoreSucceeded: false,
    });
    expect(report.result).toBe("failed");

    expect(() =>
      validateRecoveryRehearsalReport({ ...report, result: "passed" }),
    ).toThrowError("recovery_rehearsal_result_mismatch");
  });

  it("rejects unknown fields, bad hashes, invalid targets, counts, and fingerprints", () => {
    const valid = createRecoveryRehearsalReport(INPUT);
    const invalid: unknown[] = [
      { ...valid, dumpSql: "forbidden" },
      { ...valid, prePurgeDumpSha256: "A".repeat(64) },
      { ...valid, purgeTargetId: "not-a-uuid" },
      { ...valid, purgeCounts: { ...valid.purgeCounts, scenarioCount: -1 } },
      { ...valid, fingerprint: "0".repeat(64) },
    ];

    for (const candidate of invalid) {
      expect(() => validateRecoveryRehearsalReport(candidate)).toThrow(
        RecoveryRehearsalError,
      );
    }
  });

  it("does not permit arbitrary migration references or payload-shaped metadata", () => {
    for (const migrationRef of [
      "https://database.example/migrations",
      "migrations:contains space",
      `migrations:${"x".repeat(65)}`,
    ]) {
      expect(() =>
        createRecoveryRehearsalReport({ ...INPUT, migrationRef }),
      ).toThrowError("invalid_recovery_migration_ref");
    }
  });

  it("returns detached data independent from caller-owned purge counts", () => {
    const counts = { snapshotCount: 1, historyCount: 1, scenarioCount: 1 };
    const report = createRecoveryRehearsalReport({ ...INPUT, purgeCounts: counts });
    expect(report.purgeCounts).not.toBe(counts);
    counts.snapshotCount = 99;
    expect(report.purgeCounts.snapshotCount).toBe(1);
  });
});
