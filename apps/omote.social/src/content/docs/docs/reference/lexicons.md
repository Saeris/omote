---
title: Lexicons
description: Reference for social.omote.actor.profile and social.omote.getProfile, and the @omote-social/lexicon package.
sidebar:
  order: 2
---

The `@omote-social/lexicon` package ships Omote's lexicons as JSON, with [Valibot](https://valibot.dev) schemas for them.

```sh
npm install @omote-social/lexicon valibot
```

## `social.omote.actor.profile`

A record at key `literal:self`. It has two jobs:

- **The shared profile.** It belongs to the account holder, not to an app, so any app may write it when the person chooses to change something everywhere.
- **The template.** An app adopting Omote copies it into its own namespace.

| Field         | Type       | Limits                              | Description                                                                              |
| ------------- | ---------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `extends`     | `nsid[]`   | Up to 8                             | The collections whose `self` records this builds on. Later entries win                   |
| `displayName` | `string`   | 64 graphemes                        | `null` hides what the bases say                                                          |
| `description` | `string`   | 256 graphemes                       | The bio. `null` hides                                                                    |
| `pronouns`    | `string`   | 20 graphemes                        | `null` hides                                                                             |
| `website`     | `string`   | URI                                 | `null` hides                                                                             |
| `avatar`      | `blob`     | PNG, JPEG, GIF, WebP or AVIF; 10 MB | Animated formats are allowed; whether to animate them is each app's choice. `null` hides |
| `banner`      | `blob`     | PNG, JPEG, GIF, WebP or AVIF; 10 MB | `null` hides                                                                             |
| `createdAt`   | `datetime` | Optional                            |                                                                                          |

The text limits are Bluesky's, so everything in the shared profile fits every app that copied Bluesky's profile. The image formats and size match Discord's.

The JSON is at `@omote-social/lexicon/lexicons/social/omote/actor/profile.json`.

## `social.omote.getProfile`

A query returning an account's profile as one app shows it. See the [resolve endpoint](/docs/reference/endpoint/).

| Parameter    | Type                     | Description                         |
| ------------ | ------------------------ | ----------------------------------- |
| `actor`      | `string` (at-identifier) | A handle or DID                     |
| `collection` | `string` (nsid)          | The app's profile record collection |

It returns the same `ProfileView` as [`getProfile()`](/docs/reference/profiles/#result).

## Package exports

| Export                                  | Description                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `NSID_BASE_PROFILE`, `NSID_GET_PROFILE` | `"social.omote.actor.profile"`, `"social.omote.getProfile"`                                |
| `NSID_BSKY_PROFILE`                     | `"app.bsky.actor.profile"`                                                                 |
| `FIELDS`                                | The six shared fields, in display order                                                    |
| `MAX_EXTENDS`                           | How many bases one record may name (8)                                                     |
| `IMAGE_TYPES`, `MAX_IMAGE_BYTES`        | The shared profile's image formats, and its 10 MB limit                                    |
| `baseProfileSchema`                     | `social.omote.actor.profile`, keeping fields it doesn't know                               |
| `nsidSchema`                            | A collection's NSID                                                                        |
| `blobSchema`                            | A blob reference, read tolerantly and written in its canonical `{ $type: "blob", … }` form |
| `ProfileView`, `Field`, `Source`        | Types for a resolved profile                                                               |

To read other apps' records, which follow their own lexicons, use [`readProfileRecord()`](/docs/reference/profiles/#readprofilerecord) instead of `baseProfileSchema`.
