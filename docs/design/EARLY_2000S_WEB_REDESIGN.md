# 2000年代前半の個人ホームページ風デザインB

Issue: #98  
Draft PR: #100

## 目的

既存の検索ロジック、公開境界、セマンティックHTMLを維持したまま、2000〜2003年頃の日本語個人ホームページを想起させる検索サイトへ再構成する。

最初の検索ポータル寄り試作を経て、ユーザーレビューで「デザインB：テーブルレイアウト風＋GIF装飾を多用した個人サイト風」を採用した。

現代的なカードUIにレトロな色を載せるだけではなく、当時の個人サイトに見られた更新欄、アクセスカウンター風表示、リンクバナー、左右の情報欄、淡色の囲み記事、密度の高い本文配置を情報設計として取り込む。

## 調査した参照先

- Web Design Museum: Yahoo 2001
  - https://www.webdesignmuseum.org/gallery/yahoo-2001
- Web Design Museum: Yahoo! GeoCities 2001
  - https://www.webdesignmuseum.org/gallery/geocities-2001
- ICS MEDIA: tableレイアウト、spacer.gifなどの2000年代Web制作技術史
  - https://ics.media/entry/17960/
- Alcarna: 日本のWebデザイン史アーカイブ検索
  - https://www.alcarna.net/
- ACEWEB: 平成レトロWebの再現要素
  - https://aceweb.jp/column/heiseiretro/

参照先は情報設計と時代要素の理解だけに使用する。外部画像、外部フォント、CDN、外部JavaScript、解析タグ、ランタイム通信は追加しない。

## 採用した構成

### ヘッダー

- 左右にローカルSVGの猫マスコットを配置
- 蝶、星、点飾りをコードで描画
- タイトルはMS Gothic系の太い見出しと淡い影で構成
- TOP、検索、結果、使い方、公開境界へのサイト内リンクを設置

### 左サイド

- `What's New`形式の更新情報
- 現在の検索結果件数を表示するカウンター
- 固定デモと非実データであることの説明
- 88×31バナー文化を意識したサイト内リンク

カウンターは架空の訪問者数ではなく、実際の`rows.length`を6桁表示する。

### 中央

- 既存の検索フォーム
- 適用中条件
- 検索結果一覧

検索機能、URLパラメータ、明示的不明、保留・販売終了の除外、親商品リンクの境界は変更しない。

### 右サイド

- `INDEX TOP 5`
- 公開境界
- おすすめサイト内リンク
- リンクフリー風の装飾欄

`INDEX TOP 5`は人気ランキングではない。現在の検索結果の表示順から先頭5件を抜き出したページ内索引であり、根拠のない順位情報を生成しない。

### フッター

- 表示件数
- 現在の並び順
- `SYNTHETIC FIXTURE / READ ONLY`
- 88×31風ProjectBadge

## GIF風装飾の実装

外部GIFは導入しない。猫のしっぽ、瞬き、蝶の羽ばたきは、インラインSVGとCSSの`steps()`アニメーションで再現する。

`prefers-reduced-motion: reduce`ではアニメーションとtransitionを実質停止する。装飾は`aria-hidden`とし、検索や読み上げ順には介入させない。

## 現代側で維持するもの

- 本物の`frameset`、`frame`、`marquee`、`blink`は使わない
- spacer GIFやレイアウト目的のHTML tableは使わない
- CSS Grid / Flexboxで当時のテーブル型外観を再現する
- heading、nav、aside、fieldset、legend、label、role、ariaを維持する
- キーボードフォーカスを高コントラストで表示する
- 外部runtime requestを追加しない
- 架空のアクセス数、人気順位、価格、作者、商品数を表示しない

## レスポンシブ方針

デスクトップは左184px、中央可変、右210pxの3カラムとする。

920px以下では中央＋左補助領域の2カラムへ移行する。44rem以下では、利用優先度に合わせて次の1カラム順へ並べ替える。

1. 検索フォーム
2. 適用中条件
3. 検索結果
4. 更新情報・カウンター・サイト説明
5. 索引・公開境界・おすすめリンク
6. フッター

390pxで文書全体の横スクロールが発生しないことをPlaywrightで検証する。

## 変更対象

- `app/page.tsx`
  - 個人ホームページ型の左右レール、ローカル装飾、ページ内ナビゲーションを追加
- `app/style.css`
  - デザインBの配色、3カラム、バナー、カウンター、GIF風アニメーション、レスポンシブを実装
- `e2e/search-ui.spec.ts-snapshots/*.png`
  - 承認済みデザインBの6状態を視覚基準として更新

検索ドメイン、fixture、永続化、安全ヘッダー、デプロイ境界には変更を加えない。

## 検証結果

- Prettier: PASS
- ESLint: PASS
- TypeScript: PASS
- Vitest: 6ファイル / 50テスト PASS
- Next.js production build: PASS
- Repository CI: PASS
- Unit Tests workflow: PASS
- Playwright baseline更新: 8 / 8 PASS
- Playwright baseline再照合: 8 / 8 PASS
- 視覚基準画像: 6ファイル生成・保存
- 390px横スクロール: なし
- キーボードskip-link: 可視
- reduced motion: PASS
- 外部runtime request: 0

視覚基準は、デスクトップ、空結果、明示的不明と公開境界、390pxモバイル、キーボードフォーカス、reduced motionの6状態を対象とする。
