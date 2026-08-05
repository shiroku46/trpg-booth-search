import { expect, test, type Page } from "@playwright/test";

const expectedRuntimeOrigin = new URL(
  process.env.PREVIEW_BASE_URL ?? "http://127.0.0.1:3000",
).origin;

function rejectUnexpectedRequests(page: Page) {
  const unexpected: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== expectedRuntimeOrigin) unexpected.push(request.url());
  });
  return () => expect(unexpected, "unexpected runtime requests").toEqual([]);
}

function cssTimeToMilliseconds(value: string): number {
  if (value.endsWith("ms")) return Number.parseFloat(value);
  if (value.endsWith("s")) return Number.parseFloat(value) * 1000;
  throw new Error(`Unsupported CSS time value: ${value}`);
}

test("default desktop archive is readable, labelled, and visually stable", async ({
  page,
}) => {
  const verifyRuntimeBoundary = rejectUnexpectedRequests(page);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "TRPGシナリオ検索" }),
  ).toBeVisible();
  await expect(page.getByRole("search")).toBeVisible();
  await expect(page.getByLabel("キーワード")).toBeVisible();
  await expect(page.getByLabel("システム")).toBeVisible();
  await expect(page.getByLabel("並び順")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "検索結果（5件）" }),
  ).toBeVisible();

  const productLinks = page.getByRole("link", { name: /親商品「.+」を見る/u });
  await expect(productLinks).toHaveCount(5);
  for (let index = 0; index < (await productLinks.count()); index += 1) {
    const link = productLinks.nth(index);
    await expect(link).toHaveAttribute("rel", "external");
    await expect(link).not.toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute(
      "href",
      /^https:\/\/example[.]invalid\//u,
    );
  }

  verifyRuntimeBoundary();
  await expect(page).toHaveScreenshot("default-desktop.png", {
    fullPage: true,
  });
});

test("search submission updates the URL and reset restores the archive", async ({
  page,
}) => {
  const verifyRuntimeBoundary = rejectUnexpectedRequests(page);
  await page.goto("/");

  await page.getByLabel("システム").selectOption("合成システムB");
  await page.getByLabel("プレイヤー人数").selectOption("1");
  await page.getByLabel("プレイ時間").selectOption("short");
  await page.getByLabel("並び順").selectOption("new");
  await page.getByRole("button", { name: "この条件で検索" }).click();

  await expect(page).toHaveURL(
    /[?&]system=%E5%90%88%E6%88%90%E3%82%B7%E3%82%B9%E3%83%86%E3%83%A0B(?:&|$)/u,
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "検索結果（1件）" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "朝焼けの航路" }),
  ).toBeVisible();
  await expect(page.getByText("人数: 1人", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "条件をリセット" }).click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { level: 2, name: "検索結果（5件）" }),
  ).toBeVisible();
  verifyRuntimeBoundary();
});

test("empty result keeps the archive hierarchy and visual contract", async ({
  page,
}) => {
  const verifyRuntimeBoundary = rejectUnexpectedRequests(page);
  await page.goto("/?q=%E5%AD%98%E5%9C%A8%E3%81%97%E3%81%AA%E3%81%84%E8%AA%9E");

  await expect(
    page.getByRole("heading", { level: 2, name: "検索結果（0件）" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "一致する記録がありません" }),
  ).toBeVisible();
  await expect(
    page.getByText("条件を減らして再検索してください"),
  ).toBeVisible();

  verifyRuntimeBoundary();
  await expect(page).toHaveScreenshot("empty-result.png", { fullPage: true });
});

test("explicit unknown remains visible beside held and ended boundaries", async ({
  page,
}) => {
  const verifyRuntimeBoundary = rejectUnexpectedRequests(page);
  await page.goto("/?edition=unknown");

  await expect(
    page.getByRole("heading", { level: 2, name: "検索結果（1件）" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "不明な森の手紙" }),
  ).toBeVisible();
  await expect(page.locator('select[name="edition"]')).toHaveValue("unknown");
  await expect(
    page.getByText("版: 明示的な不明", { exact: true }),
  ).toBeVisible();
  const boundary = page.getByRole("note", { name: "公開境界" });
  await expect(boundary).toContainText("明示的不明は表示可能");
  await expect(boundary).toContainText("保留は非表示");
  await expect(boundary).toContainText("販売終了は非表示");

  verifyRuntimeBoundary();
  await expect(page).toHaveScreenshot("unknown-and-boundaries.png", {
    fullPage: true,
  });
});

test("narrow mobile has no horizontal document overflow", async ({ page }) => {
  const verifyRuntimeBoundary = rejectUnexpectedRequests(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(page.getByRole("search")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "この条件で検索" }),
  ).toBeVisible();

  verifyRuntimeBoundary();
  await expect(page).toHaveScreenshot("narrow-mobile.png", { fullPage: true });
});

test("keyboard navigation exposes a visible skip-link focus state", async ({
  page,
}) => {
  const verifyRuntimeBoundary = rejectUnexpectedRequests(page);
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "検索結果へ移動" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  const outline = await skipLink.evaluate(
    (element) => getComputedStyle(element).outlineStyle,
  );
  expect(outline).toBe("solid");

  verifyRuntimeBoundary();
  await expect(page).toHaveScreenshot("keyboard-focus.png");
});

test("reduced motion removes meaningful transitions without changing layout", async ({
  page,
}) => {
  const verifyRuntimeBoundary = rejectUnexpectedRequests(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const motion = await page
    .getByRole("button", { name: "この条件で検索" })
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animationDuration: style.animationDuration,
        transitionDuration: style.transitionDuration,
      };
    });
  expect(cssTimeToMilliseconds(motion.animationDuration)).toBeCloseTo(0.01, 6);
  expect(cssTimeToMilliseconds(motion.transitionDuration)).toBeCloseTo(0.01, 6);

  verifyRuntimeBoundary();
  await expect(page).toHaveScreenshot("reduced-motion.png", { fullPage: true });
});

test("@preview-smoke verifies the non-indexed fixture-only deployment contract", async ({
  page,
  request,
}) => {
  const verifyRuntimeBoundary = rejectUnexpectedRequests(page);
  const rootResponse = await page.goto("/");
  expect(rootResponse).not.toBeNull();

  const rootHeaders = rootResponse!.headers();
  expect(rootHeaders["x-content-type-options"]).toBe("nosniff");
  expect(rootHeaders["referrer-policy"]).toBe("no-referrer");
  expect(rootHeaders["x-frame-options"]).toBe("DENY");
  expect(rootHeaders["cross-origin-opener-policy"]).toBe("same-origin");
  expect(rootHeaders["x-robots-tag"]).toBe(
    "noindex, nofollow, noarchive, noimageindex",
  );
  expect(rootHeaders["permissions-policy"]).toContain("camera=()");
  expect(rootHeaders["permissions-policy"]).toContain("microphone=()");
  expect(rootHeaders["permissions-policy"]).toContain("geolocation=()");
  expect(rootHeaders["permissions-policy"]).toContain("payment=()");
  expect(rootHeaders["permissions-policy"]).toContain("usb=()");
  expect(rootHeaders["permissions-policy"]).toContain("browsing-topics=()");

  const robotsMeta = page.locator('meta[name="robots"]');
  await expect(robotsMeta).toHaveAttribute("content", /noindex/u);
  await expect(robotsMeta).toHaveAttribute("content", /nofollow/u);
  await expect(robotsMeta).toHaveAttribute("content", /noarchive/u);
  await expect(robotsMeta).toHaveAttribute("content", /noimageindex/u);

  await expect(
    page.getByRole("heading", { level: 2, name: "検索結果（5件）" }),
  ).toBeVisible();
  await expect(page.getByText("BOOTHの実データ", { exact: false })).toBeVisible();
  await expect(page.getByText("合成", { exact: false }).first()).toBeVisible();

  const productLinks = page.getByRole("link", { name: /親商品「.+」を見る/u });
  await expect(productLinks).toHaveCount(5);
  for (let index = 0; index < (await productLinks.count()); index += 1)
    await expect(productLinks.nth(index)).toHaveAttribute(
      "href",
      /^https:\/\/example[.]invalid\//u,
    );

  const robotsResponse = await request.get("/robots.txt");
  expect(robotsResponse.status()).toBe(200);
  const robotsText = await robotsResponse.text();
  expect(robotsText).toContain("User-Agent: *");
  expect(robotsText).toContain("Disallow: /");

  const healthResponse = await request.get("/healthz");
  expect(healthResponse.status()).toBe(200);
  expect(healthResponse.headers()["cache-control"]).toContain("no-store");
  await expect(healthResponse.json()).resolves.toEqual({
    service: "trpg-booth-search-preview",
    status: "ok",
    dataMode: "synthetic-fixtures-only",
    liveCollection: false,
    hostedDatabase: false,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  verifyRuntimeBoundary();
});
