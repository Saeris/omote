# General Rules of Contribution

These rules apply to every task in this project unless explicitly overridden.
Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

## Rule 1 — Think Before Coding

State assumptions explicitly. If uncertain, ask rather than guess.
Present multiple interpretations when ambiguity exists.
Push back when a simpler approach exists.
Stop when confused. Name what's unclear.

## Rule 2 — Simplicity First

Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

## Rule 3 — Surgical Changes

Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor what isn't broken. Match existing style.

## Rule 4 — Goal-Driven Execution

Define success criteria. Loop until verified.
Don't follow steps. Define success and iterate.
Strong success criteria let you loop independently.

## Rule 5 — Use the model only for judgment calls

Use me for: classification, drafting, summarization, extraction.
Do NOT use me for: routing, retries, deterministic transforms.
If code can answer, code answers.

## Rule 6 — Surface conflicts, don't average them

If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don't blend conflicting patterns.

## Rule 7 — Read before you write

Before adding code, read exports, immediate callers, shared utilities.
"Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.

## Rule 8 — Tests verify intent, not just behavior

Tests must encode WHY behavior matters, not just WHAT it does.
A test that can't fail when business logic changes is wrong.

## Rule 9 — Checkpoint after every significant step

Summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.
If you lose track, stop and restate.

## Rule 10 — Match the codebase's conventions, even if you disagree

Conformance > taste inside the codebase.
If you genuinely think a convention is harmful, surface it. Don't fork silently.

## Rule 11 — Fail loud

"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.

# Project: omote (per-app profiles for ATProto)

- **What it is:** one ATProto identity, presented differently per app. Each
  app's own profile record may name the records it builds on in an `extends`
  array, resolved like tsconfig's: later bases win, the record's own fields win,
  absent inherits, `null` hides. Records take part structurally (Bluesky's field
  names and types), never by referencing our lexicon. `social.omote.actor.profile`
  is the shared base and the template. The spec is `docs/spec.md`. Design notes: `docs/extensions.md` (app-specific extensions) and, in the taproom.social
  repo, `plan/taproom/24-per-app-profiles.md`.
- **Say what it is not:** these records are public. Per-app profiles separate
  presentations; they do not make them unlinkable. Never describe them as
  anonymity.
- **Layout** mirrors keytrace (github.com/orta/keytrace):
  - `packages/lexicon`: the lexicon JSON and its Valibot twins, held together by
    `lexicon-parity.test.ts`.
  - `packages/profiles`: `getProfile(actor, collection)` and the pure
    `resolveProfile`. This is the production path: apps resolve profiles from the
    records themselves.
  - `apps/omote.social`: the editor (Astro, with React only for forms) plus a
    Worker serving `social.omote.getProfile` over XRPC, for prototyping and
    convenience.
- **Stack:**
  - Yarn 4 (catalog in `.yarnrc.yml`) and Vite+.
  - atcute for all ATProto code.
  - Valibot schemas as the type source of truth.
  - React Aria, React Hook Form and TanStack Query in the editor.
  - Vitest, with MSW mocking the network at the fetch boundary. Test files
    live in a `__tests__/` folder beside the code they test, and JSON is
    imported `with { type: "json" }` so TypeScript types it, never cast.
  - Cloudflare Workers for hosting.
- **No third party in the identity path:** handles resolve over DNS-over-HTTPS
  and `.well-known`, DIDs via PLC or did:web, and images come from the account's
  own PDS, never a Bluesky CDN.
- **Releases:** Bumpy (`.bumpy/`). A PR that changes a published package adds a
  bump file (`yarn bumpy add`); the release workflow opens a version PR, and
  merging it publishes. Published packages keep `main`/`exports` on `src/` for
  the workspace; `publishConfig` swaps in `dist/` when Yarn packs. The site is
  private: Cloudflare Workers Builds deploys it (see its README), not GitHub.
- **Local editor:** `yarn dev` (Astro, hot reload) at `http://127.0.0.1:4321/editor/`;
  `yarn preview` adds the Worker. Sign-in redirects to 127.0.0.1, never
  `localhost`: bsky.social refuses a `localhost` redirect (RFC 8252) while Cirrus
  accepts one, so testing only against Cirrus hides the bug.
- **Site routes:** `/` is the marketing page (structured after keytrace.dev;
  tailark.com is the code reference for the design pass), `/docs/` the
  developer docs (Starlight, inside the same Astro site; pages in
  `src/content/docs/docs/`), `/editor/` the signed-in editor.
- **Docs writing style:** Astro's guide
  (contribute.docs.astro.build/guides/writing-style/): neutral and factual,
  imperative, no "we/us/let's", explain before showing code, short headings
  without end punctuation.
- **Editing other apps' records:** permission per collection on first edit
  (`src/scope.ts` lists what the client metadata declares), and every write
  follows that app's resolved lexicon (`src/editor/shape.ts`).
- Do not use `vp install` to bootstrap: it writes a pnpm `devEngines` block that
  fights Yarn. Use `yarn install`.

# Using Vite+, the Unified Toolchain for the Web

This project uses Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task, through a single global CLI called `vp`. Run `vp help` for commands; docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `yarn install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
