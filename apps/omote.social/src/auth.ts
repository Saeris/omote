/**
 * Signing in, entirely in the browser.
 *
 * A public OAuth client: no server of ours holds tokens or secrets, so the whole editor is static files. The cost is shorter sessions (public clients' refresh tokens last two weeks at most), which suits something people open occasionally to change a profile.
 *
 * Handles resolve with `@omote-social/profiles`' own resolver (DNS-over-HTTPS, then `.well-known`), so signing in sends nobody's handle to Bluesky or to us. Only the sign-in field's suggestions ask Bluesky, and the field says so (see editor/handles.ts).
 */

import { Client } from "@atcute/client";
import type { ActorIdentifier, Did } from "@atcute/lexicons";
import { isActorIdentifier, isDid } from "@atcute/lexicons/syntax";
import {
  OAuthUserAgent,
  configureOAuth,
  createAuthorizationUrl,
  finalizeAuthorization,
  getSession,
} from "@atcute/oauth-browser-client";
import { defaultResolver } from "@omote-social/profiles";
import { EDITOR_PATH } from "./paths";
import { DECLARED_SCOPE, SIGN_IN_SCOPE, withCollection } from "./scope";

export interface Session {
  readonly did: Did;
  /** The account's PDS, as the OAuth exchange reported it. */
  readonly pds: string;
  /** What the account's server granted, which may be less than was asked for. */
  readonly scope: string;
  /** Reads and writes as this account. */
  readonly rpc: Client;
  readonly signOut: () => Promise<void>;
}

const LAST_DID = "omote.lastDid";

/**
 * Running on this machine. `Base.astro` moves `localhost` to `127.0.0.1` before anything else runs, because the redirect must land there.
 */
const isLoopback = (): boolean => globalThis.location.hostname === "127.0.0.1";

/**
 * The client id for wherever the editor is served.
 *
 * On this machine the spec's development exception applies, and its shape is exact:
 *
 * - the client id's origin is `http://localhost`, with no port and an empty path;
 * - the `redirect_uri` goes to `127.0.0.1`, not `localhost`. The reference PDS (bsky.social) refuses a `localhost` redirect under RFC 8252, while Cirrus accepts both, so only accounts on bsky.social showed it;
 * - `redirect_uri` and `scope` ride in the client id's own query string.
 *
 * Elsewhere it is the metadata document this site serves.
 */
const clientId = (redirectUri: string): string => {
  if (isLoopback()) {
    return `http://localhost?${new URLSearchParams({ redirect_uri: redirectUri, scope: DECLARED_SCOPE }).toString()}`;
  }

  return `${globalThis.location.origin}/client-metadata.json`;
};

let configured = false;

const configure = (): void => {
  if (configured) {
    return;
  }

  // The editor's own page, not a /callback route: the page that starts sign-in finishes it, on any static host.
  // On this machine, that page is already on 127.0.0.1 (see isLoopback), so its origin is the redirect's.
  const redirectUri = `${globalThis.location.origin}${EDITOR_PATH}`;

  configureOAuth({
    metadata: { client_id: clientId(redirectUri), redirect_uri: redirectUri },
    identityResolver: defaultResolver(),
  });
  configured = true;
};

/**
 * An authenticated client that refreshes before each request rather than after a refusal.
 *
 * atcute refreshes when a 401 carries `WWW-Authenticate`, but Cirrus does not expose that header to browsers, so a reactive refresh never happens there and every write fails once the access token expires.
 */
const clientFor = (agent: OAuthUserAgent): Client =>
  new Client({
    handler: {
      handle: async (pathname, init) => {
        await agent.getSession();
        return agent.handle(pathname, init);
      },
    },
  });

const toSession = (agent: OAuthUserAgent): Session => ({
  did: agent.session.info.sub,
  pds: agent.session.info.aud,
  scope: agent.session.token.scope,
  rpc: clientFor(agent),
  signOut: async () => {
    forget();
    await agent.signOut();
  },
});

const remember = (did: string): void => {
  try {
    globalThis.localStorage.setItem(LAST_DID, did);
  } catch {
    // Blocked storage: the session lasts one page load instead.
  }
};

const forget = (): void => {
  try {
    globalThis.localStorage.removeItem(LAST_DID);
  } catch {
    // Nothing to forget.
  }
};

/** Send the browser to the account's own server to sign in. Navigates away. */
export const beginSignIn = async (identifier: string, scope = SIGN_IN_SCOPE): Promise<void> => {
  configure();

  if (!isActorIdentifier(identifier)) {
    throw new Error(`That doesn't look like a handle: ${identifier}`);
  }

  const url = await createAuthorizationUrl({
    target: { type: "account", identifier: identifier as ActorIdentifier },
    scope,
  });

  // atcute's advice: let storage flush before leaving the page.
  await new Promise((resolve) => setTimeout(resolve, 200));
  globalThis.location.assign(url.toString());
};

const RETURN_TO = "omote.returnTo";

/**
 * Ask the account's server for permission to write one more collection, keeping everything already granted. Navigates away, and back to that profile once approved.
 */
export const requestAccess = async (session: Session, collection: string): Promise<void> => {
  try {
    globalThis.sessionStorage.setItem(RETURN_TO, collection);
  } catch {
    // Blocked storage: the editor opens on the overview instead.
  }
  await beginSignIn(session.did, withCollection(session.scope, collection));
};

/** The profile to reopen after `requestAccess`, once. */
export const takeReturnTo = (): string | undefined => {
  try {
    const collection = globalThis.sessionStorage.getItem(RETURN_TO) ?? undefined;
    globalThis.sessionStorage.removeItem(RETURN_TO);
    return collection;
  } catch {
    return undefined;
  }
};

/**
 * The session to use on this page load: a sign-in just completed, a remembered one, or none.
 *
 * The authorization server answers in the URL fragment; it is cleared at once so a reload cannot replay it.
 */
export const currentSession = async (): Promise<Session | undefined> => {
  configure();
  const params = new URLSearchParams(globalThis.location.hash.slice(1));

  if (params.has("state")) {
    globalThis.history.replaceState(null, "", globalThis.location.pathname);
    const { session } = await finalizeAuthorization(params);
    remember(session.info.sub);

    return toSession(new OAuthUserAgent(session));
  }

  let did: string | null = null;
  try {
    did = globalThis.localStorage.getItem(LAST_DID);
  } catch {
    return undefined;
  }

  if (!did || !isDid(did)) {
    return undefined;
  }

  try {
    // Stale is fine: clientFor refreshes before the first request.
    return toSession(new OAuthUserAgent(await getSession(did, { allowStale: true })));
  } catch {
    forget();
    return undefined;
  }
};
