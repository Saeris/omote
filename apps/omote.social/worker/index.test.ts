import { DID, HANDLE, bsky, override, reset, server, state } from "@omote-social/profiles/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import worker from "./index";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(reset);
afterAll(() => server.close());

/** Static files, which the Worker hands to the assets binding untouched. */
const env = {
  ASSETS: { fetch: async () => new Response("the editor") },
} as unknown as Env;

const call = (path: string, init?: RequestInit) =>
  // A plain Request stands in for the one Cloudflare hands the Worker; nothing here reads `cf`.
  worker.fetch(
    new Request(`https://omote.social${path}`, init) as Parameters<typeof worker.fetch>[0],
    env,
  );

describe("social.omote.getProfile", () => {
  it("answers any origin, since every app that shows profiles is on another one", async () => {
    state.records = override("social.taproom", { displayName: "Alice M." });

    const response = await call(
      `/xrpc/social.omote.getProfile?actor=${HANDLE}&context=social.taproom`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(await response.json()).toMatchObject({ did: DID, displayName: "Alice M." });
  });

  it("gives the same answer as the library, so the service is only ever a convenience", async () => {
    state.records = {
      ...bsky({ displayName: "Alice Mori", description: "Lagers." }),
      ...override("social.taproom", { hide: ["description"] }),
    };

    const body = await (
      await call(`/xrpc/social.omote.getProfile?actor=${DID}&context=social.taproom`)
    ).json();

    expect(body).toEqual({
      did: DID,
      handle: HANDLE,
      context: "social.taproom",
      displayName: "Alice Mori",
      sources: { displayName: "base", description: "hidden" },
    });
  });

  it("names a bad context as XRPC does, so a client can tell it from a missing account", async () => {
    const response = await call(`/xrpc/social.omote.getProfile?actor=${DID}&context=taproom`);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "InvalidContext" });
  });

  it("blames the upstream PDS, not the caller, when it cannot be read", async () => {
    state.pdsDown = true;

    const response = await call(
      `/xrpc/social.omote.getProfile?actor=${DID}&context=social.taproom`,
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "UpstreamFailure" });
  });

  it("requires both parameters", async () => {
    const response = await call(`/xrpc/social.omote.getProfile?actor=${DID}`);

    expect(await response.json()).toMatchObject({ error: "InvalidRequest" });
  });
});

describe("everything else", () => {
  it("refuses XRPC methods it does not serve, rather than returning the editor's HTML", async () => {
    const response = await call("/xrpc/app.bsky.actor.getProfile?actor=alice");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "MethodNotImplemented" });
  });

  it("serves the editor for any other path", async () => {
    expect(await (await call("/")).text()).toBe("the editor");
  });
});
