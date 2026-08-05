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
import { PixelIcon } from "./ui/pixel-icons";
import {
  ArchiveDecoration,
  EmptyState,
  IconLabel,
  Panel,
  PixelDivider,
  ProjectBadge,
  StatusChip,
  WindowTitleBar,
} from "./ui/primitives";

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

const tagCategoryLabel = {
  genre: "ジャンル",
  tone: "雰囲気",
  setting: "舞台",
  structure: "構成",
  content: "内容",
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
        ? `${tagCategoryLabel[category]}: ${optionLabel(query.tags[category])}`
        : "",
    ),
  ];
  return values.filter((value): value is string => Boolean(value));
}

export default async function Page({ searchParams }: { searchParams: Params }) {
  const parsed = parseSearchParams(await searchParams);
  const rows = parsed.invalid ? [] : search(fixtureRepository, parsed.query);
  const active = activeFilters(parsed.query);
  const searchTitleId = "search-panel-title";
  const activeTitleId = "active-filter-title";

  return (
    <main className="site-frame">
      <a className="skip-link" href="#search-results">
        検索結果へ移動
      </a>

      <div className="archive-window">
        <WindowTitleBar title="TRPG ARCHIVE // FIXTURE INDEX" />

        <div className="archive-window__body">
          <header className="site-header">
            <div className="site-header__copy">
              <div className="site-header__title-row">
                <PixelIcon name="archive" size={32} />
                <h1 id="page-title">TRPGシナリオ検索</h1>
              </div>
              <p>
                条件を組み合わせて、遊びたいシナリオ記録を探すための検索アーカイブです。
                現在は合成した全年齢フィクスチャだけを表示しています。
              </p>
            </div>
            <ArchiveDecoration />
          </header>

          <div className="fixture-notice" role="note">
            <PixelIcon name="info" size={24} />
            <div>
              <strong>固定デモの公開境界</strong>
              <p>
                BOOTHの実データ、網羅性、公開準備完了を示すものではありません。
                購入・支払い・ダウンロードはこの画面では扱いません。
              </p>
            </div>
          </div>

          {parsed.invalid ? (
            <div className="alert" role="alert">
              <PixelIcon name="warning" size={24} />
              <p>
                無効な検索条件を検出したため、安全のため結果を表示していません。
              </p>
            </div>
          ) : null}

          <Panel
            className="search-panel"
            headingId={searchTitleId}
            icon="filter"
            title="検索条件"
          >
            <form className="search-form" role="search">
              <fieldset className="field-group field-group--primary">
                <legend>
                  <IconLabel icon="search">基本条件</IconLabel>
                </legend>
                <div className="field-grid field-grid--primary">
                  <label className="field field--wide">
                    <span>キーワード</span>
                    <input
                      defaultValue={parsed.query.keyword}
                      maxLength={100}
                      name="q"
                      placeholder="タイトルやキーワード"
                    />
                  </label>
                  <label className="field">
                    <span>システム</span>
                    <select name="system" defaultValue={parsed.query.system}>
                      <option value="">すべて</option>
                      {SYSTEM_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {optionLabel(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>版</span>
                    <select name="edition" defaultValue={parsed.query.edition}>
                      <option value="">すべて</option>
                      {EDITION_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {optionLabel(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>プレイヤー人数</span>
                    <select
                      name="players"
                      defaultValue={parsed.query.playerCount}
                    >
                      <option value="">すべて</option>
                      {PLAYER_COUNT_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {optionLabel(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>プレイ時間</span>
                    <select
                      name="playTime"
                      defaultValue={parsed.query.playTime}
                    >
                      <option value="">すべて</option>
                      {PLAY_TIME_FILTERS.map((value) => (
                        <option key={value} value={value}>
                          {optionLabel(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>プレイ形式</span>
                    <select
                      name="modality"
                      defaultValue={parsed.query.modality}
                    >
                      <option value="">すべて</option>
                      {MODALITY_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {optionLabel(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>

              <fieldset className="field-group">
                <legend>
                  <IconLabel icon="tag">タグ条件</IconLabel>
                </legend>
                <div className="field-grid">
                  {TAG_CATEGORIES.map((category) => (
                    <label className="field" key={category}>
                      <span>{tagCategoryLabel[category]}</span>
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
                </div>
              </fieldset>

              <fieldset className="field-group">
                <legend>
                  <IconLabel icon="book">詳細条件と並び順</IconLabel>
                </legend>
                <div className="field-grid">
                  <label className="field">
                    <span>書籍</span>
                    <select name="book" defaultValue={parsed.query.book}>
                      <option value="">すべて</option>
                      {BOOK_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {optionLabel(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>互換性</span>
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
                  <label className="field">
                    <span>並び順</span>
                    <select name="sort" defaultValue={parsed.query.sort}>
                      {SORT_ORDERS.map((value) => (
                        <option key={value} value={value}>
                          {optionLabel(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {parsed.query.sort === "random" ? (
                    <label className="field">
                      <span>ランダムシード</span>
                      <input
                        defaultValue={parsed.query.seed}
                        maxLength={64}
                        name="seed"
                      />
                    </label>
                  ) : null}
                </div>
              </fieldset>

              <div className="form-actions">
                <button className="pixel-button" type="submit">
                  <PixelIcon name="search" size={20} />
                  <span>この条件で検索</span>
                </button>
                {active.length > 0 ? (
                  <Link className="reset-link" href="/">
                    <PixelIcon name="reset" size={20} />
                    <span>条件をリセット</span>
                  </Link>
                ) : null}
              </div>
            </form>
          </Panel>

          {active.length > 0 ? (
            <Panel
              className="active-filter-panel"
              headingId={activeTitleId}
              icon="filter"
              title="適用中の条件"
            >
              <ul className="active-filter-list">
                {active.map((value) => (
                  <li key={value}>{value}</li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <section
            aria-labelledby="result-heading"
            className="results-panel"
            id="search-results"
          >
            <div className="results-panel__header">
              <div>
                <p className="section-code">SEARCH OUTPUT</p>
                <h2 id="result-heading">検索結果（{rows.length}件）</h2>
              </div>
              <div className="sort-indicator">
                <PixelIcon
                  name={parsed.query.sort === "random" ? "random" : "sort"}
                  size={20}
                />
                <span>{optionLabel(parsed.query.sort)}</span>
              </div>
            </div>

            <div
              aria-label="公開境界"
              className="publication-boundary"
              role="note"
            >
              <strong>公開境界</strong>
              <div className="status-chip-list">
                <StatusChip icon="check" tone="confirmed">
                  確認済みを表示
                </StatusChip>
                <StatusChip icon="unknown" tone="unknown">
                  明示的不明は表示可能
                </StatusChip>
                <StatusChip icon="warning" tone="held">
                  保留は非表示
                </StatusChip>
                <StatusChip icon="warning" tone="ended">
                  販売終了は非表示
                </StatusChip>
              </div>
            </div>

            <div aria-atomic="true" aria-live="polite" className="result-count">
              条件に一致した公開可能な合成記録は {rows.length} 件です。
            </div>

            {rows.length === 0 ? (
              <EmptyState title="一致する記録がありません">
                条件に一致する合成シナリオはありません。条件を減らして再検索してください。
              </EmptyState>
            ) : (
              <ol className="result-list">
                {rows.map((row, index) => (
                  <li className="result-card" key={row.id}>
                    <article aria-labelledby={`scenario-${row.id}`}>
                      <header className="result-card__header">
                        <span aria-hidden="true" className="record-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <PixelIcon name="document" size={24} />
                        <div>
                          <p className="result-card__type">SCENARIO RECORD</p>
                          <h3 id={`scenario-${row.id}`}>{row.title}</h3>
                        </div>
                      </header>

                      <PixelDivider />

                      <dl className="result-facts">
                        <div>
                          <dt>
                            <IconLabel icon="people">人数</IconLabel>
                          </dt>
                          <dd>{facetText(row.playerCount, playerCountText)}</dd>
                        </div>
                        <div>
                          <dt>
                            <IconLabel icon="clock">プレイ時間</IconLabel>
                          </dt>
                          <dd>
                            {facetText(row.playTimeMinutes, playTimeText)}
                          </dd>
                        </div>
                        <div>
                          <dt>
                            <IconLabel icon="book">版</IconLabel>
                          </dt>
                          <dd>{facetText(row.edition, (value) => value)}</dd>
                        </div>
                        <div>
                          <dt>
                            <IconLabel icon="computer">形式</IconLabel>
                          </dt>
                          <dd>{facetText(row.modality, optionLabel)}</dd>
                        </div>
                        <div className="result-facts__wide">
                          <dt>
                            <IconLabel icon="archive">システム</IconLabel>
                          </dt>
                          <dd>
                            {facetText(row.systems, (values) =>
                              values.join("、"),
                            )}
                          </dd>
                        </div>
                      </dl>

                      <a className="product-link" href={row.productUrl} rel="external">
                        <span>親商品「{row.productTitle}」を見る</span>
                        <PixelIcon name="external" size={20} />
                      </a>
                    </article>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <footer className="window-statusbar">
            <div className="window-statusbar__items">
              <span>
                <PixelIcon name="archive" size={16} />
                {rows.length} RECORDS
              </span>
              <span>
                <PixelIcon name="sort" size={16} />
                {optionLabel(parsed.query.sort)}
              </span>
              <span>
                <PixelIcon name="info" size={16} />
                SYNTHETIC FIXTURE / READ ONLY
              </span>
            </div>
            <ProjectBadge />
          </footer>
        </div>
      </div>
    </main>
  );
}
