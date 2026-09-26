import {
  FIELDS,
  type BaseProfile,
  type Blob,
  type Field,
  type Source,
} from "@omote-social/lexicon";
import { mergeProfile } from "@omote-social/profiles";
import type { Override } from "./api";
import type { NativeProfile } from "./native";

/**
 * Every place the account appears, and where each field there comes from: the answer to "if I change my avatar on Bluesky, does it change on Grain?".
 *
 * One column per app. An app can have an omote override, its own profile record, or both, and the two mean different things, so each cell says which it is showing.
 */

export type CellOrigin =
  /** Set by omote for this app. */
  | "override"
  /** Inherited from the base profile through omote. */
  | "base"
  /** In the base profile, hidden for this app by omote. */
  | "hidden"
  /** From the app's own profile record, which omote cannot change. */
  | "native";

export interface Cell {
  readonly value?: string | Blob;
  readonly origin?: CellOrigin;
}

export interface Column {
  readonly context: string;
  /** Whether omote has an override for this app. */
  readonly override: boolean;
  /** The app's own profile record, if it keeps one. */
  readonly native?: string;
  readonly cells: Readonly<Record<Field, Cell>>;
}

export interface Overview {
  readonly base: Readonly<Record<Field, Cell>>;
  readonly columns: readonly Column[];
}

const empty = (): Record<Field, Cell> =>
  Object.fromEntries(FIELDS.map((field) => [field, {}])) as Record<Field, Cell>;

/**
 * Builds the overview.
 *
 * For an app with omote's override, cells follow omote's merge. For an app that only keeps its own record, cells show that record and nothing is inherited: whether such an app falls back to the base profile is its own choice, and claiming otherwise would be the very ambiguity this view exists to remove.
 */
export const buildOverview = (
  base: BaseProfile | undefined,
  overrides: readonly Override[],
  natives: readonly NativeProfile[],
): Overview => {
  const baseCells = empty();
  for (const field of FIELDS) {
    const value = base?.[field];
    if (value !== undefined && !(typeof value === "string" && value.trim() === "")) {
      baseCells[field] = { value, origin: "base" };
    }
  }

  const contexts = [
    ...new Set([...overrides.map((o) => o.context), ...natives.map((n) => n.context)]),
  ].sort();

  const columns = contexts.map((context): Column => {
    const override = overrides.find((o) => o.context === context);
    const native = natives.find((n) => n.context === context);
    const cells = empty();

    if (override?.record) {
      const { fields, sources } = mergeProfile(base, override.record);
      for (const field of FIELDS) {
        const source: Source | undefined = sources[field];
        if (source) cells[field] = { value: fields[field], origin: source };
      }
    } else if (native) {
      for (const field of FIELDS) {
        const value = native.fields[field];
        if (value !== undefined) cells[field] = { value, origin: "native" };
      }
    }

    return {
      context,
      override: override !== undefined,
      ...(native && { native: native.collection }),
      cells,
    };
  });

  return { base: baseCells, columns };
};
