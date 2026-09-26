import { defineConfig } from "vite-plus";

export default defineConfig({
  // The published build. In the workspace, consumers read src/ directly.
  pack: {
    entry: ["./src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    outDir: "./dist",
  },
  test: {
    name: "profiles",
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
