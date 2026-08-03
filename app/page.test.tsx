import { renderToStaticMarkup } from "react-dom/server";
import Page from "./page.tsx";

export async function renderFixturePageContract(): Promise<string> {
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  if (!html.includes("星明かりの冒険 visible")) throw new Error("eligible scenario missing");
  if (!html.includes("星明かりの冒険 unknown")) throw new Error("explicit unknown scenario missing");
  if (html.includes("非承認AI候補")) throw new Error("unapproved AI candidate leaked");
  if (!html.includes("https://example.invalid/products/visible")) throw new Error("parent boundary missing");
  return html;
}
