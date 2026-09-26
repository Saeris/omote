import { NSID_BASE_PROFILE, NSID_BSKY_PROFILE } from "@omote-social/lexicon";

/**
 * Which of an account's collections are profiles, and what to call them.
 *
 * Accounts accumulate profile records one per app (`social.grain.actor.profile`, `sh.tangled.actor.profile`, `dev.npmx.actor.profile`), each with its own display name and avatar, and nothing tells the account holder which app reads which. The editor shows them side by side so that finally something does.
 */

/**
 * Whether a collection is an app's profile of the account: `*.profile`, or Sifa's `*.profile.self`.
 *
 * Deliberately narrow. Records like Sifa's `id.sifa.profile.education` are CV entries, not how the account is named or pictured.
 */
export const isProfileCollection = (collection: string): boolean =>
  collection.endsWith(".profile") || collection.endsWith(".profile.self");

/**
 * The app a collection belongs to, by its first two segments (e.g. `social.grain`).
 *
 * A heuristic. It is right for every app seen so far (`social.grain`, `sh.tangled`, `network.slices`, `fyi.atstore`), and wrong under multi-part public suffixes such as `uk.co.example`. An app declaring itself would make it exact.
 */
export const appOf = (collection: string): string => collection.split(".").slice(0, 2).join(".");

/** What to call a collection's record to a person. */
export const nameOf = (collection: string): string =>
  collection === NSID_BSKY_PROFILE
    ? "Bluesky"
    : collection === NSID_BASE_PROFILE
      ? "Shared profile"
      : appOf(collection);

/** Bluesky first, as most people's root, then the shared base, then every other app. */
export const byPrecedence = (a: string, b: string): number => {
  const rank = (collection: string) =>
    collection === NSID_BSKY_PROFILE ? 0 : collection === NSID_BASE_PROFILE ? 1 : 2;
  return rank(a) - rank(b) || a.localeCompare(b);
};
