import { profileOverrideSchema } from "@omote-social/lexicon";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { formSchema, toForm, toRecord, type FormValues } from "./records";

const blank: FormValues = { displayName: "", description: "", pronouns: "", website: "", hide: [] };
const NOW = () => "2026-09-26T12:00:00.000Z";

describe("saving an override", () => {
  it("leaves blank fields out, so they fall back to the base profile instead of showing nothing", () => {
    const record = toRecord({ ...blank, displayName: "Alice M." }, {}, undefined, NOW);

    expect(record).toEqual({
      $type: "social.omote.profile",
      displayName: "Alice M.",
      createdAt: NOW(),
    });
  });

  it("treats whitespace as blank, so a stray space does not blank someone's name", () => {
    expect(toRecord({ ...blank, displayName: "   " }, {}, undefined, NOW)).not.toHaveProperty(
      "displayName",
    );
  });

  it("writes hide only when something is hidden, keeping the record sparse", () => {
    expect(toRecord(blank, {}, undefined, NOW)).not.toHaveProperty("hide");
    expect(toRecord({ ...blank, hide: ["description"] }, {}, undefined, NOW).hide).toEqual([
      "description",
    ]);
  });

  it("keeps when the override was first made", () => {
    const existing = { createdAt: "2026-01-01T00:00:00.000Z" };

    expect(toRecord(blank, {}, existing, NOW).createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("always produces a record the lexicon accepts", () => {
    const record = toRecord(
      {
        displayName: "Alice M.",
        description: "Cicerone.",
        pronouns: "she/her",
        website: "https://alice.example",
        hide: ["banner"],
      },
      {},
      undefined,
      NOW,
    );

    expect(v.safeParse(profileOverrideSchema, record).success).toBe(true);
  });
});

describe("editing an override", () => {
  it("shows unknown hide values as nothing rather than crashing, since knownValues are open", () => {
    expect(toForm({ createdAt: NOW(), hide: ["description", "someFutureField"] }).hide).toEqual([
      "description",
    ]);
  });

  it("rejects a website that is not a URL, but accepts none at all", () => {
    expect(v.is(formSchema, { ...blank, website: "alice.example" })).toBe(false);
    expect(v.is(formSchema, blank)).toBe(true);
  });
});
