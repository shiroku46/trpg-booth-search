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
  SalesState,
  Scenario,
} from "./domain";

function publishableMetadata(
  value: EvidencedValue<unknown>,
  options: { requireApproved: boolean; requireEvidence: boolean },
): boolean {
  return (
    (value.confidence === "high" || value.confidence === "medium") &&
    Array.isArray(value.evidence) &&
    (!options.requireEvidence || value.evidence.length > 0) &&
    !value.conflictReason &&
    (options.requireApproved
      ? value.reviewState === "approved"
      : value.reviewState !== "rejected" &&
        value.reviewState !== "needs_more_evidence") &&
    (!value.evidence.some((evidence) => evidence.method === "ai_candidate") ||
      value.reviewState === "approved") &&
    typeof value.contentVersion === "string" &&
    value.contentVersion.length > 0 &&
    typeof value.checkedAt === "string" &&
    value.checkedAt.length > 0
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

function publishableSalesState(
  value: EvidencedValue<SalesState> | undefined,
): value is Extract<EvidencedValue<SalesState>, { state: "known" }> {
  return (
    value !== undefined &&
    value.state === "known" &&
    ["available", "sold_out", "sales_ended"].includes(value.value) &&
    publishableMetadata(value, {
      requireApproved: true,
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

const validBookRequirement = (value: BookRequirement) =>
  value.title.trim().length > 0 &&
  (value.kind === "required" || value.kind === "optional");

function publicRelationshipFacet<T>(
  relationships: readonly EvidencedValue<T>[],
  validValue: (value: T) => boolean,
): PublicFacet<readonly T[]> {
  const values: T[] = [];
  let hasExplicitUnknown = false;

  for (const relationship of relationships) {
    if (
      publishableValue(relationship) &&
      relationship.reviewState === "approved" &&
      validValue(relationship.value)
    ) {
      values.push(relationship.value);
    } else if (publishableUnknown(relationship)) {
      hasExplicitUnknown = true;
    }
  }

  if (values.length > 0) return { state: "known", value: values };
  if (hasExplicitUnknown) return { state: "unknown" };
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

function publicSystems(relationships: readonly Relationship[]): {
  systems: PublicFacet<readonly string[]>;
  systemAliases: readonly string[];
  hasExplicitUnknownSystem: boolean;
} {
  const labels = new Set<string>();
  const aliases = new Set<string>();
  let hasExplicitUnknownSystem = false;

  for (const relationship of relationships) {
    if (
      publishableValue(relationship.system) &&
      relationship.system.reviewState === "approved"
    ) {
      const label = relationship.system.value.trim();
      if (!label) continue;
      labels.add(label);
      if (
        publishableValue(relationship.aliases) &&
        relationship.aliases.reviewState === "approved" &&
        validStringList(relationship.aliases.value)
      )
        for (const alias of relationship.aliases.value)
          aliases.add(alias.trim());
    } else if (publishableUnknown(relationship.system)) {
      hasExplicitUnknownSystem = true;
    }
  }

  const systems: PublicFacet<readonly string[]> =
    labels.size > 0
      ? { state: "known", value: [...labels] }
      : hasExplicitUnknownSystem
        ? { state: "unknown" }
        : { state: "omitted" };

  return {
    systems,
    systemAliases: [...aliases],
    hasExplicitUnknownSystem,
  };
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
  if (!publishableSalesState(product.salesState))
    return { publish: false, reason: "sales_state_evidence" };
  if (product.salesState.value === "sales_ended")
    return { publish: false, reason: "sales_ended" };
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
    publishableValue(product.sourcePublicationDate) &&
    validDate(product.sourcePublicationDate.value)
      ? product.sourcePublicationDate.value
      : validDate(product.firstSeenAt)
        ? product.firstSeenAt
        : undefined;
  const lastCheckedAt = validDate(product.lastCheckedAt)
    ? product.lastCheckedAt
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

  const systems = publicSystems(scenario.relationships);

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
      requiredBooks: publicRelationshipFacet(
        scenario.requiredBooks,
        validBookRequirement,
      ),
      compatibility: publicRelationshipFacet(
        scenario.compatibility,
        (value) => value.trim().length > 0,
      ),
      publishedAt,
      lastCheckedAt,
      productUrl: product.canonicalUrl,
      productTitle: product.title ?? "合成商品",
      ...systems,
    },
  };
}
