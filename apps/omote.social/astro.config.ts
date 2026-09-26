import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

/**
 * The profile editor. Static pages, with React only for the editor's forms; the one server-side piece, the resolve API, is the Worker in worker/.
 */
export default defineConfig({
  output: "static",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
