export const REANALYSIS_VERSION_DIMENSIONS = [
  "content_version",
  "normalizer_version",
  "registry_version",
] as const;

export type ReanalysisVersionDimension =
  (typeof REANALYSIS_VERSION_DIMENSIONS)[number];

export const REANALYSIS_TRIGGERS = [
  "content_changed",
  "normalizer_version_changed",
  "registry_version_changed",
  "alias_approved",
  "canonical_entity_added",
  "manual_trigger",
] as const;

export type ReanalysisTrigger = (typeof REANALYSIS_TRIGGERS)[number];

export type ReanalysisVersionKey = {
  contentVersion: string;
  normalizerVersion: string;
  registryVersion: string;
};

export type ReanalysisPlan =
  | {
      state: "initial_analysis";
      next: ReanalysisVersionKey;
    }
  | {
      state: "skip";
      previous: ReanalysisVersionKey;
      next: ReanalysisVersionKey;
    }
  | {
      state: "reanalyze";
      previous: ReanalysisVersionKey;
      next: ReanalysisVersionKey;
      trigger: ReanalysisTrigger;
      changedDimensions: readonly ReanalysisVersionDimension[];
      reasonDetail: string;
    };

const VERSION_MAX_LENGTH = 256;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

export function assertReanalysisVersionKey(
  key: ReanalysisVersionKey,
): void {
  for (const [field, value] of Object.entries(key)) {
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      value.length > VERSION_MAX_LENGTH ||
      value.trim() !== value ||
      CONTROL_CHARACTERS.test(value)
    )
      throw new Error(`Invalid reanalysis version field: ${field}.`);
  }
}

export function sameReanalysisVersionKey(
  first: ReanalysisVersionKey,
  second: ReanalysisVersionKey,
): boolean {
  return (
    first.contentVersion === second.contentVersion &&
    first.normalizerVersion === second.normalizerVersion &&
    first.registryVersion === second.registryVersion
  );
}

function changedDimensions(
  previous: ReanalysisVersionKey,
  next: ReanalysisVersionKey,
): ReanalysisVersionDimension[] {
  const changed: ReanalysisVersionDimension[] = [];
  if (previous.contentVersion !== next.contentVersion)
    changed.push("content_version");
  if (previous.normalizerVersion !== next.normalizerVersion)
    changed.push("normalizer_version");
  if (previous.registryVersion !== next.registryVersion)
    changed.push("registry_version");
  return changed;
}

function automaticTrigger(
  changed: readonly ReanalysisVersionDimension[],
): ReanalysisTrigger {
  if (changed.includes("registry_version")) return "registry_version_changed";
  if (changed.includes("normalizer_version"))
    return "normalizer_version_changed";
  return "content_changed";
}

function validateRequestedTrigger(
  trigger: ReanalysisTrigger,
  changed: readonly ReanalysisVersionDimension[],
): void {
  if (!REANALYSIS_TRIGGERS.includes(trigger))
    throw new Error("Unsupported reanalysis trigger.");
  if (
    (trigger === "alias_approved" || trigger === "canonical_entity_added") &&
    !changed.includes("registry_version")
  )
    throw new Error(`${trigger} requires a registry-version change.`);
}

export function planReanalysis(
  previous: ReanalysisVersionKey | null,
  next: ReanalysisVersionKey,
  requestedTrigger?: ReanalysisTrigger,
): ReanalysisPlan {
  assertReanalysisVersionKey(next);
  if (previous === null) {
    if (requestedTrigger)
      throw new Error("An initial analysis cannot carry a reanalysis trigger.");
    return { state: "initial_analysis", next: structuredClone(next) };
  }

  assertReanalysisVersionKey(previous);
  const changed = changedDimensions(previous, next);
  if (requestedTrigger) validateRequestedTrigger(requestedTrigger, changed);

  if (changed.length === 0 && requestedTrigger !== "manual_trigger")
    return {
      state: "skip",
      previous: structuredClone(previous),
      next: structuredClone(next),
    };

  const trigger = requestedTrigger ?? automaticTrigger(changed);
  const changedLabel = changed.length > 0 ? changed.join(",") : "none";
  const requestedLabel = requestedTrigger ?? "automatic";
  return {
    state: "reanalyze",
    previous: structuredClone(previous),
    next: structuredClone(next),
    trigger,
    changedDimensions: Object.freeze([...changed]),
    reasonDetail: `changed=${changedLabel};trigger=${requestedLabel}`,
  };
}
