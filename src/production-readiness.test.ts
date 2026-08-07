import { describe, expect, it } from "vitest";

import {
  CURRENT_PRODUCTION_READINESS,
  REQUIRED_PRODUCTION_GATES,
  ProductionReadinessError,
  evaluateProductionReadiness,
} from "./production-readiness";

type SyntheticGate = {
  id: string;
  state: string;
  reason: string;
  evidenceRef: string;
};

const ALL_READY: readonly SyntheticGate[] = [
  {
    id: "collection_access",
    state: "ready",
    reason: "approved_collection_mechanism",
    evidenceRef: "collection-mechanism:approved-001",
  },
  {
    id: "production_data",
    state: "ready",
    reason: "verified_production_data",
    evidenceRef: "production-data:verified-001",
  },
  {
    id: "hosted_database",
    state: "ready",
    reason: "verified_hosted_database",
    evidenceRef: "database:verified-001",
  },
  {
    id: "backup_restore",
    state: "ready",
    reason: "verified_backup_restore",
    evidenceRef: "recovery:restore-001",
  },
  {
    id: "production_deployment",
    state: "ready",
    reason: "verified_production_deployment",
    evidenceRef: "deployment:production-001",
  },
];

describe("Stage 34 production readiness", () => {
  it("requires exactly the fixed five gates and becomes ready only when all are ready", () => {
    const report = evaluateProductionReadiness([...ALL_READY].reverse());

    expect(report.ready).toBe(true);
    expect(report.gates.map((gate) => gate.id)).toEqual(
      REQUIRED_PRODUCTION_GATES,
    );
    expect(report.blockers).toEqual([]);
    expect(report.schemaVersion).toBe(1);
  });

  it("publishes the current repository checkpoint as explicitly not ready", () => {
    expect(CURRENT_PRODUCTION_READINESS.ready).toBe(false);
    expect(CURRENT_PRODUCTION_READINESS.blockers).toHaveLength(5);
    expect(CURRENT_PRODUCTION_READINESS.gates).toEqual([
      {
        id: "collection_access",
        state: "blocked",
        reason: "collection_challenge_blocked",
        evidenceRef: "github-run:31177408337",
      },
      {
        id: "production_data",
        state: "blocked",
        reason: "production_data_fixture_only",
        evidenceRef: "repository:fixture-preview",
      },
      {
        id: "hosted_database",
        state: "not_evaluated",
        reason: "hosted_database_not_provisioned",
        evidenceRef: "decision:D-028",
      },
      {
        id: "backup_restore",
        state: "not_evaluated",
        reason: "backup_restore_unresolved",
        evidenceRef: "decision:PD-010",
      },
      {
        id: "production_deployment",
        state: "not_evaluated",
        reason: "production_deployment_not_authorized",
        evidenceRef: "decision:D-050",
      },
    ]);
  });

  it("fails closed on missing, duplicate, unknown, or malformed gates", () => {
    expect(() =>
      evaluateProductionReadiness(ALL_READY.slice(0, 4)),
    ).toThrowError("production_gate_count_mismatch");

    const duplicate = [...ALL_READY.slice(0, 4), ALL_READY[0]];
    expect(() => evaluateProductionReadiness(duplicate)).toThrowError(
      "duplicate_production_gate",
    );

    const unknown = ALL_READY.map((gate) => ({ ...gate }));
    unknown[0] = { ...unknown[0]!, id: "unknown_gate" };
    expect(() => evaluateProductionReadiness(unknown)).toThrowError(
      "unknown_production_gate",
    );

    const extraField = ALL_READY.map((gate) => ({ ...gate }));
    const malformed = [
      { ...extraField[0]!, payload: "forbidden" },
      ...extraField.slice(1),
    ];
    expect(() => evaluateProductionReadiness(malformed)).toThrowError(
      "invalid_production_gate_shape",
    );
  });

  it("does not allow policy or robots evidence alone to mark collection access ready", () => {
    const policyOnly = ALL_READY.map((gate) => ({ ...gate }));
    policyOnly[0] = {
      ...policyOnly[0]!,
      evidenceRef: "policy:approved-digest",
    };

    expect(() => evaluateProductionReadiness(policyOnly)).toThrowError(
      "ready_gate_evidence_mismatch",
    );
  });

  it("enforces gate-specific ready reasons and controlled non-ready reasons", () => {
    const wrongReadyReason = ALL_READY.map((gate) => ({ ...gate }));
    wrongReadyReason[1] = {
      ...wrongReadyReason[1]!,
      reason: "verified_hosted_database",
    };
    expect(() => evaluateProductionReadiness(wrongReadyReason)).toThrowError(
      "ready_gate_reason_mismatch",
    );

    const wrongBlockedReason = ALL_READY.map((gate) => ({ ...gate }));
    wrongBlockedReason[0] = {
      id: "collection_access",
      state: "blocked",
      reason: "backup_restore_unresolved",
      evidenceRef: "github-run:31177408337",
    };
    expect(() => evaluateProductionReadiness(wrongBlockedReason)).toThrowError(
      "non_ready_gate_reason_mismatch",
    );
  });

  it("rejects arbitrary URLs, credentials, whitespace, and unbounded evidence refs", () => {
    for (const evidenceRef of [
      "https://example.com/evidence",
      "secret:user@example.com",
      "decision:contains space",
      `decision:${"a".repeat(120)}`,
    ]) {
      const input = ALL_READY.map((gate) => ({ ...gate }));
      input[4] = { ...input[4]!, evidenceRef };
      expect(
        () => evaluateProductionReadiness(input),
        evidenceRef,
      ).toThrowError("invalid_production_evidence_ref");
    }
  });

  it("returns canonical detached deeply immutable reports", () => {
    const caller = ALL_READY.map((gate) => ({ ...gate }));
    const report = evaluateProductionReadiness(caller);

    expect(report.gates[0]).not.toBe(caller[0]);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.gates)).toBe(true);
    expect(Object.isFrozen(report.blockers)).toBe(true);
    expect(report.gates.every(Object.isFrozen)).toBe(true);

    caller[0]!.evidenceRef = "collection-mechanism:changed-after-evaluation";
    expect(report.gates[0]!.evidenceRef).toBe(
      "collection-mechanism:approved-001",
    );
  });

  it("uses a dedicated bounded error type", () => {
    try {
      evaluateProductionReadiness("not-an-array");
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ProductionReadinessError);
      expect((error as ProductionReadinessError).reasonCode).toBe(
        "production_gates_must_be_array",
      );
    }
  });
});
