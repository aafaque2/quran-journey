import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/pipeline/src/**/*.test.ts"],
    environment: "node",
  },
});
