<div align="center">

# omote.social

The Omote profile editor, and a `social.omote.getProfile` XRPC endpoint

</div>

---

Two things on one Cloudflare Worker, with no storage and no secrets:

- **The editor**: static [Astro][astro] pages, with React only for the forms. Sign-in is a public OAuth client that runs entirely in the browser. It asks the account's own server for exactly two things: writing `social.omote.profile` records, and uploading images.
- **The resolve endpoint**: `GET /xrpc/social.omote.getProfile?actor=…&context=…`, answered by [`@omote-social/profiles`][profiles] on every request. It is open to any origin, and a convenience for prototyping; apps should resolve profiles with the library in production.

## 🔧 Local Development

```bash
yarn dev        # the editor with hot reload, at http://localhost:4321
yarn preview    # the built site and the Worker together, at http://localhost:8787
```

Sign-in works on `localhost` with no setup: ATProto's OAuth has a development exception for it, so any account can sign in to a local copy. `yarn dev` doesn't run the Worker; use `yarn preview` to try the resolve endpoint:

```bash
curl "http://localhost:8787/xrpc/social.omote.getProfile?actor=alice.example.com&context=social.taproom"
```

## 🚀 Deploying

Deployments run through [Workers Builds][workers-builds], Cloudflare's Git integration. It deploys `main` on every push and builds a preview URL for other branches, much like Vercel. One-time setup, in the Cloudflare dashboard:

1. **Workers & Pages → Create → Import a repository**, and pick `Saeris/omote`.
2. Set:
   - **Project name**: `omote-social`, which must match `name` in `wrangler.jsonc`;
   - **Root directory**: `apps/omote.social`;
   - **Build command**: `corepack enable && yarn install --immutable && yarn build`;
   - **Deploy command**: `npx wrangler deploy` (the default).
3. Under **Build variables**, add `SKIP_DEPENDENCY_INSTALL` = `true`.

   The build image's default Yarn is 1.x, so the build command installs with Corepack instead. Corepack reads the repository's `packageManager` field and runs Yarn 4.

4. Optionally, set **Build watch paths** to `apps/omote.social/*`, `packages/*` and `yarn.lock`, so a docs-only change doesn't redeploy.

Until the domain is live, the Worker is served on its `workers.dev` address. To attach the domain, uncomment the `routes` entry in `wrangler.jsonc`.

### Self-hosting

Deploy this app to your own Cloudflare account the same way. Set `PUBLIC_SITE_ORIGIN` at build time to where it will be served, since the OAuth client metadata is generated from it.

[astro]: https://astro.build
[profiles]: ../../packages/profiles
[workers-builds]: https://developers.cloudflare.com/workers/ci-cd/builds/
