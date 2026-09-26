import { describe, expect, it } from "vitest";
import { normaliseHandle, readActors, suggest } from "./handles";

describe("handle suggestions", () => {
  it("offers handles used on this device first, since the account used last is the likeliest", () => {
    const found = [{ handle: "alice.bsky.social", displayName: "Alice" }];

    expect(suggest("al", ["alice.example.com"], found).map((s) => s.handle)).toEqual([
      "alice.example.com",
      "alice.bsky.social",
    ]);
  });

  it("lists a handle once, keeping it as this device's", () => {
    const suggestions = suggest("al", ["alice.bsky.social"], [{ handle: "alice.bsky.social" }]);

    expect(suggestions).toEqual([{ handle: "alice.bsky.social", remembered: true }]);
  });

  it("narrows this device's handles to what's typed, however it's typed", () => {
    expect(suggest(" @Venue", ["venue.taproom.social", "alice.example.com"], [])).toEqual([
      { handle: "venue.taproom.social", remembered: true },
    ]);
  });

  it("offers every remembered handle before anything is typed", () => {
    expect(suggest("", ["a.example.com", "b.example.com"], [])).toHaveLength(2);
  });

  it("never offers handle.invalid, which cannot be signed in with", () => {
    expect(suggest("al", [], [{ handle: "handle.invalid" }])).toEqual([]);
  });

  it("stops at a short list", () => {
    const found = Array.from({ length: 20 }, (_, i) => ({ handle: `al${i}.bsky.social` }));

    expect(suggest("al", [], found)).toHaveLength(8);
  });
});

describe("a typed handle", () => {
  it("is trimmed, loses a pasted @, and is lowercased, since handles are case-insensitive", () => {
    expect(normaliseHandle("  @Alice.Example.COM ")).toBe("alice.example.com");
  });
});

describe("Bluesky's answer", () => {
  it("is read for the handle, name and avatar", () => {
    const body = {
      actors: [
        {
          did: "did:plc:x",
          handle: "alice.bsky.social",
          displayName: "Alice",
          avatar: "https://cdn/a",
        },
        { did: "did:plc:y", handle: "bob.bsky.social", displayName: " " },
      ],
    };

    expect(readActors(body)).toEqual([
      { handle: "alice.bsky.social", displayName: "Alice", avatar: "https://cdn/a" },
      { handle: "bob.bsky.social" },
    ]);
  });

  it("becomes no suggestions when it isn't what was expected, rather than breaking sign-in", () => {
    expect(readActors({ error: "RateLimitExceeded" })).toEqual([]);
    expect(readActors(null)).toEqual([]);
  });
});
