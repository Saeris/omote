---
title: Resolve endpoint
description: Reference for social.omote.getProfile, served over XRPC by omote.social.
sidebar:
  order: 3
---

omote.social serves `social.omote.getProfile` over XRPC. It answers with exactly what [`getProfile()`](/docs/reference/profiles/) returns, reading the account's records from its own server on every request and storing nothing.

It is a convenience for prototyping. In production, resolve profiles with the library, so no service sits between your app and the account.

## Request

```http
GET https://omote.social/xrpc/social.omote.getProfile?actor=alice.example.com&collection=social.grain.actor.profile
```

| Parameter    | Required | Description                         |
| ------------ | -------- | ----------------------------------- |
| `actor`      | Yes      | A handle or DID                     |
| `collection` | Yes      | The app's profile record collection |

Any origin may call it. Responses may be cached for up to 60 seconds, so a change to a profile shows within a minute.

## Response

A `ProfileView`, as described in the [library reference](/docs/reference/profiles/#result).

## Errors

Errors follow XRPC's shape, `{ "error": "…", "message": "…" }`:

| Status | `error`                | Meaning                                                  |
| ------ | ---------------------- | -------------------------------------------------------- |
| 400    | `InvalidRequest`       | A parameter is missing, or `actor` isn't a handle or DID |
| 400    | `InvalidCollection`    | `collection` isn't an NSID                               |
| 400    | `ActorNotFound`        | The handle or DID doesn't resolve                        |
| 502    | `UpstreamFailure`      | The account's server failed                              |
| 404    | `MethodNotImplemented` | Any other XRPC method                                    |

## Run your own

The endpoint is part of the omote.social Worker, which is open source. Deploy your own copy to Cloudflare Workers; see the [site's README](https://github.com/Saeris/omote/tree/main/apps/omote.social#readme).
