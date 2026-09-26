<div align="center">

# @omote-social/lexicon

[![npm version][npm_badge]][npm]
[![CI status][ci_badge]][ci]

The `social.omote` [lexicons][lexicon] for ATProto profiles that extend, and their [Valibot][valibot] schemas

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

### `social.omote.actor.profile`

A record, at key `self`, with two jobs:

- **The shared base.** A profile that belongs to the account holder rather than to any app, so any app may write it. Other apps' profile records name it in `extends` to build on it.
- **The template.** To adopt the pattern, copy [`actor/profile.json`](./lexicons/social/omote/actor/profile.json) into your own namespace (`social.grain.actor.profile`, say), change `id`, adjust the limits, and add your own fields.

| Field         | Type       | Limits                              | Notes                                                                                  |
| ------------- | ---------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| `extends`     | `nsid[]`   | Up to 8                             | The collections whose `self` records this builds on. Later entries win. Absent: a root |
| `displayName` | `string`   | 64 graphemes                        | `null` hides what the bases say                                                        |
| `description` | `string`   | 256 graphemes                       | The bio. `null` hides                                                                  |
| `pronouns`    | `string`   | 20 graphemes                        | `null` hides                                                                           |
| `website`     | `string`   | URI                                 | `null` hides                                                                           |
| `avatar`      | `blob`     | PNG, JPEG, GIF, WebP or AVIF; 10 MB | Animated formats are allowed; whether to animate is each app's choice. `null` hides    |
| `banner`      | `blob`     | PNG, JPEG, GIF, WebP or AVIF; 10 MB | `null` hides                                                                           |
| `createdAt`   | `datetime` | Optional                            |                                                                                        |

The six profile fields have Bluesky's names and types, which is what lets any profile record take part: inheritance is structural, not by reference to this lexicon. The text limits are Bluesky's too; the image formats and ceiling are Discord's. Your own PDS may refuse large uploads: the reference PDS defaults to 5 MB.

### `social.omote.getProfile`

A query returning an account's profile as one app shows it: `actor` (handle or DID) and `collection` (the app's profile record, e.g. `social.grain.actor.profile`) in; the resolved profile out, with a `sources` map naming the record each field came from or the one that hid it, and the `chain` of records applied.

## 🔧 Usage

```ts
import * as v from "valibot";
import { baseProfileSchema } from "@omote-social/lexicon";

// Check a shared base before writing it. Fields this version doesn't know are kept.
const record = v.parse(baseProfileSchema, {
  extends: ["app.bsky.actor.profile"],
  displayName: "Alice M.",
  description: null,
});
```

To read _other_ apps' records, which follow their own lexicons, use `readProfileRecord` from [`@omote-social/profiles`][profiles]: it reads the shared fields by shape and ignores the rest.

### Exports

| Export                                  | Description                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `NSID_BASE_PROFILE`, `NSID_GET_PROFILE` | `"social.omote.actor.profile"`, `"social.omote.getProfile"`                                    |
| `NSID_BSKY_PROFILE`                     | `"app.bsky.actor.profile"`: the template, and the root most accounts have today                |
| `FIELDS`                                | The six shared fields, in display order                                                        |
| `MAX_EXTENDS`                           | How many bases one record may name (8)                                                         |
| `IMAGE_TYPES`, `MAX_IMAGE_BYTES`        | Accepted image media types, and the 10 MB ceiling                                              |
| `baseProfileSchema`                     | `social.omote.actor.profile`, keeping unknown fields                                           |
| `nsidSchema`                            | A collection's NSID                                                                            |
| `blobSchema`                            | A blob reference, read tolerantly and normalised to the canonical `{ $type: "blob", … }` shape |
| `ProfileView`, `Field`, `Source`        | Types for a resolved profile                                                                   |

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
