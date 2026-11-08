import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/features",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  outputDir: process.env.EMAIL_ISLAND_E2E_OUTPUT ?? "test-results/artifacts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    viewport: { width: 1600, height: 900 },
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile:
          process.env.EMAIL_ISLAND_E2E_REPORT ?? "test-results/acceptance.json",
      },
    ],
  ],
});
