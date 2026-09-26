import {
  FIELDS,
  NSID_BSKY_PROFILE,
  blobSchema,
  type Blob,
  type Field,
} from "@omote-social/lexicon";
import { resolveProfile, type Resolved } from "@omote-social/profiles";
import * as v from "valibot";
import type { FieldRule, ProfileShape } from "./shape";

/**
 * One profile record as a form.
 *
 * Every field shows what the app will show, so a person starts from their existing profile rather than a blank form. But a record should say only what differs, so each field also carries a mode:
 *
 * - **inherit**: the record says nothing, and the field shows what its bases give;
 * - **set**: the record holds this value;
 * - **hide**: the record holds `null`, where its lexicon allows it.
 *
 * Typing into an inherited field sets it. Saving writes only what is set or hidden, so an untouched field keeps following its bases.
 */

export type Mode = "inherit" | "set" | "hide";

export interface FieldValue {
  readonly mode: Mode;
  /** The text as set. Empty while inheriting; the form shows the inherited value instead. */
  readonly text: string;
  readonly image?: Blob;
}

export interface FormValues {
  readonly fields: Partial<Record<Field, FieldValue>>;
  /** Whether `extends` names Bluesky's profile. Only offered where the lexicon has `extends`. */
  readonly fromBluesky: boolean;
}

const imageOf = (value: unknown) => {
  const parsed = v.safeParse(blobSchema, value);
  return parsed.success ? parsed.output : undefined;
};

const basesOf = (record: Record<string, unknown> | undefined): string[] =>
  Array.isArray(record?.extends)
    ? record.extends.filter((entry): entry is string => typeof entry === "string")
    : [];

/** A record as the form starts: set where it holds a value, hidden where it holds `null`, inheriting elsewhere. */
export const toForm = (
  record: Record<string, unknown> | undefined,
  shape: ProfileShape,
): FormValues => {
  const fields: Partial<Record<Field, FieldValue>> = {};
  for (const field of FIELDS) {
    const rule = shape.fields[field];
    if (!rule) continue;

    const own = record?.[field];
    if (own === null) {
      fields[field] = { mode: "hide", text: "" };
    } else if (rule.kind === "text" && typeof own === "string" && own.trim() !== "") {
      fields[field] = { mode: "set", text: own };
    } else if (rule.kind === "image" && imageOf(own)) {
      fields[field] = { mode: "set", text: "", image: imageOf(own) };
    } else {
      fields[field] = { mode: "inherit", text: "" };
    }
  }

  return {
    fields,
    // A new record that can build on others starts from Bluesky: it is where most people's profile is today.
    fromBluesky: record === undefined || basesOf(record).includes(NSID_BSKY_PROFILE),
  };
};

/** The bases a record will name once saved: its other bases kept, Bluesky's added or removed as chosen. */
export const basesFor = (
  values: FormValues,
  existing: Record<string, unknown> | undefined,
): string[] => {
  const others = basesOf(existing).filter((base) => base !== NSID_BSKY_PROFILE);
  return values.fromBluesky ? [NSID_BSKY_PROFILE, ...others] : others;
};

/**
 * The record to write.
 *
 * - **Set** writes the value; a set text left blank is removed.
 * - **Hide** writes `null`, only where the lexicon allows it.
 * - **Inherit** leaves the field out.
 * - **Everything else in the existing record is kept**, unknown fields and other bases included: other apps write these records too.
 * - **Fields the lexicon doesn't declare are never touched.**
 */
export const toRecord = (
  values: FormValues,
  existing: Record<string, unknown> | undefined,
  collection: string,
  shape: ProfileShape,
  now: () => string = () => new Date().toISOString(),
): Record<string, unknown> => {
  const record: Record<string, unknown> = { ...existing, $type: collection };

  for (const field of FIELDS) {
    const rule = shape.fields[field];
    const value = values.fields[field];
    if (!rule || !value) continue;

    delete record[field];
    if (value.mode === "hide" && rule.nullable) {
      record[field] = null;
    } else if (value.mode === "set" && rule.kind === "text" && value.text.trim() !== "") {
      record[field] = value.text.trim();
    } else if (value.mode === "set" && rule.kind === "image" && value.image) {
      record[field] = value.image;
    }
  }

  if (shape.extends) {
    const bases = basesFor(values, existing);
    if (bases.length > 0) record.extends = bases;
    else delete record.extends;
  }

  if (shape.createdAt && typeof record.createdAt !== "string") {
    record.createdAt = now();
  }

  return record;
};

/**
 * What each field would show if this record said nothing about it: its bases, folded. This is what an inheriting field displays.
 */
export const inheritedFor = (
  profiles: ReadonlyMap<string, unknown>,
  collection: string,
  bases: readonly string[],
): Resolved => {
  const others = new Map(profiles);
  others.set(collection, bases.length > 0 ? { extends: bases } : {});
  return resolveProfile(others, collection);
};

const graphemes = (text: string) =>
  [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length;

const isWebLink = (text: string) => {
  try {
    return ["http:", "https:"].includes(new URL(text).protocol);
  } catch {
    return false;
  }
};

/**
 * What's wrong with one field, in words for the person, or `undefined`.
 *
 * Checked against this record's own lexicon, not omote's: a name Bluesky allows may be too long for another app.
 */
export const fieldProblem = (
  field: Field,
  value: FieldValue,
  rule: FieldRule,
  standsAlone: boolean,
): string | undefined => {
  const text = value.text.trim();
  // With nothing to inherit from, leaving a required field unset leaves it empty.
  const empty =
    value.mode === "hide" || (value.mode === "set" ? text === "" && !value.image : standsAlone);
  if (rule.required && empty) return "This app requires it.";
  if (value.mode !== "set" || rule.kind !== "text" || text === "") return undefined;

  if (rule.maxGraphemes !== undefined && graphemes(text) > rule.maxGraphemes) {
    return `This app allows at most ${rule.maxGraphemes} characters.`;
  }
  if (rule.maxLength !== undefined && new TextEncoder().encode(text).length > rule.maxLength) {
    return "This is too long for this app.";
  }
  if (field === "website" && !isWebLink(text)) {
    return "A website must be a full link, like https://example.com";
  }
  return undefined;
};

const fieldValueSchema = v.object({
  mode: v.picklist(["inherit", "set", "hide"]),
  text: v.string(),
  image: v.optional(blobSchema),
});

/** The form's schema, built from one record's lexicon. */
export const formSchemaFor = (shape: ProfileShape) =>
  v.object({
    fields: v.object(
      Object.fromEntries(
        FIELDS.flatMap((field) => {
          const rule = shape.fields[field];
          if (!rule) return [];
          const problem = (value: FieldValue) => fieldProblem(field, value, rule, !shape.extends);
          return [
            [
              field,
              v.pipe(
                fieldValueSchema,
                v.check(
                  (value) => problem(value) === undefined,
                  (issue) => problem(issue.input as FieldValue) ?? "Invalid",
                ),
              ),
            ],
          ];
        }),
      ),
    ),
    fromBluesky: v.boolean(),
  });
