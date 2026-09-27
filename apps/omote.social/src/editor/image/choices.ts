import type { Blob as BlobRef } from "@omote-social/lexicon";
import { readProfileRecord } from "@omote-social/profiles";
import { byPrecedence } from "../collections";

export interface Choice {
  readonly collection: string;
  readonly image: BlobRef;
}

/**
 * The avatars (or banners) the account's profiles already hold, each once, Bluesky's first. Discord offers your recent uploads; the nearest thing an account has is what its profiles use.
 *
 * Only images a profile holds itself: an inherited one is the same image as its source's.
 */
export const imageChoices = (
  profiles: ReadonlyMap<string, unknown>,
  field: "avatar" | "banner",
): Choice[] => {
  const seen = new Set<string>();
  const choices: Choice[] = [];
  for (const collection of [...profiles.keys()].sort(byPrecedence)) {
    const image = readProfileRecord(profiles.get(collection)).fields[field];
    if (typeof image !== "object" || image === null || seen.has(image.ref.$link)) continue;
    seen.add(image.ref.$link);
    choices.push({ collection, image });
  }
  return choices;
};
