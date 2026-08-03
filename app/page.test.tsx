import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Page from "./page.tsx";

describe("fixture-backed SSR page", () => {
  it("renders only eligible scenarios and their parent-product boundary", async () => {
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("星明かりの冒険 visible");
    expect(html).toContain("星明かりの冒険 unknown");
    expect(html).not.toContain("非承認AI候補");
    expect(html).toContain("https://example.invalid/products/visible");
  });
});
