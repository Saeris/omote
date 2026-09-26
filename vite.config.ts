import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    options: {
      // Without these, `vp check` formats and lints but never type-checks, and
      // still reports success.
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    // Each workspace owns its Vitest project: the library runs in Node, the
    // editor's pure logic too, and each resolves its own aliases.
    projects: ["apps/*", "packages/*"],
  },
});
