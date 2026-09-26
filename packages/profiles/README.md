<div align="center">

# @omote-social/profiles

[![npm version][npm_badge]][npm]
[![CI status][ci_badge]][ci]

Resolve how an [ATProto][atproto] account appears in one app: its per-app override, merged over its base profile

</div>

---

## 📦 Installation

```bash
npm install @omote-social/profiles
```

```bash
yarn add @omote-social/profiles
```

Works in browsers, Node (22+) and Cloudflare Workers.

## 🔧 Usage

Pass an account (handle or DID) and your app's context, its reversed domain:

```ts
import { getProfile } from "@omote-social/profiles";

const profile = await getProfile("alice.example.com", "social.grain");

profile.displayName ?? `@${profile.handle}`; // show the handle when there's no name
profile.avatar; // a URL served by the account's own PDS
profile.sources; // { displayName: "override", description: "hidden", avatar: "base" }
```

`getProfile` reads the account's records straight from its own PDS:

- **Identity** resolves without any AppView: handles over DNS-over-HTTPS and `.well-known`, DIDs through PLC or `did:web`.
- **Images** are served by the account's own PDS, never a Bluesky CDN.

> [!NOTE]
>
> A record written by another app can be malformed. One that fails its schema is treated as missing, so a bad record costs that record rather than the whole profile. A blank display name counts as no name.

### Options

`getProfile(actor, context, options)` accepts:

| option     | type            | default             | purpose                                                                            |
| ---------- | --------------- | ------------------- | ---------------------------------------------------------------------------------- |
| `resolver` | `ActorResolver` | `defaultResolver()` | Resolves a handle or DID to its DID, handle and PDS. Reuse one across many lookups |
| `fetch`    | `typeof fetch`  | `globalThis.fetch`  | For proxies, instrumentation or tests                                              |
| `timeout`  | `number`        | `10000`             | Milliseconds to wait on each network call                                          |

### Result

| field                                               | type                             | notes                                                                 |
| --------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| `did`, `handle`                                     | `string`                         | Verified in both directions                                           |
| `context`                                           | `string`                         | As asked                                                              |
| `displayName`, `description`, `pronouns`, `website` | `string \| undefined`            | Absent when neither the override nor the base has a value             |
| `avatar`, `banner`                                  | `string \| undefined`            | Image URLs on the account's PDS                                       |
| `sources`                                           | `Partial<Record<Field, Source>>` | `override`, `base`, or `hidden` (in the base, hidden in this context) |

### Errors

Failures throw a `ProfileError` with a `code`:

| code                | meaning                                                                      |
| ------------------- | ---------------------------------------------------------------------------- |
| `InvalidActor`      | Not a handle or DID                                                          |
| `InvalidContext`    | Not a reversed domain (checked before any network call)                      |
| `ActorNotFound`     | The handle or DID doesn't resolve                                            |
| `RecordUnavailable` | The PDS failed, which is different from the account simply having no profile |

### Merging records yourself

If you already have the records, `mergeProfile(base, override)` applies the same rules without the network:

1. A field the override sets wins.
2. A field the override hides is left out.
3. Otherwise the base shows through.

## 🥂 License

Released under the [MIT license][license] © [Drake Costa][personal-website].

[npm_badge]: https://img.shields.io/npm/v/@omote-social/profiles.svg?style=flat
[npm]: https://www.npmjs.com/package/@omote-social/profiles
[ci_badge]: https://github.com/Saeris/omote/actions/workflows/ci.yml/badge.svg
[ci]: https://github.com/Saeris/omote/actions/workflows/ci.yml
[atproto]: https://atproto.com
[license]: ../../LICENSE
[personal-website]: https://saeris.gg
