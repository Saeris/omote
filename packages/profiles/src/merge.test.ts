import { describe, expect, it } from "vitest";
import { mergeProfile } from "./merge";

const CREATED = "2026-09-26T00:00:00.000Z";
const base = {
  displayName: "Alice Mori",
  description: "Posting about lagers.",
  website: "https://alice.example",
};

describe("one context's profile", () => {
  it("uses the override where it says something, so a person can be someone else here", () => {
    const { fields, sources } = mergeProfile(base, { displayName: "Alice M.", createdAt: CREATED });

    expect(fields.displayName).toBe("Alice M.");
    expect(sources.displayName).toBe("override");
  });

  it("lets the base show through where the override is silent, so an override only records what differs", () => {
    const { fields, sources } = mergeProfile(base, { displayName: "Alice M.", createdAt: CREATED });

    expect(fields.description).toBe("Posting about lagers.");
    expect(sources.description).toBe("base");
  });

  it("leaves out what the override hides, because not showing the base bio somewhere is the point", () => {
    const { fields, sources } = mergeProfile(base, {
      hide: ["description", "website"],
      createdAt: CREATED,
    });

    expect(fields).toEqual({ displayName: "Alice Mori" });
    expect(sources).toEqual({ displayName: "base", description: "hidden", website: "hidden" });
  });

  it("never hides the override's own value, since hiding only removes what would be inherited", () => {
    const { fields } = mergeProfile(base, {
      description: "Cicerone.",
      hide: ["description"],
      createdAt: CREATED,
    });

    expect(fields.description).toBe("Cicerone.");
  });

  it("does not report a hidden field the base never had, since nothing was hidden", () => {
    const { sources } = mergeProfile({}, { hide: ["pronouns"], createdAt: CREATED });

    expect(sources).toEqual({});
  });

  it("is empty for someone with neither, who is then known only by handle", () => {
    expect(mergeProfile(undefined, undefined)).toEqual({ fields: {}, sources: {} });
  });
});
