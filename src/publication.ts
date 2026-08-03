import type {
  BookRequirement,
  ClassificationEnvelope,
  EvidencedValue,
  PlayerCountRange,
  PlayTimeRange,
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

const validPlayerCountRange = (value: PlayerCountRange) =>
  Number.isInteger(value.minimumPlayers) &&
  Number.isInteger(value.maximumPlayers) &&
  value.minimumPlayers >= 1 &&
  value.maximumPlayers >= value.minimumPlayers;

function publicPlayerCountFacet(
  value: EvidencedValue<PlayerCountRange>,
): PublicFacet<PlayerCountRange> | undefined {
  if (publishableValue(value) && validPlayerCountRange(value.value))
    return { state: "known", value: value.value };
  if (publishableUnknown(value)) return { state: "unknown" };
  return undefined;
}

const validPlayTimeRange = (value: PlayTimeRange) =>
  Number.isFinite(value.minimumMinutes) &&
  Number.isFinite(value.maximumMinutes) &&
  value.minimumMinutes >= 0 &&
  value.maximumMinutes >= value.minimumMinutes;

function publicPlayTimeFacet(
  value: EvidencedValue<PlayTimeRange>,
): PublicFacet<PlayTimeRange> | undefined {
  if (publishableValue(value) && validPlayTimeRange(value.value))
    return { state: "known", value: value.value };
  if (publishableUnknown(value)) return { state: "unknown" };
  return undefined;
}

const validStringList = (values: readonly string[]) =>
  values.every((value) => value.trim().length > 0);

function publicStringListFacet(
  value: EvidencedValue<readonly string[]>,
): PublicFacet<readonly string[]> {
  if (publishableValue(value) && validStringList(value.value))
    return { state: "known", value: value.value };
  if (publishableUnknown(value)) return { state: "unknown" };
  return { state: "omitted" };
}

const validBookRequirements = (values: readonly BookRequirement[]) =>
  values.every(
    (value) =>
      value.title.trim().length > 0 &&
      (value.kind === "required" || value.kind === "optional"),
  );

function publicBookFacet(
  value: EvidencedValue<readonly BookRequirement[]>,
): PublicFacet<readonly BookRequirement[]> {
  if (publishableValue(value) && validBookRequirements(value.value))
    return { state: "known", value: value.value };
  if (publishableUnknown(value)) return { state: "unknown" };
  return { state: "omitted" };
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

function publicSystems(
  relationships: readonly Relationship[],
): PublicFacet<readonly string[]> {
  const labels = new Set<string>();
  let hasExplicitUnknown = false;

  for (const relationship of relationships) {
    if (
      publishableValue(relationship.system) &&
      relationship.system.reviewState === "approved"
    ) {
      labels.add(relationship.system.value.trim());
      if (
        publishableValue(relationship.aliases) &&
        relationship.aliases.reviewState === "approved" &&
        validStringList(relationship.aliases.value)
      )
        for (const alias of relationship.aliases.value)
          labels.add(alias.trim());
    } else if (publishableUnknown(relationship.system)) {
      hasExplicitUnknown = true;
    }
  }

  if (labels.size > 0) return { state: "known", value: [...labels] };
  if (hasExplicitUnknown) return { state: "unknown" };
  return { state: "omitted" };
}

const timezoneAwareIso =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/u;

const isLeapYear = (year: number) =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const validDate = (value: string) => {
  const match = timezoneAwareIso.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[9] === undefined ? 0 : Number(match[9]);
  const offsetMinute = match[10] === undefined ? 0 : Number(match[10]);
  const days = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= (days[month - 1] ?? 0) &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 14 &&
    offsetMinute <= 59 &&
    (offsetHour < 14 || offsetMinute === 0) &&
    Number.isFinite(Date.parse(value))
  );
};

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

  const playerCount = publicPlayerCountFacet(scenario.playerCount);
  const edition = publicFacet(scenario.edition);
  const playTimeMinutes = publicPlayTimeFacet(scenario.playTimeMinutes);
  const modality = publicFacet(scenario.modality);
  const publishedAt =
    publishableValue(scenario.publishedAt) &&
    validDate(scenario.publishedAt.value)
      ? scenario.publishedAt.value
      : validDate(product.firstSeenAt)
        ? product.firstSeenAt
        : undefined;
  const lastCheckedAt =
    publishableValue(scenario.lastCheckedAt) &&
    validDate(scenario.lastCheckedAt.value)
      ? scenario.lastCheckedAt.value
      : undefined;

  if (
    !playerCount ||
    !edition ||
    !playTimeMinutes ||
    !modality ||
    !publishedAt ||
    !lastCheckedAt
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
      tags: {
        genre: publicStringListFacet(scenario.tags.genre),
        tone: publicStringListFacet(scenario.tags.tone),
        setting: publicStringListFacet(scenario.tags.setting),
        structure: publicStringListFacet(scenario.tags.structure),
        content: publicStringListFacet(scenario.tags.content),
      },
      requiredBooks: publicBookFacet(scenario.requiredBooks),
      compatibility: publicStringListFacet(scenario.compatibility),
      publishedAt,
      lastCheckedAt,
      productUrl: product.canonicalUrl,
      productTitle: product.title ?? "合成商品",
      systems: publicSystems(scenario.relationships),
    },
  };
}
