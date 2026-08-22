import { defineConfig } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const localState = mkdtempSync(join(tmpdir(), "t-bud-e2e-"));
const quotedLocalState = JSON.stringify(localState);

process.once("exit", () => {
  rmSync(localState, { recursive: true, force: true });
});

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  webServer: {
    command:
      `npm run build && npx wrangler d1 migrations apply t-bud --local --persist-to ${quotedLocalState} && npm run dev:worker -- --port 8791 --persist-to ${quotedLocalState}`,
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
