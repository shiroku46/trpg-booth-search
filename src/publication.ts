import type {
  BookRequirementRecord,
  ClassificationEnvelope,
  EvidencedValue,
  NumericRange,
  Product,
  PublicBook,
  PublicationDecision,
  PublicPlayTime,
  PublicRange,
  PublicSystem,
  PublicTag,
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
    value.value !== undefined &&
    value.value !== null &&
    value.value !== "" &&
    publishableMetadata(value, {
      requireApproved: false,
      requireEvidence: true,
    })
  );
}

function approvedValue<T>(
  value: EvidencedValue<T> | undefined,
): value is Extract<EvidencedValue<T>, { state: "known" }> {
  return Boolean(
    value && publishableValue(value) && value.reviewState === "approved",
  );
}

function publishableUnknown<T>(
  value: EvidencedValue<T> | undefined,
): value is Extract<EvidencedValue<T>, { state: "unknown" }> {
  return Boolean(
    value &&
      value.state === "unknown" &&
      publishableMetadata(value, {
        requireApproved: true,
        requireEvidence: true,
      }),
  );
}

function publishableClassification(
  classification: ClassificationEnvelope,
): classification is Extract<ClassificationEnvelope, { state: "known" }> {
  return (
    approvedValue(classification) &&
    Boolean(classification.normalizerVersion && classification.registryVersion)
  );
}

function validRange(value: NumericRange): boolean {
  return (
    Number.isFinite(value.min) &&
    Number.isFinite(value.max) &&
    value.min >= 0 &&
    value.max >= value.min
  );
}

function publicRange(
  value: EvidencedValue<NumericRange> | undefined,
): PublicRange | undefined {
  if (approvedValue(value) && validRange(value.value)) {
    return { state: "known", min: value.value.min, max: value.value.max };
  }
  return publishableUnknown(value) ? { state: "unknown" } : undefined;
}

function publicPlayTime(
  value: Scenario["playTime"],
): PublicPlayTime | undefined {
  if (approvedValue(value) && validRange(value.value)) {
    return {
      state: "known",
      min: value.value.min,
      max: value.value.max,
      ...(value.value.modality ? { modality: value.value.modality } : {}),
    };
  }
  return publishableUnknown(value) ? { state: "unknown" } : undefined;
}

function publicSystem(relationship: Relationship): PublicSystem | undefined {
  if (!approvedValue(relationship.system)) return undefined;
  const normalized = approvedValue(relationship.normalizedSystem)
    ? relationship.normalizedSystem.value
    : relationship.system.value;
  const edition = approvedValue(relationship.edition)
    ? relationship.edition.value
    : undefined;
  const aliases = (relationship.aliases ?? [])
    .filter(approvedValue)
    .map((alias) => alias.value);
  return {
    label: relationship.system.value,
    normalized,
    ...(edition ? { edition } : {}),
    aliases,
  };
}

function publicTags(scenario: Scenario): PublicTag[] {
  return (scenario.tags ?? []).flatMap((tag) =>
    approvedValue(tag.label)
      ? [{ category: tag.category, label: tag.label.value }]
      : [],
  );
}

function publicBook(book: BookRequirementRecord): PublicBook | undefined {
  if (!approvedValue(book.title)) return undefined;
  const compatibility = approvedValue(book.compatibility)
    ? book.compatibility.value
    : publishableUnknown(book.compatibility)
      ? "unknown"
      : undefined;
  return {
    kind: book.kind,
    title: book.title.value,
    ...(compatibility ? { compatibility } : {}),
  };
}

export function project(
  product: Product | undefined,
  scenario: Scenario,
): PublicationDecision {
  if (!product || scenario.hold) {
    return { publish: false, reason: "hold_or_missing_product" };
  }
  if (
    !approvedValue(product.allAges) ||
    product.allAges.value !== "all_ages_confirmed"
  ) {
    return { publish: false, reason: "all_ages" };
  }
  if (product.salesState !== "available" && product.salesState !== "sold_out") {
    return { publish: false, reason: "sales" };
  }
  if (
    !product.classification ||
    !publishableClassification(product.classification) ||
    ![
      "scenario_single",
      "scenario_collection",
      "mixed_scenario_and_material",
    ].includes(product.classification.value)
  ) {
    return { publish: false, reason: "classification" };
  }
  if (!scenario.separationApproved || !publishableValue(scenario.title)) {
    return { publish: false, reason: "required_core" };
  }
  const players = publishableValue(scenario.playerCount)
    ? scenario.playerCount.value
    : publishableUnknown(scenario.playerCount)
      ? undefined
      : null;
  if (players === null) return { publish: false, reason: "required_core" };

  const systems = scenario.relationships
    .map(publicSystem)
    .filter((value): value is PublicSystem => Boolean(value));
  const books = (scenario.books ?? [])
    .map(publicBook)
    .filter((value): value is PublicBook => Boolean(value));
  const publicationDate = approvedValue(scenario.publicationDate)
    ? scenario.publicationDate.value
    : undefined;
  const discoveryScore = approvedValue(scenario.discoveryScore)
    ? scenario.discoveryScore.value
    : undefined;

  const playerRange = publicRange(scenario.playerRange);
  const playTime = publicPlayTime(scenario.playTime);

  return {
    publish: true,
    value: {
      id: scenario.id,
      title: scenario.title.value,
      ...(players ? { playerCount: players } : {}),
      ...(playerRange ? { playerRange } : {}),
      ...(playTime ? { playTime } : {}),
      productUrl: product.canonicalUrl,
      productTitle: product.title ?? "合成商品",
      systems: systems.map((system) => system.label),
      systemDetails: systems,
      tags: publicTags(scenario),
      books,
      ...(publicationDate ? { publicationDate } : {}),
      ...(typeof discoveryScore === "number" &&
      Number.isFinite(discoveryScore)
        ? { discoveryScore }
        : {}),
      lastCheckedAt: scenario.title.checkedAt,
    },
  };
}
