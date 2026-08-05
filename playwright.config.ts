import { isIP } from "node:net";

import { defineConfig, devices } from "@playwright/test";

const localBaseUrl = "http://127.0.0.1:3000";

export function resolvePreviewBaseUrl(
  rawValue: string | undefined,
): string | undefined {
  if (rawValue === undefined || rawValue.trim() === "") return undefined;

  let url: URL;
  try {
    url = new URL(rawValue.trim());
  } catch {
    throw new Error("PREVIEW_BASE_URL must be a valid absolute HTTPS URL.");
  }

  const hostname = url.hostname.toLowerCase();
  const invalidHostname =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    !hostname.includes(".") ||
    isIP(hostname) !== 0;

  if (url.protocol !== "https:")
    throw new Error("PREVIEW_BASE_URL must use HTTPS.");
  if (url.username !== "" || url.password !== "")
    throw new Error("PREVIEW_BASE_URL must not contain credentials.");
  if (url.search !== "" || url.hash !== "")
    throw new Error("PREVIEW_BASE_URL must not contain a query or fragment.");
  if (url.pathname !== "/")
    throw new Error("PREVIEW_BASE_URL must be a root origin without a path.");
  if (url.port !== "" && url.port !== "443")
    throw new Error("PREVIEW_BASE_URL may use only the default HTTPS port.");
  if (invalidHostname)
    throw new Error("PREVIEW_BASE_URL must use a public DNS hostname.");

  return url.origin;
}

const previewBaseUrl = resolvePreviewBaseUrl(process.env.PREVIEW_BASE_URL);

if (
  previewBaseUrl &&
  process.argv.some((argument) => argument.includes("update-snapshots"))
)
  throw new Error("Remote preview runs may not update visual baselines.");

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.001,
    },
  },
  reporter: [["line"]],
  snapshotPathTemplate:
    "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}-{platform}{ext}",
  use: {
    baseURL: previewBaseUrl ?? localBaseUrl,
    colorScheme: "light",
    locale: "ja-JP",
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 960 },
      },
    },
  ],
  webServer: previewBaseUrl
    ? undefined
    : {
        command: "npm run start -- --hostname 127.0.0.1 --port 3000",
        env: {
          NEXT_TELEMETRY_DISABLED: "1",
        },
        reuseExistingServer: false,
        timeout: 120_000,
        url: localBaseUrl,
      },
});
