import { describe, expect, it } from "vitest";
import { appOf, byPrecedence, isProfileCollection } from "./collections";
import { buildOverview } from "./overview-model";

const BSKY = "app.bsky.actor.profile";
const BASE = "social.omote.actor.profile";
const GRAIN = "social.grain.actor.profile";

describe("finding profiles", () => {
  it("recognises the profile records apps keep today", () => {
    // All seen on real accounts.
    for (const collection of [
      BSKY,
      BASE,
      GRAIN,
      "sh.tangled.actor.profile",
      "dev.npmx.actor.profile",
      "fyi.atstore.profile",
      "id.sifa.profile.self",
    ]) {
      expect(isProfileCollection(collection)).toBe(true);
    }
  });

  it("leaves out records that are not how the account is named or pictured", () => {
    for (const collection of [
      "id.sifa.profile.education",
      "chat.bsky.actor.declaration",
      "com.germnetwork.declaration",
    ]) {
      expect(isProfileCollection(collection)).toBe(false);
    }
  });

  it("names an app by its reversed domain", () => {
    expect(appOf(GRAIN)).toBe("social.grain");
    expect(appOf("id.sifa.profile.self")).toBe("id.sifa");
  });

  it("puts Bluesky first and the shared base second, as the roots the rest build on", () => {
    expect(["sh.tangled.actor.profile", GRAIN, BASE, BSKY].sort(byPrecedence)).toEqual([
      BSKY,
      BASE,
      "sh.tangled.actor.profile",
      GRAIN,
    ]);
  });
});

describe("the overview", () => {
  const profiles = new Map<string, unknown>([
    [BSKY, { displayName: "Drake", description: "Design engineer." }],
    [BASE, { extends: [BSKY], displayName: "Drake Costa" }],
    [GRAIN, { extends: [BSKY, BASE], description: null }],
    ["dev.npmx.actor.profile", { displayName: "saeris.gg" }],
  ]);

  it("resolves each app's column through its own extends, as that app would", () => {
    const grain = buildOverview(profiles).find((column) => column.collection === GRAIN);

    expect(grain?.extends).toEqual([BSKY, BASE]);
    expect(grain?.cells.displayName).toEqual({
      value: "Drake Costa",
      source: { collection: BASE },
    });
    expect(grain?.cells.description).toEqual({ source: { collection: GRAIN, hidden: true } });
  });

  it("never claims an app without extends inherits anything, since the record doesn't say so", () => {
    const npmx = buildOverview(profiles).find(
      (column) => column.collection === "dev.npmx.actor.profile",
    );

    expect(npmx?.extends).toEqual([]);
    expect(npmx?.cells.displayName).toEqual({
      value: "saeris.gg",
      source: { collection: "dev.npmx.actor.profile" },
    });
    expect(npmx?.cells.description).toEqual({});
  });

  it("has one column per record, Bluesky first", () => {
    expect(buildOverview(profiles).map((column) => column.collection)).toEqual([
      BSKY,
      BASE,
      "dev.npmx.actor.profile",
      GRAIN,
    ]);
  });
});
