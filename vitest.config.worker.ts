import path from "node:path";
import {
  cloudflareTest,
  readD1Migrations
} from "@cloudflare/vitest-plugin";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      remoteBindings: false,
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          RAZORPAY_WEBHOOK_SECRET: "test_webhook_secret",
          TEST_MIGRATIONS: await readD1Migrations(
            path.join(import.meta.dirname, "migrations")
          )
        }
      }
    }))
  ],
  test: {
    globals: true,
    setupFiles: ["./test/worker/setup.ts"],
    exclude: [
      ...configDefaults.exclude,
      "e2e/**",
      "test/ui/**",
      "test/ai/**",
      "test/domain/**"
    ]
  }
});
