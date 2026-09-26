/**
 * The omote lexicons, as Valibot schemas.
 *
 * The JSON in `lexicons/` is what the network reads; these are what our code parses with. `lexicon-parity.test.ts` holds the two to the same limits, so neither can drift.
 */

import { isNsid } from "@atcute/lexicons/syntax";
import * as v from "valibot";

/** The shared base: a profile that belongs to the account holder, not to an app. */
export const NSID_BASE_PROFILE = "social.omote.actor.profile";
export const NSID_GET_PROFILE = "social.omote.getProfile";
/** Bluesky's profile: the template for the shared fields, and the root most accounts have today. */
export const NSID_BSKY_PROFILE = "app.bsky.actor.profile";

/** The shared fields, in display order: Bluesky's names and types, which every profile record can take part in inheritance with. */
export const FIELDS = [
  "displayName",
  "description",
  "pronouns",
  "website",
  "avatar",
  "banner",
] as const;

export type Field = (typeof FIELDS)[number];

/** How many bases one record may name. */
export const MAX_EXTENDS = 8;

/** A collection's NSID, e.g. `app.bsky.actor.profile`. */
export const nsidSchema = v.pipe(
  v.string(),
  v.check((value) => isNsid(value), "Not an NSID"),
);

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
 * Wider than Bluesky's PNG/JPEG on purpose: limits are not part of the shared type, nothing in the protocol limits a blob's type, and bsky.social and Cirrus both accept these.
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

/** A shared field: absent inherits, `null` hides what the bases say. */
const shared = <T extends v.GenericSchema>(schema: T) => v.optional(v.nullable(schema));

/**
 * `social.omote.actor.profile`: the shared base, and the template apps copy.
 *
 * Loose, so a record written by a newer version of this lexicon keeps the fields this one doesn't know when it is parsed and written back.
 */
export const baseProfileSchema = v.looseObject({
  extends: v.optional(v.pipe(v.array(nsidSchema), v.maxLength(MAX_EXTENDS))),
  displayName: shared(text(64, 640)),
  description: shared(text(256, 2560)),
  pronouns: shared(text(20, 200)),
  website: shared(v.pipe(v.string(), v.url())),
  avatar: shared(imageSchema),
  banner: shared(imageSchema),
  createdAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
});

export type BaseProfile = v.InferOutput<typeof baseProfileSchema>;

/** `social.omote.getProfile#source`: the record a field came from, or the one whose `null` hid it. */
export interface Source {
  readonly collection: string;
  readonly hidden?: true;
}

/** `social.omote.getProfile#profileView`. */
export interface ProfileView {
  readonly did: string;
  readonly handle: string;
  readonly collection: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly pronouns?: string;
  readonly website?: string;
  /** Served by the account's own PDS. */
  readonly avatar?: string;
  readonly banner?: string;
  readonly sources: Partial<Record<Field, Source>>;
  /** The records applied, lowest precedence first. */
  readonly chain: readonly string[];
}
