import type { Field, Source } from "@omote-social/lexicon";
import { nameOf } from "./collections";

/** How each field is named to people, everywhere in the editor. */
export const FIELD_LABEL: Record<Field, string> = {
  displayName: "Name",
  description: "Bio",
  pronouns: "Pronouns",
  website: "Website",
  avatar: "Avatar",
  banner: "Banner",
};

/** Where a field came from, as seen from one record. */
export const sourceLabel = (here: string, source: Source): string => {
  const own = source.collection === here;
  if (source.hidden) return own ? "Hidden here" : `Hidden by ${nameOf(source.collection)}`;
  return own ? "Set here" : `From ${nameOf(source.collection)}`;
};
