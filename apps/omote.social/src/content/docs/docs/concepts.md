---
title: How profiles extend
description: Shared fields, the extends field, how a chain of records resolves, and how null hides a field.
---

A profile in Omote is not one record but a chain of them. This page explains the parts of that chain and the rules for folding it into the profile an app shows.

## Profile records

A profile record describes how an account appears in one app. It lives in the account's repository at the record key `self`, in the app's own collection (for example, `app.bsky.actor.profile` or `social.grain.actor.profile`).

A record that names other records in `extends` builds on them. The records it names are its **bases**. A record with no `extends` is a **root**: it inherits nothing. Bluesky's profile is a root, and for most accounts it is the one everything else builds on.

## Shared fields

Bluesky's profile is the template. Its identity fields are the shared fields, with its names and types:

| Field         | Type           | Bluesky's limit   |
| ------------- | -------------- | ----------------- |
| `displayName` | string         | 64 graphemes      |
| `description` | string         | 256 graphemes     |
| `pronouns`    | string         | 20 graphemes      |
| `website`     | string (`uri`) | none              |
| `avatar`      | blob (image)   | PNG or JPEG, 1 MB |
| `banner`      | blob (image)   | PNG or JPEG, 1 MB |

A record takes part field by field, by name and type, the way TypeScript checks an object against `Partial<Profile>`:

- A field with a shared name and the shared type takes part. Every shared field is optional, so a record that has only a name and an avatar still takes part.
- A field with a shared name but a different type is ignored.
- A field with a different name never takes part, even if it means the same thing. Sifa's `about` is not a `description`.
- Limits are not part of the type. A record may allow a longer bio than Bluesky does, and values cross records whatever their limits. An app shortens a long value for display; it never saves a shortened copy.
- Everything else in a record is the app's own and never crosses records.

## The `extends` field

`extends` is an array of collection names (NSIDs), up to eight. Each names a base: that collection's `self` record in the same repository.

```json
"extends": ["app.bsky.actor.profile", "social.omote.actor.profile"]
```

- **An absent or empty `extends` makes a root.** A record never inherits implicitly, so whether it inherits can always be read from the record.
- **Entries are collections, not AT-URIs.** A profile only inherits from the same account.
- **It is an array from the start.** TypeScript's `extends` changed from a string to an array in version 5.0; for records already in the wild, the same change would break every reader.

## How a chain resolves

Resolving a profile folds its chain into one set of fields.

1. **Collect the chain.** Visit the record: visit each of its bases in `extends` order, then add the record itself. Never visit a record twice. Skip a base the account doesn't have, and stop following bases past a depth of 8 or after 16 records.
2. **Fold it, from the first record collected to the last.** For each shared field:
   - a value replaces what came before;
   - `null` removes what came before;
   - an absent field changes nothing.

For example:

| Record                                          | `displayName` | `description`    | `avatar` |
| ----------------------------------------------- | ------------- | ---------------- | -------- |
| `app.bsky.actor.profile` (a root)               | Alice         | Posting about... | image A  |
| `social.omote.actor.profile`, extending Bluesky | Alice Mori    |                  |          |
| `social.grain.actor.profile`, extending both    |               | `null`           |          |
| **Grain shows**                                 | Alice Mori    | nothing          | image A  |

Later bases win over earlier ones, and a record's own fields win over all of its bases, as in `tsconfig.json`.

### A base reached twice

Unlike `tsconfig.json`, a base reached through two parents applies once, not twice. Suppose Grain extends `["social.omote.actor.profile", "app.bsky.actor.profile"]`, and the shared profile itself extends Bluesky's. TypeScript would apply Bluesky's profile a second time, last, and its name would win over the shared profile's. Omote applies each record once, after all of its own bases, so a record always wins over everything it builds on.

## Hiding a field

Set a shared field to `null` to hide what the bases say. `null` is only meaningful when there was a value to hide, and it only works in records whose lexicon declares the field `nullable`.

## Missing records

- **A missing base is skipped.** Naming the shared profile costs nothing for an account that doesn't have one.
- **A missing starting record uses the app's default.** For someone who has never used the app, resolve as if its record existed with the app's default `extends`. Apps should default to `["app.bsky.actor.profile", "social.omote.actor.profile"]`.

## The shared profile

`social.omote.actor.profile` is a profile that belongs to the account holder rather than to any app. Any app may write it, when the person chooses to change something everywhere. An account that started outside Bluesky can use it as its root.

Its lexicon is also the template: an app adopting Omote copies it into its own namespace. See [Adopt Omote in your app](/docs/guides/adopt/).
