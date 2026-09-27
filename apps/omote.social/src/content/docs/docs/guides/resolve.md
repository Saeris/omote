---
title: Show profiles in your app
description: Resolve how an account appears in your app with @omote-social/profiles.
sidebar:
  order: 2
---

`@omote-social/profiles` resolves how an account appears in your app: it reads your profile record and every record it extends from the account's own server, and folds them. No AppView is involved, Bluesky's or Omote's.

## Install the library

```sh
npm install @omote-social/profiles
```

It works in browsers, Node 22 or later, and Cloudflare Workers.

## Resolve a profile

Pass an account (a handle or DID) and your app's profile collection to `getProfile()`:

```ts
import { getProfile } from "@omote-social/profiles";

const profile = await getProfile("alice.example.com", "social.grain.actor.profile");
```

The result holds the resolved fields and where each came from:

```json
{
  "did": "did:plc:…",
  "handle": "alice.example.com",
  "collection": "social.grain.actor.profile",
  "displayName": "Alice Mori",
  "avatar": "https://pds.example.com/xrpc/com.atproto.sync.getBlob?did=…&cid=…",
  "sources": {
    "displayName": { "collection": "social.omote.actor.profile" },
    "description": { "collection": "social.grain.actor.profile", "hidden": true },
    "avatar": { "collection": "app.bsky.actor.profile" }
  },
  "chain": ["app.bsky.actor.profile", "social.omote.actor.profile", "social.grain.actor.profile"]
}
```

## Display the result

- **Show the handle when there is no name.** `displayName` is absent when no record in the chain has one, or when one hides it.
- **Load images from the URLs given.** `avatar` and `banner` are served by the account's own server, not by any one app's CDN.
- **Treat every value as untrusted text.** The library already drops a `website` that isn't an `http:` or `https:` link, but other fields are shown as the person wrote them.

## Choose a default for new people

Someone who has never used your app has no record in it. `getProfile()` then resolves as if their record existed with `defaultExtends`, which is Bluesky's profile followed by the shared profile unless you pass another:

```ts
await getProfile(actor, "social.grain.actor.profile", {
  defaultExtends: ["social.omote.actor.profile"],
});
```

## Handle failures

`getProfile()` throws a `ProfileError` whose `code` says what went wrong. A missing profile is not an error, but an unreachable server is:

```ts
import { getProfile, ProfileError } from "@omote-social/profiles";

try {
  return await getProfile(actor, collection);
} catch (error) {
  if (error instanceof ProfileError && error.code === "RecordUnavailable") {
    // The account's server didn't answer. Try again later.
  }
  throw error;
}
```

See the [library reference](/docs/reference/profiles/) for every code.

## Resolve records you already have

If your app already stores the records, for example from the firehose, resolve them without the network:

```ts
import { resolveProfile } from "@omote-social/profiles";

const records = new Map([
  ["app.bsky.actor.profile", bskyRecord],
  ["social.grain.actor.profile", grainRecord],
]);

const { fields, sources, chain } = resolveProfile(records, "social.grain.actor.profile");
```

`resolveProfile()` applies exactly the same rules as `getProfile()`.

## Use the endpoint instead

For prototyping, omote.social answers the same question over XRPC. See the [resolve endpoint](/docs/reference/endpoint/). In production, resolve with the library so no service sits between your app and the account.
