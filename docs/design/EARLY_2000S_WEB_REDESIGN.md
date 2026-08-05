# 2000年代前半の日本語Web風デザイン試作

Issue: #98

## 目的

既存の検索ロジック、安全境界、セマンティックHTMLを変更せず、2000〜2003年頃の日本語検索ポータル／個人ホームページを想起させる外観へ再構成する。

対象は「現代的なカードUIにY2K装飾を加える」方向ではない。Yahoo! JAPAN型の高密度な検索ポータル、GeoCities／個人サイト型の手作り感、Windows 98〜XP初期のフォーム表現を組み合わせる。

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

参照先は情報設計・時代要素の理解だけに利用し、外部画像、外部フォント、CDN、JavaScript SDK、ランタイム通信は導入しない。

## 採用した時代要素

- 1024×768時代を思わせる中央寄せ本文
- 8px周期の小さな反復パターン背景
- MS PGothic / MS Gothic / Osakaを優先するローカルフォントスタック
- 青い下線リンクと訪問済みリンクの紫
- 1px境界線、点線、二重線、淡い水色・緑・紫・黄の見出し帯
- Windows風の `inset` 入力欄と `outset` ボタン
- 高密度なフォーム配置と検索ディレクトリ風の結果行
- `FILE 01` 型の記録番号
- 88×31バナー文化を意識したProjectBadge
- 小さな更新情報とページ案内を持つ左サイド領域

## 現代側で維持するもの

- 本物の `frameset`、`frame`、`marquee`、`blink` は使わない
- spacer GIFやレイアウト目的のHTML tableは使わない
- CSS Grid / Flexboxで外観だけを再構成する
- 既存のheading、fieldset、legend、label、role、ariaを維持する
- `focus-visible` を高コントラストで表示する
- `prefers-reduced-motion` でアニメーション／transitionを実質停止する
- 390pxでは検索、適用条件、結果、補助情報の順へ1カラム化する
- 外部ランタイムrequestを追加しない

## 実装方針

この初回試作は `app/style.css` を全面置換するstylesheet-only redesignとする。検索ロジック、fixture、パラメータ検証、公開境界、商品リンク、安全文言、テスト対象のDOM文言には触れない。

デスクトップでは既存DOMを次のように再配置する。

1. ヘッダー：検索ポータル型のロゴ＋登録案内風ボックス
2. 左：固定デモの説明、更新情報、ページ案内
3. 中央：検索条件、適用中条件、結果一覧
4. 右上：公開境界
5. フッター：記録件数、並び順、安全境界、88×31風バッジ

モバイルでは検索フォームを最優先し、結果の後に固定デモ説明を置く。

## 非採用

- 架空の訪問者数、ランキング、価格、作者、商品数
- 実データに根拠のない「新着」表示
- 大きな角丸、ガラスモーフィズム、巨大ヒーロー、余白過多のSaaS UI
- 外部フォント、画像、広告、iframe、解析タグ

## 検証

Draft PR上で以下を確認する。

- format / lint / typecheck / unit test / build
- Playwrightの既存検索・安全境界テスト
- 390pxで `scrollWidth <= clientWidth`
- キーボードフォーカス
- reduced motion
- 外部runtime request 0
- 新しい視覚スナップショットの確認
