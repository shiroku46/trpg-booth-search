import Link from "next/link";
import type { ReactNode } from "react";

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

type RetroTone = "pink" | "mint" | "lavender" | "blue" | "yellow";

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

function RetroBox({
  headingId,
  title,
  tone = "pink",
  className,
  children,
}: {
  headingId: string;
  title: string;
  tone?: RetroTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className={["retro-box", `retro-box--${tone}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="retro-box__titlebar">
        <span aria-hidden="true">★</span>
        <h2 id={headingId}>{title}</h2>
        <span aria-hidden="true">★</span>
      </div>
      <div className="retro-box__body">{children}</div>
    </section>
  );
}

function RetroMascot({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={["retro-mascot", mirrored && "retro-mascot--mirrored"]
        .filter(Boolean)
        .join(" ")}
      focusable="false"
      shapeRendering="crispEdges"
      viewBox="0 0 72 72"
    >
      <g className="retro-mascot__tail">
        <rect fill="#7d62a8" height="8" width="24" x="42" y="46" />
        <rect fill="#7d62a8" height="16" width="8" x="58" y="38" />
        <rect fill="#f7cce8" height="8" width="8" x="50" y="46" />
      </g>
      <rect fill="#7d62a8" height="40" width="40" x="16" y="22" />
      <rect fill="#ffffff" height="32" width="32" x="20" y="26" />
      <rect fill="#7d62a8" height="12" width="12" x="16" y="14" />
      <rect fill="#7d62a8" height="12" width="12" x="44" y="14" />
      <rect fill="#f7cce8" height="6" width="6" x="20" y="18" />
      <rect fill="#f7cce8" height="6" width="6" x="46" y="18" />
      <g className="retro-mascot__eyes">
        <rect fill="#24313c" height="5" width="5" x="27" y="35" />
        <rect fill="#24313c" height="5" width="5" x="40" y="35" />
      </g>
      <rect fill="#e57aa9" height="4" width="4" x="34" y="43" />
      <rect fill="#7d62a8" height="4" width="8" x="30" y="49" />
      <rect fill="#7d62a8" height="4" width="8" x="38" y="49" />
      <rect fill="#7d62a8" height="8" width="12" x="18" y="60" />
      <rect fill="#7d62a8" height="8" width="12" x="42" y="60" />
    </svg>
  );
}

function RetroButterfly({ tone }: { tone: "pink" | "blue" }) {
  return (
    <span
      aria-hidden="true"
      className={`retro-butterfly retro-butterfly--${tone}`}
    >
      <span />
      <span />
      <i />
    </span>
  );
}

function RetroCounter({ count }: { count: number }) {
  const value = String(count).padStart(6, "0");
  return (
    <div className="retro-counter" role="group" aria-label="現在の表示件数">
      <span className="retro-counter__label">SCENARIO COUNT</span>
      <span className="retro-counter__digits" aria-label={`${count}件`}>
        {value}
      </span>
      <span className="retro-counter__caption">この条件で表示中です</span>
    </div>
  );
}

function MiniBanner({
  href,
  children,
  tone,
}: {
  href: string;
  children: ReactNode;
  tone: RetroTone;
}) {
  return (
    <a className={`mini-banner mini-banner--${tone}`} href={href}>
      <span aria-hidden="true">◆</span>
      <strong>{children}</strong>
    </a>
  );
}

export default async function Page({ searchParams }: { searchParams: Params }) {
  const parsed = parseSearchParams(await searchParams);
  const rows = parsed.invalid ? [] : search(fixtureRepository, parsed.query);
  const active = activeFilters(parsed.query);
  const indexRows = rows.slice(0, 5);
  const searchTitleId = "search-panel-title";
  const activeTitleId = "active-filter-title";

  return (
    <main className="site-frame" id="top">
      <a className="skip-link" href="#search-results">
        検索結果へ移動
      </a>

      <div className="archive-window">
        <WindowTitleBar title="TRPG ARCHIVE // FIXTURE INDEX" />

        <header className="site-header">
          <RetroMascot />
          <div className="site-header__copy">
            <div className="site-header__ornaments" aria-hidden="true">
              <RetroButterfly tone="pink" />
              <span>＊</span>
              <span>・</span>
              <span>＊</span>
              <RetroButterfly tone="blue" />
            </div>
            <h1 id="page-title">TRPGシナリオ検索</h1>
            <p>
              いろいろな条件を組み合わせて、遊びたいシナリオ記録を探すための
              個人ホームページ風アーカイブです。
            </p>
          </div>
          <RetroMascot mirrored />
        </header>

        <nav aria-label="サイト内メニュー" className="retro-nav">
          <a href="#top">TOP</a>
          <a href={`#${searchTitleId}`}>シナリオ検索</a>
          <a href="#search-results">検索結果</a>
          <a href="#site-guide">使い方</a>
          <a href="#publication-guide">公開境界</a>
        </nav>

        <div className="archive-window__body homepage-grid">
          <aside aria-label="更新情報とサイト案内" className="homepage-rail">
            <RetroBox
              className="whats-new"
              headingId="whats-new-title"
              title="What's New"
              tone="lavender"
            >
              <ul className="update-list">
                <li>
                  <time dateTime="2026-08-06">08/06</time>
                  <span>デザインBを試作</span>
                </li>
                <li>
                  <time dateTime="2026-08-06">08/06</time>
                  <span>検索機能を再確認</span>
                </li>
                <li>
                  <time dateTime="2026-08-05">08/05</time>
                  <span>初回レトロ案を公開</span>
                </li>
              </ul>
            </RetroBox>

            <RetroCounter count={rows.length} />

            <section
              aria-labelledby="site-guide"
              className="fixture-notice retro-box retro-box--blue"
              role="note"
            >
              <div className="retro-box__titlebar">
                <span aria-hidden="true">★</span>
                <h2 id="site-guide">このサイトについて</h2>
                <span aria-hidden="true">★</span>
              </div>
              <div className="retro-box__body">
                <p>
                  BOOTHの実データ、網羅性、公開準備完了を示すものではありません。
                  購入・支払い・ダウンロードはこの画面では扱いません。
                </p>
                <p>現在は合成した全年齢フィクスチャだけを表示しています。</p>
              </div>
            </section>

            <div aria-label="サイト内リンクバナー" className="mini-banner-list">
              <MiniBanner href={`#${searchTitleId}`} tone="mint">
                条件検索はこちら
              </MiniBanner>
              <MiniBanner href="#search-results" tone="pink">
                記録一覧はこちら
              </MiniBanner>
              <MiniBanner href="#publication-guide" tone="blue">
                公開ルール
              </MiniBanner>
            </div>
          </aside>

          <div className="homepage-main">
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
              title="シナリオ検索コーナー"
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
                      <select
                        name="edition"
                        defaultValue={parsed.query.edition}
                      >
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
                  <p className="section-code">NEW SCENARIO INDEX</p>
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
                aria-atomic="true"
                aria-live="polite"
                className="result-count"
              >
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
                            <dd>
                              {facetText(row.playerCount, playerCountText)}
                            </dd>
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

                        <a
                          className="product-link"
                          href={row.productUrl}
                          rel="external"
                        >
                          <span>親商品「{row.productTitle}」を見る</span>
                          <PixelIcon name="external" size={20} />
                        </a>
                      </article>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <aside aria-label="索引と公開境界" className="homepage-rail">
            <RetroBox
              headingId="index-top-title"
              title="INDEX TOP 5"
              tone="yellow"
            >
              {indexRows.length > 0 ? (
                <ol className="index-list">
                  {indexRows.map((row, index) => (
                    <li key={row.id}>
                      <span>{index + 1}.</span>
                      <a href={`#scenario-${row.id}`}>{row.title}</a>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rail-empty">表示できる記録はありません。</p>
              )}
              <a className="rail-more-link" href="#search-results">
                → 検索結果一覧へ
              </a>
            </RetroBox>

            <section
              aria-label="公開境界"
              className="publication-boundary retro-box retro-box--lavender"
              id="publication-guide"
              role="note"
            >
              <div className="retro-box__titlebar">
                <span aria-hidden="true">★</span>
                <h2>公開境界</h2>
                <span aria-hidden="true">★</span>
              </div>
              <div className="retro-box__body status-chip-list">
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
            </section>

            <RetroBox
              headingId="recommended-links-title"
              title="おすすめリンク"
              tone="mint"
            >
              <ul className="recommended-link-list">
                <li>
                  <a href={`#${searchTitleId}`}>条件を組み直す</a>
                </li>
                <li>
                  <a href="#search-results">新着順の一覧を見る</a>
                </li>
                <li>
                  <a href="#site-guide">固定デモの説明</a>
                </li>
              </ul>
            </RetroBox>

            <div className="link-free-note">
              <RetroButterfly tone="pink" />
              <p>
                この試作ページはリンクフリー風です。
                <br />
                検索機能はそのまま使えます。
              </p>
              <RetroButterfly tone="blue" />
            </div>
          </aside>

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
            <p className="footer-message">
              ＊ 2000年代前半の個人ホームページ風デザインB ＊
            </p>
            <ProjectBadge />
          </footer>
        </div>
      </div>
    </main>
  );
}
