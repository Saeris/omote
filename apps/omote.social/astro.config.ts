import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

/**
 * omote.social: the homepage, the developer docs at /docs/, and the editor at /editor/. Static pages, with React only for the editor's forms; the one server-side piece, the resolve API, is the Worker in worker/.
 */
export default defineConfig({
  // Where this copy is served, for canonical URLs and the sitemap. Set PUBLIC_SITE_ORIGIN when self-hosting, as for the OAuth client metadata.
  site: process.env.PUBLIC_SITE_ORIGIN ?? "https://omote.social",
  output: "static",
  integrations: [
    // The docs. Their pages live in src/content/docs/docs/, which is what puts them under /docs/.
    starlight({
      title: "omote docs",
      description: "Profiles that extend, for ATProto: how they resolve, and how to adopt them.",
      favicon: "/favicon.svg",
      // The site's own pages aren't docs, so a missing page shouldn't look like one.
      disable404Route: true,
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/Saeris/omote" }],
      editLink: {
        baseUrl: "https://github.com/Saeris/omote/edit/main/apps/omote.social/",
      },
      sidebar: [
        { label: "Start here", items: ["docs", "docs/concepts"] },
        { label: "Guides", items: [{ autogenerate: { directory: "docs/guides" } }] },
        { label: "Reference", items: [{ autogenerate: { directory: "docs/reference" } }] },
      ],
    }),
    react(),
  ],
  // Where sign-in on this machine redirects to (see src/auth.ts). Listening here
  // explicitly, since `localhost` can resolve to IPv6 alone.
  server: { host: "127.0.0.1" },
  vite: {
    plugins: [tailwindcss()],
  },
});
