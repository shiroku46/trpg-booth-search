export type Confidence = "high" | "medium" | "low" | "unresolved";
export type ReviewState =
  | "unreviewed"
  | "approved"
  | "rejected"
  | "needs_more_evidence";
export type Evidence = {
  pointer: string;
  method: "explicit_source" | "deterministic_rule" | "ai_candidate";
};
type Meta = {
  confidence: Confidence;
  reviewState: ReviewState;
  evidence: readonly Evidence[];
  contentVersion: string;
  checkedAt: string;
  conflictReason?: string;
};
export type EvidencedValue<T> =
  | ({ state: "known"; value: T } & Meta)
  | ({ state: "unknown" | "not_applicable" } & Meta)
  | ({ state: "hold"; holdReason: string } & Meta);
export type Classification =
  | "scenario_single"
  | "scenario_collection"
  | "mixed_scenario_and_material"
  | "material_only"
  | "hold_unknown";
export type ClassificationEnvelope = EvidencedValue<Classification> & {
  normalizerVersion: string;
  registryVersion: string;
};
export type NumericRange = { min: number; max: number };
export type PlayModality = "online" | "offline" | "hybrid";
export type TagCategory =
  | "genre"
  | "tone"
  | "setting"
  | "play_style"
  | "content_note";
export type RequirementKind = "required" | "optional";
export type CompatibilityState = "compatible" | "conversion_required";
export type PlayTimeRecord = NumericRange & { modality?: PlayModality };
export type ScenarioTagRecord = {
  category: TagCategory;
  label: EvidencedValue<string>;
};
export type BookRequirementRecord = {
  kind: RequirementKind;
  title: EvidencedValue<string>;
  compatibility?: EvidencedValue<CompatibilityState>;
};
export type Product = {
  id: string;
  canonicalUrl: string;
  title?: string;
  salesState?: "available" | "sold_out" | "sales_ended";
  allAges: EvidencedValue<"all_ages_confirmed">;
  classification?: ClassificationEnvelope;
};
export type Relationship = {
  system: EvidencedValue<string>;
  normalizedSystem?: EvidencedValue<string>;
  edition?: EvidencedValue<string>;
  aliases?: readonly EvidencedValue<string>[];
};
export type Scenario = {
  id: string;
  productId: string;
  title: EvidencedValue<string>;
  playerCount: EvidencedValue<string>;
  playerRange?: EvidencedValue<NumericRange>;
  playTime?: EvidencedValue<PlayTimeRecord>;
  tags?: readonly ScenarioTagRecord[];
  books?: readonly BookRequirementRecord[];
  publicationDate?: EvidencedValue<string>;
  discoveryScore?: EvidencedValue<number>;
  separationApproved: boolean;
  relationships: readonly Relationship[];
  hold?: boolean;
};
export type PublicRange =
  | { state: "known"; min: number; max: number }
  | { state: "unknown" };
export type PublicPlayTime =
  | ({ state: "known" } & PlayTimeRecord)
  | { state: "unknown" };
export type PublicSystem = {
  label: string;
  normalized: string;
  edition?: string;
  aliases: readonly string[];
};
export type PublicTag = { category: TagCategory; label: string };
export type PublicBook = {
  kind: RequirementKind;
  title: string;
  compatibility?: CompatibilityState | "unknown";
};
export type PublicScenario = {
  id: string;
  title: string;
  playerCount?: string;
  playerRange?: PublicRange;
  playTime?: PublicPlayTime;
  productUrl: string;
  productTitle: string;
  systems: readonly string[];
  systemDetails: readonly PublicSystem[];
  tags: readonly PublicTag[];
  books: readonly PublicBook[];
  publicationDate?: string;
  discoveryScore?: number;
  lastCheckedAt: string;
};
export type SortOrder =
  | "title"
  | "discovery"
  | "new"
  | "last_checked"
  | "seeded_random";
export type UnknownableNumber = number | "unknown";
export type SearchQuery = {
  valid: boolean;
  keyword: string;
  system?: string;
  edition?: string;
  playerCount?: UnknownableNumber;
  playTimeMinutes?: UnknownableNumber;
  modality?: PlayModality;
  tag?: { category: TagCategory; label: string };
  book?: string;
  requirementKind?: RequirementKind;
  compatibility?: CompatibilityState | "unknown";
  sort: SortOrder;
  seed: string;
};
export type PublicationDecision =
  | { publish: true; value: PublicScenario }
  | { publish: false; reason: string };
export interface FixtureRepository {
  products(): readonly Product[];
  scenarios(): readonly Scenario[];
}
export interface SeededRandom {
  order<T extends { id: string }>(values: readonly T[], seed: string): T[];
}
