# Omote baseline (draft)

> **Status**: draft for discussion with the first adopting apps. Sections 1–4
> describe what the prototype does today. Section 5 lists the choices still open,
> which the adopters should settle together before a first release. The key
> words MUST, SHOULD and MAY are used as in RFC 2119.

## 1. The problem

An ATProto account is one identity across every app, but its profile is not.
Apps keep their own profile records beside `app.bsky.actor.profile`, and nothing
tells the account holder which app reads which.

Grain's own account shows this. It holds nine profile-like records,
including `app.bsky.actor.profile`, `social.grain.actor.profile`,
`sh.tangled.actor.profile`, `network.slices.actor.profile`,
`org.atmosphereconf.profile` and `fyi.atstore.profile`, with three different
display names between them.

So does changing a display name on Bluesky change it on Grain? Does the reverse
hold? Today, only each app knows.

Omote makes that answer explicit. It gives each account:

- **one base profile**, which propagates everywhere;
- **an override per app**, which propagates nowhere else;
- **one tool** that shows and edits all of them.

## 2. Terms

- **Base profile**: `app.bsky.actor.profile/self`, the profile everything falls
  back to.
- **Context**: an app, named by the reversed domain its lexicons live under
  (`social.grain`). It is also the override's record key.
- **Override**: a `social.omote.profile` record for one context. It is sparse:
  it holds only what differs in that app, and can hide base fields there.
- **App's own profile**: a profile record an app defines for itself
  (`social.grain.actor.profile`). It is outside Omote, but shown by the editor.

## 3. Records

`social.omote.profile`:

- **Record key:** the context, a lowercase reversed domain.
- **Fields:** `displayName` (64 graphemes), `description` (256), `pronouns` (20),
  `website` (URI), `avatar` and `banner` (PNG, JPEG, GIF, WebP or AVIF, up to
  10 MB), `hide` (a list of those six field names), and `createdAt`.

`social.omote.getProfile`: a query returning the resolved profile for an
`actor` and a `context`, with a `sources` map. It is a convenience; apps SHOULD
resolve from the records themselves (§4).

Full definitions are in
[`packages/lexicon/lexicons`](../packages/lexicon/lexicons/social/omote).

## 4. Resolution

To show an account in context C, an app MUST:

1. **Resolve the account** to its DID, handle and PDS, verifying the handle in
   both directions.
2. **Read** `app.bsky.actor.profile/self` (the base) and
   `social.omote.profile/C` (the override) from that PDS. A missing record is
   not an error.
3. **Treat a record that fails its schema as missing.** It was written by
   someone else, and a bad field there should cost that record, not the profile.
4. **Treat a blank string as absent.** Bluesky writes `displayName: ""` when a
   name is cleared.
5. **Resolve each field in order:**
   - if the override sets it, use the override's value;
   - otherwise, if the override hides it, show nothing;
   - otherwise, use the base value.

   Hiding only ever removes inherited values: a field the override sets is
   shown even if it is also listed in `hide`.

6. **With no display name at all, show the handle.**
7. **Load images from the account's own PDS**
   (`com.atproto.sync.getBlob`), not from any one app's CDN.

[`@omote-social/profiles`](../packages/profiles) implements this in TypeScript.
Other implementations MUST reach the same result for the same records.

### Rules for apps

- **An app edits only its own context.** It MAY write its own override, and its
  own profile record if it has one. It MUST NOT write other apps' overrides or
  other apps' records. Editing across apps is the account holder's decision,
  made in a tool built for it, such as omote.social.
- **An app that edits profiles SHOULD offer two explicit choices:**
  - **"Change it here"** writes the app's own override;
  - **"Change it everywhere"** writes the base profile.

  This single convention removes the ambiguity in §1.

- **An app with its own profile record MAY keep it.** Leaflet's move to
  standard.site is a precedent: it wrote the shared records while keeping its
  own. Once an app reads overrides, its own record can become that app's
  extension data (§5.1) or be retired.

## 5. Open for agreement

These choices are hardest to change once records exist in the wild, so they
come before a first release.

1. **Extensions.** Should the override carry an open union for app-specific
   data (decorations, name styles, widgets), as standard.site's `content` does?
   Adding one later is backward compatible, but having it from the start tells
   apps where their fields belong. See [`extensions.md`](./extensions.md).
2. **Theme colours.** Discord lets a person set colours per server. If Omote
   adds colours, reusing standard.site's `site.standard.theme.basic`
   (background, foreground, accent, accent foreground) would share a schema the
   publishing ecosystem already uses, rather than invent a new one.
3. **Namespace and governance.**
   - `social.omote` belongs to this project's domain, which also hosts the
     editor.
   - standard.site's namespace belongs to no app, and it is governed by the
     implementers who founded it.
   - Either works, but the adopters should choose knowingly. Whichever it is,
     governance should be written down: who decides, where changes are
     proposed, and how breaking changes are handled.
4. **App declarations.** Should apps declare themselves, much as a
   standard.site publication does? A record naming the app's context, display
   name, icon and any extension lexicons, verified from the app's domain
   through `.well-known`, would:
   - let editors offer a list of apps instead of a typed reversed domain;
   - prove the context belongs to that app;
   - give the ecosystem a list of adopters.
5. **The base.** Is `app.bsky.actor.profile` always the base, or can an account
   declare another? A declarable base matters as more accounts start outside
   Bluesky.
6. **Fields and limits.**
   - Are the six fields the right set?
   - Is 10 MB (matching Discord) the right image ceiling? Some PDSes refuse
     over 5 MB by default.
7. **Lookups at scale.** An app showing many people cannot read one PDS per
   row. A batch `getProfiles` backed by an index of the network's records (the
   role Standard Reader plays for standard.site) is likely needed. Is it part of
   the standard, or a service built on it?
