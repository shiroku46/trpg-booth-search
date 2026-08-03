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
    expect(html).toContain("https://example.invalid/products/visible");
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
    expect(html).toContain("条件をリセット");
  });

  it("supports explicit unknown filters without conflating omitted systems", async () => {
    const editionHtml = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ edition: "unknown" }) }),
    );
    expect(editionHtml).toContain("不明な森の手紙");
    expect(editionHtml).toContain("検索結果（1件）");

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
  });

  it("fails closed for arrays, unknown parameters, and invalid values", async () => {
    expect(parseSearchParams({ sort: ["title", "new"] }).invalid).toBe(true);
    expect(parseSearchParams({ unexpected: "value" }).invalid).toBe(true);
    expect(parseSearchParams({ players: "2〜4人" }).invalid).toBe(true);
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ sort: "unsafe" }) }),
    );
    expect(html).toContain("無効な検索条件");
    expect(html).toContain("検索結果（0件）");
  });

  it("shows an accessible empty state", async () => {
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ q: "存在しない語" }) }),
    );
    expect(html).toContain("検索結果（0件）");
    expect(html).toContain("条件を減らして再検索してください");
  });
});
