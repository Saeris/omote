import { readProfileRecord, resolveProfile, type Resolved } from "@omote-social/profiles";
import { byPrecedence } from "./collections";

/**
 * Every place the account appears, and where each field there comes from: the answer to "if I change my avatar on Bluesky, does it change on Grain?".
 *
 * One entry per profile record, each resolved through its own `extends`, exactly as an app following the spec would.
 */

export interface Appearance {
  readonly collection: string;
  /** The bases the record names. Empty for a root, which inherits nothing. */
  readonly extends: readonly string[];
  readonly resolved: Resolved;
}

export const buildOverview = (profiles: ReadonlyMap<string, unknown>): Appearance[] =>
  [...profiles.keys()].sort(byPrecedence).map((collection) => ({
    collection,
    extends: readProfileRecord(profiles.get(collection)).extends,
    resolved: resolveProfile(profiles, collection),
  }));
