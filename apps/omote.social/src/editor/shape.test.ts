import baseLexicon from "@omote-social/lexicon/lexicons/social/omote/actor/profile.json";
import { describe, expect, it } from "vitest";
import { accepts, readProfileShape } from "./shape";

const lexicon = (record: Record<string, unknown>) => ({
  lexicon: 1,
  id: "com.example.actor.profile",
  defs: { main: { type: "record", key: "literal:self", record: { type: "object", ...record } } },
});

const image = { type: "blob", accept: ["image/png", "image/jpeg"], maxSize: 1_000_000 };

describe("reading an app's profile lexicon", () => {
  it("finds the shared fields it declares, with its own limits", () => {
    // Shaped like npmx's published lexicon, which requires a name.
    const shape = readProfileShape(
      lexicon({
        required: ["displayName"],
        properties: {
          displayName: { type: "string", maxGraphemes: 64, maxLength: 640 },
          description: { type: "string", maxGraphemes: 256 },
          avatar: image,
        },
      }),
    );

    expect(shape?.fields.displayName).toEqual({
      kind: "text",
      maxGraphemes: 64,
      maxLength: 640,
      required: true,
      nullable: false,
    });
    expect(shape?.fields.avatar).toMatchObject({ kind: "image", maxSize: 1_000_000 });
    expect(Object.keys(shape?.fields ?? {})).toEqual(["displayName", "description", "avatar"]);
  });

  it("leaves out a shared name with another type, which omote must not write", () => {
    const shape = readProfileShape(lexicon({ properties: { website: { type: "array" } } }));

    expect(shape?.fields).toEqual({});
  });

  it("knows a lexicon that adopted extends from one that didn't", () => {
    expect(readProfileShape(baseLexicon)?.extends).toBe(true);
    expect(readProfileShape(lexicon({ properties: {} }))?.extends).toBe(false);
  });

  it("allows null only where the lexicon says so, since an app may break on one it doesn't expect", () => {
    const shape = readProfileShape(baseLexicon);

    expect(shape?.fields.description?.nullable).toBe(true);
    expect(
      readProfileShape(lexicon({ properties: { description: { type: "string" } } }))?.fields
        .description?.nullable,
    ).toBe(false);
  });

  it("refuses what isn't a record lexicon", () => {
    expect(readProfileShape({ defs: { main: { type: "query" } } })).toBeUndefined();
    expect(readProfileShape("nonsense")).toBeUndefined();
  });
});

describe("an image's type", () => {
  it("is checked against the record's own formats, wildcards included", () => {
    const rule = { kind: "image", required: false, nullable: false } as const;

    expect(accepts({ ...rule, accept: ["image/png", "image/jpeg"] }, "image/webp")).toBe(false);
    expect(accepts({ ...rule, accept: ["image/*"] }, "image/webp")).toBe(true);
    expect(accepts(rule, "image/webp")).toBe(true);
  });
});
