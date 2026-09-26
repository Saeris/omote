<div align="center">

# @omote-social/lexicon

[![npm version][npm_badge]][npm]
[![CI status][ci_badge]][ci]

The `social.omote` [lexicons][lexicon] for per-app ATProto profiles, and their [Valibot][valibot] schemas

</div>

---

## 📦 Installation

```bash
npm install @omote-social/lexicon valibot
```

```bash
yarn add @omote-social/lexicon valibot
```

To resolve profiles rather than read records yourself, use [`@omote-social/profiles`][profiles], which builds on this package.

## 📜 Lexicons

The JSON lexicons ship with the package, under `@omote-social/lexicon/lexicons/social/omote/`.

### `social.omote.profile`

A record describing how the account holder appears in **one context**. The record key names the context: an app, by the reversed domain its own lexicons live under (e.g. `social.grain` for [Grain][grain], the photo-sharing app). The record is sparse: a field it leaves out falls back to the account's base profile (`app.bsky.actor.profile`).

| Field         | Type       | Limits                              | Notes                                                                                   |
| ------------- | ---------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| `displayName` | `string`   | 64 graphemes                        |                                                                                         |
| `description` | `string`   | 256 graphemes                       | The bio                                                                                 |
| `pronouns`    | `string`   | 20 graphemes                        |                                                                                         |
| `website`     | `string`   | URI                                 |                                                                                         |
| `avatar`      | `blob`     | PNG, JPEG, GIF, WebP or AVIF; 10 MB | Animated formats are allowed; whether to animate is each app's choice                   |
| `banner`      | `blob`     | PNG, JPEG, GIF, WebP or AVIF; 10 MB |                                                                                         |
| `hide`        | `string[]` | Any of the six fields above         | Base fields not to show in this context. A field set on this record is shown regardless |
| `createdAt`   | `datetime` | Required                            | When this context's profile was first made                                              |

The formats and ceiling match Discord's. Your own PDS may refuse large uploads: the reference PDS defaults to 5 MB.

### `social.omote.getProfile`

A query returning an account's profile as it appears in one context: `actor` (handle or DID) and `context` (the reversed domain) in, the merged profile out, with a `sources` map saying where each field came from (`override`, `base` or `hidden`).

## 🔧 Usage

```ts
import * as v from "valibot";
import { NSID_PROFILE, contextSchema, profileOverrideSchema } from "@omote-social/lexicon";

// Parse a record someone else wrote. Unknown `hide` values are kept, since knownValues are open.
const override = v.parse(profileOverrideSchema, record.value);

// Is this a valid context (and so a valid record key)?
v.is(contextSchema, "social.grain"); // true
v.is(contextSchema, "grain"); // false
```

### Exports

| Export                             | Description                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| `NSID_PROFILE`, `NSID_GET_PROFILE` | `"social.omote.profile"`, `"social.omote.getProfile"`                                               |
| `NSID_BSKY_PROFILE`                | `"app.bsky.actor.profile"`, the base every override falls back to                                   |
| `FIELDS`                           | The six fields an override can set or hide, in display order                                        |
| `IMAGE_TYPES`, `MAX_IMAGE_BYTES`   | Accepted image media types, and the 10 MB ceiling                                                   |
| `contextSchema`                    | A context: an app's reversed domain, which is also a valid record key                               |
| `profileOverrideSchema`            | `social.omote.profile`                                                                              |
| `baseProfileSchema`                | The parts of `app.bsky.actor.profile` a base contributes; lenient, since it is another app's record |
| `blobSchema`                       | A blob reference, read tolerantly and normalised to the canonical `{ $type: "blob", … }` shape      |
| `ProfileView`, `Field`, `Source`   | Types for a resolved profile                                                                        |

## 🥂 License

Released under the [MIT license][license] © [Drake Costa][personal-website].

[npm_badge]: https://img.shields.io/npm/v/@omote-social/lexicon.svg?style=flat
[npm]: https://www.npmjs.com/package/@omote-social/lexicon
[ci_badge]: https://github.com/Saeris/omote/actions/workflows/ci.yml/badge.svg
[ci]: https://github.com/Saeris/omote/actions/workflows/ci.yml
[lexicon]: https://atproto.com/specs/lexicon
[valibot]: https://valibot.dev
[grain]: https://grain.social
[profiles]: ../profiles
[license]: ../../LICENSE
[personal-website]: https://saeris.gg
