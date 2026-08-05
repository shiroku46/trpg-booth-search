import rawRegistry from "../registry/initial-v1.json";

export const REGISTRY_SCHEMA_VERSION = 1 as const;
export const REGISTRY_NORMALIZER_VERSION = "system-normalizer-v1" as const;

export const REGISTRY_TARGET_TYPES = [
  "system_family",
  "edition",
  "book",
] as const;
export type RegistryTargetType = (typeof REGISTRY_TARGET_TYPES)[number];

export const REGISTRY_ALIAS_KINDS = [
  "official_label",
  "abbreviation",
  "common_variant",
  "transliteration",
  "typographical_variant",
  "unclassified",
] as const;
export type RegistryAliasKind = (typeof REGISTRY_ALIAS_KINDS)[number];

export type RegistryEvidence = {
  url: string;
  location: string;
};

type RegistryEntityBase = {
  id: string;
  labels: { ja: string };
  evidence: RegistryEvidence[];
};

export type RegistrySystemFamily = RegistryEntityBase;

export type RegistryEdition = RegistryEntityBase & {
  systemFamilyId: string;
};

export type RegistryBook = RegistryEntityBase & {
  systemFamilyId: string;
  editionId?: string;
  kind: "core_rulebook";
  medium: "print" | "web";
};

export type RegistryAlias = {
  originalSourceText: string;
  comparisonKey: string;
  aliasKind: RegistryAliasKind;
  targetEntityType: RegistryTargetType;
  targetId: string;
  sourceUrl: string;
  evidenceLocation: string;
  confidence: "high" | "medium" | "low" | "unresolved";
  conflictStatus: "clear" | "hold_alias_conflict";
  firstObserved: string;
  lastObserved: string;
  normalizerVersion: string;
  reviewState: "pending" | "approved" | "rejected";
};

export type RegistryManifest = {
  schemaVersion: number;
  registryVersion: string;
  normalizerVersion: string;
  reviewedAt: string;
  officialDomains: string[];
  systemFamilies: RegistrySystemFamily[];
  editions: RegistryEdition[];
  books: RegistryBook[];
  aliases: RegistryAlias[];
};

export type RegistryCandidate = {
  targetEntityType: RegistryTargetType;
  targetId: string;
};

export type RegistryResolution =
  | {
      state: "resolved";
      comparisonKey: string;
      targetEntityType: RegistryTargetType;
      targetId: string;
    }
  | { state: "no_match"; comparisonKey: string }
  | {
      state: "ambiguous";
      comparisonKey: string;
      candidates: RegistryCandidate[];
    }
  | {
      state: "hold_alias_conflict";
      comparisonKey: string;
      candidates: RegistryCandidate[];
    };

export type RegistryValidation = {
  valid: boolean;
  errors: string[];
};

const MACHINE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const REGISTRY_VERSION = /^registry-\d{4}-\d{2}-\d{2}\.\d+$/u;
const HYPHEN_VARIANTS = /[‐‑‒–—―−]/gu;
const SINGLE_QUOTE_VARIANTS = /[‘’‚‛]/gu;
const DOUBLE_QUOTE_VARIANTS = /[“”„‟]/gu;
const MIDDLE_DOT_VARIANTS = /[・･]/gu;

function foldFullWidthAscii(value: string): string {
  return Array.from(value.normalize("NFC"), (character) => {
    const codePoint = character.codePointAt(0)!;
    if (codePoint === 0x3000) return " ";
    if (codePoint >= 0xff01 && codePoint <= 0xff5e)
      return String.fromCodePoint(codePoint - 0xfee0);
    return character;
  }).join("");
}

export function normalizeRegistryComparisonKey(value: string): string {
  const widthFolded = foldFullWidthAscii(value).toLocaleLowerCase("ja");
  const whitespaceFolded = widthFolded.replace(/\s+/gu, " ").trim();
  return whitespaceFolded
    .replace(HYPHEN_VARIANTS, "-")
    .replace(SINGLE_QUOTE_VARIANTS, "'")
    .replace(DOUBLE_QUOTE_VARIANTS, '"')
    .replace(MIDDLE_DOT_VARIANTS, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function isRegistryTargetType(value: unknown): value is RegistryTargetType {
  return (
    typeof value === "string" &&
    (REGISTRY_TARGET_TYPES as readonly string[]).includes(value)
  );
}

function isRegistryAliasKind(value: unknown): value is RegistryAliasKind {
  return (
    typeof value === "string" &&
    (REGISTRY_ALIAS_KINDS as readonly string[]).includes(value)
  );
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function officialUrlError(
  value: string,
  officialDomains: readonly string[],
): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "must use HTTPS";
    if (url.username || url.password || url.hash)
      return "must not contain credentials or a fragment";
    if (!officialDomains.includes(url.hostname))
      return `uses unapproved domain ${url.hostname}`;
    return undefined;
  } catch {
    return "is not a valid URL";
  }
}

function entityRecords(registry: RegistryManifest): Array<{
  targetEntityType: RegistryTargetType;
  entity: RegistryEntityBase;
}> {
  return [
    ...registry.systemFamilies.map((entity) => ({
      targetEntityType: "system_family" as const,
      entity,
    })),
    ...registry.editions.map((entity) => ({
      targetEntityType: "edition" as const,
      entity,
    })),
    ...registry.books.map((entity) => ({
      targetEntityType: "book" as const,
      entity,
    })),
  ];
}

function targetSets(
  registry: RegistryManifest,
): Record<RegistryTargetType, Set<string>> {
  return {
    system_family: new Set(registry.systemFamilies.map(({ id }) => id)),
    edition: new Set(registry.editions.map(({ id }) => id)),
    book: new Set(registry.books.map(({ id }) => id)),
  };
}

function validateEvidence(
  owner: string,
  evidence: readonly RegistryEvidence[],
  domains: readonly string[],
  errors: string[],
): void {
  if (evidence.length === 0)
    errors.push(`${owner}: evidence must not be empty`);
  for (const [index, item] of evidence.entries()) {
    const prefix = `${owner}: evidence[${index}]`;
    if (!item.location.trim())
      errors.push(`${prefix}: location must not be empty`);
    const urlError = officialUrlError(item.url, domains);
    if (urlError) errors.push(`${prefix}: ${urlError}`);
  }
}

export function validateRegistry(
  registry: RegistryManifest,
): RegistryValidation {
  const errors: string[] = [];

  if (registry.schemaVersion !== REGISTRY_SCHEMA_VERSION)
    errors.push(`schemaVersion must be ${REGISTRY_SCHEMA_VERSION}`);
  if (!REGISTRY_VERSION.test(registry.registryVersion))
    errors.push("registryVersion is not in the accepted format");
  if (registry.normalizerVersion !== REGISTRY_NORMALIZER_VERSION)
    errors.push(`normalizerVersion must be ${REGISTRY_NORMALIZER_VERSION}`);
  if (!isIsoDate(registry.reviewedAt))
    errors.push("reviewedAt must be an ISO date");

  const sortedDomains = [...registry.officialDomains].sort();
  if (
    new Set(registry.officialDomains).size !== registry.officialDomains.length
  )
    errors.push("officialDomains must not contain duplicates");
  if (
    JSON.stringify(sortedDomains) !== JSON.stringify(registry.officialDomains)
  )
    errors.push("officialDomains must use deterministic sorted order");

  const allIds = new Set<string>();
  for (const { targetEntityType, entity } of entityRecords(registry)) {
    const owner = `${targetEntityType}:${entity.id}`;
    if (!MACHINE_ID.test(entity.id) || entity.id.length > 64)
      errors.push(`${owner}: invalid immutable ID`);
    if (allIds.has(entity.id)) errors.push(`${owner}: duplicate global ID`);
    allIds.add(entity.id);
    if (!entity.labels.ja.trim())
      errors.push(`${owner}: Japanese label is required`);
    validateEvidence(owner, entity.evidence, registry.officialDomains, errors);
  }

  const families = new Set(registry.systemFamilies.map(({ id }) => id));
  const editions = new Map(
    registry.editions.map((edition) => [edition.id, edition]),
  );
  for (const edition of registry.editions)
    if (!families.has(edition.systemFamilyId))
      errors.push(`edition:${edition.id}: unknown system family`);

  for (const book of registry.books) {
    if (!families.has(book.systemFamilyId))
      errors.push(`book:${book.id}: unknown system family`);
    if (book.editionId) {
      const edition = editions.get(book.editionId);
      if (!edition) errors.push(`book:${book.id}: unknown edition`);
      else if (edition.systemFamilyId !== book.systemFamilyId)
        errors.push(
          `book:${book.id}: edition belongs to another system family`,
        );
    }
  }

  const targets = targetSets(registry);
  const aliasesByTypeAndKey = new Map<string, Set<string>>();
  for (const [index, alias] of registry.aliases.entries()) {
    const owner = `alias[${index}]`;
    const targetEntityType = isRegistryTargetType(alias.targetEntityType)
      ? alias.targetEntityType
      : undefined;
    if (!targetEntityType) errors.push(`${owner}: invalid target entity type`);
    if (!isRegistryAliasKind(alias.aliasKind))
      errors.push(`${owner}: invalid alias kind`);
    if (!alias.originalSourceText.trim())
      errors.push(`${owner}: original source text must not be empty`);
    if (
      alias.comparisonKey !==
      normalizeRegistryComparisonKey(alias.originalSourceText)
    )
      errors.push(`${owner}: comparison key does not match the normalizer`);
    if (targetEntityType && !targets[targetEntityType].has(alias.targetId))
      errors.push(`${owner}: target does not exist`);
    if (!alias.evidenceLocation.trim())
      errors.push(`${owner}: evidence location must not be empty`);
    const urlError = officialUrlError(
      alias.sourceUrl,
      registry.officialDomains,
    );
    if (urlError) errors.push(`${owner}: ${urlError}`);
    if (!isIsoDate(alias.firstObserved) || !isIsoDate(alias.lastObserved))
      errors.push(`${owner}: observation dates must be ISO dates`);
    else if (alias.lastObserved < alias.firstObserved)
      errors.push(`${owner}: last observation precedes first observation`);
    if (alias.normalizerVersion !== registry.normalizerVersion)
      errors.push(`${owner}: normalizer version mismatch`);
    if (alias.reviewState !== "approved")
      errors.push(`${owner}: v1 aliases must be approved`);
    if (alias.conflictStatus !== "clear")
      errors.push(`${owner}: v1 aliases must be conflict-free`);

    if (targetEntityType) {
      const collisionKey = `${targetEntityType}:${alias.comparisonKey}`;
      const candidateIds =
        aliasesByTypeAndKey.get(collisionKey) ?? new Set<string>();
      candidateIds.add(alias.targetId);
      aliasesByTypeAndKey.set(collisionKey, candidateIds);
    }
  }
  for (const [key, ids] of aliasesByTypeAndKey)
    if (ids.size > 1)
      errors.push(
        `${key}: same-type alias collision requires hold_alias_conflict`,
      );

  for (const { targetEntityType, entity } of entityRecords(registry)) {
    const canonicalAlias = registry.aliases.find(
      (alias) =>
        alias.targetEntityType === targetEntityType &&
        alias.targetId === entity.id &&
        alias.aliasKind === "official_label" &&
        alias.reviewState === "approved" &&
        alias.originalSourceText === entity.labels.ja,
    );
    if (!canonicalAlias)
      errors.push(
        `${targetEntityType}:${entity.id}: canonical label alias is missing`,
      );
  }

  return { valid: errors.length === 0, errors };
}

function uniqueCandidates(
  aliases: readonly RegistryAlias[],
): RegistryCandidate[] {
  const candidates = new Map<string, RegistryCandidate>();
  for (const alias of aliases) {
    const key = `${alias.targetEntityType}:${alias.targetId}`;
    candidates.set(key, {
      targetEntityType: alias.targetEntityType,
      targetId: alias.targetId,
    });
  }
  return [...candidates.values()].sort(
    (a, b) =>
      a.targetEntityType.localeCompare(b.targetEntityType) ||
      a.targetId.localeCompare(b.targetId),
  );
}

export function resolveRegistryAlias(
  input: string,
  targetEntityType?: RegistryTargetType,
  registry: RegistryManifest = INITIAL_REGISTRY,
): RegistryResolution {
  const comparisonKey = normalizeRegistryComparisonKey(input);
  const aliases = registry.aliases.filter(
    (alias) =>
      isRegistryTargetType(alias.targetEntityType) &&
      alias.reviewState === "approved" &&
      alias.comparisonKey === comparisonKey &&
      (!targetEntityType || alias.targetEntityType === targetEntityType),
  );
  if (aliases.length === 0) return { state: "no_match", comparisonKey };

  const candidates = uniqueCandidates(aliases);
  const sameTypeCandidates = new Map<RegistryTargetType, Set<string>>();
  for (const candidate of candidates) {
    const ids =
      sameTypeCandidates.get(candidate.targetEntityType) ?? new Set<string>();
    ids.add(candidate.targetId);
    sameTypeCandidates.set(candidate.targetEntityType, ids);
  }
  const hasConflict =
    aliases.some(
      ({ conflictStatus }) => conflictStatus === "hold_alias_conflict",
    ) || [...sameTypeCandidates.values()].some((ids) => ids.size > 1);
  if (hasConflict)
    return { state: "hold_alias_conflict", comparisonKey, candidates };

  if (candidates.length > 1)
    return { state: "ambiguous", comparisonKey, candidates };

  const [candidate] = candidates;
  return {
    state: "resolved",
    comparisonKey,
    targetEntityType: candidate!.targetEntityType,
    targetId: candidate!.targetId,
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>))
      deepFreeze(nested);
  }
  return value;
}

const loadedRegistry = rawRegistry as unknown as RegistryManifest;
const loadedValidation = validateRegistry(loadedRegistry);
if (!loadedValidation.valid)
  throw new Error(
    `Initial registry is invalid:\n${loadedValidation.errors.join("\n")}`,
  );

export const INITIAL_REGISTRY = deepFreeze(loadedRegistry);
export const INITIAL_REGISTRY_VALIDATION = deepFreeze(loadedValidation);
