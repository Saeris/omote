# Omote: profiles that extend (draft)

> **Status**: draft for discussion with the first adopting apps. Sections 2–9
> describe what the prototype does today. Section 11 lists the choices still
> open, which the adopters should settle together before a first release. The key
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

The apps already agree on the _shape_ of a profile. Grain's published lexicon is
Bluesky's with three fields removed, down to the avatar's description ("Small
image to be displayed next to posts from account"). What they cannot say, because
nothing gives them a way to, is **where a value comes from when their own record
doesn't have it.**

Omote gives them that way, and a tool that shows the account holder the answer.

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
  belongs to no app. It MUST NOT write other apps' records, Bluesky's included.
  Editing across apps is the account holder's decision, made in a tool built for
  it, such as omote.social.
- **An app that edits profiles SHOULD offer two explicit choices:**
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
  images take Discord's formats (PNG, JPEG, GIF, WebP and AVIF) up to 10 MB;
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
   - Adding a shared field is backward compatible: records without it are simply
     silent about it.
5. **The image ceiling.** 10 MB matches Discord. Some self-hosted PDSes refuse
   anything over 5 MB by default.
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
   - A record declaring the app would settle both: its profile collection, name
     and icon, verified from the app's domain through `.well-known` as a
     standard.site publication is. Editors could offer a list of apps, and the
     ecosystem would have a list of adopters.
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
