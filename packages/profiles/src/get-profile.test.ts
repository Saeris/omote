import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getProfile, ProfileError } from "./get-profile";
import { DID, HANDLE, PDS, bsky, override, reset, server, state } from "./testing";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(reset);
afterAll(() => server.close());

const AVATAR = {
  $type: "blob",
  ref: { $link: "bafkreibme22gw2h7y2h7tg2fhqotaqjucnbc24deqo72b6mkl2egezxhvy" },
  mimeType: "image/png",
  size: 1234,
};

describe("getProfile", () => {
  it("shows an app the person's override for it, over their Bluesky profile", async () => {
    state.records = {
      ...bsky({ displayName: "Alice Mori", description: "Posting about lagers." }),
      ...override("social.taproom", { displayName: "Alice M.", hide: ["description"] }),
    };

    const profile = await getProfile(HANDLE, "social.taproom");

    expect(profile).toEqual({
      did: DID,
      handle: HANDLE,
      context: "social.taproom",
      displayName: "Alice M.",
      sources: { displayName: "override", description: "hidden" },
    });
  });

  it("falls back to the base profile in an app the person has not customised", async () => {
    state.records = {
      ...bsky({ displayName: "Alice Mori" }),
      ...override("social.taproom", { displayName: "Alice M." }),
    };

    const profile = await getProfile(HANDLE, "place.stream");

    expect(profile.displayName).toBe("Alice Mori");
    expect(profile.sources.displayName).toBe("base");
  });

  it("serves images from the person's own PDS, so a profile never depends on one app's CDN", async () => {
    state.records = override("social.taproom", { avatar: AVATAR });

    const { avatar } = await getProfile(DID, "social.taproom");

    expect(avatar).toBe(
      `${PDS}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(DID)}&cid=${AVATAR.ref.$link}`,
    );
  });

  it("returns only the handle for someone who has neither record, having signed up outside Bluesky", async () => {
    const profile = await getProfile(DID, "social.taproom");

    expect(profile).toEqual({ did: DID, handle: HANDLE, context: "social.taproom", sources: {} });
  });

  it("ignores an override that fails its schema, costing that record rather than the whole profile", async () => {
    state.records = {
      ...bsky({ displayName: "Alice Mori" }),
      ...override("social.taproom", { displayName: "x".repeat(65) }),
    };

    const profile = await getProfile(DID, "social.taproom");

    expect(profile.displayName).toBe("Alice Mori");
  });

  it("refuses a context that is not an app's reversed domain, before touching the network", async () => {
    await expect(getProfile(DID, "taproom")).rejects.toMatchObject({ code: "InvalidContext" });
  });

  it("tells an unreachable PDS apart from a missing profile, which are different answers", async () => {
    state.pdsDown = true;

    const failure = await getProfile(DID, "social.taproom").catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ProfileError);
    expect(failure).toMatchObject({ code: "RecordUnavailable" });
  });
});
