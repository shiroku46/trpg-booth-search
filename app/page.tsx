import Link from "next/link";
import { fixtureRepository } from "../fixtures";
import {
  TAG_CATEGORIES,
  type PlayerCountRange,
  type PlayTimeRange,
  type PublicFacet,
} from "../src/domain";
import {
  BOOK_OPTIONS,
  COMPATIBILITY_OPTIONS,
  EDITION_OPTIONS,
  EMPTY_QUERY,
  MODALITY_OPTIONS,
  PLAYER_COUNT_OPTIONS,
  PLAY_TIME_FILTERS,
  search,
  SORT_ORDERS,
  SYSTEM_OPTIONS,
  TAG_OPTIONS,
  type CanonicalSearchQuery,
  type PlayTimeFilter,
  type SortOrder,
} from "../src/search";

type Params = Promise<Record<string, string | string[] | undefined>>;
type RawParams = Awaited<Params>;

const parameterNames = new Set([
  "q",
  "system",
  "edition",
  "players",
  "playTime",
  "modality",
  "tagGenre",
  "tagTone",
  "tagSetting",
  "tagStructure",
  "tagContent",
  "book",
  "compatibility",
  "sort",
  "seed",
]);

const tagParameter = {
  genre: "tagGenre",
  tone: "tagTone",
  setting: "tagSetting",
  structure: "tagStructure",
  content: "tagContent",
} as const;

const includes = (values: readonly string[], value: string) =>
  value === "" || values.includes(value);

function scalar(
  params: RawParams,
  key: string,
): { value: string; invalid: boolean } {
  const value = params[key];
  if (value === undefined) return { value: "", invalid: false };
  return typeof value === "string"
    ? { value, invalid: false }
    : { value: "", invalid: true };
}

export function parseSearchParams(params: RawParams): {
  query: CanonicalSearchQuery;
  invalid: boolean;
} {
  let invalid = Object.keys(params).some((key) => !parameterNames.has(key));
  const read = (key: string) => {
    const result = scalar(params, key);
    invalid ||= result.invalid;
    return result.value;
  };

  const keyword = read("q").trim();
  const system = read("system");
  const edition = read("edition");
  const playerCount = read("players");
  const playTime = read("playTime");
  const modality = read("modality");
  const book = read("book");
  const compatibility = read("compatibility");
  const sort = read("sort") || EMPTY_QUERY.sort;
  const seed = read("seed") || EMPTY_QUERY.seed;
  const tagValues = {
    genre: read(tagParameter.genre),
    tone: read(tagParameter.tone),
    setting: read(tagParameter.setting),
    structure: read(tagParameter.structure),
    content: read(tagParameter.content),
  };

  invalid ||=
    keyword.length > 100 ||
    /[\u0000-\u001f\u007f]/u.test(keyword) ||
    !includes(SYSTEM_OPTIONS, system) ||
    !includes(EDITION_OPTIONS, edition) ||
    !includes(PLAYER_COUNT_OPTIONS, playerCount) ||
    !includes(PLAY_TIME_FILTERS, playTime) ||
    !includes(MODALITY_OPTIONS, modality) ||
    !includes(BOOK_OPTIONS, book) ||
    !includes(COMPATIBILITY_OPTIONS, compatibility) ||
    !SORT_ORDERS.includes(sort as SortOrder) ||
    !/^[\p{L}\p{N}_-]{1,64}$/u.test(seed) ||
    TAG_CATEGORIES.some(
      (category) => !includes(TAG_OPTIONS[category], tagValues[category]),
    );

  return {
    invalid,
    query: {
      keyword,
      system,
      edition,
      playerCount,
      playTime: playTime as PlayTimeFilter,
      modality,
      tags: tagValues,
      book,
      compatibility,
      sort: sort as SortOrder,
      seed,
    },
  };
}

const optionLabel = (value: string) => {
  const labels: Record<string, string> = {
    unknown: "明示的な不明",
    "1": "1人",
    "2": "2人",
    "3": "3人",
    "4": "4人",
    "5": "5人",
    online: "オンライン",
    offline: "オフライン",
    either: "どちらでも可",
    short: "短時間（120分以下）",
    medium: "中時間（121〜240分）",
    long: "長時間（241分以上）",
    title: "タイトル",
    discovery: "発見用（親商品・タイトル順）",
    new: "新着順",
    "last-checked": "最終確認順",
    random: "シード付きランダム",
  };
  return labels[value] ?? value;
};

const facetText = <T,>(facet: PublicFacet<T>, format: (value: T) => string) => {
  if (facet.state === "known") return format(facet.value);
  return facet.state === "unknown" ? "明示的な不明" : "公開対象外";
};

const playerCountText = (value: PlayerCountRange) =>
  value.minimumPlayers === value.maximumPlayers
    ? `${value.minimumPlayers}人`
    : `${value.minimumPlayers}〜${value.maximumPlayers}人`;

const playTimeText = (value: PlayTimeRange) =>
  value.minimumMinutes === value.maximumMinutes
    ? `${value.minimumMinutes}分`
    : `${value.minimumMinutes}〜${value.maximumMinutes}分`;

function activeFilters(query: CanonicalSearchQuery): string[] {
  const values = [
    query.keyword && `キーワード: ${query.keyword}`,
    query.system && `システム: ${optionLabel(query.system)}`,
    query.edition && `版: ${optionLabel(query.edition)}`,
    query.playerCount && `人数: ${optionLabel(query.playerCount)}`,
    query.playTime && `プレイ時間: ${optionLabel(query.playTime)}`,
    query.modality && `形式: ${optionLabel(query.modality)}`,
    query.book && `書籍: ${optionLabel(query.book)}`,
    query.compatibility && `互換性: ${optionLabel(query.compatibility)}`,
    query.sort !== EMPTY_QUERY.sort && `並び順: ${optionLabel(query.sort)}`,
    query.sort === "random" && `シード: ${query.seed}`,
    ...TAG_CATEGORIES.map((category) =>
      query.tags[category]
        ? `${category}: ${optionLabel(query.tags[category])}`
        : "",
    ),
  ];
  return values.filter((value): value is string => Boolean(value));
}

export default async function Page({ searchParams }: { searchParams: Params }) {
  const parsed = parseSearchParams(await searchParams);
  const rows = parsed.invalid ? [] : search(fixtureRepository, parsed.query);
  const active = activeFilters(parsed.query);

  return (
    <main>
      <header>
        <p className="eyebrow">FIXTURE-ONLY PREVIEW</p>
        <h1>TRPGシナリオ検索</h1>
        <p>
          これは合成した全年齢フィクスチャのみの固定デモです。BOOTHの実データや網羅性、公開準備完了を示すものではありません。
        </p>
      </header>
      {parsed.invalid ? (
        <p role="alert">
          無効な検索条件を検出したため、安全のため結果を表示していません。
        </p>
      ) : null}
      <form role="search">
        <label>
          キーワード
          <input name="q" defaultValue={parsed.query.keyword} maxLength={100} />
        </label>
        <label>
          システム
          <select name="system" defaultValue={parsed.query.system}>
            <option value="">すべて</option>
            {SYSTEM_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {optionLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          版
          <select name="edition" defaultValue={parsed.query.edition}>
            <option value="">すべて</option>
            {EDITION_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {optionLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          プレイヤー人数
          <select name="players" defaultValue={parsed.query.playerCount}>
            <option value="">すべて</option>
            {PLAYER_COUNT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {optionLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          プレイ時間
          <select name="playTime" defaultValue={parsed.query.playTime}>
            <option value="">すべて</option>
            {PLAY_TIME_FILTERS.map((value) => (
              <option key={value} value={value}>
                {optionLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          プレイ形式
          <select name="modality" defaultValue={parsed.query.modality}>
            <option value="">すべて</option>
            {MODALITY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {optionLabel(value)}
              </option>
            ))}
          </select>
        </label>
        {TAG_CATEGORIES.map((category) => (
          <label key={category}>
            タグ（{category}）
            <select
              name={tagParameter[category]}
              defaultValue={parsed.query.tags[category]}
            >
              <option value="">すべて</option>
              {TAG_OPTIONS[category].map((value) => (
                <option key={value} value={value}>
                  {optionLabel(value)}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          書籍
          <select name="book" defaultValue={parsed.query.book}>
            <option value="">すべて</option>
            {BOOK_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {optionLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          互換性
          <select
            name="compatibility"
            defaultValue={parsed.query.compatibility}
          >
            <option value="">すべて</option>
            {COMPATIBILITY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {optionLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          並び順
          <select name="sort" defaultValue={parsed.query.sort}>
            {SORT_ORDERS.map((value) => (
              <option key={value} value={value}>
                {optionLabel(value)}
              </option>
            ))}
          </select>
        </label>
        {parsed.query.sort === "random" ? (
          <label>
            ランダムシード
            <input
              name="seed"
              defaultValue={parsed.query.seed}
              maxLength={64}
            />
          </label>
        ) : null}
        <button>検索</button>
      </form>
      {active.length > 0 ? (
        <aside aria-label="適用中の条件">
          <h2>適用中の条件</h2>
          <ul>
            {active.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
          <Link href="/">条件をリセット</Link>
        </aside>
      ) : null}
      <section aria-live="polite" aria-atomic="true">
        <h2>検索結果（{rows.length}件）</h2>
        {rows.length === 0 ? (
          <p className="empty">
            条件に一致する合成シナリオはありません。条件を減らして再検索してください。
          </p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li key={row.id}>
                <h3>{row.title}</h3>
                <p>
                  人数: {facetText(row.playerCount, playerCountText)}／版:{" "}
                  {facetText(row.edition, (value) => value)}
                </p>
                <p>
                  プレイ時間: {facetText(row.playTimeMinutes, playTimeText)}
                  ／形式: {facetText(row.modality, optionLabel)}
                </p>
                <p>
                  システム:{" "}
                  {facetText(row.systems, (values) => values.join("、"))}
                </p>
                <a href={row.productUrl}>親商品「{row.productTitle}」を見る</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
