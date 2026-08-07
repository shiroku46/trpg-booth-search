export const REQUIRED_PRODUCTION_GATES = [
  "collection_access",
  "production_data",
  "hosted_database",
  "backup_restore",
  "production_deployment",
] as const;

export type ProductionGateId = (typeof REQUIRED_PRODUCTION_GATES)[number];
export type ProductionGateState = "ready" | "blocked" | "not_evaluated";

export type ProductionGateReason =
  | "approved_collection_mechanism"
  | "collection_challenge_blocked"
  | "verified_production_data"
  | "production_data_fixture_only"
  | "verified_hosted_database"
  | "hosted_database_not_provisioned"
  | "verified_backup_restore"
  | "backup_restore_unresolved"
  | "verified_production_deployment"
  | "production_deployment_not_authorized";

export type ProductionGate = Readonly<{
  id: ProductionGateId;
  state: ProductionGateState;
  reason: ProductionGateReason;
  evidenceRef: string;
}>;

export type ProductionReadinessReport = Readonly<{
  schemaVersion: 1;
  ready: boolean;
  gates: readonly ProductionGate[];
  blockers: readonly ProductionGate[];
}>;

const READY_REASON_BY_GATE: Readonly<Record<ProductionGateId, ProductionGateReason>> = {
  collection_access: "approved_collection_mechanism",
  production_data: "verified_production_data",
  hosted_database: "verified_hosted_database",
  backup_restore: "verified_backup_restore",
  production_deployment: "verified_production_deployment",
};

const NON_READY_REASONS_BY_GATE: Readonly<
  Record<ProductionGateId, readonly ProductionGateReason[]>
> = {
  collection_access: ["collection_challenge_blocked"],
  production_data: ["production_data_fixture_only"],
  hosted_database: ["hosted_database_not_provisioned"],
  backup_restore: ["backup_restore_unresolved"],
  production_deployment: ["production_deployment_not_authorized"],
};

const READY_EVIDENCE_PREFIX: Readonly<Record<ProductionGateId, string>> = {
  collection_access: "collection-mechanism:",
  production_data: "production-data:",
  hosted_database: "database:",
  backup_restore: "recovery:",
  production_deployment: "deployment:",
};

const GATE_IDS = new Set<string>(REQUIRED_PRODUCTION_GATES);
const GATE_STATES = new Set<ProductionGateState>([
  "ready",
  "blocked",
  "not_evaluated",
]);
const EVIDENCE_REF = /^[a-z][a-z0-9_-]{1,31}:[A-Za-z0-9][A-Za-z0-9._/#-]{0,95}$/;

export class ProductionReadinessError extends Error {
  constructor(public readonly reasonCode: string) {
    super(reasonCode);
    this.name = "ProductionReadinessError";
  }
}

function fail(reasonCode: string): never {
  throw new ProductionReadinessError(reasonCode);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function validateEvidenceRef(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 128 ||
    value.includes("://") ||
    value.includes("@") ||
    !EVIDENCE_REF.test(value)
  ) {
    fail("invalid_production_evidence_ref");
  }
  return value;
}

function validateGate(value: unknown): ProductionGate {
  if (!isRecord(value) || !exactKeys(value, ["id", "state", "reason", "evidenceRef"])) {
    fail("invalid_production_gate_shape");
  }

  const { id, state, reason } = value;
  if (typeof id !== "string" || !GATE_IDS.has(id)) {
    fail("unknown_production_gate");
  }
  if (typeof state !== "string" || !GATE_STATES.has(state as ProductionGateState)) {
    fail("invalid_production_gate_state");
  }
  if (typeof reason !== "string") {
    fail("invalid_production_gate_reason");
  }

  const gateId = id as ProductionGateId;
  const gateState = state as ProductionGateState;
  const expectedReadyReason = READY_REASON_BY_GATE[gateId];
  if (gateState === "ready") {
    if (reason !== expectedReadyReason) {
      fail("ready_gate_reason_mismatch");
    }
  } else if (!NON_READY_REASONS_BY_GATE[gateId].includes(reason as ProductionGateReason)) {
    fail("non_ready_gate_reason_mismatch");
  }

  const evidenceRef = validateEvidenceRef(value.evidenceRef);
  if (
    gateState === "ready" &&
    !evidenceRef.startsWith(READY_EVIDENCE_PREFIX[gateId])
  ) {
    fail("ready_gate_evidence_mismatch");
  }

  return Object.freeze({
    id: gateId,
    state: gateState,
    reason: reason as ProductionGateReason,
    evidenceRef,
  });
}

export function evaluateProductionReadiness(input: unknown): ProductionReadinessReport {
  if (!Array.isArray(input)) {
    fail("production_gates_must_be_array");
  }
  if (input.length !== REQUIRED_PRODUCTION_GATES.length) {
    fail("production_gate_count_mismatch");
  }

  const byId = new Map<ProductionGateId, ProductionGate>();
  for (const item of input) {
    const gate = validateGate(item);
    if (byId.has(gate.id)) {
      fail("duplicate_production_gate");
    }
    byId.set(gate.id, gate);
  }

  const gates = REQUIRED_PRODUCTION_GATES.map((id) => {
    const gate = byId.get(id);
    if (!gate) fail("missing_production_gate");
    return gate;
  });
  const blockers = gates.filter((gate) => gate.state !== "ready");

  return Object.freeze({
    schemaVersion: 1 as const,
    ready: blockers.length === 0,
    gates: Object.freeze([...gates]),
    blockers: Object.freeze([...blockers]),
  });
}

export const CURRENT_PRODUCTION_READINESS = evaluateProductionReadiness([
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
