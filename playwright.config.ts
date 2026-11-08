import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/features",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  // Tests are independent (own app, port and DB per test), so CI shards split by test, not file.
  fullyParallel: Boolean(process.env.CI),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    viewport: { width: 1600, height: 900 },
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: process.env.CI
    ? [["list"], ["blob"]]
    : [["list"], ["json", { outputFile: "test-results/acceptance.json" }]],
});
