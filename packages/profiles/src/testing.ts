/**
 * A small ATProto network for tests: one account, its DID document on PLC, its handle in DNS, and its PDS, all answered by MSW.
 *
 * Shared so that the library and every app built on it test against the same network, and so the fetch code under test is the code that ships.
 */

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const DID = "did:plc:alice234567abcdefghijklm";
export const HANDLE = "alice.example.com";
export const PDS = "https://pds.example.com";

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

/** What the PDS holds, keyed by `collection/rkey`, and whether it is answering. Tests set these; `reset` clears them. */
export const state: { records: Record<string, unknown>; pdsDown: boolean } = {
  records: {},
  pdsDown: false,
};

export const reset = (): void => {
  state.records = {};
  state.pdsDown = false;
};

export const bsky = (value: Record<string, unknown>) => profile("app.bsky.actor.profile", value);

/** Any app's profile record, at its `self` key. */
export const profile = (collection: string, value: Record<string, unknown>) => ({
  [`${collection}/self`]: { $type: collection, ...value },
});

/** The shared base, `social.omote.actor.profile`. */
export const base = (value: Record<string, unknown>) =>
  profile("social.omote.actor.profile", value);

export const server = setupServer(
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
    if (state.pdsDown) {
      return HttpResponse.json({ error: "InternalServerError", message: "down" }, { status: 500 });
    }
    const params = new URL(request.url).searchParams;
    const value = state.records[`${params.get("collection")}/${params.get("rkey")}`];
    return value === undefined
      ? HttpResponse.json(
          { error: "RecordNotFound", message: "Could not locate record" },
          { status: 400 },
        )
      : HttpResponse.json({ uri: `at://${DID}/x/y`, cid: "bafyrei", value });
  }),
);
