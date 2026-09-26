import {
  FIELDS,
  type BaseProfile,
  type Blob,
  type Field,
  type ProfileOverride,
  type Source,
} from "@omote/lexicon";

/** A field's value before blobs become URLs. */
type Value = string | Blob;

export interface Merged {
  readonly fields: Partial<Record<Field, Value>>;
  readonly sources: Partial<Record<Field, Source>>;
}

/**
 * One context's profile: the override where it says something, the base where it does not, minus what the override hides.
 *
 * Pure, and the heart of the model, so every app that resolves profiles, through this library or by hand, should land on the same answer:
 *
 * 1. **A field the override sets wins.** Hiding it as well changes nothing, since `hide` only ever removes inherited values.
 * 2. **A hidden field is left out**, even though the base has it. "Don't show my Bluesky bio here" matters as much as a different name.
 * 3. **Otherwise the base shows through.**
 */
export const mergeProfile = (
  base: BaseProfile | undefined,
  override: ProfileOverride | undefined,
): Merged => {
  const hidden = new Set(override?.hide ?? []);
  const fields: Partial<Record<Field, Value>> = {};
  const sources: Partial<Record<Field, Source>> = {};

  for (const field of FIELDS) {
    const own = override?.[field];
    const inherited = base?.[field];

    if (own !== undefined) {
      fields[field] = own;
      sources[field] = "override";
    } else if (inherited !== undefined && hidden.has(field)) {
      sources[field] = "hidden";
    } else if (inherited !== undefined) {
      fields[field] = inherited;
      sources[field] = "base";
    }
  }

  return { fields, sources };
};
