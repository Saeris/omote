import { describe, expect, it } from "vitest";
import { contextOf, isNativeProfile, readNativeFields } from "./native";
import { buildOverview } from "./overview-model";

const CREATED = "2026-09-26T00:00:00.000Z";
const AVATAR = {
  $type: "blob" as const,
  ref: { $link: "bafkreibme22gw2h7y2h7tg2fhqotaqjucnbc24deqo72b6mkl2egezxhvy" },
  mimeType: "image/png",
  size: 1234,
};

describe("finding other apps' profiles", () => {
  it("recognises the profile records apps keep today", () => {
    // All seen on real accounts.
    for (const collection of [
      "social.grain.actor.profile",
      "sh.tangled.actor.profile",
      "dev.npmx.actor.profile",
      "fyi.atstore.profile",
      "id.sifa.profile.self",
    ]) {
      expect(isNativeProfile(collection)).toBe(true);
    }
  });

  it("leaves out the base, omote's own records, and records that are not profiles", () => {
    for (const collection of [
      "app.bsky.actor.profile",
      "social.omote.profile",
      "id.sifa.profile.education",
      "chat.bsky.actor.declaration",
      "com.germnetwork.declaration",
    ]) {
      expect(isNativeProfile(collection)).toBe(false);
    }
  });

  it("names an app by its reversed domain", () => {
    expect(contextOf("social.grain.actor.profile")).toBe("social.grain");
    expect(contextOf("id.sifa.profile.self")).toBe("id.sifa");
  });

  it("reads the names apps actually use, and ignores what it does not understand", () => {
    expect(
      readNativeFields({
        name: "Grain",
        mainLink: "https://grain.social",
        avatar: AVATAR,
        stats: ["", ""],
      }),
    ).toEqual({ displayName: "Grain", website: "https://grain.social", avatar: AVATAR });
  });

  it("treats a blank field as absent, as Tangled's empty strings are", () => {
    expect(readNativeFields({ description: "", pronouns: "" })).toEqual({});
  });
});

describe("the overview", () => {
  const base = { displayName: "Drake", description: "Design engineer.", avatar: AVATAR };

  it("shows an app with an override as omote resolves it", () => {
    const { columns } = buildOverview(
      base,
      [
        {
          context: "social.grain",
          record: { displayName: "Drake (photos)", hide: ["description"], createdAt: CREATED },
        },
      ],
      [],
    );

    expect(columns[0]?.cells.displayName).toEqual({ value: "Drake (photos)", origin: "override" });
    expect(columns[0]?.cells.description).toEqual({ value: undefined, origin: "hidden" });
    expect(columns[0]?.cells.avatar.origin).toBe("base");
  });

  it("never claims an app with only its own record inherits from the base, since that is the app's choice", () => {
    const { columns } = buildOverview(
      base,
      [],
      [
        {
          context: "dev.npmx",
          collection: "dev.npmx.actor.profile",
          fields: { displayName: "saeris.gg" },
        },
      ],
    );

    expect(columns[0]?.cells.displayName).toEqual({ value: "saeris.gg", origin: "native" });
    expect(columns[0]?.cells.avatar).toEqual({});
  });

  it("puts an app's override and its own record in one column, noting both", () => {
    const { columns } = buildOverview(
      base,
      [{ context: "social.grain", record: { createdAt: CREATED } }],
      [
        {
          context: "social.grain",
          collection: "social.grain.actor.profile",
          fields: { displayName: "Grain" },
        },
      ],
    );

    expect(columns).toHaveLength(1);
    expect(columns[0]).toMatchObject({
      context: "social.grain",
      override: true,
      native: "social.grain.actor.profile",
    });
  });
});
