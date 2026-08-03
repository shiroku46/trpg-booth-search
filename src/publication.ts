import type {
  EvidencedValue,
  Product,
  PublicationDecision,
  Relationship,
  Scenario,
} from "./domain";

function publishableMetadata(
  v: EvidencedValue<unknown>,
  options: { requireApproved: boolean; requireEvidence: boolean },
): boolean {
  return (
    (v.confidence === "high" || v.confidence === "medium") &&
    (!options.requireEvidence || v.evidence.length > 0) &&
    !v.conflictReason &&
    (options.requireApproved
      ? v.reviewState === "approved"
      : v.reviewState !== "rejected" &&
        v.reviewState !== "needs_more_evidence") &&
    (!v.evidence.some((e) => e.method === "ai_candidate") ||
      v.reviewState === "approved") &&
    Boolean(v.contentVersion && v.checkedAt)
  );
}

export function publishableValue<T>(
  v: EvidencedValue<T>,
): v is Extract<EvidencedValue<T>, { state: "known" }> {
  return (
    v.state === "known" &&
    Boolean(v.value) &&
    publishableMetadata(v, {
      requireApproved: false,
      requireEvidence: true,
    })
  );
}

function publishableUnknown<T>(
  v: EvidencedValue<T>,
): v is Extract<EvidencedValue<T>, { state: "unknown" }> {
  return (
    v.state === "unknown" &&
    publishableMetadata(v, {
      requireApproved: true,
      requireEvidence: true,
    })
  );
}

const system = (r: Relationship) =>
  publishableValue(r.system) && r.system.reviewState === "approved"
    ? r.system.value
    : undefined;

export function project(
  product: Product | undefined,
  scenario: Scenario,
): PublicationDecision {
  if (!product || scenario.hold)
    return { publish: false, reason: "hold_or_missing_product" };
  if (
    !publishableValue(product.allAges) ||
    product.allAges.value !== "all_ages_confirmed" ||
    product.allAges.reviewState !== "approved"
  )
    return { publish: false, reason: "all_ages" };
  if (product.salesState !== "available" && product.salesState !== "sold_out")
    return { publish: false, reason: "sales" };
  if (
    !product.classification ||
    !publishableValue(product.classification) ||
    product.classification.reviewState !== "approved" ||
    ![
      "scenario_single",
      "scenario_collection",
      "mixed_scenario_and_material",
    ].includes(product.classification.value)
  )
    return { publish: false, reason: "classification" };
  if (!scenario.separationApproved || !publishableValue(scenario.title))
    return { publish: false, reason: "required_core" };
  const players = publishableValue(scenario.playerCount)
    ? scenario.playerCount.value
    : publishableUnknown(scenario.playerCount)
      ? undefined
      : null;
  if (players === null) return { publish: false, reason: "required_core" };
  return {
    publish: true,
    value: {
      id: scenario.id,
      title: scenario.title.value,
      ...(players ? { playerCount: players } : {}),
      productUrl: product.canonicalUrl,
      productTitle: product.title ?? "合成商品",
      systems: scenario.relationships
        .map(system)
        .filter((v): v is string => Boolean(v)),
    },
  };
}
