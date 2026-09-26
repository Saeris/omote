import baseLexicon from "@omote-social/lexicon/lexicons/social/omote/actor/profile.json";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
  fieldProblem,
  formSchemaFor,
  inheritedFor,
  toForm,
  toRecord,
  type FormValues,
} from "./form-model";
import { readProfileShape, type ProfileShape } from "./shape";

const BSKY = "app.bsky.actor.profile";
const BASE = "social.omote.actor.profile";
const NPMX = "dev.npmx.actor.profile";
const NOW = () => "2026-09-26T12:00:00.000Z";

const base = readProfileShape(baseLexicon) as ProfileShape;
// Shaped like npmx's published lexicon: no extends, no nullable, a required name.
const npmx: ProfileShape = {
  fields: {
    displayName: { kind: "text", maxGraphemes: 64, required: true, nullable: false },
    description: { kind: "text", maxGraphemes: 256, required: false, nullable: false },
  },
  extends: false,
  createdAt: false,
};

const AVATAR = {
  $type: "blob" as const,
  ref: { $link: "bafkreibme22gw2h7y2h7tg2fhqotaqjucnbc24deqo72b6mkl2egezxhvy" },
  mimeType: "image/png",
  size: 1234,
};

describe("opening a profile", () => {
  it("marks what the record says and inherits the rest, so nothing it doesn't hold gets copied into it", () => {
    const form = toForm({ extends: [BSKY], displayName: "Drake Costa", description: null }, base);

    expect(form.fields.displayName).toEqual({ mode: "set", text: "Drake Costa" });
    expect(form.fields.description).toEqual({ mode: "hide", text: "" });
    expect(form.fields.pronouns).toEqual({ mode: "inherit", text: "" });
    expect(form.fromBluesky).toBe(true);
  });

  it("offers only the fields the app's lexicon has", () => {
    expect(Object.keys(toForm({ displayName: "saeris.gg" }, npmx).fields)).toEqual([
      "displayName",
      "description",
    ]);
  });

  it("starts a new shared profile from Bluesky", () => {
    expect(toForm(undefined, base).fromBluesky).toBe(true);
  });
});

describe("what an inheriting field shows", () => {
  it("is what its bases give, so the form opens on the person's existing profile", () => {
    const profiles = new Map<string, unknown>([[BSKY, { displayName: "Drake", avatar: AVATAR }]]);

    const { fields, sources } = inheritedFor(profiles, BASE, [BSKY]);

    expect(fields.displayName).toBe("Drake");
    expect(sources.avatar).toEqual({ collection: BSKY });
  });

  it("is nothing for a record that stands alone", () => {
    const profiles = new Map<string, unknown>([[BSKY, { displayName: "Drake" }]]);

    expect(inheritedFor(profiles, NPMX, []).fields).toEqual({});
  });
});

describe("saving a profile", () => {
  const values = (fields: FormValues["fields"], fromBluesky = true): FormValues => ({
    fields,
    fromBluesky,
  });

  it("writes only what is set or hidden, so untouched fields keep following their bases", () => {
    const record = toRecord(
      values({
        displayName: { mode: "set", text: " Drake Costa " },
        description: { mode: "hide", text: "" },
        pronouns: { mode: "inherit", text: "" },
      }),
      undefined,
      BASE,
      base,
      NOW,
    );

    expect(record).toEqual({
      $type: BASE,
      displayName: "Drake Costa",
      description: null,
      extends: [BSKY],
      createdAt: NOW(),
    });
  });

  it("keeps everything it doesn't edit, since other apps write these records too", () => {
    const existing = { $type: NPMX, displayName: "saeris.gg", links: ["https://saeris.gg"] };

    const record = toRecord(
      values({ displayName: { mode: "set", text: "Drake" } }),
      existing,
      NPMX,
      npmx,
      NOW,
    );

    expect(record).toEqual({ $type: NPMX, displayName: "Drake", links: ["https://saeris.gg"] });
  });

  it("never writes null where the app's lexicon doesn't allow it, since the app may break on one", () => {
    const record = toRecord(
      values({ description: { mode: "hide", text: "" } }),
      { description: "Old bio." },
      NPMX,
      npmx,
      NOW,
    );

    expect(record).not.toHaveProperty("description");
  });

  it("writes extends only for an app whose lexicon has it", () => {
    expect(toRecord(values({}), undefined, NPMX, npmx, NOW)).not.toHaveProperty("extends");
    expect(toRecord(values({}, false), undefined, BASE, base, NOW)).not.toHaveProperty("extends");
  });

  it("sets an image as the uploaded blob", () => {
    const record = toRecord(
      values({ avatar: { mode: "set", text: "", image: AVATAR } }),
      undefined,
      BASE,
      base,
      NOW,
    );

    expect(record.avatar).toEqual(AVATAR);
  });
});

describe("checking a field", () => {
  const rule = npmx.fields.displayName!;

  it("holds a value to the app's own limits, not omote's", () => {
    expect(fieldProblem("displayName", { mode: "set", text: "x".repeat(65) }, rule, true)).toMatch(
      /64 characters/u,
    );
    expect(fieldProblem("displayName", { mode: "set", text: "Drake" }, rule, true)).toBeUndefined();
  });

  it("refuses to empty a field the app requires", () => {
    expect(fieldProblem("displayName", { mode: "set", text: " " }, rule, true)).toMatch(
      /requires/u,
    );
    expect(fieldProblem("displayName", { mode: "inherit", text: "" }, rule, true)).toMatch(
      /requires/u,
    );
  });

  it("doesn't hold an inherited value to limits it isn't being written under", () => {
    const short = { kind: "text", maxGraphemes: 5, required: false, nullable: false } as const;

    expect(
      fieldProblem("description", { mode: "inherit", text: "" }, short, false),
    ).toBeUndefined();
  });

  it("wants a website to be a web link, since apps show it as one", () => {
    const site = { kind: "text", required: false, nullable: true } as const;

    expect(fieldProblem("website", { mode: "set", text: "saeris.gg" }, site, false)).toBeDefined();
    expect(
      fieldProblem("website", { mode: "set", text: "https://saeris.gg" }, site, false),
    ).toBeUndefined();
  });

  it("puts the problem on the field, where the form shows it", () => {
    const result = v.safeParse(formSchemaFor(npmx), {
      fields: {
        displayName: { mode: "set", text: "" },
        description: { mode: "inherit", text: "" },
      },
      fromBluesky: false,
    });

    expect(result.success).toBe(false);
    expect(result.issues?.map((issue) => [v.getDotPath(issue), issue.message])).toEqual([
      ["fields.displayName", "This app requires it."],
    ]);
  });
});
