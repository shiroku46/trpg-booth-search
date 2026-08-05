import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Page, { parseSearchParams } from "./page";

describe("fixture search page", () => {
  it("renders eligible scenarios, explicit ranges, result count, and parent boundaries", async () => {
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain("検索結果（5件）");
    expect(html).toContain("星明かりの図書館");
    expect(html).toContain("不明な森の手紙");
    expect(html).toContain("2〜4人");
    expect(html).toContain("121〜240分");
    expect(html).not.toContain("非承認AI候補");
    expect(html).not.toContain("https://example.invalid/products/ended");
    expect(html).not.toContain("sales_ended");
    expect(html).not.toContain("salesState");
    expect(html).not.toContain("synthetic_sales_hold");
    expect(html).toContain("https://example.invalid/products/visible");
  });

  it("renders the archive shell, visible labels, and publication boundary", async () => {
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain("TRPG ARCHIVE // FIXTURE INDEX");
    expect(html).toContain('href="#search-results"');
    expect(html).toContain('role="search"');
    expect(html).toContain('id="search-panel-title"');
    expect(html).toContain('aria-label="公開境界"');
    expect(html).toContain("明示的不明は表示可能");
    expect(html).toContain("保留は非表示");
    expect(html).toContain("販売終了は非表示");

    for (const label of [
      "キーワード",
      "システム",
      "版",
      "プレイヤー人数",
      "プレイ時間",
      "プレイ形式",
      "ジャンル",
      "雰囲気",
      "舞台",
      "構成",
      "内容",
      "書籍",
      "互換性",
      "並び順",
    ])
      expect(html).toContain(label);

    expect(html).toContain("この条件で検索");
    expect(html).toContain("SYNTHETIC FIXTURE / READ ONLY");
    expect(html).toContain("TRPG Archive Fixture Index");
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/src=["']https?:/u);
  });

  it("renders approved facets, active summaries, and reset control", async () => {
    const html = renderToStaticMarkup(
      await Page({
        searchParams: Promise.resolve({
          system: "合成システムB",
          players: "1",
          playTime: "short",
          sort: "new",
        }),
      }),
    );
    expect(html).toContain("朝焼けの航路");
    expect(html).not.toContain("星明かりの図書館");
    expect(html).toContain("適用中の条件");
    expect(html).toContain("人数: 1人");
    expect(html).toContain('href="/"');
    expect(html).toContain("条件をリセット");
  });

  it("supports explicit unknown filters without conflating omitted systems", async () => {
    const editionHtml = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ edition: "unknown" }) }),
    );
    expect(editionHtml).toContain("不明な森の手紙");
    expect(editionHtml).toContain("検索結果（1件）");
    expect(editionHtml).toContain("明示的な不明");

    expect(parseSearchParams({ system: "unknown" }).invalid).toBe(false);
    const systemHtml = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ system: "unknown" }) }),
    );
    expect(systemHtml).toContain("硝子時計の街");
    expect(systemHtml).toContain("検索結果（1件）");
  });

  it("shows the random seed control only for seeded-random sort", async () => {
    const defaultHtml = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({}) }),
    );
    expect(defaultHtml).not.toContain('name="seed"');

    const randomHtml = renderToStaticMarkup(
      await Page({
        searchParams: Promise.resolve({ sort: "random", seed: "repeatable" }),
      }),
    );
    expect(randomHtml).toContain('name="seed"');
    expect(randomHtml).toContain('value="repeatable"');
    expect(randomHtml).toContain("シード: repeatable");
    expect(randomHtml).not.toContain("https://example.invalid/products/ended");
  });

  it("fails closed for arrays, unknown parameters, and invalid values", async () => {
    expect(parseSearchParams({ sort: ["title", "new"] }).invalid).toBe(true);
    expect(parseSearchParams({ unexpected: "value" }).invalid).toBe(true);
    expect(parseSearchParams({ players: "2〜4人" }).invalid).toBe(true);
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ sort: "unsafe" }) }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("無効な検索条件");
    expect(html).toContain("検索結果（0件）");
  });

  it("shows a reusable accessible empty state", async () => {
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ q: "存在しない語" }) }),
    );
    expect(html).toContain("検索結果（0件）");
    expect(html).toContain("一致する記録がありません");
    expect(html).toContain("条件を減らして再検索してください");
  });

  it("keeps result links text-labelled and external without forcing a new window", async () => {
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ q: "星明かり" }) }),
    );
    expect(html).toContain("親商品「合成商品 visible」を見る");
    expect(html).toContain('rel="external"');
    expect(html).not.toContain('target="_blank"');
  });
});
