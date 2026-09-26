import { FIELDS, type Blob, type Field, type Source } from "@omote-social/lexicon";
import { readProfileRecord, resolveProfile } from "@omote-social/profiles";
import { byPrecedence } from "./collections";

/**
 * Every place the account appears, and where each field there comes from: the answer to "if I change my avatar on Bluesky, does it change on Grain?".
 *
 * One column per profile record, each resolved through its own `extends`, exactly as an app following the spec would.
 */

export interface Cell {
  readonly value?: string | Blob;
  /** The record the value came from, or the one that hid it. Absent when no record in the chain mentions the field. */
  readonly source?: Source;
}

export interface Column {
  readonly collection: string;
  /** The bases the record names. Empty for a root, which inherits nothing. */
  readonly extends: readonly string[];
  readonly cells: Readonly<Record<Field, Cell>>;
}

export const buildOverview = (profiles: ReadonlyMap<string, unknown>): Column[] =>
  [...profiles.keys()].sort(byPrecedence).map((collection) => {
    const { fields, sources } = resolveProfile(profiles, collection);
    const cells = Object.fromEntries(
      FIELDS.map((field) => [
        field,
        {
          ...(fields[field] !== undefined && { value: fields[field] }),
          ...(sources[field] && { source: sources[field] }),
        },
      ]),
    ) as Record<Field, Cell>;

    return { collection, extends: readProfileRecord(profiles.get(collection)).extends, cells };
  });
