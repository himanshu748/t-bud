import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  webServer: {
    command:
      "npm run build && npx wrangler d1 migrations apply t-bud --local && npm run dev:worker -- --port 8791",
    url: "http://localhost:8791/api/health",
    reuseExistingServer: false,
    timeout: 120_000
  },
  use: {
    baseURL: "http://localhost:8791",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  }
});
