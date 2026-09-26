import { NSID_BASE_PROFILE } from "@omote-social/lexicon";

/**
 * What the editor may ask for, and when.
 *
 * Signing in asks only for the shared base and images. Editing another app's profile asks, the first time, for that one collection, so nobody grants write access to apps they don't use.
 *
 * bsky.social grants only the scopes a client's metadata names one by one: declaring `repo:*` does not cover a request for `repo:social.grain.actor.profile` (tested 2026-09-26). So every collection omote can ever request is listed here, and the metadata document and the localhost client id both declare all of them. A profile collection not listed stays read-only.
 */

/** Profile collections seen on real accounts, which omote can offer to edit. */
export const KNOWN_PROFILES = [
  "app.bsky.actor.profile",
  "com.atmosphereaccount.registry.profile",
  "dev.npmx.actor.profile",
  "fyi.atstore.profile",
  "games.gamesgamesgamesgames.actor.profile",
  "id.sifa.profile.self",
  "network.slices.actor.profile",
  "org.atmosphereconf.profile",
  "place.atwork.profile",
  "sh.tangled.actor.profile",
  "social.grain.actor.profile",
] as const;

const repo = (collection: string) => `repo:${collection}`;

/** Asked for at sign-in: the shared base, and images for it. */
export const SIGN_IN_SCOPE = ["atproto", repo(NSID_BASE_PROFILE), "blob:image/*"].join(" ");

/** Everything omote may ever ask for, which the client metadata declares. */
export const DECLARED_SCOPE = [SIGN_IN_SCOPE, ...KNOWN_PROFILES.map(repo)].join(" ");

/** Whether omote can ever write this collection. */
export const canRequest = (collection: string): boolean =>
  collection === NSID_BASE_PROFILE || (KNOWN_PROFILES as readonly string[]).includes(collection);

/** Whether a granted scope already covers writing this collection. */
export const canWrite = (granted: string, collection: string): boolean =>
  granted.split(" ").includes(repo(collection));

/** The scope to ask for to add one collection: everything already granted, plus it, so nothing already allowed is lost. */
export const withCollection = (granted: string, collection: string): string =>
  [...new Set([...granted.split(" ").filter(Boolean), repo(collection)])].join(" ");
