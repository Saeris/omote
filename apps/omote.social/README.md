<div align="center">

# omote.social

The Omote profile editor, and a `social.omote.getProfile` XRPC endpoint

</div>

---

Two things on one Cloudflare Worker, with no storage and no secrets:

- **The editor**, at `/editor/`: static [Astro][astro] pages, with React only for the forms. Sign-in is a public OAuth client that runs entirely in the browser.
  - **Sign-in asks for two things:** writing the shared base (`social.omote.actor.profile`), and uploading images.
  - **Each app's profile is asked for separately**, the first time you edit it, so nobody grants write access to apps they don't use. bsky.social only grants collections the client metadata names, so the ones omote can ask for are listed in [`src/scope.ts`](./src/scope.ts); any other app's profile is read-only.
  - **Edits follow the app's own lexicon**, resolved from the network: its fields, limits, image formats and required fields. omote never writes `null` or `extends` into a record whose lexicon doesn't declare them, and keeps every field it doesn't edit.
  - **Images are framed, then fitted.** Any image the browser can open is cropped in a React Aria cropper (drag or arrow keys to move, slider, wheel, pinch or +/− to zoom, quarter turns), then resized and encoded with the browser's own canvas until it fits the app's formats and size. An image already in the account, or an untouched upload that already fits, is used as it is, so animation survives.
- **The homepage**, at `/`: a placeholder for now.
- **The resolve endpoint**: `GET /xrpc/social.omote.getProfile?actor=…&collection=…`, answered by [`@omote-social/profiles`][profiles] on every request. It is open to any origin, and a convenience for prototyping; apps should resolve profiles with the library in production.

## 🔧 Local Development

```bash
yarn dev        # the site with hot reload, at http://127.0.0.1:4321/editor/
yarn preview    # the built site and the Worker together, at http://127.0.0.1:8787/editor/
```

Sign-in works on this machine with no setup: ATProto's OAuth has a development exception for it, so any account can sign in to a local copy. The exception's client id is `http://localhost`, but bsky.social only redirects back to `127.0.0.1`, so both servers listen there and a page opened on `localhost` moves itself across.

`yarn dev` doesn't run the Worker; use `yarn preview` to try the resolve endpoint:

```bash
curl "http://127.0.0.1:8787/xrpc/social.omote.getProfile?actor=alice.example.com&collection=social.grain.actor.profile"
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
