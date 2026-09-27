import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
  FIELDS,
  IMAGE_TYPES,
  MAX_EXTENDS,
  MAX_IMAGE_BYTES,
  NSID_BASE_PROFILE,
  baseProfileSchema,
} from "../index";
import lexicon from "../../lexicons/social/omote/actor/profile.json" with { type: "json" };

/**
 * The JSON lexicon is what every other app and PDS reads; the Valibot schema is what our code enforces. If they disagree, we accept records the network rejects, or reject ones it accepts. These tests pin the limits that matter.
 */

const { record: schema } = lexicon.defs.main;
const properties = schema.properties;

const accepts = (value: unknown) => v.safeParse(baseProfileSchema, value).success;

describe("the shared base's lexicon and its schema", () => {
  it("share an NSID", () => {
    expect(lexicon.id).toBe(NSID_BASE_PROFILE);
  });

  it("key the record self, since extends finds a base by its collection's self record", () => {
    expect(lexicon.defs.main.key).toBe("literal:self");
  });

  it("declare exactly the shared fields, plus extends and createdAt", () => {
    expect(Object.keys(properties).sort()).toEqual([...FIELDS, "extends", "createdAt"].sort());
  });

  it("let every shared field be hidden, and none be required, as a Partial of the shared type", () => {
    expect(schema.nullable).toEqual([...FIELDS]);
    expect(schema).not.toHaveProperty("required");
    expect(accepts({})).toBe(true);
    for (const field of FIELDS) {
      expect(accepts({ [field]: null })).toBe(true);
    }
  });

  it("keep Bluesky's text limits, since Bluesky's profile is the template", () => {
    expect(properties.displayName.maxGraphemes).toBe(64);
    expect(properties.description.maxGraphemes).toBe(256);
    expect(properties.pronouns.maxGraphemes).toBe(20);
  });

  it.each([
    ["displayName", 64],
    ["description", 256],
    ["pronouns", 20],
  ] as const)("agree on how long %s may be", (field, graphemes) => {
    expect(accepts({ [field]: "x".repeat(graphemes) })).toBe(true);
    expect(accepts({ [field]: "x".repeat(graphemes + 1) })).toBe(false);
  });

  it("count graphemes, not code units, so an emoji name is not cut short", () => {
    expect(accepts({ pronouns: "🏳️‍⚧️".repeat(20) })).toBe(true);
  });
});

describe("extends", () => {
  it("is an array of NSIDs from the start, since changing a string to an array later breaks every reader", () => {
    expect(properties.extends).toMatchObject({
      type: "array",
      maxLength: MAX_EXTENDS,
      items: { type: "string", format: "nsid" },
    });
  });

  it("names collections, not records or URLs, so a profile only ever inherits from its own account", () => {
    expect(accepts({ extends: ["app.bsky.actor.profile"] })).toBe(true);
    expect(accepts({ extends: ["at://did:plc:abc/app.bsky.actor.profile/self"] })).toBe(false);
    expect(accepts({ extends: ["https://bsky.app"] })).toBe(false);
  });

  it("is bounded, so a record cannot make every reader fetch without end", () => {
    const many = Array.from({ length: MAX_EXTENDS + 1 }, (_, i) => `com.example${i}.profile`);

    expect(accepts({ extends: many.slice(0, MAX_EXTENDS) })).toBe(true);
    expect(accepts({ extends: many })).toBe(false);
  });
});

describe("the template", () => {
  it("accepts a Bluesky profile as it is, since the shapes are the same", () => {
    // Shaped like a real app.bsky.actor.profile record, including fields only Bluesky uses.
    const bluesky = {
      $type: "app.bsky.actor.profile",
      displayName: "Alice Mori",
      description: "Posting about lagers.",
      avatar: {
        $type: "blob",
        ref: { $link: "bafkreibme22gw2h7y2h7tg2fhqotaqjucnbc24deqo72b6mkl2egezxhvy" },
        mimeType: "image/jpeg",
        size: 91_234,
      },
      pinnedPost: { uri: "at://did:plc:alice/app.bsky.feed.post/3k", cid: "bafyrei" },
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const parsed = v.parse(baseProfileSchema, bluesky);

    // And keeps what it doesn't know, so reading and writing back loses nothing.
    expect(parsed).toMatchObject({ pinnedPost: bluesky.pinnedPost });
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

    const parsed = v.parse(baseProfileSchema, { avatar: fromListRecords });

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

  it.each(["avatar", "banner"] as const)(
    "agree on what a %s may be, matching Discord's formats and ceiling",
    (field) => {
      expect(properties[field].accept).toEqual([...IMAGE_TYPES]);
      expect(properties[field].maxSize).toBe(MAX_IMAGE_BYTES);
    },
  );

  it("accepts WebP and animated formats, which people use for avatars everywhere else", () => {
    for (const type of ["image/webp", "image/gif", "image/avif"]) {
      expect(accepts({ avatar: image(type) })).toBe(true);
    }
  });

  it("refuses what is not an image, or is larger than the ceiling", () => {
    expect(accepts({ avatar: image("video/mp4") })).toBe(false);
    expect(accepts({ banner: image("image/png", MAX_IMAGE_BYTES + 1) })).toBe(false);
  });
});
