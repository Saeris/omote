import { defineConfig } from "vitest/config";

/**
 * Tests only. Astro owns the app build (astro.config.ts); this keeps the app in the workspace's Vitest projects.
 */
export default defineConfig({
  test: {
    name: "omote.social",
    include: ["src/**/*.test.ts", "worker/**/*.test.ts"],
    environment: "node",
  },
});
