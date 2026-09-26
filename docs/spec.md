# Omote: profiles that extend (draft)

> **Status**: draft for discussion with the first adopting apps. Sections 2–9
> describe what the prototype does today. Section 11 lists the choices still
> open, which the adopters should settle together before a first release.
> Section 12 sets out the earlier proposals this builds on. The key words MUST,
> SHOULD and MAY are used as in RFC 2119.

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

The apps already agree on the _shape_ of a profile. Grain's published lexicon is
Bluesky's with three fields removed, down to the avatar's description ("Small
image to be displayed next to posts from account"). What they cannot say, because
nothing gives them a way to, is **where a value comes from when their own record
doesn't have it.**

Omote gives them that way, and a tool that shows the account holder the answer.

This has been tried before. The Lexicon Community's shared base profile stalled
on a protocol constraint, and Trezy's lexicon generics chose to solve reading
alone. Section 12 covers what each found, and which of their open problems this
design settles.

## 2. The idea, in TypeScript's terms

The mechanism is the one `tsconfig.json` uses. A configuration names the bases it
builds on, and sets only what differs:

```jsonc
// tsconfig.json
{
  "extends": ["@tsconfig/strictest", "./tsconfig.base.json"],
  "compilerOptions": { "outDir": "dist" },
}
```

A profile record does the same:

```jsonc
// social.grain.actor.profile/self
{
  "$type": "social.grain.actor.profile",
  "extends": ["app.bsky.actor.profile", "social.omote.actor.profile"],
  "displayName": "Drake (photos)", // set: wins over every base
  "description": null, // null: don't show what the bases say
  "cameraGear": ["X100VI"], // Grain's own field: never inherited
}
```

| TypeScript and ESLint                                                                                | Omote                                                                                                              |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `extends` in `tsconfig.json`                                                                         | `extends` in a profile record                                                                                      |
| Since TypeScript 5.0, `extends` takes an array, and later entries win                                | The same                                                                                                           |
| The file's own options win over every base                                                           | The record's own fields win over every base                                                                        |
| A base can extend another base                                                                       | The same                                                                                                           |
| Structural typing: a value satisfies an interface by having its members, not by naming the interface | A record takes part by having the shared fields, with the same names and types, not by referencing Omote's lexicon |
| ESLint: `"rule": "off"` turns off a rule a shared config turned on                                   | `null` turns off a field a base set                                                                                |
| `@tsconfig/bases`: shared bases published by the community, not by the TypeScript team               | `social.omote.actor.profile`: a base that belongs to no app, and a candidate for the Lexicon Community (§9)        |

There are two differences. Bases are records in the same repository, named by
their collection's NSID, not files named by path. And a base reached through two
parents applies once, not twice (§5.2).

## 3. Terms

- **Profile record**: a record, at record key `self`, describing how the account
  appears in one app: `app.bsky.actor.profile`, `social.grain.actor.profile`.
- **Shared fields**: the six fields every profile record can take part in
  inheritance with (§4). Their names and types are Bluesky's.
- **Base**: a profile record that another names in `extends`.
- **Root**: a profile record with no `extends`. Bluesky's profile is a root, and
  for most accounts today it is _the_ root: the one everything else falls back
  to.
- **Chain**: a record, its bases, their bases, and so on.
- **Shared base**: `social.omote.actor.profile/self`, a base that belongs to the
  account holder rather than to any app (§8).

## 4. The shared fields

Bluesky's profile is the template. The shared fields are its identity fields, with
its names and types:

| Field         | Type           | Bluesky's limit   |
| ------------- | -------------- | ----------------- |
| `displayName` | string         | 64 graphemes      |
| `description` | string         | 256 graphemes     |
| `pronouns`    | string         | 20 graphemes      |
| `website`     | string (`uri`) | —                 |
| `avatar`      | blob (image)   | PNG or JPEG, 1 MB |
| `banner`      | blob (image)   | PNG or JPEG, 1 MB |

A record takes part **field by field, by name and type**, as TypeScript checks an
object against `Partial<Profile>`:

- **A field with a shared name and the shared type takes part in inheritance.**
  Every shared field is optional, so Grain's record takes part although it has no
  pronouns, website or banner.
- **A field with a shared name and a different type is ignored**, as if it were
  absent.
- **A field with a different name never takes part**, even when it means the
  same thing. Sifa's `about` is not a `description`. Accepting aliases would make
  the shape nominal again, and every reader would need the same list of them.
- **Limits are not part of the type.** A record MAY allow a longer description
  than Bluesky (a professional bio), or more image formats. Values cross records
  whatever their limits; a reader shows what fits its layout, truncating a long
  bio for instance, and never writes a truncated copy back.
- **An app's other fields never cross records.** Grain's `cameraGear` is Grain's
  alone.

## 5. `extends`

### 5.1 The field

```json
"extends": {
  "type": "array",
  "maxLength": 8,
  "items": { "type": "string", "format": "nsid" }
}
```

- **Each entry names a collection.** The base is that collection's `self` record,
  in the same repository.
- **Absent or empty means the record is a root.** A record never inherits
  implicitly. One that names no bases has none, which is what makes "does my
  Bluesky name show on Grain?" answerable from the records alone.
- **It is an array from the start.** TypeScript moved from a string to an array in
  5.0. For records already in the wild, that change would break every reader, so
  Omote starts where TypeScript ended up.
- **Entries are NSIDs, not AT-URIs**, so a profile inherits only from the same
  account (§11.3).

### 5.2 Order

A reader collects the chain into a list, lowest precedence first:

1. **Visit a record:** visit each of its bases in `extends` order, then add the
   record itself.
2. **Never visit a record twice.** So each record applies once, and always after
   every base it builds on, directly or not.
3. **Skip a base that is missing**, and stop following bases past a depth of 8 or
   after 16 records in total. The limits bound the work a reader does for a
   hostile or broken chain; no real profile comes near them.

Then it folds the list, field by field, from the lowest to the highest:

- **a value replaces** what came before;
- **`null` removes** what came before;
- **an absent field changes nothing.**

For example:

| Record                                          | `displayName` | `description`    | `avatar` |
| ----------------------------------------------- | ------------- | ---------------- | -------- |
| `app.bsky.actor.profile` (a root)               | Drake         | Design engineer. | 🖼 A      |
| `social.omote.actor.profile`, extending Bluesky | Drake Costa   |                  |          |
| `social.grain.actor.profile`, extending both    |               | `null`           |          |
| **Grain shows**                                 | Drake Costa   | _nothing_        | 🖼 A      |

This is where Omote departs from `tsconfig.json`. TypeScript resolves each base on
its own and merges the results in order, so a base reached through two parents
applies twice, and its second application can undo the first parent's settings.
Suppose Grain extended `["social.omote.actor.profile", "app.bsky.actor.profile"]`,
with Bluesky last. Bluesky's name would then override the shared base's, although
the shared base was built on Bluesky precisely to override it. Applying each
record once, after its bases, means **a record always wins over everything it
builds on**, however it is reached. It is the rule Python's method resolution
order follows for the same reason.

### 5.3 Missing records

- **A missing base is skipped.** Naming the shared base costs nothing for someone
  who doesn't have one.
- **A missing starting record uses the app's default.** When the record being
  resolved doesn't exist, as for someone who has never opened Grain, the app
  resolves it as if it existed with the app's default `extends`. Apps SHOULD
  default to `["app.bsky.actor.profile", "social.omote.actor.profile"]`:
  Bluesky's profile, then the shared base if the person has one.

## 6. Resolution

To show an account in the app whose profile record is collection C, an app MUST:

1. **Resolve the account** to its DID, handle and PDS, verifying the handle in
   both directions.
2. **Read C's `self` record and its chain** (§5.2) from that PDS. A missing
   record is not an error. An unreachable PDS is, and is not the same answer.
3. **Read each record leniently, field by field** (§4). A malformed field costs
   that field, not the record, and not the profile. Two further rules:
   - **a blank string is absent**, because Bluesky writes `displayName: ""` when a
     name is cleared;
   - **a website that is not an `http:` or `https:` URL is absent**, because it
     will be shown as a link.
4. **Fold the chain** (§5.2).
5. **With no display name at all, show the handle.**
6. **Load images from the account's own PDS** (`com.atproto.sync.getBlob`), not
   from any one app's CDN.

[`@omote-social/profiles`](../packages/profiles) implements this in TypeScript.
Other implementations MUST reach the same result for the same records.

## 7. Rules for apps and editors

- **Adopting is two additions to an app's own lexicon:** `extends`, and
  `nullable` on the shared fields the app lets people hide. An optional field
  and a relaxed constraint are both backward compatible under Lexicon's evolution
  rules.
- **An app edits only its own record.** It MAY also write the shared base, which
  belongs to no app, when the person chooses to (below). It MUST NOT write other
  apps' records, Bluesky's included. Editing across apps is the account holder's
  decision, made in a tool built for it, such as omote.social.
- **Writing the shared base is always the person's explicit choice.** An app MUST
  NOT write the shared base unless the person chose, for that change, to make it
  everywhere. Without that choice, an edit goes to the app's own record. So a bio
  written for a game can never replace one written for work by accident. A tool
  whose only job is managing profiles, such as omote.social, is that choice: it
  has no "here".
- **An app that edits profiles SHOULD offer both choices side by side:**
  - **"Change it here"** writes the app's own record;
  - **"Change it everywhere"** writes the shared base, and so reaches every app
    whose chain includes it.

  This single convention removes the ambiguity in §1.

- **Keep what you don't understand.** Several apps and editors now write the same
  records, so an editor MUST read, change and write back, keeping every field it
  doesn't know, `extends` included.
- **Write `null` only where the record's lexicon allows it.** An app that doesn't
  expect `null` in its own record may break on one.
- **Write the default down.** An app creating its record for the first time
  SHOULD write the `extends` it had been assuming (§5.3), so the record says what
  the app did.

## 8. The lexicons

**`social.omote.actor.profile`** is a record with key `literal:self`, holding:

- the six shared fields, all `nullable`, with Bluesky's limits, except that
  images take Discord's formats (PNG, JPEG, GIF, WebP and AVIF) up to 10 MB. The
  text limits are Bluesky's so that anything set here fits every Bluesky-shaped
  app without being cut short; a longer bio belongs in an app's own record for
  now (§11.4);
- `extends`;
- an optional `createdAt`.

It serves two purposes:

- **It is the shared base.** It belongs to the account holder, not to an app, so
  any app may write it (§7). An account starting outside Bluesky can use it as
  its root.
- **It is the template.** An app adopting Omote copies it into its own namespace,
  changes `id`, adjusts the limits, and adds its own fields.

**`social.omote.getProfile`** is a query taking `actor` and `collection`. It
returns:

- the resolved profile;
- a `sources` map naming, for each field, the collection it came from, or the one
  that hid it;
- the `chain` of records it read.

It is a convenience; apps SHOULD resolve from the records (§6).

There is deliberately no `defs` lexicon for apps to reference. Because taking part
is structural, an app copies the shape rather than pointing at ours. So no app's
lexicon depends on Omote's NSIDs resolving, and nothing in any app's schema
changes if the shared base moves.

Full definitions are in
[`packages/lexicon/lexicons`](../packages/lexicon/lexicons/social/omote).

## 9. Moving to a community lexicon

`social.omote.actor.profile` is written as the lexicon a community base could be,
so that adopting it upstream is a rename. The shape needs no renaming, because it
is copied, never referenced. Only two things name the NSID:

- the shared base records themselves;
- `extends` entries pointing at them.

A move to, say, `community.lexicon.actor.profile` takes three steps:

1. **Publish the lexicon under the new NSID**, unchanged apart from its `id`.
2. **Copy each account's shared base** to the new collection, and rewrite the old
   record as a forwarder: `{ "extends": ["community.lexicon.actor.profile"] }`.
   This is a tsconfig whose only job is to extend another.
3. **Let apps update their default `extends`** at their own pace. Every existing
   entry keeps resolving through the forwarder in the meantime.

No reader changes. The editor can do step 2 for each person as they sign in.

## 10. What this is not

- **Not private.** Profile records are public, like the rest of the repository.
  Different profiles in different apps separate presentations; they don't make
  them unlinkable.
- **Not a change to Bluesky.** Bluesky's profile stays a root and its app keeps
  writing it as it does today. Nothing here needs Bluesky to act.

## 11. Open for agreement

These choices are hardest to change once records exist in the wild, so they come
before a first release.

1. **Namespace and governance.**
   - `social.omote` belongs to this project's domain, which also hosts the
     editor. §9 is how the shared base would leave it.
   - standard.site's namespace belongs to no app, and it is governed by the
     implementers who founded it. Starting in a neutral namespace would skip the
     move altogether.
   - Either works, but the adopters should choose knowingly. Whichever it is,
     governance should be written down: who decides, where changes are proposed,
     and how breaking changes are handled.
2. **The field's name.** `extends` is the word developers already know from
   TypeScript, ESLint and CSS preprocessors. Renaming it after records exist
   would break every reader.
3. **Only the same account?** Entries are NSIDs, so a profile inherits only from
   its own repository. AT-URIs would let a business's profile be a base for its
   staff, but allowing them later changes the items' format, which is a breaking
   change. The alternative is a second field, added later, if the need is real.
4. **More shared fields.**
   - **Location and links** recur across apps. Tangled has free-text location and
     a list of links. Sifa has structured location
     (`community.lexicon.location.address`) and external accounts. Bluesky has
     only a single website. If either is added, reuse a community lexicon for its
     shape, as Sifa does.
   - **Theme colours.** Discord lets a person set colours per server. Reusing
     standard.site's `site.standard.theme.basic` (background, foreground, accent,
     accent foreground) would share a schema the publishing ecosystem already
     uses, rather than invent one.
   - **Time zone.** Raised in the Lexicon Community's base-profile discussion
     (§12.1), and already in Smoke Signal's profile as `tz`. It passes the test
     for a shared field, since it means the same thing in every app. Its name and
     format (an IANA name such as `Europe/Paris` is the obvious choice) should be
     agreed before any app ships one, since the names must match exactly.
   - **A longer description.** The shared base keeps Bluesky's 256 graphemes, so
     everything in it fits every Bluesky-shaped app without being cut short. That
     leaves one objection from §12.1 standing: someone with a long bio sets it app
     by app. Raising a limit later is backward compatible, because it relaxes a
     constraint; lowering one is not. So the limit starts at Bluesky's, and the
     adopters can raise it together once their apps shorten inherited text for
     display (§4).
   - Adding a shared field is backward compatible: records without it are simply
     silent about it.
5. **Images.**
   - **The ceiling.** 10 MB matches Discord. Some self-hosted PDSes refuse
     anything over 5 MB by default.
   - **Metadata.** Discussion #9 asked for alt text, for focal points, and for a
     way to handle banners that apps crop to different aspect ratios (§12.1).
     `avatar` and `banner` must stay blobs to keep Bluesky's shape, so any
     metadata goes beside them rather than inside them: `bannerAlt`, say, and an
     aspect ratio shaped like `community.lexicon.app.defs#aspectRatio` (`width`
     and `height`). The Lexicon Community already uses that shape, with required
     alt text, for apps' own images. A focal point has no precedent yet; with
     one, an app could choose its crop rather than guess.
6. **App declarations, and how an editor knows an app adopted.** An editor that
   writes apps' records needs to know which records follow these rules, and it
   needs permission for each.
   - **Adoption** can be read from an app's published lexicon. Grain already
     publishes `social.grain.actor.profile` through lexicon resolution. An
     `extends` property there means the app adopted, and `nullable` says where an
     editor may write `null`.
   - **Permission** is harder. bsky.social only lets a client request the
     `repo:` scopes its metadata lists by name: declaring `repo:*` does not
     cover a request for `repo:social.grain.actor.profile` (tested 2026-09-26).
     So an editor has to name each app's collection in advance.
   - **The declaration already exists.** `community.lexicon.app.profile`
     (Lexicon Community, June 2026) is a record an app publishes about itself, at
     `self` in its own repository. It holds the app's name, images (an icon
     among them) and links, the collections it `produces` and `consumes`, and
     `accountIndicators`: records whose presence shows that an account uses the
     app.
   - **An editor can get from a profile collection to its app's declaration**
     without a registry:
     1. lexicon resolution names the DID that publishes the collection's lexicon
        (Grain's `_lexicon` DNS record does);
     2. that DID's `community.lexicon.app.profile/self` names and pictures the
        app.

     The DNS record is the verification: only the domain's owner can publish
     it.

   - **What adopters would do** is publish that record, listing their profile
     collection under `produces` and in `accountIndicators`. Editors could then
     show each app by name and icon, the ecosystem would have a list of adopters,
     and omote.social would know which collections to name in its client
     metadata. Grain does not publish one yet.
7. **Extensions.** App-specific data already has a home, in the app's own record.
   What stays open is whether some of it, such as Discord-style decorations,
   should be shared across apps. See [`extensions.md`](./extensions.md).
8. **Apps with rich profiles.**
   - **Sifa** already inherits a person's name and avatar from Bluesky, and keeps
     only professional data (headline, positions, skills) in its own records.
     `extends: ["app.bsky.actor.profile"]` would say so in the record, and let
     Sifa add the shared base.
   - **Tangled** shows the opposite pattern. Its profile copies the base's avatar,
     description and pronouns, and the copies drift. With `extends`, it could stop
     copying and keep only what is Tangled's: pinned repositories, stats and
     links.
9. **Lookups at scale.** An app showing many people cannot read one PDS per row,
   let alone follow a chain for each. A batch `getProfiles`, backed by an index
   of the network's profile records, is likely needed; Standard Reader plays that
   role for standard.site. Is it part of the standard, or a service built on it?

## 12. Prior art

### 12.1 A shared base profile (Lexicon Community, discussion #9)

[Discussion #9](https://github.com/lexicon-community/lexicon/discussions/9)
(December 2024 – February 2025) proposed `community.lexicon.actor.profile`:

- **one collection**, holding a generic record at record key `com.atproto`, and a
  record per service beside it (`app.bsky`, `events.smokesignal`);
- **shared fields** of `displayName`, `description`, `avatar` and `banner`, with
  Bluesky's limits;
- **inheritance by default:** service records would "inherit all object
  properties from the generic profile record", and services without one would
  use the generic record.

It stalled on a point @yamarten raised: a collection has exactly one schema,
and a `literal` record key admits one key, so Bluesky's and Smoke Signal's
records could not have different fields in the same collection. Several
objections to the shape were also left unanswered.

| Unresolved in #9                                          | Raised by             | Here                                                                                                       | Status       |
| --------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------- | ------------ |
| One collection cannot hold several schemas                | @yamarten             | Each app keeps its own collection and schema; `extends` links collections (§5)                             | **Settled**  |
| How inheritance is expressed                              | Left open             | Explicit and ordered, per record: a missing field inherits, `null` hides, and the fold is specified (§5.2) | **Settled**  |
| Services forced into one shape ("very 'twitter-like'")    | @essential-randomness | Only field names and types are shared; each record sets its own limits and adds its own fields (§4)        | **Settled**  |
| A 256-grapheme bio for everyone                           | @essential-randomness | An app may allow more in its own record; the shared base keeps 256 for now (§11.4)                         | **Deferred** |
| Animated images                                           | @essential-randomness | GIF, WebP and AVIF on the shared base (§8)                                                                 | **Settled**  |
| One banner for every aspect ratio, focal points, alt text | @essential-randomness | Metadata beside the blobs, reusing the Lexicon Community's aspect-ratio shape (§11.5)                      | **Open**     |
| Image metadata as its own reusable lexicon                | @snarfed              | The same question (§11.5)                                                                                  | **Open**     |
| Time zone                                                 | @essential-randomness | A shared-field candidate (§11.4)                                                                           | **Open**     |

Our own first design, a `social.omote.profile` record per app keyed by the
app's name, repeated #9's structural mistake: one collection, one schema, for
every app. Moving the link into each app's own record removed it.

### 12.2 Lexicon generics (Trezy, March 2026)

[Lexicon generics](https://trezy.codes/blog/atproto-profile-lexicon-generics)
leave each app's profile alone. Beside each profile lexicon, its author
publishes a sidecar (`community.lexicon.generic.profile`, keyed by the target
NSID) mapping the lexicon's own fields to common concepts: `avatar`,
`displayName`, `description`, `pronouns`.

Its case against a single base profile names three failure modes, and they
shaped this design:

| Failure mode                                                                                                                                           | Here                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Scope:** "does editing my bio on one app update it everywhere?"                                                                                      | Every record says what it builds on, and writing the shared base requires the person's explicit "everywhere" (§7)         |
| **Leaving the app:** "if the base profile is read-only, now I have to leave the app I'm using to go edit my profile"                                   | Apps edit their own record, and may write the shared base when the person asks (§7)                                       |
| **Staleness:** "a profile that exists for the sake of being a profile, with no app experience around it, will go stale. This is the Gravatar problem." | Inheritance is live, so an app that builds on a base never holds a stale copy of it. A base nobody edits still goes stale |

Generics solve reading, and say so: the proposal is "a discovery mechanism and
translation layer", and leaves writing and propagation aside. Omote is the other
half. The two differ on one point: generics map fields by declaration, so Sifa's
`about` could be read as a description, while Omote matches names exactly (§4).
They can coexist: an editor could read apps that haven't adopted through their
sidecars, and resolve apps that have through `extends`.

### 12.3 standard.site

[standard.site](https://standard.site) is not about profiles, but it is the
nearest precedent for how a shared lexicon wins adoption:

- implementers who compete with one another founded it together, in a namespace
  none of them owns (§11.1);
- it shares a small core and leaves each app's content in an open union, as §4
  leaves each app's own fields to the app;
- Bluesky rendering its records gave apps a reason to publish them.

Its `site.standard.theme.basic` is the candidate shape for theme colours (§11.4).

### 12.4 App declarations (`community.lexicon.app`, June 2026)

The Lexicon Community's
[`community.lexicon.app`](https://github.com/lexicon-community/lexicon/tree/main/community/lexicon/app)
lexicons let an app describe itself, including the collections it produces and
the records that show an account uses it. §11.6 builds on them rather than
defining a declaration of Omote's own.

### 12.5 Discord

Discord's per-server profiles are the experience this aims at: a nickname,
avatar, banner, bio and colours per server, with anything unset falling back to
the global profile. [`extensions.md`](./extensions.md) maps the rest of what
Discord offers.
