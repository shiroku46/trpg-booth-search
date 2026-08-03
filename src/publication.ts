import type { EvidencedValue, Product, PublicationDecision, Relationship, Scenario } from "./domain.ts";
export function publishableValue<T>(v: EvidencedValue<T>): v is Extract<EvidencedValue<T>, { state: "known" }> {
  if (v.state !== "known") return false;
  return Boolean(v.value) && (v.confidence === "high" || v.confidence === "medium") && v.evidence.length > 0 && !v.conflictReason && v.reviewState !== "rejected" && v.reviewState !== "needs_more_evidence" && (!v.evidence.some((e) => e.method === "ai_candidate") || v.reviewState === "approved") && Boolean(v.contentVersion && v.checkedAt);
}
const system = (r: Relationship) => publishableValue(r.system) ? r.system.value : undefined;
export function project(product: Product | undefined, scenario: Scenario): PublicationDecision {
  if (!product || scenario.hold) return { publish: false, reason: "hold_or_missing_product" };
  if (!publishableValue(product.allAges) || product.allAges.value !== "all_ages_confirmed" || product.allAges.reviewState !== "approved") return { publish: false, reason: "all_ages" };
  if (product.salesState !== "available" && product.salesState !== "sold_out") return { publish: false, reason: "sales" };
  if (!product.classification || !publishableValue(product.classification) || !["scenario_single", "scenario_collection", "mixed_scenario_and_material"].includes(product.classification.value)) return { publish: false, reason: "classification" };
  if (!scenario.separationApproved || !publishableValue(scenario.title)) return { publish: false, reason: "required_core" };
  const players = publishableValue(scenario.playerCount) ? scenario.playerCount.value : scenario.playerCount.state === "unknown" ? undefined : null;
  if (players === null) return { publish: false, reason: "required_core" };
  return { publish: true, value: { id: scenario.id, title: scenario.title.value, ...(players ? { playerCount: players } : {}), productUrl: product.canonicalUrl, productTitle: product.title ?? "合成商品", systems: scenario.relationships.map(system).filter((v): v is string => Boolean(v)) } };
}
