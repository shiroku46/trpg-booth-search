import { createHash } from "node:crypto";

export const RECOVERY_REHEARSAL_SCHEMA_VERSION = 1 as const;
export const RECOVERY_REHEARSAL_KIND = "local_pglite_purge_rehearsal" as const;

const SHA256 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MIGRATION_REF = /^migrations:[A-Za-z0-9._-]{1,64}$/;

export type RecoveryPurgeCounts = Readonly<{
  snapshotCount: number;
  historyCount: number;
  scenarioCount: number;
}>;

export type RecoveryRehearsalResult = "passed" | "failed";

export type RecoveryRehearsalReport = Readonly<{
  schemaVersion: typeof RECOVERY_REHEARSAL_SCHEMA_VERSION;
  kind: typeof RECOVERY_REHEARSAL_KIND;
  migrationRef: string;
  prePurgeDumpSha256: string;
  prePurgeRestoreSucceeded: boolean;
  purgeTargetId: string;
  purgeCounts: RecoveryPurgeCounts;
  postPurgeDumpSha256: string;
  postPurgeRestoreSucceeded: boolean;
  purgedPayloadAbsent: boolean;
  purgedHashesAbsent: boolean;
  unaffectedProductPreserved: boolean;
  result: RecoveryRehearsalResult;
  fingerprint: string;
}>;

export type RecoveryRehearsalInput = Readonly<{
  migrationRef: string;
  prePurgeDumpSha256: string;
  prePurgeRestoreSucceeded: boolean;
  purgeTargetId: string;
  purgeCounts: RecoveryPurgeCounts;
  postPurgeDumpSha256: string;
  postPurgeRestoreSucceeded: boolean;
  purgedPayloadAbsent: boolean;
  purgedHashesAbsent: boolean;
  unaffectedProductPreserved: boolean;
}>;

export class RecoveryRehearsalError extends Error {
  constructor(public readonly reasonCode: string) {
    super(reasonCode);
    this.name = "RecoveryRehearsalError";
  }
}

function fail(reasonCode: string): never {
  throw new RecoveryRehearsalError(reasonCode);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  reasonCode: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    fail(reasonCode);
  }
}

function requireSha256(value: unknown, reasonCode: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) fail(reasonCode);
  return value;
}

function requireBoolean(value: unknown, reasonCode: string): boolean {
  if (typeof value !== "boolean") fail(reasonCode);
  return value;
}

function requireCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail("invalid_recovery_purge_count");
  }
  return value;
}

function normalizeCounts(value: unknown): RecoveryPurgeCounts {
  if (!isRecord(value)) fail("invalid_recovery_purge_counts");
  requireExactKeys(
    value,
    ["snapshotCount", "historyCount", "scenarioCount"],
    "invalid_recovery_purge_counts",
  );
  return Object.freeze({
    snapshotCount: requireCount(value.snapshotCount),
    historyCount: requireCount(value.historyCount),
    scenarioCount: requireCount(value.scenarioCount),
  });
}

function expectedResult(input: {
  prePurgeRestoreSucceeded: boolean;
  postPurgeRestoreSucceeded: boolean;
  purgedPayloadAbsent: boolean;
  purgedHashesAbsent: boolean;
  unaffectedProductPreserved: boolean;
}): RecoveryRehearsalResult {
  return input.prePurgeRestoreSucceeded &&
    input.postPurgeRestoreSucceeded &&
    input.purgedPayloadAbsent &&
    input.purgedHashesAbsent &&
    input.unaffectedProductPreserved
    ? "passed"
    : "failed";
}

function fingerprintPayload(report: Omit<RecoveryRehearsalReport, "fingerprint">): string {
  return JSON.stringify(report);
}

function fingerprint(report: Omit<RecoveryRehearsalReport, "fingerprint">): string {
  return createHash("sha256").update(fingerprintPayload(report), "utf8").digest("hex");
}

function normalizeBase(value: RecoveryRehearsalInput): Omit<RecoveryRehearsalReport, "fingerprint"> {
  if (!MIGRATION_REF.test(value.migrationRef)) fail("invalid_recovery_migration_ref");
  if (!UUID.test(value.purgeTargetId)) fail("invalid_recovery_purge_target");

  const normalized = {
    schemaVersion: RECOVERY_REHEARSAL_SCHEMA_VERSION,
    kind: RECOVERY_REHEARSAL_KIND,
    migrationRef: value.migrationRef,
    prePurgeDumpSha256: requireSha256(
      value.prePurgeDumpSha256,
      "invalid_pre_purge_dump_sha256",
    ),
    prePurgeRestoreSucceeded: requireBoolean(
      value.prePurgeRestoreSucceeded,
      "invalid_pre_purge_restore_state",
    ),
    purgeTargetId: value.purgeTargetId,
    purgeCounts: normalizeCounts(value.purgeCounts),
    postPurgeDumpSha256: requireSha256(
      value.postPurgeDumpSha256,
      "invalid_post_purge_dump_sha256",
    ),
    postPurgeRestoreSucceeded: requireBoolean(
      value.postPurgeRestoreSucceeded,
      "invalid_post_purge_restore_state",
    ),
    purgedPayloadAbsent: requireBoolean(
      value.purgedPayloadAbsent,
      "invalid_purged_payload_state",
    ),
    purgedHashesAbsent: requireBoolean(
      value.purgedHashesAbsent,
      "invalid_purged_hash_state",
    ),
    unaffectedProductPreserved: requireBoolean(
      value.unaffectedProductPreserved,
      "invalid_unaffected_product_state",
    ),
    result: expectedResult(value),
  } as const;
  return Object.freeze(normalized);
}

export function createRecoveryRehearsalReport(
  input: RecoveryRehearsalInput,
): RecoveryRehearsalReport {
  const base = normalizeBase(input);
  return Object.freeze({ ...base, fingerprint: fingerprint(base) });
}

export function validateRecoveryRehearsalReport(
  value: unknown,
): RecoveryRehearsalReport {
  if (!isRecord(value)) fail("invalid_recovery_rehearsal_shape");
  requireExactKeys(
    value,
    [
      "schemaVersion",
      "kind",
      "migrationRef",
      "prePurgeDumpSha256",
      "prePurgeRestoreSucceeded",
      "purgeTargetId",
      "purgeCounts",
      "postPurgeDumpSha256",
      "postPurgeRestoreSucceeded",
      "purgedPayloadAbsent",
      "purgedHashesAbsent",
      "unaffectedProductPreserved",
      "result",
      "fingerprint",
    ],
    "invalid_recovery_rehearsal_shape",
  );
  if (value.schemaVersion !== RECOVERY_REHEARSAL_SCHEMA_VERSION) {
    fail("unsupported_recovery_rehearsal_schema");
  }
  if (value.kind !== RECOVERY_REHEARSAL_KIND) fail("invalid_recovery_rehearsal_kind");

  const base = normalizeBase({
    migrationRef: value.migrationRef as string,
    prePurgeDumpSha256: value.prePurgeDumpSha256 as string,
    prePurgeRestoreSucceeded: value.prePurgeRestoreSucceeded as boolean,
    purgeTargetId: value.purgeTargetId as string,
    purgeCounts: value.purgeCounts as RecoveryPurgeCounts,
    postPurgeDumpSha256: value.postPurgeDumpSha256 as string,
    postPurgeRestoreSucceeded: value.postPurgeRestoreSucceeded as boolean,
    purgedPayloadAbsent: value.purgedPayloadAbsent as boolean,
    purgedHashesAbsent: value.purgedHashesAbsent as boolean,
    unaffectedProductPreserved: value.unaffectedProductPreserved as boolean,
  });
  if (value.result !== base.result) fail("recovery_rehearsal_result_mismatch");
  const suppliedFingerprint = requireSha256(
    value.fingerprint,
    "invalid_recovery_rehearsal_fingerprint",
  );
  const expectedFingerprint = fingerprint(base);
  if (suppliedFingerprint !== expectedFingerprint) {
    fail("recovery_rehearsal_fingerprint_mismatch");
  }
  return Object.freeze({ ...base, fingerprint: expectedFingerprint });
}
