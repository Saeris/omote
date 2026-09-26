<div align="center">

# @omote-social/profiles

[![npm version][npm_badge]][npm]
[![CI status][ci_badge]][ci]

Resolve how an [ATProto][atproto] account appears in one app: that app's profile record, folded over the records it extends

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

Pass an account (handle or DID) and your app's profile record collection:

```ts
import { getProfile } from "@omote-social/profiles";

const profile = await getProfile("alice.example.com", "social.grain.actor.profile");

profile.displayName ?? `@${profile.handle}`; // show the handle when there's no name
profile.avatar; // a URL served by the account's own PDS
profile.sources.description; // { collection: "social.grain.actor.profile", hidden: true }
profile.chain; // ["app.bsky.actor.profile", "social.omote.actor.profile", "social.grain.actor.profile"]
```

`getProfile` reads your collection's `self` record from the account's own PDS, then every record its `extends` chain reaches, and folds them as TypeScript folds `extends`:

- **later bases win** over earlier ones, and **the record's own fields win** over all;
- **an absent field is inherited**, and **`null` hides** what the bases say;
- **a base reached twice applies once**, before everything built on it, so it can't undo the record that overrode it (this is where it differs from tsconfig);
- **a record without `extends` is a root**: it never inherits implicitly.

It also:

- **resolves identity without any AppView**: handles over DNS-over-HTTPS and `.well-known`, DIDs through PLC or `did:web`;
- **serves images from the account's own PDS**, never a Bluesky CDN.

> [!NOTE]
>
> Other apps' records follow their own lexicons, so they are read by shape: a field with a shared name and type takes part, and anything else is ignored rather than failing the record. A blank string is absent, and a website that isn't an `http(s)` link is dropped.

### Options

`getProfile(actor, collection, options)` accepts:

| option           | type            | default                                                    | purpose                                                                            |
| ---------------- | --------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `defaultExtends` | `string[]`      | `["app.bsky.actor.profile", "social.omote.actor.profile"]` | The bases to use for someone with no record in your app yet                        |
| `resolver`       | `ActorResolver` | `defaultResolver()`                                        | Resolves a handle or DID to its DID, handle and PDS. Reuse one across many lookups |
| `fetch`          | `typeof fetch`  | `globalThis.fetch`                                         | For proxies, instrumentation or tests                                              |
| `timeout`        | `number`        | `10000`                                                    | Milliseconds to wait on each network call                                          |

### Result

| field                                               | type                             | notes                                                              |
| --------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| `did`, `handle`                                     | `string`                         | Verified in both directions                                        |
| `collection`                                        | `string`                         | As asked                                                           |
| `displayName`, `description`, `pronouns`, `website` | `string \| undefined`            | Absent when no record in the chain has a value, or one hid it      |
| `avatar`, `banner`                                  | `string \| undefined`            | Image URLs on the account's PDS                                    |
| `sources`                                           | `Partial<Record<Field, Source>>` | The record each field came from, or `{ collection, hidden: true }` |
| `chain`                                             | `string[]`                       | The records applied, lowest precedence first                       |

### Errors

Failures throw a `ProfileError` with a `code`:

| code                | meaning                                                                      |
| ------------------- | ---------------------------------------------------------------------------- |
| `InvalidActor`      | Not a handle or DID                                                          |
| `InvalidCollection` | Not an NSID (checked before any network call)                                |
| `ActorNotFound`     | The handle or DID doesn't resolve                                            |
| `RecordUnavailable` | The PDS failed, which is different from the account simply having no profile |

### Resolving records yourself

If you already have the records, `resolveProfile(records, collection)` applies the same rules without the network; `records` maps each collection to its `self` record. `loadChain(collection, load)` fetches exactly the records a chain reaches, given a function that loads one, and `readProfileRecord(value)` reads one record's shared fields and bases.

## 🥂 License

Released under the [MIT license][license] © [Drake Costa][personal-website].

[npm_badge]: https://img.shields.io/npm/v/@omote-social/profiles.svg?style=flat
[npm]: https://www.npmjs.com/package/@omote-social/profiles
[ci_badge]: https://github.com/Saeris/omote/actions/workflows/ci.yml/badge.svg
[ci]: https://github.com/Saeris/omote/actions/workflows/ci.yml
[atproto]: https://atproto.com
[license]: ../../LICENSE
[personal-website]: https://saeris.gg
