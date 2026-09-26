import { describe, expect, it } from "vitest";
import { MAX_RECORDS, loadChain, readProfileRecord, resolveProfile } from "./resolve";

const BSKY = "app.bsky.actor.profile";
const BASE = "social.omote.actor.profile";
const GRAIN = "social.grain.actor.profile";

const records = (entries: Record<string, unknown>) => new Map(Object.entries(entries));

const bluesky = {
  displayName: "Drake",
  description: "Design engineer.",
  website: "https://saeris.gg",
};

describe("a profile that extends others", () => {
  it("shows its own value over every base's, as a tsconfig's own options win", () => {
    const { fields, sources } = resolveProfile(
      records({ [BSKY]: bluesky, [GRAIN]: { extends: [BSKY], displayName: "Drake (photos)" } }),
      GRAIN,
    );

    expect(fields.displayName).toBe("Drake (photos)");
    expect(sources.displayName).toEqual({ collection: GRAIN });
  });

  it("inherits what it is silent about, so an app's record holds only what differs there", () => {
    const { fields, sources } = resolveProfile(
      records({ [BSKY]: bluesky, [GRAIN]: { extends: [BSKY], displayName: "Drake (photos)" } }),
      GRAIN,
    );

    expect(fields.description).toBe("Design engineer.");
    expect(sources.description).toEqual({ collection: BSKY });
  });

  it("lets later bases win over earlier ones, as TypeScript 5's extends arrays do", () => {
    const { fields, sources } = resolveProfile(
      records({
        [BSKY]: bluesky,
        [BASE]: { displayName: "Drake Costa" },
        [GRAIN]: { extends: [BSKY, BASE] },
      }),
      GRAIN,
    );

    expect(fields.displayName).toBe("Drake Costa");
    expect(sources.displayName).toEqual({ collection: BASE });
    expect(fields.website).toBe("https://saeris.gg");
  });

  it("follows bases of bases, so the shared base can itself start from Bluesky", () => {
    const { fields, chain } = resolveProfile(
      records({
        [BSKY]: bluesky,
        [BASE]: { extends: [BSKY], displayName: "Drake Costa" },
        [GRAIN]: { extends: [BASE] },
      }),
      GRAIN,
    );

    expect(fields).toMatchObject({ displayName: "Drake Costa", description: "Design engineer." });
    expect(chain).toEqual([BSKY, BASE, GRAIN]);
  });
});

describe("null", () => {
  it("hides what the bases say, because not showing a Bluesky bio somewhere matters as much as a different name", () => {
    const { fields, sources } = resolveProfile(
      records({ [BSKY]: bluesky, [GRAIN]: { extends: [BSKY], description: null } }),
      GRAIN,
    );

    expect(fields).not.toHaveProperty("description");
    expect(sources.description).toEqual({ collection: GRAIN, hidden: true });
  });

  it("names the last record that hid a field, since that is the one to change to show it again", () => {
    const { sources } = resolveProfile(
      records({
        [BSKY]: bluesky,
        [BASE]: { extends: [BSKY], description: null },
        [GRAIN]: { extends: [BASE], description: null },
      }),
      GRAIN,
    );

    expect(sources.description).toEqual({ collection: GRAIN, hidden: true });
  });

  it("can be undone further along, since a later record's own value wins", () => {
    const { fields } = resolveProfile(
      records({
        [BSKY]: bluesky,
        [BASE]: { extends: [BSKY], description: null },
        [GRAIN]: { extends: [BASE], description: "Photos, mostly film." },
      }),
      GRAIN,
    );

    expect(fields.description).toBe("Photos, mostly film.");
  });

  it("reports nothing when there was nothing to hide", () => {
    const { sources } = resolveProfile(
      records({ [GRAIN]: { extends: [BSKY], pronouns: null } }),
      GRAIN,
    );

    expect(sources).toEqual({});
  });
});

describe("where inheritance stops", () => {
  it("never inherits without extends, so a record's bases can be read from the record", () => {
    const { fields, chain } = resolveProfile(
      records({ [BSKY]: bluesky, [GRAIN]: { displayName: "Grain" } }),
      GRAIN,
    );

    expect(fields).toEqual({ displayName: "Grain" });
    expect(chain).toEqual([GRAIN]);
  });

  it("uses the app's default for someone with no record there yet, who has never opened the app", () => {
    const { fields, chain } = resolveProfile(
      records({ [BSKY]: bluesky, [BASE]: { displayName: "Drake Costa" } }),
      GRAIN,
    );

    expect(fields.displayName).toBe("Drake Costa");
    expect(chain).toEqual([BSKY, BASE]);
  });

  it("lets an app choose a different default", () => {
    const { chain } = resolveProfile(
      records({ [BSKY]: bluesky, [BASE]: { displayName: "Drake Costa" } }),
      GRAIN,
      { defaultExtends: [BASE] },
    );

    expect(chain).toEqual([BASE]);
  });

  it("skips a base the person doesn't have, so naming the shared base costs nothing", () => {
    const { fields, chain } = resolveProfile(
      records({ [BSKY]: bluesky, [GRAIN]: { extends: [BSKY, BASE] } }),
      GRAIN,
    );

    expect(fields.displayName).toBe("Drake");
    expect(chain).toEqual([BSKY, GRAIN]);
  });

  it("is empty for someone with no records at all, who is then known by their handle", () => {
    expect(resolveProfile(records({}), GRAIN)).toEqual({ fields: {}, sources: {}, chain: [] });
  });
});

describe("a base reached twice", () => {
  it("applies once, before everything built on it, so it cannot undo the record that overrode it", () => {
    // Grain lists Bluesky last, but the shared base is built on Bluesky to override it.
    // tsconfig would apply Bluesky a second time here, and "Drake" would win.
    const { fields, chain } = resolveProfile(
      records({
        [BSKY]: bluesky,
        [BASE]: { extends: [BSKY], displayName: "Drake Costa" },
        [GRAIN]: { extends: [BASE, BSKY] },
      }),
      GRAIN,
    );

    expect(fields.displayName).toBe("Drake Costa");
    expect(chain).toEqual([BSKY, BASE, GRAIN]);
  });

  it("stops at a cycle rather than following it forever", () => {
    const { fields, chain } = resolveProfile(
      records({
        [BASE]: { extends: [GRAIN], displayName: "Drake Costa" },
        [GRAIN]: { extends: [BASE], pronouns: "he/him" },
      }),
      GRAIN,
    );

    expect(chain).toEqual([BASE, GRAIN]);
    expect(fields).toEqual({ displayName: "Drake Costa", pronouns: "he/him" });
  });

  it("stops after a bounded number of records, however long the chain", () => {
    const long = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [
        `com.example${i}.profile`,
        { extends: [`com.example${i + 1}.profile`] },
      ]),
    );

    expect(resolveProfile(records(long), "com.example0.profile").chain.length).toBeLessThanOrEqual(
      MAX_RECORDS,
    );
  });
});

describe("reading another app's record", () => {
  it("takes part by field name and type, as a structural type checks, not by which lexicon it is", () => {
    // Grain's lexicon is Bluesky's with fields removed: it takes part without knowing omote exists.
    const grain = {
      $type: GRAIN,
      displayName: "Grain",
      description: "Photos.",
      cameraGear: ["X100VI"],
    };

    expect(readProfileRecord(grain).fields).toEqual({
      displayName: "Grain",
      description: "Photos.",
    });
  });

  it("ignores a shared name with another type, rather than failing the record", () => {
    expect(readProfileRecord({ displayName: 42, description: "Still read." }).fields).toEqual({
      description: "Still read.",
    });
  });

  it("does not guess at other names for a field, so every reader agrees on the shape", () => {
    // Sifa's bio is `about`: it means description, but it is not named description.
    expect(readProfileRecord({ about: "A decade of design systems." }).fields).toEqual({});
  });

  it("treats a blank name as no name, as Bluesky writes one when a name is cleared", () => {
    const { fields } = resolveProfile(
      records({ [BSKY]: { displayName: "" }, [GRAIN]: { extends: [BSKY], displayName: "  " } }),
      GRAIN,
    );

    expect(fields).toEqual({});
  });

  it("drops a website that is not a web link, since apps show it as one", () => {
    expect(readProfileRecord({ website: "javascript:alert(1)" }).fields).toEqual({});
    expect(readProfileRecord({ website: "https://saeris.gg" }).fields).toEqual({
      website: "https://saeris.gg",
    });
  });

  it("keeps only the bases that are collection names", () => {
    expect(readProfileRecord({ extends: [BSKY, "not an nsid", 7, BSKY, BASE] }).extends).toEqual([
      BSKY,
      BASE,
    ]);
    expect(readProfileRecord({ extends: BSKY }).extends).toEqual([]);
  });
});

describe("loading a chain", () => {
  it("reads only what the chain reaches, with bases at the same depth together", async () => {
    const stored = records({
      [BSKY]: bluesky,
      [BASE]: { extends: [BSKY] },
      [GRAIN]: { extends: [BASE, BSKY] },
      "sh.tangled.actor.profile": { displayName: "unrelated" },
    });
    const asked: string[][] = [];
    let batch: string[] = [];
    const load = async (collection: string) => {
      batch.push(collection);
      await Promise.resolve();
      if (batch.length > 0) {
        asked.push(batch);
        batch = [];
      }
      return stored.get(collection);
    };

    const loaded = await loadChain(GRAIN, load);

    expect([...loaded.keys()].sort()).toEqual([BSKY, BASE, GRAIN].sort());
    expect(asked).toEqual([[GRAIN], [BASE, BSKY]]);
    expect(resolveProfile(loaded, GRAIN)).toEqual(resolveProfile(stored, GRAIN));
  });

  it("follows the app's default when its record is missing", async () => {
    const stored = records({ [BSKY]: bluesky });

    const loaded = await loadChain(GRAIN, async (collection) => stored.get(collection));

    expect([...loaded.keys()]).toEqual([BSKY]);
  });
});
