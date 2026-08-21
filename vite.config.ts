import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/ui/setup.ts"],
    exclude: [
      ...configDefaults.exclude,
      "e2e/**",
      "test/worker/**",
      "test/data/**",
      "test/a2a/**",
      "test/holds/**"
    ]
  }
});
