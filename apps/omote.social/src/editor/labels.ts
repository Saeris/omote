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

/** A value this record holds for itself, which no other profile shows unless it builds on this one. */
export const ownLabel = (here: string): string => `Only in ${nameOf(here)}`;

/** This record hides the field, whatever its bases say. */
export const hiddenLabel = (here: string): string => `Hidden in ${nameOf(here)}`;

/** Where a field came from, as seen from one record: its own value, or which profile it follows. */
export const sourceLabel = (here: string, source: Source): string => {
  const own = source.collection === here;
  if (source.hidden) return own ? hiddenLabel(here) : `Hidden by ${nameOf(source.collection)}`;
  return own ? ownLabel(here) : `From ${nameOf(source.collection)}`;
};
