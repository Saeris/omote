<div align="center">

# Omote

[![CI status][ci_badge]][ci]
[![@omote-social/lexicon][lexicon_badge]][lexicon_npm]
[![@omote-social/profiles][profiles_badge]][profiles_npm]

Per-app profiles for [ATProto][atproto]: one identity, and the face you choose to show in each app.

</div>

---

In Noh theatre, the masks the performers wear are called _omote_ (表), "the face". One performer takes up a different mask for each role, and the audience still knows who is underneath.

Your ATProto account works the same way. It is one identity, and its handle signs you in to any app in the Atmosphere. But the profile you'd show your company's team, your photography followers or a game's lobby need not be the same one. Omote lets you set how you appear in each app. Anything you don't set falls back to your base profile.

## 🔧 How It Works

Your base profile is your `app.bsky.actor.profile`, if you have one. For any app, you can add a `social.omote.profile` record, keyed by that app's reversed domain (`social.grain` for [Grain][grain], the photo-sharing app), that:

- **overrides** only what should differ there: display name, bio, pronouns, website, avatar or banner;
- **hides** base fields you'd rather not show there.

An app that supports Omote resolves your profile straight from your PDS, with no service in between.

```ts
import { getProfile } from "@omote-social/profiles";

const profile = await getProfile("alice.example.com", "social.grain");
// { did, handle, context, displayName?, description?, pronouns?, website?, avatar?, banner?, sources }
```

> [!IMPORTANT]
>
> Like everything in your repository, these records are **public**. An override changes how you _appear_ in an app; it doesn't hide that it's you. To keep two identities apart, use two accounts.

## 📦 Packages

| Package                                              | Description                                                                                           |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`@omote-social/lexicon`](./packages/lexicon)        | The `social.omote.*` lexicons and their [Valibot][valibot] schemas                                    |
| [`@omote-social/profiles`](./packages/profiles)      | `getProfile(actor, context)`: resolve how an account appears in an app, in browsers, Node and Workers |
| [`omote.social`](./apps/omote.social) _(not on npm)_ | The profile editor, and a `social.omote.getProfile` XRPC endpoint                                     |

## 🤝 Contributing

The project uses [Vite+][viteplus] as a unified toolchain (Oxlint + Oxfmt + tsdown + Vitest) and [Bumpy][bumpy] for versioning and release.

```bash
yarn install         # install dependencies
yarn dev             # run the editor locally, at http://localhost:4321
vp check --fix       # format + lint + typecheck (with autofixes)
vp test              # run Vitest
yarn bumpy add       # create a bump file for your PR
```

The baseline, including the resolution rules every implementation must match and the choices still open, is drafted in [`docs/spec.md`](./docs/spec.md). Design notes for layering app-specific customisation (decorations, name styles, widgets) on top of the base profile live in [`docs/extensions.md`](./docs/extensions.md).

## 📣 Acknowledgements

The package layout follows [keytrace][keytrace], which links ATProto identities to accounts elsewhere. Its claims are a natural companion to a profile.

## 🥂 License

Released under the [MIT license][license] © [Drake Costa][personal-website].

[ci_badge]: https://github.com/Saeris/omote/actions/workflows/ci.yml/badge.svg
[ci]: https://github.com/Saeris/omote/actions/workflows/ci.yml
[lexicon_badge]: https://img.shields.io/npm/v/@omote-social/lexicon.svg?style=flat&label=lexicon
[lexicon_npm]: https://www.npmjs.com/package/@omote-social/lexicon
[profiles_badge]: https://img.shields.io/npm/v/@omote-social/profiles.svg?style=flat&label=profiles
[profiles_npm]: https://www.npmjs.com/package/@omote-social/profiles
[atproto]: https://atproto.com
[grain]: https://grain.social
[valibot]: https://valibot.dev
[viteplus]: https://viteplus.dev/
[bumpy]: https://bumpy.varlock.dev/
[keytrace]: https://keytrace.dev
[license]: ./LICENSE
[personal-website]: https://saeris.gg
