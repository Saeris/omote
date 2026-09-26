# omote

**Per-app profiles for ATProto.** Your ATProto identity is universal: one account, one handle, every app. How you present yourself shouldn't have to be. omote lets you choose how you appear in each app, a professional face in one place and a casual one in another, while your identity stays one.

_Omote_ (表) is the face you show: the front of a thing, and the word for a Noh mask.

## How it works

Your base profile is your `app.bsky.actor.profile`, if you have one. For any app, you can add a `social.omote.profile` record, keyed by that app's reversed domain (e.g. `social.taproom`), that:

- **overrides** only what should differ there (display name, bio, pronouns, website, avatar, banner);
- **hides** base fields you'd rather not show there.

Everything else falls through to your base profile. An app that shows omote profiles resolves them straight from your PDS, with no service in between.

These records are **public**, like everything in your repository. Overrides let you present differently; they do not make those presentations unlinkable. For that, use a separate account.

## Packages

| Package                                         | What it is                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`@omote-social/lexicon`](./packages/lexicon)   | The `social.omote.*` lexicons and their Valibot schemas                                               |
| [`@omote-social/profiles`](./packages/profiles) | `getProfile(actor, context)`: resolve how an account appears in an app, in browsers, Node and Workers |
| [`omote.social`](./apps/omote.social)           | The profile editor, and a `social.omote.getProfile` XRPC endpoint for prototyping                     |

```ts
import { getProfile } from "@omote-social/profiles";

const profile = await getProfile("alice.example.com", "social.taproom");
// { did, handle, context, displayName?, description?, pronouns?, website?, avatar?, banner?, sources }
```

## Development

```sh
yarn install
vp check
vp test
```

MIT licensed.
