import { FIELDS, NSID_PROFILE, type Blob, type Field, type ProfileOverride } from "@omote/lexicon";
import * as v from "valibot";

/** The text fields a person edits. Images are uploaded separately and carried as blob references. */
export const TEXT_FIELDS = ["displayName", "description", "pronouns", "website"] as const;
export type TextField = (typeof TEXT_FIELDS)[number];

const text = (graphemes: number, label: string) =>
  v.pipe(v.string(), v.maxGraphemes(graphemes, `${label} can be at most ${graphemes} characters`));

/**
 * The form. Every text field allows empty, which means "use my base profile here", not "show nothing": hiding is its own control.
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
});

export type FormValues = v.InferOutput<typeof formSchema>;
export type Images = Partial<Record<"avatar" | "banner", Blob>>;

/** A record as the form shows it: empty where the record is silent. */
export const toForm = (record: ProfileOverride | undefined): FormValues => ({
  displayName: record?.displayName ?? "",
  description: record?.description ?? "",
  pronouns: record?.pronouns ?? "",
  website: record?.website ?? "",
  hide: (record?.hide ?? []).filter((field): field is Field =>
    (FIELDS as readonly string[]).includes(field),
  ),
});

/**
 * The record to write. Blank fields are left out rather than written empty, so they fall back to the base profile: an override records only what differs.
 *
 * `createdAt` is kept from the record being edited, so it means when this context's profile was made.
 */
export const toRecord = (
  values: FormValues,
  images: Images,
  existing: ProfileOverride | undefined,
  now: () => string = () => new Date().toISOString(),
): ProfileOverride & { $type: typeof NSID_PROFILE } => {
  const record: Record<string, unknown> = { $type: NSID_PROFILE };

  for (const field of TEXT_FIELDS) {
    const value = values[field].trim();
    if (value !== "") {
      record[field] = value;
    }
  }

  if (images.avatar) record.avatar = images.avatar;
  if (images.banner) record.banner = images.banner;
  if (values.hide.length > 0) record.hide = values.hide;
  record.createdAt = existing?.createdAt ?? now();

  return record as ProfileOverride & { $type: typeof NSID_PROFILE };
};
