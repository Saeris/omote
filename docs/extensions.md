# Extensions: layering app-specific customisation on the base

> **Status**: direction, September 2026. Nothing here is built. The base model
> (`social.omote.profile`) stays small on purpose; this is how the rest of
> Discord's per-server fidelity would layer on top of it without the base
> growing to fit every app.

## What Discord's per-server profile carries

| Discord                                             | omote                | Why there                                                                         |
| --------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------- |
| Nickname, avatar, banner, bio, pronouns             | **Base** (built)     | Meaningful in any app                                                             |
| Theme colours (primary, accent)                     | **Base candidate**   | Two colours mean the same thing everywhere; an app can ignore them                |
| Avatar decoration, profile effect, frame, nameplate | **Extension**        | Each needs an app's own asset catalogue and renderer                              |
| Display name style (font, effect, colour)           | **Extension**        | Depends on the fonts and effects an app ships                                     |
| Server tag                                          | **Extension**        | Belongs to a community, not to the person                                         |
| Widgets (games I like, favourite game, wishlist)    | **Extension**        | App data with app-specific shapes                                                 |
| Connections                                         | **Not ours**         | Verified links are keytrace's job (`dev.keytrace.claim`); an editor can show them |
| Member since, activity                              | **Not profile data** | Derived by the app, not chosen by the person                                      |

The test for the base: **would every app render it the same way?** A name
would. A nameplate would not: it only means something where that nameplate
exists.

## How extensions would work

1. **An app publishes its extension as a lexicon**, e.g.
   `social.taproom.profile.extension` for a favourite beer, or a decoration
   picked from its own catalogue.
2. **The override carries it** in an open union:
   `extensions: [{ $type: "social.taproom.profile.extension", … }]`.
   - An app reads only the `$type`s it knows.
   - Extensions have no base to fall back to: each is scoped to its app by
     definition.
3. **The editor learns the shape at runtime.** It resolves the extension's
   lexicon (lexicon resolution: DNS `_lexicon` TXT → the authority's
   `com.atproto.lexicon.schema` records) and renders a form from it:
   - string and `knownValues` fields become text inputs and pickers;
   - blobs become uploads;
   - arrays become lists.

   This is what gives omote a Discord-style editing experience for apps it has
   never heard of.

4. **Existing app-native profiles** (Grain, Streamplace and others) get the same
   form, generated from their own profile lexicons, to edit their record
   directly. That needs a scope for their collection, requested when first
   used, not at sign-in.

Adding `extensions` to the lexicon later is backward compatible (a new optional
field), so it waits until the first real extension exists to shape it.

**Open questions:**

- Should an app be able to supply editing hints (labels, order, previews) beyond
  what a lexicon can express?
- How are unknown or unresolvable extension types shown in the editor?
- Does one context's override hold several apps' extensions, or only its own?
