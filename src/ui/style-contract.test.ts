import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/style.css"), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) throw new Error(`Missing hexadecimal CSS token: ${name}`);
  return match[1];
}

function rgb(value: string): [number, number, number] {
  const normalized = value.slice(1);
  return [0, 2, 4].map((index) =>
    Number.parseInt(normalized.slice(index, index + 2), 16),
  ) as [number, number, number];
}

function luminance(value: string): number {
  const channels = rgb(value).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
  );
}

function contrast(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Stage 10 visual-system contract", () => {
  it.each([
    ["ink", "paper", 4.5],
    ["ink", "paper-strong", 4.5],
    ["muted", "paper", 4.5],
    ["paper-strong", "accent", 4.5],
    ["paper-strong", "accent-dark", 4.5],
    ["accent-dark", "accent-pale", 4.5],
    ["warning", "warning-pale", 4.5],
    ["unknown", "unknown-pale", 4.5],
    ["held", "held-pale", 4.5],
    ["ended", "ended-pale", 4.5],
    ["success", "success-pale", 4.5],
    ["focus", "paper-strong", 3],
    ["line", "paper", 3],
  ])(
    "%s on %s satisfies the committed contrast threshold",
    (foreground, background, minimum) => {
      expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(
        minimum,
      );
    },
  );

  it("keeps the approved motion, mobile, and asset boundaries", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@media (max-width: 44rem)");
    expect(css).toContain("min-height: 2.85rem");
    expect(css).toContain("outline: 3px solid var(--focus)");
    expect(css).not.toMatch(/url\s*\(\s*["']?https?:/iu);
    expect(css).not.toMatch(/cursor\s*:\s*url/iu);
    expect(css).not.toMatch(/animation[^;]*(blink|marquee)/iu);
    expect(css).not.toContain("image-rendering: pixelated");
    expect(css).not.toContain("filter: blur");
  });
});
