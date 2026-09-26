<div align="center">

# Omote

[![CI status][ci_badge]][ci]
[![@omote-social/lexicon][lexicon_badge]][lexicon_npm]
[![@omote-social/profiles][profiles_badge]][profiles_npm]

Profiles that extend, for [ATProto][atproto]: one identity, and the face you choose to show in each app.

</div>

---

In Noh theatre, the masks the performers wear are called _omote_ (表), "the face". One performer takes up a different mask for each role, and the audience still knows who is underneath.

Your ATProto account works the same way. It is one identity, and its handle signs you in to any app in the Atmosphere. But the profile you'd show your company's team, your photography followers or a game's lobby need not be the same one. Omote lets each app's profile of you build on the ones you already have, the way a `tsconfig.json` extends a shared config, and shows you where every field comes from.

## 🔧 How It Works

Apps already keep their own profile records, and most copy the shape of Bluesky's. Omote adds one optional field to them, `extends`, naming the profile records they build on:

```jsonc
// social.grain.actor.profile/self, in the account's own repository
{
  "extends": ["app.bsky.actor.profile", "social.omote.actor.profile"],
  "displayName": "Drake (photos)", // set here: wins over every base
  "description": null, // hidden here, whatever the bases say
}
```

It resolves the way TypeScript resolves `extends`:

- **later bases win** over earlier ones;
- **the record's own fields win** over all of them;
- **an absent field is inherited**, and `null` hides it.

A record takes part by its shape, not by referencing Omote: fields with Bluesky's names and types are shared, and everything else stays the app's own. [Grain][grain]'s lexicon already has that shape.

`social.omote.actor.profile` is a shared base that belongs to you rather than to any app, so "change it everywhere" has somewhere to go that isn't Bluesky's record. Its lexicon doubles as the template apps copy.

An app resolves your profile straight from your PDS, with no service in between:

```ts
import { getProfile } from "@omote-social/profiles";

const profile = await getProfile("alice.example.com", "social.grain.actor.profile");
// { did, handle, collection, displayName?, description?, pronouns?, website?, avatar?, banner?, sources, chain }
```

> [!IMPORTANT]
>
> Like everything in your repository, these records are **public**. A per-app profile changes how you _appear_ in an app; it doesn't hide that it's you. To keep two identities apart, use two accounts.

## 📦 Packages

| Package                                              | Description                                                                                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@omote-social/lexicon`](./packages/lexicon)        | The `social.omote.*` lexicons and their [Valibot][valibot] schemas                                                                           |
| [`@omote-social/profiles`](./packages/profiles)      | `getProfile(actor, collection)`: resolve how an account appears in an app, in browsers, Node and Workers                                     |
| [`omote.social`](./apps/omote.social) _(not on npm)_ | The editor: every profile in your account, where each field comes from, and your shared base. Plus a `social.omote.getProfile` XRPC endpoint |

## 🤝 Contributing

The project uses [Vite+][viteplus] as a unified toolchain (Oxlint + Oxfmt + tsdown + Vitest) and [Bumpy][bumpy] for versioning and release.

```bash
yarn install         # install dependencies
yarn dev             # run the editor locally, at http://localhost:4321
vp check --fix       # format + lint + typecheck (with autofixes)
vp test              # run Vitest
yarn bumpy add       # create a bump file for your PR
```

The spec, including the resolution rules every implementation must match, the path to a community lexicon, the choices still open and how it answers earlier proposals, is drafted in [`docs/spec.md`](./docs/spec.md). Design notes for app-specific customisation beyond the shared fields (decorations, name styles, widgets) live in [`docs/extensions.md`](./docs/extensions.md).

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
