import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getProfile, ProfileError } from "../get-profile";
import { DID, HANDLE, PDS, base, bsky, profile, reset, server, state } from "../testing";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(reset);
afterAll(() => server.close());

const GRAIN = "social.grain.actor.profile";
const AVATAR = {
  $type: "blob",
  ref: { $link: "bafkreibme22gw2h7y2h7tg2fhqotaqjucnbc24deqo72b6mkl2egezxhvy" },
  mimeType: "image/png",
  size: 1234,
};

describe("getProfile", () => {
  it("shows an app the person's record there, over the records it extends, from their own PDS", async () => {
    state.records = {
      ...bsky({ displayName: "Alice Mori", description: "Posting about lagers." }),
      ...base({ extends: ["app.bsky.actor.profile"], pronouns: "she/her" }),
      ...profile(GRAIN, {
        extends: ["app.bsky.actor.profile", "social.omote.actor.profile"],
        displayName: "Alice M.",
        description: null,
      }),
    };

    const view = await getProfile(HANDLE, GRAIN);

    expect(view).toEqual({
      did: DID,
      handle: HANDLE,
      collection: GRAIN,
      displayName: "Alice M.",
      pronouns: "she/her",
      sources: {
        displayName: { collection: GRAIN },
        description: { collection: GRAIN, hidden: true },
        pronouns: { collection: "social.omote.actor.profile" },
      },
      chain: ["app.bsky.actor.profile", "social.omote.actor.profile", GRAIN],
    });
  });

  it("uses Bluesky's profile and the shared base in an app the person has never opened", async () => {
    state.records = {
      ...bsky({ displayName: "Alice Mori" }),
      ...base({ displayName: "Alice M." }),
    };

    const view = await getProfile(HANDLE, "place.stream.actor.profile");

    expect(view.displayName).toBe("Alice M.");
    expect(view.chain).toEqual(["app.bsky.actor.profile", "social.omote.actor.profile"]);
  });

  it("serves images from the person's own PDS, so a profile never depends on one app's CDN", async () => {
    state.records = profile(GRAIN, { avatar: AVATAR });

    const { avatar } = await getProfile(DID, GRAIN);

    expect(avatar).toBe(
      `${PDS}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(DID)}&cid=${AVATAR.ref.$link}`,
    );
  });

  it("returns only the handle for someone with no profile anywhere", async () => {
    const view = await getProfile(DID, GRAIN);

    expect(view).toEqual({ did: DID, handle: HANDLE, collection: GRAIN, sources: {}, chain: [] });
  });

  it("refuses a collection that is not an NSID, before touching the network", async () => {
    await expect(getProfile(DID, "social.grain")).rejects.toMatchObject({
      code: "InvalidCollection",
    });
  });

  it("tells an unreachable PDS apart from a missing profile, which are different answers", async () => {
    state.pdsDown = true;

    const failure = await getProfile(DID, GRAIN).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ProfileError);
    expect(failure).toMatchObject({ code: "RecordUnavailable" });
  });
});
