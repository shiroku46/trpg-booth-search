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
export type Product = {
  id: string;
  canonicalUrl: string;
  title?: string;
  salesState?: "available" | "sold_out" | "sales_ended";
  firstSeenAt: string;
  allAges: EvidencedValue<"all_ages_confirmed">;
  classification?: ClassificationEnvelope;
};
export type Relationship = {
  system: EvidencedValue<string>;
  aliases: EvidencedValue<readonly string[]>;
};
export const TAG_CATEGORIES = [
  "genre",
  "tone",
  "setting",
  "structure",
  "content",
] as const;
export type TagCategory = (typeof TAG_CATEGORIES)[number];
export type Modality = "online" | "offline" | "either";
export type PlayerCountRange = {
  minimumPlayers: number;
  maximumPlayers: number;
};
export type PlayTimeRange = {
  minimumMinutes: number;
  maximumMinutes: number;
};
export type BookRequirement = {
  title: string;
  kind: "required" | "optional";
};
export type ScenarioTags = Record<
  TagCategory,
  EvidencedValue<readonly string[]>
>;
export type Scenario = {
  id: string;
  productId: string;
  title: EvidencedValue<string>;
  playerCount: EvidencedValue<PlayerCountRange>;
  edition: EvidencedValue<string>;
  playTimeMinutes: EvidencedValue<PlayTimeRange>;
  modality: EvidencedValue<Modality>;
  tags: ScenarioTags;
  requiredBooks: EvidencedValue<readonly BookRequirement[]>;
  compatibility: EvidencedValue<readonly string[]>;
  publishedAt: EvidencedValue<string>;
  lastCheckedAt: EvidencedValue<string>;
  separationApproved: boolean;
  relationships: readonly Relationship[];
  hold?: boolean;
};
export type PublicFacet<T> =
  | { state: "known"; value: T }
  | { state: "unknown" }
  | { state: "omitted" };
export type PublicScenario = {
  id: string;
  title: string;
  playerCount: PublicFacet<PlayerCountRange>;
  edition: PublicFacet<string>;
  playTimeMinutes: PublicFacet<PlayTimeRange>;
  modality: PublicFacet<Modality>;
  tags: Record<TagCategory, PublicFacet<readonly string[]>>;
  requiredBooks: PublicFacet<readonly BookRequirement[]>;
  compatibility: PublicFacet<readonly string[]>;
  publishedAt: string;
  lastCheckedAt: string;
  productUrl: string;
  productTitle: string;
  systems: PublicFacet<readonly string[]>;
  systemAliases: readonly string[];
  hasExplicitUnknownSystem: boolean;
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
