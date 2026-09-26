import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getProfile, ProfileError } from "./get-profile";

/**
 * A small network: one account, its DID document on PLC, its handle in DNS, and its PDS. Everything `getProfile` touches is real HTTP answered by MSW, so the fetch code under test is the code that ships.
 */

const DID = "did:plc:alice234567abcdefghijklm";
const HANDLE = "alice.example.com";
const PDS = "https://pds.example.com";

const didDocument = {
  "@context": ["https://www.w3.org/ns/did/v1"],
  id: DID,
  alsoKnownAs: [`at://${HANDLE}`],
  verificationMethod: [
    {
      id: `${DID}#atproto`,
      type: "Multikey",
      controller: DID,
      publicKeyMultibase: "zQ3shunBKsXixLxKtC5qeSG9E4J5RkGN57im31pcTzbNQnm5w",
    },
  ],
  service: [{ id: "#atproto_pds", type: "AtprotoPersonalDataServer", serviceEndpoint: PDS }],
};

const AVATAR = {
  $type: "blob",
  ref: { $link: "bafkreibme22gw2h7y2h7tg2fhqotaqjucnbc24deqo72b6mkl2egezxhvy" },
  mimeType: "image/png",
  size: 1234,
};

/** Records in the PDS, keyed by `collection/rkey`. Each test sets what exists. */
let records: Record<string, unknown> = {};
let pdsDown = false;

const server = setupServer(
  http.get("https://plc.directory/:did", () => HttpResponse.json(didDocument)),
  http.get("https://cloudflare-dns.com/dns-query", ({ request }) => {
    const name = new URL(request.url).searchParams.get("name") ?? "";
    // Shaped like Cloudflare's answer, which atcute validates field by field.
    return HttpResponse.json(
      {
        Status: 0,
        TC: false,
        RD: true,
        RA: true,
        AD: false,
        CD: false,
        Question: [{ name, type: 16 }],
        Answer:
          name === `_atproto.${HANDLE}` ? [{ name, type: 16, TTL: 300, data: `"did=${DID}"` }] : [],
      },
      { headers: { "content-type": "application/dns-json" } },
    );
  }),
  http.get(`https://${HANDLE}/.well-known/atproto-did`, () => HttpResponse.text(DID)),
  http.get(`${PDS}/xrpc/com.atproto.repo.getRecord`, ({ request }) => {
    if (pdsDown) {
      return HttpResponse.json({ error: "InternalServerError", message: "down" }, { status: 500 });
    }
    const params = new URL(request.url).searchParams;
    const value = records[`${params.get("collection")}/${params.get("rkey")}`];
    return value === undefined
      ? HttpResponse.json(
          { error: "RecordNotFound", message: "Could not locate record" },
          { status: 400 },
        )
      : HttpResponse.json({ uri: `at://${DID}/x/y`, cid: "bafyrei", value });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  records = {};
  pdsDown = false;
});
afterAll(() => server.close());

const bsky = (value: Record<string, unknown>) => ({
  "app.bsky.actor.profile/self": { $type: "app.bsky.actor.profile", ...value },
});
const override = (context: string, value: Record<string, unknown>) => ({
  [`social.omote.profile/${context}`]: {
    $type: "social.omote.profile",
    createdAt: "2026-09-26T00:00:00.000Z",
    ...value,
  },
});

describe("getProfile", () => {
  it("shows an app the person's override for it, over their Bluesky profile", async () => {
    records = {
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
    records = {
      ...bsky({ displayName: "Alice Mori" }),
      ...override("social.taproom", { displayName: "Alice M." }),
    };

    const profile = await getProfile(HANDLE, "place.stream");

    expect(profile.displayName).toBe("Alice Mori");
    expect(profile.sources.displayName).toBe("base");
  });

  it("serves images from the person's own PDS, so a profile never depends on one app's CDN", async () => {
    records = override("social.taproom", { avatar: AVATAR });

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
    records = {
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
    pdsDown = true;

    const failure = await getProfile(DID, "social.taproom").catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ProfileError);
    expect(failure).toMatchObject({ code: "RecordUnavailable" });
  });
});
