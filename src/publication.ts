import type {
  ClassificationEnvelope,
  EvidencedValue,
  Product,
  PublicFacet,
  PublicationDecision,
  Relationship,
  Scenario,
} from "./domain";

function publishableMetadata(
  value: EvidencedValue<unknown>,
  options: { requireApproved: boolean; requireEvidence: boolean },
): boolean {
  return (
    (value.confidence === "high" || value.confidence === "medium") &&
    (!options.requireEvidence || value.evidence.length > 0) &&
    !value.conflictReason &&
    (options.requireApproved
      ? value.reviewState === "approved"
      : value.reviewState !== "rejected" &&
        value.reviewState !== "needs_more_evidence") &&
    (!value.evidence.some((evidence) => evidence.method === "ai_candidate") ||
      value.reviewState === "approved") &&
    Boolean(value.contentVersion && value.checkedAt)
  );
}

export function publishableValue<T>(
  value: EvidencedValue<T>,
): value is Extract<EvidencedValue<T>, { state: "known" }> {
  return (
    value.state === "known" &&
    Boolean(value.value) &&
    publishableMetadata(value, {
      requireApproved: false,
      requireEvidence: true,
    })
  );
}

function publishableUnknown<T>(
  value: EvidencedValue<T>,
): value is Extract<EvidencedValue<T>, { state: "unknown" }> {
  return (
    value.state === "unknown" &&
    publishableMetadata(value, {
      requireApproved: true,
      requireEvidence: true,
    })
  );
}

function publicFacet<T>(value: EvidencedValue<T>): PublicFacet<T> | undefined {
  if (publishableValue(value)) return { state: "known", value: value.value };
  if (publishableUnknown(value)) return { state: "unknown" };
  return undefined;
}

function publishableClassification(
  classification: ClassificationEnvelope,
): classification is Extract<ClassificationEnvelope, { state: "known" }> {
  return (
    publishableValue(classification) &&
    classification.reviewState === "approved" &&
    Boolean(classification.normalizerVersion && classification.registryVersion)
  );
}

const system = (relationship: Relationship) =>
  publishableValue(relationship.system) &&
  relationship.system.reviewState === "approved"
    ? relationship.system.value
    : undefined;

const validDate = (value: string) => Number.isFinite(Date.parse(value));

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
    !publishableClassification(product.classification) ||
    ![
      "scenario_single",
      "scenario_collection",
      "mixed_scenario_and_material",
    ].includes(product.classification.value)
  )
    return { publish: false, reason: "classification" };
  if (!scenario.separationApproved || !publishableValue(scenario.title))
    return { publish: false, reason: "required_core" };

  const playerCount = publicFacet(scenario.playerCount);
  const edition = publicFacet(scenario.edition);
  const playTimeMinutes = publicFacet(scenario.playTimeMinutes);
  const modality = publicFacet(scenario.modality);
  const requiredBooks = publicFacet(scenario.requiredBooks);
  const compatibility = publicFacet(scenario.compatibility);
  const genre = publicFacet(scenario.tags.genre);
  const tone = publicFacet(scenario.tags.tone);
  const setting = publicFacet(scenario.tags.setting);
  const structure = publicFacet(scenario.tags.structure);
  const content = publicFacet(scenario.tags.content);

  if (
    !playerCount ||
    !edition ||
    !playTimeMinutes ||
    !modality ||
    !requiredBooks ||
    !compatibility ||
    !genre ||
    !tone ||
    !setting ||
    !structure ||
    !content ||
    !publishableValue(scenario.publishedAt) ||
    !publishableValue(scenario.lastCheckedAt) ||
    !validDate(scenario.publishedAt.value) ||
    !validDate(scenario.lastCheckedAt.value)
  )
    return { publish: false, reason: "facet_evidence" };

  return {
    publish: true,
    value: {
      id: scenario.id,
      title: scenario.title.value,
      playerCount,
      edition,
      playTimeMinutes,
      modality,
      tags: { genre, tone, setting, structure, content },
      requiredBooks,
      compatibility,
      publishedAt: scenario.publishedAt.value,
      lastCheckedAt: scenario.lastCheckedAt.value,
      productUrl: product.canonicalUrl,
      productTitle: product.title ?? "合成商品",
      systems: scenario.relationships
        .map(system)
        .filter((value): value is string => Boolean(value)),
    },
  };
}
