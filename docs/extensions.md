# Extensions: app-specific customisation beyond the shared fields

> **Status**: direction, September 2026. Nothing here is built. The shared
> fields ([spec §4](./spec.md#4-the-shared-fields)) stay few on purpose; this is
> how the rest of Discord's per-server fidelity fits without them growing to
> fit every app.

## What Discord's per-server profile carries

| Discord                                             | omote                    | Why there                                                                         |
| --------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------- |
| Nickname, avatar, banner, bio, pronouns             | **Shared field** (built) | Meaningful in any app                                                             |
| Theme colours (primary, accent)                     | **Shared candidate**     | Two colours mean the same thing everywhere; an app can ignore them                |
| Avatar decoration, profile effect, frame, nameplate | **App's own**            | Each needs an app's own asset catalogue and renderer                              |
| Display name style (font, effect, colour)           | **App's own**            | Depends on the fonts and effects an app ships                                     |
| Server tag                                          | **App's own**            | Belongs to a community, not to the person                                         |
| Widgets (games I like, favourite game, wishlist)    | **App's own**            | App data with app-specific shapes                                                 |
| Connections                                         | **Not ours**             | Verified links are keytrace's job (`dev.keytrace.claim`); an editor can show them |
| Member since, activity                              | **Not profile data**     | Derived by the app, not chosen by the person                                      |

The test for a shared field: **would every app render it the same way?** A name
would. A nameplate would not: it only means something where that nameplate
exists.

## Where app-specific data lives

**In the app's own profile record, beside the shared fields.** Grain's
`cameraGear` or a nameplate picked from an app's catalogue is just another
field of that app's lexicon. Inheritance never carries it to another record
([spec §4](./spec.md#4-the-shared-fields)), so no extension mechanism is needed
for an app to keep its own data.

## How the editor would edit it

The editor learns an app's shape at runtime:

1. **It resolves the app's lexicon** through lexicon resolution: a DNS
   `_lexicon` TXT record, then the authority's `com.atproto.lexicon.schema`
   records. Grain already publishes `social.grain.actor.profile` this way.
2. **It renders a form from it:**
   - string and `knownValues` fields become text inputs and pickers;
   - blobs become uploads;
   - arrays become lists.

   This is what gives omote a Discord-style editing experience for apps it has
   never heard of.

3. **The same lexicon says whether the app adopted.** An `extends` property
   means the app resolves its record the way the overview shows; `nullable`
   says which fields may be hidden with `null`.

What blocks editing other apps' records today is permission, not shape.
bsky.social only grants `repo:` scopes that the client metadata names one by
one, so omote would have to list each app's collection in advance
([spec §11.6](./spec.md#11-open-for-agreement)).

**Open questions:**

- Should an app be able to supply editing hints (labels, order, previews) beyond
  what a lexicon can express?
- How are unknown or unresolvable field types shown in the editor?
- Should some decorations be shared across apps, as theme colours might be? That
  would make them shared fields, with the same test as above.
