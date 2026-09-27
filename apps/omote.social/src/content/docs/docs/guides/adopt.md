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

## Read and write the record

Show the resolved profile rather than your record alone: see [Show profiles in your app](/docs/guides/resolve/).

When your app saves the record, follow these rules. They are requirements, not suggestions: other apps and editors write the same records, and rely on yours following them. They come from the [specification](https://github.com/Saeris/omote/blob/main/docs/spec.md#7-rules-for-apps-and-editors).

- **Keep what you don't understand.** Read the record, change the fields you edit, and write everything else back as it was, `extends` included. Never rebuild the record from your own fields alone.
- **Write your default down.** When you create someone's record for the first time, write the `extends` your app had been assuming, usually `["app.bsky.actor.profile", "social.omote.actor.profile"]`. The record then says what your app did.
- **Write `null` only where your lexicon allows it.** Other apps' editors won't write `null` into a field your lexicon doesn't declare `nullable`; hold your own writes to the same rule.
- **Offer "Change it here" and "Change it everywhere".** "Here" writes your app's own record. "Everywhere" writes the shared profile, `social.omote.actor.profile`, and so reaches every app whose chain includes it. Write the shared profile only when the person chooses "everywhere" for that change.
- **Never write another app's record**, Bluesky's included.

## Help editors find your app

Both are optional. Without a published lexicon, the Omote editor shows your app's profile read-only; without a declaration, it names your app by its collection.

- **Publish your lexicon** through [lexicon resolution](https://atproto.com/specs/lexicon#lexicon-publication-and-resolution): a `_lexicon` DNS record naming your DID, and a `com.atproto.lexicon.schema` record in that DID's repository. Editors read it to learn which fields your record has, their limits and image formats, which are required, and whether your record takes `extends` and `null`.
- **Declare your app** with a [`community.lexicon.app.profile`](https://github.com/lexicon-community/lexicon/tree/main/community/lexicon/app) record from the same DID. List your profile collection under `lexicons.produces` and in `accountIndicators`, so editors can show your app by name and icon.
