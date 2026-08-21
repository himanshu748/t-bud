import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/ui/setup.ts"],
    exclude: ["test/worker/**", "test/data/**", "test/a2a/**", "test/holds/**"]
  }
});
