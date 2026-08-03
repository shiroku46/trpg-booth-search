import { fixtureRepository } from "../fixtures";
import type { PublicScenario, TagCategory } from "../src/domain";
import {
  defaultSearchQuery,
  parseSearchQuery,
  search,
} from "../src/search";

type Params = Promise<Record<string, string | string[] | undefined>>;

const unique = (values: readonly string[]) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right, "ja"));

const tagCategoryLabels: Record<TagCategory, string> = {
  genre: "ジャンル",
  tone: "雰囲気",
  setting: "舞台",
  play_style: "遊び方",
  content_note: "注意事項",
};

function activeFilters(query: ReturnType<typeof parseSearchQuery>): string[] {
  const values = [
    query.keyword ? `キーワード: ${query.keyword}` : undefined,
    query.system ? `システム: ${query.system}` : undefined,
    query.edition ? `版: ${query.edition}` : undefined,
    query.playerCount !== undefined
      ? `人数: ${
          query.playerCount === "unknown" ? "不明" : `${query.playerCount}人`
        }`
      : undefined,
    query.playTimeMinutes !== undefined
      ? `時間: ${
          query.playTimeMinutes === "unknown"
            ? "不明"
            : `${query.playTimeMinutes}分`
        }`
      : undefined,
    query.modality ? `形式: ${query.modality}` : undefined,
    query.tag
      ? `${tagCategoryLabels[query.tag.category]}: ${query.tag.label}`
      : undefined,
    query.book ? `書籍: ${query.book}` : undefined,
    query.requirementKind
      ? `書籍区分: ${query.requirementKind}`
      : undefined,
    query.compatibility ? `互換性: ${query.compatibility}` : undefined,
    query.sort !== "title" ? `並び順: ${query.sort}` : undefined,
    query.sort === "seeded_random" ? `シード: ${query.seed}` : undefined,
  ];
  return values.filter((value): value is string => Boolean(value));
}

function rangeLabel(row: PublicScenario): string {
  if (row.playerRange?.state === "known") {
    return `${row.playerRange.min}〜${row.playerRange.max}人`;
  }
  if (row.playerRange?.state === "unknown") return "不明（承認済み）";
  return row.playerCount ?? "公開情報なし";
}

function timeLabel(row: PublicScenario): string {
  if (row.playTime?.state === "known") {
    const modality = row.playTime.modality
      ? `・${row.playTime.modality}`
      : "";
    return `${row.playTime.min}〜${row.playTime.max}分${modality}`;
  }
  if (row.playTime?.state === "unknown") return "不明（承認済み）";
  return "公開情報なし";
}

export default async function Page({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const query = parseSearchQuery(params);
  const rows = search(fixtureRepository, query);
  const publicRows = search(fixtureRepository, defaultSearchQuery());
  const systems = unique(
    publicRows.flatMap((row) =>
      row.systemDetails.flatMap((system) => [
        system.normalized,
        system.label,
        ...system.aliases,
      ]),
    ),
  );
  const editions = unique(
    publicRows.flatMap((row) =>
      row.systemDetails.flatMap((system) =>
        system.edition ? [system.edition] : [],
      ),
    ),
  );
  const books = unique(
    publicRows.flatMap((row) => row.books.map((book) => book.title)),
  );
  const tags = Object.entries(
    publicRows
      .flatMap((row) => row.tags)
      .reduce<Record<TagCategory, string[]>>(
        (groups, tag) => {
          groups[tag.category].push(tag.label);
          return groups;
        },
        {
          genre: [],
          tone: [],
          setting: [],
          play_style: [],
          content_note: [],
        },
      ),
  ) as [TagCategory, string[]][];
  const active = activeFilters(query);

  return (
    <main>
      <header>
        <p className="eyebrow">FIXTURE-ONLY PREVIEW</p>
        <h1>TRPGシナリオ検索</h1>
        <p>
          合成した全年齢フィクスチャだけを使う固定デモです。BOOTHの実データ、網羅性、価格、公開準備完了を示すものではありません。
        </p>
      </header>

      <form role="search" aria-label="シナリオ検索">
        <label>
          キーワード
          <input name="q" defaultValue={query.keyword} />
        </label>
        <label>
          システム
          <select name="system" defaultValue={query.system ?? ""}>
            <option value="">すべて</option>
            {systems.map((system) => (
              <option key={system} value={system}>
                {system}
              </option>
            ))}
          </select>
        </label>
        <label>
          版
          <select name="edition" defaultValue={query.edition ?? ""}>
            <option value="">すべて</option>
            {editions.map((edition) => (
              <option key={edition} value={edition}>
                {edition}
              </option>
            ))}
          </select>
        </label>
        <label>
          対応プレイヤー数
          <select
            name="players"
            defaultValue={query.playerCount?.toString() ?? ""}
          >
            <option value="">指定なし</option>
            {[1, 2, 3, 4, 5].map((players) => (
              <option key={players} value={players}>
                {players}人を含む
              </option>
            ))}
            <option value="unknown">不明のみ</option>
          </select>
        </label>
        <label>
          対応プレイ時間
          <select
            name="minutes"
            defaultValue={query.playTimeMinutes?.toString() ?? ""}
          >
            <option value="">指定なし</option>
            {[60, 90, 120, 180, 240].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes}分を含む
              </option>
            ))}
            <option value="unknown">不明のみ</option>
          </select>
        </label>
        <label>
          プレイ形式
          <select name="modality" defaultValue={query.modality ?? ""}>
            <option value="">すべて</option>
            <option value="online">オンライン</option>
            <option value="offline">オフライン</option>
            <option value="hybrid">ハイブリッド</option>
          </select>
        </label>
        <label>
          タグ
          <select
            name="tag"
            defaultValue={
              query.tag ? `${query.tag.category}:${query.tag.label}` : ""
            }
          >
            <option value="">すべて</option>
            {tags.map(([category, labels]) => (
              <optgroup key={category} label={tagCategoryLabels[category]}>
                {unique(labels).map((label) => (
                  <option
                    key={`${category}:${label}`}
                    value={`${category}:${label}`}
                  >
                    {label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          ルールブック・サプリ
          <select name="book" defaultValue={query.book ?? ""}>
            <option value="">すべて</option>
            {books.map((book) => (
              <option key={book} value={book}>
                {book}
              </option>
            ))}
          </select>
        </label>
        <label>
          書籍区分
          <select
            name="requirement"
            defaultValue={query.requirementKind ?? ""}
          >
            <option value="">すべて</option>
            <option value="required">必須</option>
            <option value="optional">任意</option>
          </select>
        </label>
        <label>
          互換性
          <select
            name="compatibility"
            defaultValue={query.compatibility ?? ""}
          >
            <option value="">すべて</option>
            <option value="compatible">互換</option>
            <option value="conversion_required">変換が必要</option>
            <option value="unknown">不明（承認済み）</option>
          </select>
        </label>
        <label>
          並び順
          <select name="sort" defaultValue={query.sort}>
            <option value="title">タイトル</option>
            <option value="discovery">発見用スコア</option>
            <option value="new">新着</option>
            <option value="last_checked">最終確認が新しい順</option>
            <option value="seeded_random">シード付きランダム</option>
          </select>
        </label>
        {query.sort === "seeded_random" ? (
          <label>
            ランダムシード
            <input name="seed" defaultValue={query.seed} maxLength={80} />
          </label>
        ) : null}
        <button type="submit">検索</button>
        <a href="/">条件をリセット</a>
      </form>

      {!query.valid ? (
        <p role="alert">
          未対応または不正な検索条件が含まれるため、安全のため結果を表示していません。
        </p>
      ) : null}

      <section aria-label="適用中の条件">
        <h2>適用中の条件</h2>
        {active.length ? <p>{active.join("／")}</p> : <p>条件なし</p>}
      </section>

      <section aria-live="polite">
        <h2>検索結果（{rows.length}件）</h2>
        {rows.length === 0 ? (
          <p className="empty">条件に一致する合成シナリオはありません。</p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li key={row.id}>
                <h3>{row.title}</h3>
                <p>人数: {rangeLabel(row)}</p>
                <p>時間: {timeLabel(row)}</p>
                <p>
                  システム: {row.systems.length ? row.systems.join("、") : "公開情報なし"}
                </p>
                {row.tags.length ? (
                  <p>タグ: {row.tags.map((tag) => tag.label).join("、")}</p>
                ) : null}
                {row.books.length ? (
                  <p>書籍: {row.books.map((book) => book.title).join("、")}</p>
                ) : null}
                <a href={row.productUrl}>親商品「{row.productTitle}」を見る</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
