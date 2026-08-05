import { expect, test, type Page } from "@playwright/test";

function rejectUnexpectedRequests(page: Page) {
  const unexpected: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!new Set(["127.0.0.1", "localhost"]).has(url.hostname))
      unexpected.push(request.url());
  });
  return () => expect(unexpected, "unexpected non-local requests").toEqual([]);
}

function cssTimeToMilliseconds(value: string): number {
  if (value.endsWith("ms")) return Number.parseFloat(value);
  if (value.endsWith("s")) return Number.parseFloat(value) * 1000;
  throw new Error(`Unsupported CSS time value: ${value}`);
}

test("default desktop archive is readable, labelled, and visually stable", async ({
  page,
}) => {
  const verifyLocalOnly = rejectUnexpectedRequests(page);
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
    await expect(link).toHaveAttribute("href", /^https:\/\/example[.]invalid\//u);
  }

  verifyLocalOnly();
  await expect(page).toHaveScreenshot("default-desktop.png", {
    fullPage: true,
  });
});

test("search submission updates the URL and reset restores the archive", async ({
  page,
}) => {
  const verifyLocalOnly = rejectUnexpectedRequests(page);
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
  await expect(page.getByRole("heading", { name: "朝焼けの航路" })).toBeVisible();
  await expect(page.getByText("人数: 1人", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "条件をリセット" }).click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { level: 2, name: "検索結果（5件）" }),
  ).toBeVisible();
  verifyLocalOnly();
});

test("empty result keeps the archive hierarchy and visual contract", async ({
  page,
}) => {
  const verifyLocalOnly = rejectUnexpectedRequests(page);
  await page.goto("/?q=%E5%AD%98%E5%9C%A8%E3%81%97%E3%81%AA%E3%81%84%E8%AA%9E");

  await expect(
    page.getByRole("heading", { level: 2, name: "検索結果（0件）" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "一致する記録がありません" }),
  ).toBeVisible();
  await expect(page.getByText("条件を減らして再検索してください")).toBeVisible();

  verifyLocalOnly();
  await expect(page).toHaveScreenshot("empty-result.png", { fullPage: true });
});

test("explicit unknown remains visible beside held and ended boundaries", async ({
  page,
}) => {
  const verifyLocalOnly = rejectUnexpectedRequests(page);
  await page.goto("/?edition=unknown");

  await expect(
    page.getByRole("heading", { level: 2, name: "検索結果（1件）" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "不明な森の手紙" })).toBeVisible();
  await expect(page.getByLabel("版")).toHaveValue("unknown");
  await expect(page.getByText("版: 明示的な不明", { exact: true })).toBeVisible();
  const boundary = page.getByRole("note", { name: "公開境界" });
  await expect(boundary).toContainText("明示的不明は表示可能");
  await expect(boundary).toContainText("保留は非表示");
  await expect(boundary).toContainText("販売終了は非表示");

  verifyLocalOnly();
  await expect(page).toHaveScreenshot("unknown-and-boundaries.png", {
    fullPage: true,
  });
});

test("narrow mobile has no horizontal document overflow", async ({ page }) => {
  const verifyLocalOnly = rejectUnexpectedRequests(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(page.getByRole("search")).toBeVisible();
  await expect(page.getByRole("button", { name: "この条件で検索" })).toBeVisible();

  verifyLocalOnly();
  await expect(page).toHaveScreenshot("narrow-mobile.png", { fullPage: true });
});

test("keyboard navigation exposes a visible skip-link focus state", async ({
  page,
}) => {
  const verifyLocalOnly = rejectUnexpectedRequests(page);
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "検索結果へ移動" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  const outline = await skipLink.evaluate(
    (element) => getComputedStyle(element).outlineStyle,
  );
  expect(outline).toBe("solid");

  verifyLocalOnly();
  await expect(page).toHaveScreenshot("keyboard-focus.png");
});

test("reduced motion removes meaningful transitions without changing layout", async ({
  page,
}) => {
  const verifyLocalOnly = rejectUnexpectedRequests(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const motion = await page.getByRole("button", { name: "この条件で検索" }).evaluate(
    (element) => {
      const style = getComputedStyle(element);
      return {
        animationDuration: style.animationDuration,
        transitionDuration: style.transitionDuration,
      };
    },
  );
  expect(cssTimeToMilliseconds(motion.animationDuration)).toBeCloseTo(0.01, 6);
  expect(cssTimeToMilliseconds(motion.transitionDuration)).toBeCloseTo(0.01, 6);

  verifyLocalOnly();
  await expect(page).toHaveScreenshot("reduced-motion.png", { fullPage: true });
});
