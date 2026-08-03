import { fixtureRepository } from "../fixtures";
import { search } from "../src/search";
type Params = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : "";
export default async function Page({ searchParams }: { searchParams: Params }) {
  const p = await searchParams;
  const q = one(p.q),
    system = one(p.system),
    sort = one(p.sort) || "title",
    seed = one(p.seed) || "demo";
  const rows = search(fixtureRepository, q, system, sort, seed);
  return (
    <main>
      <header>
        <p className="eyebrow">FIXTURE-ONLY PREVIEW</p>
        <h1>TRPGシナリオ検索</h1>
        <p>
          これは合成した全年齢フィクスチャのみの固定デモです。BOOTHの実データや網羅性、公開準備完了を示すものではありません。
        </p>
      </header>
      <form role="search">
        <label>
          キーワード
          <input name="q" defaultValue={q} />
        </label>
        <label>
          システム
          <select name="system" defaultValue={system}>
            <option value="">すべて</option>
            <option>合成システムA</option>
          </select>
        </label>
        <label>
          並び順
          <select name="sort" defaultValue={sort}>
            <option value="title">タイトル</option>
            <option value="random">シード付きランダム</option>
          </select>
        </label>
        <label>
          ランダムシード
          <input name="seed" defaultValue={seed} />
        </label>
        <button>検索</button>
      </form>
      <section aria-live="polite">
        <h2>検索結果（{rows.length}件）</h2>
        {rows.length === 0 ? (
          <p className="empty">条件に一致する合成シナリオはありません。</p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li key={row.id}>
                <h3>{row.title}</h3>
                <p>
                  {row.playerCount
                    ? `人数: ${row.playerCount}`
                    : "人数: 不明（許可された明示的な不明）"}
                </p>
                <p>
                  {row.systems.length
                    ? `システム: ${row.systems.join("、")}`
                    : "公開可能なシステム関係なし"}
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
