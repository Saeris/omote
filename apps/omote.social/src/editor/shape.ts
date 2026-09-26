import { FIELDS, type Field } from "@omote-social/lexicon";

/**
 * What one app's profile record accepts, read from that app's published lexicon.
 *
 * Writing another app's record safely means writing only what its own lexicon allows: its limits, its image formats, its required fields, and `null` only where it says `nullable`. Bluesky, npmx and Sifa all take PNG or JPEG up to 1 MB, npmx requires a name, and none of them allow `null`.
 */

export interface FieldRule {
  readonly kind: "text" | "image";
  readonly maxGraphemes?: number;
  readonly maxLength?: number;
  /** Media types, possibly with wildcards such as `image/*`. */
  readonly accept?: readonly string[];
  readonly maxSize?: number;
  readonly required: boolean;
  readonly nullable: boolean;
}

export interface ProfileShape {
  /** The shared fields the lexicon declares with the shared type. Others are left alone. */
  readonly fields: Partial<Record<Field, FieldRule>>;
  /** It declares `extends`, so it builds on other profiles and follows these rules. */
  readonly extends: boolean;
  /** It has a `createdAt`, which a new record should carry. */
  readonly createdAt: boolean;
}

const KIND: Record<Field, FieldRule["kind"]> = {
  displayName: "text",
  description: "text",
  pronouns: "text",
  website: "text",
  avatar: "image",
  banner: "image",
};

const LEXICON_TYPE: Record<FieldRule["kind"], string> = { text: "string", image: "blob" };

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const numberOr = (value: unknown) => (typeof value === "number" ? value : undefined);
const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/**
 * A profile lexicon document, read for the parts the editor needs. `undefined` when it isn't a record lexicon.
 *
 * Structural, like the rest of omote: a field counts when its name and type match the shared field's.
 */
export const readProfileShape = (doc: unknown): ProfileShape | undefined => {
  const main = record(record(record(doc)?.defs)?.main);
  const body = record(main?.record);
  if (main?.type !== "record" || !body) return undefined;

  const properties = record(body.properties) ?? {};
  const required = new Set(strings(body.required));
  const nullable = new Set(strings(body.nullable));
  const fields: Partial<Record<Field, FieldRule>> = {};

  for (const field of FIELDS) {
    const property = record(properties[field]);
    const kind = KIND[field];
    if (property?.type !== LEXICON_TYPE[kind]) continue;

    const accept = strings(property.accept);
    fields[field] = {
      kind,
      ...(numberOr(property.maxGraphemes) !== undefined && {
        maxGraphemes: numberOr(property.maxGraphemes),
      }),
      ...(numberOr(property.maxLength) !== undefined && {
        maxLength: numberOr(property.maxLength),
      }),
      ...(accept.length > 0 && { accept }),
      ...(numberOr(property.maxSize) !== undefined && { maxSize: numberOr(property.maxSize) }),
      required: required.has(field),
      nullable: nullable.has(field),
    };
  }

  return {
    fields,
    extends: record(properties.extends)?.type === "array",
    createdAt: record(properties.createdAt)?.type === "string",
  };
};

/** Whether a media type is one a rule accepts, wildcards included. No `accept` means any. */
export const accepts = (rule: FieldRule, type: string): boolean =>
  !rule.accept ||
  rule.accept.some((pattern) =>
    pattern.endsWith("/*") ? type.startsWith(pattern.slice(0, -1)) : pattern === type,
  );
