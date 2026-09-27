---
title: "@omote-social/profiles"
description: Reference for the library that resolves how an account appears in an app.
sidebar:
  order: 1
---

Resolves how an ATProto account appears in one app: that app's profile record, folded over the records it extends. Reads straight from the account's own server.

```sh
npm install @omote-social/profiles
```

## `getProfile()`

```ts
getProfile(actor: string, collection: string, options?: GetProfileOptions): Promise<ProfileView>
```

Resolves the account's identity, reads `collection`'s `self` record and every record its chain reaches, and folds them.

- `actor`: a handle or DID.
- `collection`: the app's profile record collection, for example `social.grain.actor.profile`.

### Options

| Option           | Type            | Default                                                    | Description                                                                        |
| ---------------- | --------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `defaultExtends` | `string[]`      | `["app.bsky.actor.profile", "social.omote.actor.profile"]` | The bases to use when the account has no record in `collection`                    |
| `resolver`       | `ActorResolver` | `defaultResolver()`                                        | Resolves a handle or DID to its DID, handle and server. Reuse one for many lookups |
| `fetch`          | `typeof fetch`  | `globalThis.fetch`                                         | For proxies, instrumentation or tests                                              |
| `timeout`        | `number`        | `10000`                                                    | Milliseconds to wait for each network call                                         |

### Result

`ProfileView`:

| Field                                               | Type                             | Description                                                          |
| --------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| `did`, `handle`                                     | `string`                         | Verified in both directions                                          |
| `collection`                                        | `string`                         | As requested                                                         |
| `displayName`, `description`, `pronouns`, `website` | `string \| undefined`            | Absent when no record in the chain has a value, or when one hides it |
| `avatar`, `banner`                                  | `string \| undefined`            | URLs served by the account's own server                              |
| `sources`                                           | `Partial<Record<Field, Source>>` | The record each field came from, or `{ collection, hidden: true }`   |
| `chain`                                             | `string[]`                       | The records applied, lowest precedence first                         |

### Errors

`getProfile()` throws a `ProfileError` with a `code`:

| Code                | Meaning                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| `InvalidActor`      | Not a handle or DID                                                              |
| `InvalidCollection` | Not an NSID. Checked before any network call                                     |
| `ActorNotFound`     | The handle or DID doesn't resolve                                                |
| `RecordUnavailable` | The account's server failed. Different from the account simply having no profile |

## `resolveProfile()`

```ts
resolveProfile(records: ReadonlyMap<string, unknown>, collection: string, options?: ResolveOptions): Resolved
```

Applies the same rules as `getProfile()` to records you already have. `records` maps each collection to its `self` record; a collection missing from the map has no record. Takes the `defaultExtends` option.

Returns `{ fields, sources, chain }`. Images in `fields` are blob references rather than URLs; turn them into URLs with `blobUrl()`.

## `loadChain()`

```ts
loadChain(collection: string, load: (collection: string) => Promise<unknown>, options?: ResolveOptions): Promise<Map<string, unknown>>
```

Fetches exactly the records a chain reaches, a level at a time so that bases at the same depth load together. `load` returns a collection's `self` record, or `undefined` when there is none. Pass the result to `resolveProfile()`.

## `readProfileRecord()`

```ts
readProfileRecord(value: unknown): ProfileRecord
```

Reads one record for the parts inheritance uses: its shared fields (a value, or `null` to hide) and its bases. Other apps' records follow their own lexicons, so it reads by shape and ignores anything else, rather than failing the record.

## `blobUrl()`

```ts
blobUrl(pds: string, did: string, blob: Blob): string
```

The URL at which the account's own server serves a blob.

## `defaultResolver()`

```ts
defaultResolver(fetch?: typeof globalThis.fetch): ActorResolver
```

The resolver `getProfile()` uses when none is passed: handles over DNS-over-HTTPS and `.well-known`, DIDs through PLC or `did:web`. Create one and pass it as `resolver` to reuse it across lookups.

## Constants

| Name              | Value                                                      | Description                              |
| ----------------- | ---------------------------------------------------------- | ---------------------------------------- |
| `DEFAULT_EXTENDS` | `["app.bsky.actor.profile", "social.omote.actor.profile"]` | The default for `defaultExtends`         |
| `MAX_DEPTH`       | `8`                                                        | How deep a chain is followed             |
| `MAX_RECORDS`     | `16`                                                       | How many records a chain may read in all |
