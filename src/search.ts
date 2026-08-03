import type {
  CompatibilityState,
  FixtureRepository,
  PlayModality,
  PublicScenario,
  RequirementKind,
  SearchQuery,
  SeededRandom,
  SortOrder,
  TagCategory,
  UnknownableNumber,
} from "./domain";
import { project } from "./publication";

const SORT_ORDERS = new Set<SortOrder>([
  "title",
  "discovery",
  "new",
  "last_checked",
  "seeded_random",
]);
const MODALITIES = new Set<PlayModality>(["online", "offline", "hybrid"]);
const TAG_CATEGORIES = new Set<TagCategory>([
  "genre",
  "tone",
  "setting",
  "play_style",
  "content_note",
]);
const REQUIREMENT_KINDS = new Set<RequirementKind>(["required", "optional"]);
const COMPATIBILITY_STATES = new Set<CompatibilityState | "unknown">([
  "compatible",
  "conversion_required",
  "unknown",
]);

type RawParams = Record<string, string | string[] | undefined>;

function single(
  params: RawParams,
  key: string,
): { valid: boolean; value: string | undefined } {
  const value = params[key];
  if (Array.isArray(value)) return { valid: false, value: undefined };
  return { valid: true, value };
}

function normalized(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ja");
}

function parseUnknownableNumber(
  value: string | undefined,
): { valid: boolean; value?: UnknownableNumber } {
  if (!value) return { valid: true };
  if (value === "unknown") return { valid: true, value: "unknown" };
  if (!/^\d+$/.test(value)) return { valid: false };
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0
    ? { valid: true, value: number }
    : { valid: false };
}

export function defaultSearchQuery(): SearchQuery {
  return {
    valid: true,
    keyword: "",
    sort: "title",
    seed: "demo",
  };
}

export function parseSearchQuery(params: RawParams): SearchQuery {
  let valid = true;
  const read = (key: string): string | undefined => {
    const result = single(params, key);
    valid &&= result.valid;
    return result.value;
  };

  const keyword = read("q")?.trim() ?? "";
  const system = read("system")?.trim() || undefined;
  const edition = read("edition")?.trim() || undefined;
  const playerCount = parseUnknownableNumber(read("players"));
  const playTimeMinutes = parseUnknownableNumber(read("minutes"));
  valid &&= playerCount.valid && playTimeMinutes.valid;

  const rawModality = read("modality")?.trim();
  const modality = rawModality
    ? MODALITIES.has(rawModality as PlayModality)
      ? (rawModality as PlayModality)
      : undefined
    : undefined;
  if (rawModality && !modality) valid = false;

  const rawTag = read("tag")?.trim();
  let tag: SearchQuery["tag"];
  if (rawTag) {
    const separator = rawTag.indexOf(":");
    const rawCategory = separator >= 0 ? rawTag.slice(0, separator) : "";
    const label = separator >= 0 ? rawTag.slice(separator + 1).trim() : "";
    if (TAG_CATEGORIES.has(rawCategory as TagCategory) && label) {
      tag = { category: rawCategory as TagCategory, label };
    } else {
      valid = false;
    }
  }

  const book = read("book")?.trim() || undefined;
  const rawRequirementKind = read("requirement")?.trim();
  const requirementKind = rawRequirementKind
    ? REQUIREMENT_KINDS.has(rawRequirementKind as RequirementKind)
      ? (rawRequirementKind as RequirementKind)
      : undefined
    : undefined;
  if (rawRequirementKind && !requirementKind) valid = false;

  const rawCompatibility = read("compatibility")?.trim();
  const compatibility = rawCompatibility
    ? COMPATIBILITY_STATES.has(
        rawCompatibility as CompatibilityState | "unknown",
      )
      ? (rawCompatibility as CompatibilityState | "unknown")
      : undefined
    : undefined;
  if (rawCompatibility && !compatibility) valid = false;

  const rawSort = read("sort")?.trim() || "title";
  const sort = SORT_ORDERS.has(rawSort as SortOrder)
    ? (rawSort as SortOrder)
    : "title";
  if (!SORT_ORDERS.has(rawSort as SortOrder)) valid = false;

  const seed = read("seed")?.trim() || "demo";
  if (seed.length > 80) valid = false;

  return {
    valid,
    keyword,
    ...(system ? { system } : {}),
    ...(edition ? { edition } : {}),
    ...(playerCount.value !== undefined
      ? { playerCount: playerCount.value }
      : {}),
    ...(playTimeMinutes.value !== undefined
      ? { playTimeMinutes: playTimeMinutes.value }
      : {}),
    ...(modality ? { modality } : {}),
    ...(tag ? { tag } : {}),
    ...(book ? { book } : {}),
    ...(requirementKind ? { requirementKind } : {}),
    ...(compatibility ? { compatibility } : {}),
    sort,
    seed,
  };
}

export class HashSeededRandom implements SeededRandom {
  order<T extends { id: string }>(values: readonly T[], seed: string): T[] {
    const hash = (input: string) => {
      let value = 2166136261;
      for (const character of input) {
        value = Math.imul(value ^ character.charCodeAt(0), 16777619);
      }
      return value >>> 0;
    };
    return [...values].sort(
      (left, right) =>
        hash(`${seed}:${left.id}`) - hash(`${seed}:${right.id}`) ||
        left.id.localeCompare(right.id),
    );
  }
}

function matchesKeyword(row: PublicScenario, keyword: string): boolean {
  if (!keyword) return true;
  const needle = normalized(keyword);
  return [
    row.title,
    ...row.systemDetails.flatMap((system) => [
      system.label,
      system.normalized,
      system.edition ?? "",
      ...system.aliases,
    ]),
  ].some((value) => normalized(value).includes(needle));
}

function matchesUnknownableRange(
  range: PublicScenario["playerRange"] | PublicScenario["playTime"],
  value: UnknownableNumber | undefined,
): boolean {
  if (value === undefined) return true;
  if (value === "unknown") return range?.state === "unknown";
  return range?.state === "known" && range.min <= value && value <= range.max;
}

function matchesBooks(row: PublicScenario, query: SearchQuery): boolean {
  if (!query.book && !query.requirementKind && !query.compatibility) return true;
  return row.books.some(
    (book) =>
      (!query.book || normalized(book.title) === normalized(query.book)) &&
      (!query.requirementKind || book.kind === query.requirementKind) &&
      (!query.compatibility || book.compatibility === query.compatibility),
  );
}

function titleOrder(left: PublicScenario, right: PublicScenario): number {
  return (
    left.title.localeCompare(right.title, "ja") || left.id.localeCompare(right.id)
  );
}

function timestamp(value: string | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function sortRows(rows: PublicScenario[], query: SearchQuery): PublicScenario[] {
  if (query.sort === "seeded_random") {
    return new HashSeededRandom().order(rows, query.seed);
  }
  return [...rows].sort((left, right) => {
    if (query.sort === "discovery") {
      const score =
        (right.discoveryScore ?? Number.NEGATIVE_INFINITY) -
        (left.discoveryScore ?? Number.NEGATIVE_INFINITY);
      return score || titleOrder(left, right);
    }
    if (query.sort === "new") {
      return (
        timestamp(right.publicationDate) - timestamp(left.publicationDate) ||
        titleOrder(left, right)
      );
    }
    if (query.sort === "last_checked") {
      return (
        timestamp(right.lastCheckedAt) - timestamp(left.lastCheckedAt) ||
        titleOrder(left, right)
      );
    }
    return titleOrder(left, right);
  });
}

export function search(
  repo: FixtureRepository,
  query: SearchQuery = defaultSearchQuery(),
): PublicScenario[] {
  if (!query.valid) return [];
  const products = new Map(
    repo.products().map((product) => [product.id, product]),
  );
  const rows = repo
    .scenarios()
    .map((scenario) => project(products.get(scenario.productId), scenario))
    .filter(
      (decision): decision is Extract<typeof decision, { publish: true }> =>
        decision.publish,
    )
    .map((decision) => decision.value)
    .filter((row) => matchesKeyword(row, query.keyword))
    .filter(
      (row) =>
        !query.system ||
        row.systemDetails.some((system) =>
          [system.label, system.normalized, ...system.aliases].some(
            (value) => normalized(value) === normalized(query.system!),
          ),
        ),
    )
    .filter(
      (row) =>
        !query.edition ||
        row.systemDetails.some(
          (system) =>
            system.edition &&
            normalized(system.edition) === normalized(query.edition!),
        ),
    )
    .filter((row) => matchesUnknownableRange(row.playerRange, query.playerCount))
    .filter((row) =>
      matchesUnknownableRange(row.playTime, query.playTimeMinutes),
    )
    .filter(
      (row) =>
        !query.modality ||
        (row.playTime?.state === "known" &&
          row.playTime.modality === query.modality),
    )
    .filter(
      (row) =>
        !query.tag ||
        row.tags.some(
          (tag) =>
            tag.category === query.tag!.category &&
            normalized(tag.label) === normalized(query.tag!.label),
        ),
    )
    .filter((row) => matchesBooks(row, query));
  return sortRows(rows, query);
}
