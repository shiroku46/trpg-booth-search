import { defineConfig, devices } from "@playwright/test";

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
    baseURL: "http://127.0.0.1:3000",
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
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3000",
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://127.0.0.1:3000",
  },
});
