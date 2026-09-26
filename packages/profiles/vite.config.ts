import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "profiles",
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
