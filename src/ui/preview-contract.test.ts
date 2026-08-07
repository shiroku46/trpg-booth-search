import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { GET } from "../../app/healthz/route";
import robots from "../../app/robots";
import nextConfig from "../../next.config";
import { resolvePreviewBaseUrl } from "../../playwright.config";
import { config as proxyConfig, proxy } from "../../proxy";

const readRepositoryFile = (path: string) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const expectedPreviewHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy":
    "browsing-topics=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow, noarchive, noimageindex",
};

describe("fixture-only preview contract", () => {
  it("applies the required response-security and crawler headers to every route", async () => {
    const rules = await nextConfig.headers?.();
    expect(rules).toHaveLength(1);
    expect(rules?.[0]?.source).toBe("/:path*");

    const headers = Object.fromEntries(
      (rules?.[0]?.headers ?? []).map(({ key, value }) => [key, value]),
    );
    expect(headers).toEqual(expectedPreviewHeaders);
  });

  it("sets the same bounded headers at the Vercel delivery layer", () => {
    const configuration = JSON.parse(readRepositoryFile("vercel.json")) as {
      $schema: string;
      git: {
        deploymentEnabled: Record<string, boolean>;
      };
      headers: Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>;
    };

    expect(Object.keys(configuration).sort()).toEqual([
      "$schema",
      "git",
      "headers",
    ]);
    expect(configuration.$schema).toBe("https://openapi.vercel.sh/vercel.json");
    expect(configuration.git).toEqual({
      deploymentEnabled: { main: true, "*": false },
    });
    expect(configuration.headers).toHaveLength(1);
    expect(configuration.headers[0]?.source).toBe("/(.*)");
    expect(
      Object.fromEntries(
        (configuration.headers[0]?.headers ?? []).map(({ key, value }) => [
          key,
          value,
        ]),
      ),
    ).toEqual(expectedPreviewHeaders);
  });

  it("reasserts no-referrer in the post-config proxy without request state", () => {
    const response = proxy();
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(proxyConfig).toEqual({ matcher: "/:path*" });

    const source = readRepositoryFile("proxy.ts");
    expect(source).not.toMatch(
      /NextRequest|request[.]headers|cookies|authorization|process[.]env/iu,
    );
    expect(source).toContain("NextResponse.next()");
    expect(source).toContain('"Referrer-Policy": "no-referrer"');
  });

  it("disallows all crawlers and declares matching metadata directives", () => {
    expect(robots()).toEqual({
      rules: [{ userAgent: "*", disallow: "/" }],
    });

    const layout = readRepositoryFile("app/layout.tsx");
    for (const directive of [
      "index: false",
      "follow: false",
      "noarchive: true",
      "nocache: true",
      "noimageindex: true",
      "nosnippet: true",
    ])
      expect(layout).toContain(directive);
  });

  it("returns only static non-sensitive fixture status from healthz", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({
      service: "trpg-booth-search-preview",
      status: "ok",
      dataMode: "synthetic-fixtures-only",
      liveCollection: false,
      hostedDatabase: false,
    });

    const source = readRepositoryFile("app/healthz/route.ts");
    expect(source).not.toMatch(
      /process[.]env|commit|hostname|timestamp|databaseUrl|secret|token/iu,
    );
  });

  it("accepts only credential-free public root HTTPS preview origins", () => {
    expect(resolvePreviewBaseUrl(undefined)).toBeUndefined();
    expect(resolvePreviewBaseUrl(" ")).toBeUndefined();
    expect(resolvePreviewBaseUrl("https://preview.example.com/")).toBe(
      "https://preview.example.com",
    );
    expect(resolvePreviewBaseUrl("https://preview.example.com:443/")).toBe(
      "https://preview.example.com",
    );

    for (const invalid of [
      "http://preview.example.com/",
      "https://user:password@preview.example.com/",
      "https://preview.example.com/path",
      "https://preview.example.com/?share=token",
      "https://preview.example.com/#fragment",
      "https://preview.example.com:8443/",
      "https://localhost/",
      "https://127.0.0.1/",
      "https://preview.local/",
      "not-a-url",
    ])
      expect(() => resolvePreviewBaseUrl(invalid), invalid).toThrow();
  });

  it("keeps the manual smoke workflow read-only and deployment-free", () => {
    const workflow = readRepositoryFile(".github/workflows/preview-smoke.yml");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("github.actor == github.repository_owner");
    expect(workflow).toContain("npm run test:preview");
    expect(workflow).not.toMatch(/secrets[.[]/u);
    expect(workflow).not.toMatch(
      /vercel\s+(?:deploy|promote)|--prod|supabase|repository_dispatch|contents:\s*write/iu,
    );
  });

  it("documents the fixture-only and human deployment boundaries", () => {
    const combined = [
      readRepositoryFile("README.md"),
      readRepositoryFile("docs/PREVIEW_DEPLOYMENT.md"),
    ].join("\n");

    for (const statement of [
      "synthetic fixtures",
      "live BOOTH collection remains disabled",
      "no environment variables",
      "never paste credentials",
      "personal/non-commercial",
      "rollback",
    ])
      expect(combined.toLowerCase()).toContain(statement.toLowerCase());
  });
});
