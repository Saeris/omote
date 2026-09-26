import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "lexicon",
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
