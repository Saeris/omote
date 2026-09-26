import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

/**
 * The profile editor. Static pages, with React only for the editor's forms; the one server-side piece, the resolve API, is the Worker in worker/.
 */
export default defineConfig({
  output: "static",
  integrations: [react()],
  // Where sign-in on this machine redirects to (see src/auth.ts). Listening here
  // explicitly, since `localhost` can resolve to IPv6 alone.
  server: { host: "127.0.0.1" },
  vite: {
    plugins: [tailwindcss()],
  },
});
