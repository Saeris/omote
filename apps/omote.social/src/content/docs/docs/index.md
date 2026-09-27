---
title: Overview
description: What Omote is, the problem it solves, and where to start.
---

Omote lets each app's profile of an ATProto account build on the account's other profiles, and shows the account holder where every field comes from.

## The problem

An ATProto account is one identity across every app, but its profile is not. Apps keep their own profile records beside Bluesky's `app.bsky.actor.profile`, and nothing tells the account holder which app reads which.

The apps already agree on the shape of a profile. Grain's profile lexicon, for example, is Bluesky's with three fields removed. What they cannot say is where a value comes from when their own record doesn't have it. So nobody can tell whether changing a display name on Bluesky changes it anywhere else.

## How Omote answers it

Omote adds one optional field to an app's own profile record: `extends`, a list of the profile records it builds on.

```json title="social.grain.actor.profile/self"
{
  "$type": "social.grain.actor.profile",
  "extends": ["app.bsky.actor.profile", "social.omote.actor.profile"],
  "displayName": "Alice (photos)",
  "description": null
}
```

The record resolves the way a `tsconfig.json` resolves its `extends`:

- later bases win over earlier ones;
- the record's own fields win over all of them;
- a field the record leaves out is inherited;
- `null` hides what the bases say.

A record takes part by its shape. Fields with Bluesky's names and types are shared, and everything else stays the app's own. No app's lexicon has to reference Omote's.

## What Omote provides

- **Lexicons** (`@omote-social/lexicon`): `social.omote.actor.profile`, a shared profile that belongs to the account holder rather than to any app. It is also the template an app copies to adopt the pattern.
- **A library** (`@omote-social/profiles`): `getProfile()` resolves how an account appears in an app, reading straight from the account's own server. It works in browsers, Node and Cloudflare Workers.
- **An editor** ([omote.social/editor](/editor/)): shows every profile record in an account and where each field comes from, and edits each one within that app's own rules.
- **A resolve endpoint**: `social.omote.getProfile`, the library's answer over XRPC, for prototyping.

:::note
Profile records are public, like everything else in an ATProto repository. A different profile in each app changes how the account appears there; it doesn't hide that it's the same account.
:::

## Where to go next

- Learn [how profiles extend](/docs/concepts/), including the rules every implementation follows.
- [Adopt Omote in your app](/docs/guides/adopt/).
- [Show profiles in your app](/docs/guides/resolve/) with the library.
- Read the full [specification](https://github.com/Saeris/omote/blob/main/docs/spec.md), including the questions still open for adopting apps.
