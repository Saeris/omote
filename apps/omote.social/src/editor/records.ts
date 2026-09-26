import {
  FIELDS,
  NSID_BASE_PROFILE,
  NSID_BSKY_PROFILE,
  type Blob,
  type Field,
} from "@omote-social/lexicon";
import * as v from "valibot";

/** The text fields a person edits. Images are uploaded separately and carried as blob references. */
export const TEXT_FIELDS = ["displayName", "description", "pronouns", "website"] as const;
export type TextField = (typeof TEXT_FIELDS)[number];

const text = (graphemes: number, label: string) =>
  v.pipe(v.string(), v.maxGraphemes(graphemes, `${label} can be at most ${graphemes} characters`));

/**
 * The form. Every text field allows empty, which means "inherit", not "show nothing": hiding is its own control, written as `null`.
 */
export const formSchema = v.object({
  displayName: text(64, "A name"),
  description: text(256, "A bio"),
  pronouns: text(20, "Pronouns"),
  website: v.union([
    v.literal(""),
    v.pipe(v.string(), v.url("A website must be a full URL, like https://example.com")),
  ]),
  hide: v.array(v.picklist(FIELDS)),
  /** Whether `extends` names Bluesky's profile. */
  fromBluesky: v.boolean(),
});

export type FormValues = v.InferOutput<typeof formSchema>;
export type Images = Partial<Record<"avatar" | "banner", Blob>>;

const basesOf = (record: Record<string, unknown> | undefined): string[] =>
  Array.isArray(record?.extends)
    ? record.extends.filter((entry): entry is string => typeof entry === "string")
    : [];

/** A record as the form shows it: empty where the record is silent, hidden where it says `null`. */
export const toForm = (record: Record<string, unknown> | undefined): FormValues => {
  const textOf = (field: TextField) =>
    typeof record?.[field] === "string" ? (record[field] as string) : "";

  return {
    displayName: textOf("displayName"),
    description: textOf("description"),
    pronouns: textOf("pronouns"),
    website: textOf("website"),
    hide: FIELDS.filter((field) => record?.[field] === null),
    // A new shared base starts from Bluesky: it is where most people's profile is today.
    fromBluesky: record === undefined || basesOf(record).includes(NSID_BSKY_PROFILE),
  };
};

/**
 * The record to write.
 *
 * - **Blank is left out**, so the field is inherited.
 * - **Hidden is `null`**, so what the bases say doesn't show.
 * - **Everything else in the existing record is kept**, its other bases included: other apps and newer versions of omote write this record too.
 */
export const toRecord = (
  values: FormValues,
  images: Images,
  existing: Record<string, unknown> | undefined,
  now: () => string = () => new Date().toISOString(),
): Record<string, unknown> => {
  const record: Record<string, unknown> = { ...existing, $type: NSID_BASE_PROFILE };
  for (const field of FIELDS) delete record[field];

  const hidden = new Set<Field>(values.hide);
  for (const field of TEXT_FIELDS) {
    const value = values[field].trim();
    if (hidden.has(field)) record[field] = null;
    else if (value !== "") record[field] = value;
  }
  for (const field of ["avatar", "banner"] as const) {
    if (hidden.has(field)) record[field] = null;
    else if (images[field]) record[field] = images[field];
  }

  const others = basesOf(existing).filter((base) => base !== NSID_BSKY_PROFILE);
  const bases = values.fromBluesky ? [NSID_BSKY_PROFILE, ...others] : others;
  if (bases.length > 0) record.extends = bases;
  else delete record.extends;

  record.createdAt = existing?.createdAt ?? now();

  return record;
};
