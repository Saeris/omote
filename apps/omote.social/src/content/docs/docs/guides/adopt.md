---
title: Adopt Omote in your app
description: Let your app's profile record build on the account's other profiles, and write it in a way other editors can rely on.
sidebar:
  order: 1
---

Adopting Omote lets your app's profile build on the profiles a person already has, instead of starting blank or copying values that drift. It takes two additions to your lexicon and a few rules for writing the record.

## Add `extends` to your lexicon

Add an `extends` property to your profile record's lexicon. Copy it exactly: its name and type are what other readers look for.

```json title="lexicons/com/example/actor/profile.json" ins={11-15}
{
  "lexicon": 1,
  "id": "com.example.actor.profile",
  "defs": {
    "main": {
      "type": "record",
      "key": "literal:self",
      "record": {
        "type": "object",
        "properties": {
          "extends": {
            "type": "array",
            "maxLength": 8,
            "items": { "type": "string", "format": "nsid" }
          },
          "displayName": { "type": "string", "maxGraphemes": 64, "maxLength": 640 }
        }
      }
    }
  }
}
```

An optional property is a backward-compatible change under Lexicon's rules, so existing records stay valid.

If your app has no profile lexicon yet, copy [`social.omote.actor.profile`](/docs/reference/lexicons/) into your own namespace, change its `id`, and adjust its limits and fields.

## Let people hide inherited fields

To let people hide a field in your app that one of their other profiles sets, list it in the record's `nullable` array:

```json ins={3}
"record": {
  "type": "object",
  "nullable": ["description", "pronouns", "website"],
  "properties": {}
}
```

This is also backward compatible, since it relaxes a constraint. Update your own app to expect `null` in those fields before you declare them.

## Show the resolved profile

Resolve profiles with `@omote-social/profiles` instead of reading your record alone. See [Show profiles in your app](/docs/guides/resolve/).

## Write the record

Other apps and editors write the same records as your app, so follow these rules when you save.

### Keep what you don't understand

Read the record, change the fields you edit, and write everything else back as it was, `extends` included. Never rebuild the record from your own fields alone.

### Write your default down

When you create a record for someone for the first time, write the `extends` your app had been assuming (usually `["app.bsky.actor.profile", "social.omote.actor.profile"]`). The record then says what your app did.

### Write `null` only where your lexicon allows it

Another app's editor won't write `null` into a field your lexicon doesn't declare `nullable`. Hold your own writes to the same rule.

### Change it here, or everywhere

When someone edits their profile in your app, offer two choices:

- **Change it here** writes your app's own record.
- **Change it everywhere** writes the shared profile, `social.omote.actor.profile`, and so reaches every app whose chain includes it.

Only write the shared profile when the person chooses "everywhere" for that change. Otherwise, write your own record. Never write another app's record, including Bluesky's.

## Publish your lexicon

Publish your profile lexicon through [lexicon resolution](https://atproto.com/specs/lexicon#lexicon-publication-and-resolution): a `_lexicon` DNS record naming your DID, and a `com.atproto.lexicon.schema` record in that DID's repository. The Omote editor reads it to learn which fields your record has, their limits and image formats, which are required, and whether your record takes `extends` and `null`. Without it, the editor shows your app's profile read-only.

## Declare your app

Optionally, publish a [`community.lexicon.app.profile`](https://github.com/lexicon-community/lexicon/tree/main/community/lexicon/app) record from the same DID. List your profile collection under `lexicons.produces` and in `accountIndicators`. Editors can then show your app by name and icon.
