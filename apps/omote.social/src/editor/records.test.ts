import { baseProfileSchema } from "@omote-social/lexicon";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { formSchema, toForm, toRecord, type FormValues } from "./records";

const blank: FormValues = {
  displayName: "",
  description: "",
  pronouns: "",
  website: "",
  hide: [],
  fromBluesky: true,
};
const NOW = () => "2026-09-26T12:00:00.000Z";

describe("saving the shared base", () => {
  it("leaves blank fields out, so they are inherited instead of showing nothing", () => {
    const record = toRecord({ ...blank, displayName: "Alice M." }, {}, undefined, NOW);

    expect(record).toEqual({
      $type: "social.omote.actor.profile",
      extends: ["app.bsky.actor.profile"],
      displayName: "Alice M.",
      createdAt: NOW(),
    });
  });

  it("treats whitespace as blank, so a stray space does not blank someone's name", () => {
    expect(toRecord({ ...blank, displayName: "   " }, {}, undefined, NOW)).not.toHaveProperty(
      "displayName",
    );
  });

  it("writes a hidden field as null, whatever was typed, since hiding is the stronger choice", () => {
    const record = toRecord(
      { ...blank, description: "Typed, then hidden.", hide: ["description", "avatar"] },
      {},
      undefined,
      NOW,
    );

    expect(record).toMatchObject({ description: null, avatar: null });
  });

  it("stands alone when told not to start from Bluesky, for someone whose account began elsewhere", () => {
    expect(toRecord({ ...blank, fromBluesky: false }, {}, undefined, NOW)).not.toHaveProperty(
      "extends",
    );
  });

  it("keeps what it doesn't know, other bases included, since other apps write this record too", () => {
    const existing = {
      $type: "social.omote.actor.profile",
      extends: ["app.bsky.actor.profile", "com.example.actor.profile"],
      theme: { accent: "#b33" },
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const record = toRecord({ ...blank, fromBluesky: false }, {}, existing, NOW);

    expect(record).toMatchObject({
      extends: ["com.example.actor.profile"],
      theme: { accent: "#b33" },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("always produces a record the lexicon accepts", () => {
    const record = toRecord(
      {
        displayName: "Alice M.",
        description: "Cicerone.",
        pronouns: "she/her",
        website: "https://alice.example",
        hide: ["banner"],
        fromBluesky: true,
      },
      {},
      undefined,
      NOW,
    );

    expect(v.safeParse(baseProfileSchema, record).success).toBe(true);
  });
});

describe("editing the shared base", () => {
  it("shows null as hidden and silence as blank, the two things a person can choose", () => {
    const form = toForm({ displayName: "Alice M.", description: null });

    expect(form).toMatchObject({ displayName: "Alice M.", description: "", hide: ["description"] });
  });

  it("starts a new shared base from Bluesky, where most people's profile is today", () => {
    expect(toForm(undefined).fromBluesky).toBe(true);
    expect(toForm({ displayName: "Alice M." }).fromBluesky).toBe(false);
  });

  it("rejects a website that is not a URL, but accepts none at all", () => {
    expect(v.is(formSchema, { ...blank, website: "alice.example" })).toBe(false);
    expect(v.is(formSchema, blank)).toBe(true);
  });
});
