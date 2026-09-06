import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: [],
  },
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "src/test/stubs/server-only.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
});
