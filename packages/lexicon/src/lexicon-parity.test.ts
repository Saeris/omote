import { readFileSync } from "node:fs";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
  FIELDS,
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  NSID_PROFILE,
  contextSchema,
  profileOverrideSchema,
} from "./index";

/**
 * The JSON lexicon is what every other app and PDS reads; the Valibot schema is what our code enforces. If they disagree, we accept records the network rejects, or reject ones it accepts. These tests pin the limits that matter.
 */

const lexicon = JSON.parse(
  readFileSync(new URL("../lexicons/social/omote/profile.json", import.meta.url), "utf8"),
) as {
  id: string;
  defs: {
    main: {
      key: string;
      record: {
        required: string[];
        properties: Record<
          string,
          {
            maxGraphemes?: number;
            maxLength?: number;
            accept?: string[];
            maxSize?: number;
            items?: { knownValues?: string[] };
          }
        >;
      };
    };
  };
};
const properties = lexicon.defs.main.record.properties;

const record = (overrides: Record<string, unknown>) => ({
  createdAt: "2026-09-26T00:00:00.000Z",
  ...overrides,
});
const accepts = (value: unknown) => v.safeParse(profileOverrideSchema, value).success;

describe("the profile lexicon and its schema", () => {
  it("share an NSID", () => {
    expect(lexicon.id).toBe(NSID_PROFILE);
  });

  it("agree on which fields exist, so hide can name every one", () => {
    const declared = Object.keys(properties).filter((key) => !["hide", "createdAt"].includes(key));

    expect(declared).toEqual([...FIELDS]);
    expect(properties.hide?.items?.knownValues).toEqual([...FIELDS]);
  });

  it.each([
    ["displayName", 64],
    ["description", 256],
    ["pronouns", 20],
  ] as const)("agree on how long %s may be", (field, graphemes) => {
    expect(properties[field]?.maxGraphemes).toBe(graphemes);
    expect(accepts(record({ [field]: "x".repeat(graphemes) }))).toBe(true);
    expect(accepts(record({ [field]: "x".repeat(graphemes + 1) }))).toBe(false);
  });

  it("count graphemes, not code units, so an emoji name is not cut short", () => {
    expect(accepts(record({ pronouns: "🏳️‍⚧️".repeat(20) }))).toBe(true);
  });

  it("require only createdAt: an override is sparse by design", () => {
    expect(lexicon.defs.main.record.required).toEqual(["createdAt"]);
    expect(accepts(record({}))).toBe(true);
  });
});

describe("a context", () => {
  it("is an app's reversed domain, which is also a valid record key", () => {
    expect(lexicon.defs.main.key).toBe("any");
    expect(v.is(contextSchema, "social.taproom")).toBe(true);
    expect(v.is(contextSchema, "place.stream")).toBe(true);
  });

  it("rejects what is not a reversed domain, so one app cannot be spelled two ways", () => {
    for (const value of [
      "taproom",
      "Social.Taproom",
      "social..taproom",
      "https://taproom.social",
      "social.taproom/",
    ]) {
      expect(v.is(contextSchema, value)).toBe(false);
    }
  });
});

describe("an image in a record", () => {
  const link = "bafkreibq2jwzpz3nqshkomrrqdrdced6mt73dmupg2qjf4iybntn7s5p2m";

  it("is read as Cirrus's listRecords returns it, without $type, and written back canonically", () => {
    // Seen live on venue-pds.taproom.social: getRecord returns the canonical form, listRecords this one.
    const fromListRecords = {
      ref: { $link: link },
      mimeType: "image/png",
      size: 2799,
      original: { $type: "blob", ref: { $link: link }, mimeType: "image/png", size: 2799 },
    };

    const parsed = v.parse(profileOverrideSchema, record({ avatar: fromListRecords }));

    expect(parsed.avatar).toEqual({
      $type: "blob",
      ref: { $link: link },
      mimeType: "image/png",
      size: 2799,
    });
  });
});

describe("images", () => {
  const link = "bafkreibq2jwzpz3nqshkomrrqdrdced6mt73dmupg2qjf4iybntn7s5p2m";
  const image = (mimeType: string, size = 1000) => ({
    $type: "blob",
    ref: { $link: link },
    mimeType,
    size,
  });

  it.each(["avatar", "banner"])(
    "agree on what a %s may be, matching Discord's formats and ceiling",
    (field) => {
      expect(properties[field]?.accept).toEqual([...IMAGE_TYPES]);
      expect(properties[field]?.maxSize).toBe(MAX_IMAGE_BYTES);
    },
  );

  it("accepts WebP and animated formats, which people use for avatars everywhere else", () => {
    for (const type of ["image/webp", "image/gif", "image/avif"]) {
      expect(accepts(record({ avatar: image(type) }))).toBe(true);
    }
  });

  it("refuses what is not an image, or is larger than the ceiling", () => {
    expect(accepts(record({ avatar: image("video/mp4") }))).toBe(false);
    expect(accepts(record({ banner: image("image/png", MAX_IMAGE_BYTES + 1) }))).toBe(false);
  });
});
