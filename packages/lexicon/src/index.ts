/**
 * The omote lexicons, as Valibot schemas.
 *
 * The JSON in `lexicons/` is what the network reads; these are what our code parses with. `lexicon-parity.test.ts` holds the two to the same limits, so neither can drift.
 */

import * as v from "valibot";

export const NSID_PROFILE = "social.omote.profile";
export const NSID_GET_PROFILE = "social.omote.getProfile";
/** The base profile every override falls back to. */
export const NSID_BSKY_PROFILE = "app.bsky.actor.profile";

/** The profile fields an override can set or hide, in display order. */
export const FIELDS = [
  "displayName",
  "description",
  "pronouns",
  "website",
  "avatar",
  "banner",
] as const;

export type Field = (typeof FIELDS)[number];

/**
 * A context: the NSID authority of an app, e.g. `social.taproom`.
 *
 * It doubles as the record key, so it must also be a valid rkey. A reversed domain name is both, and it names the app by the same authority its own lexicons live under, which the app already owns.
 */
export const contextSchema = v.pipe(
  v.string(),
  v.maxLength(253),
  v.regex(
    /^[a-z][a-z0-9-]{0,62}(\.[a-z0-9][a-z0-9-]{0,62})+$/u,
    "A context is an app's reversed domain, e.g. social.taproom",
  ),
);

export type Context = v.InferOutput<typeof contextSchema>;

/** A blob reference as it appears in a record. */
/**
 * A blob reference, normalised to the canonical `{ $type: "blob", ref, mimeType, size }`.
 *
 * Tolerant on the way in because servers disagree: Cirrus's `listRecords` returns blobs without `$type` and with a nested `original` copy, while its `getRecord` returns the canonical form. Canonical on the way out, so a record read from one and saved again never writes the malformed shape back.
 */
export const blobSchema = v.pipe(
  v.looseObject({
    $type: v.optional(v.literal("blob")),
    ref: v.object({ $link: v.string() }),
    mimeType: v.string(),
    size: v.number(),
  }),
  v.transform((blob) => ({
    $type: "blob" as const,
    ref: { $link: blob.ref.$link },
    mimeType: blob.mimeType,
    size: blob.size,
  })),
);

export type Blob = v.InferOutput<typeof blobSchema>;

/**
 * The image types Discord accepts for avatars and banners. Animated GIF, WebP and AVIF are allowed; whether to animate is each app's choice.
 *
 * Wider than Bluesky's PNG/JPEG on purpose: nothing in the protocol limits a blob's type, and bsky.social and Cirrus both accept these.
 */
export const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
] as const;

/**
 * 10 MB, Discord's ceiling. bsky.social and Cirrus accept far more; a self-hosted reference PDS refuses over 5 MB unless configured otherwise, so an upload can still be refused by the person's own server.
 */
export const MAX_IMAGE_BYTES = 10_000_000;

const imageSchema = v.pipe(
  blobSchema,
  v.check(
    (blob) => (IMAGE_TYPES as readonly string[]).includes(blob.mimeType),
    "Images must be PNG, JPEG, GIF, WebP or AVIF",
  ),
  v.check((blob) => blob.size <= MAX_IMAGE_BYTES, "Images must be 10 MB or smaller"),
);

const text = (graphemes: number, length: number) =>
  v.pipe(v.string(), v.maxGraphemes(graphemes), v.maxLength(length));

/** `social.omote.profile`: how the account appears in one context. */
export const profileOverrideSchema = v.object({
  displayName: v.optional(text(64, 640)),
  description: v.optional(text(256, 2560)),
  pronouns: v.optional(text(20, 200)),
  website: v.optional(v.pipe(v.string(), v.url())),
  avatar: v.optional(imageSchema),
  banner: v.optional(imageSchema),
  // Lexicon `knownValues` are open, so unknown entries are kept rather than rejected.
  hide: v.optional(v.pipe(v.array(v.string()), v.maxLength(6))),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
});

export type ProfileOverride = v.InferOutput<typeof profileOverrideSchema>;

/**
 * The parts of `app.bsky.actor.profile` a base contributes.
 *
 * Loose on purpose: this is someone else's record, so anything we do not use is ignored rather than validated, and a field that fails its check is dropped rather than failing the whole profile.
 */
/** A field kept if valid and dropped if not, instead of failing the whole record. */
const lenient = <T extends v.GenericSchema>(schema: T) => v.fallback(v.optional(schema), undefined);

export const baseProfileSchema = v.object({
  displayName: lenient(v.string()),
  description: lenient(v.string()),
  pronouns: lenient(v.string()),
  website: lenient(v.string()),
  avatar: lenient(blobSchema),
  banner: lenient(blobSchema),
});

export type BaseProfile = v.InferOutput<typeof baseProfileSchema>;

export type Source = "override" | "base" | "hidden";

/** `social.omote.getProfile#profileView`. */
export interface ProfileView {
  readonly did: string;
  readonly handle: string;
  readonly context: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly pronouns?: string;
  readonly website?: string;
  /** Served by the account's own PDS. */
  readonly avatar?: string;
  readonly banner?: string;
  readonly sources: Partial<Record<Field, Source>>;
}
