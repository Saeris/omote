import {
  NSID_BSKY_PROFILE,
  NSID_PROFILE,
  blobSchema,
  type Blob,
  type Field,
} from "@omote-social/lexicon";
import * as v from "valibot";

/**
 * Other apps' own profile records: `social.grain.actor.profile`, `sh.tangled.actor.profile`, `dev.npmx.actor.profile` and the like.
 *
 * Accounts accumulate these one per app, each with its own display name and avatar, and nothing tells the account holder which app reads which. The editor shows them beside the base profile and omote's overrides so that finally something does. It only reads them: editing another app's record is that app's business until it adopts omote.
 */

export interface NativeProfile {
  /** The app, by the first two segments of the collection's NSID (e.g. `social.grain`). */
  readonly context: string;
  readonly collection: string;
  readonly fields: Partial<Record<Field, string | Blob>>;
}

/**
 * Whether a collection is an app's profile of the account: `*.profile`, or Sifa's `*.profile.self`.
 *
 * Deliberately narrow. Records like Sifa's `id.sifa.profile.education` are CV entries, not how the account is named or pictured, and the base profile and omote's own records are shown separately.
 */
export const isNativeProfile = (collection: string): boolean =>
  collection !== NSID_BSKY_PROFILE &&
  collection !== NSID_PROFILE &&
  (collection.endsWith(".profile") || collection.endsWith(".profile.self"));

/**
 * The app a collection belongs to, as a context: its first two segments.
 *
 * A heuristic. It is right for every app seen so far (`social.grain`, `sh.tangled`, `network.slices`, `fyi.atstore`), and wrong under multi-part public suffixes such as `uk.co.example`. An app declaring its own context would make it exact.
 */
export const contextOf = (collection: string): string =>
  collection.split(".").slice(0, 2).join(".");

const text = (value: unknown) =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;
const image = (value: unknown) => {
  const parsed = v.safeParse(blobSchema, value);
  return parsed.success ? parsed.output : undefined;
};

/**
 * The fields omote knows, read from another app's record by the names apps actually use. Unknown shapes contribute nothing rather than guessing.
 */
export const readNativeFields = (value: unknown): NativeProfile["fields"] => {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const fields: NativeProfile["fields"] = {
    displayName: text(record.displayName) ?? text(record.name),
    // Sifa calls its bio `about`.
    description: text(record.description) ?? text(record.bio) ?? text(record.about),
    pronouns: text(record.pronouns),
    website: text(record.website) ?? text(record.mainLink),
    avatar: image(record.avatar),
    banner: image(record.banner),
  };

  return Object.fromEntries(Object.entries(fields).filter(([, field]) => field !== undefined));
};
