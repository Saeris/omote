/**
 * omote.social's server side: the editor's static files, and `social.omote.getProfile` over XRPC.
 *
 * The endpoint is a convenience: the same answer `@omote-social/profiles` gives an app that resolves profiles itself, which is the path we recommend for production. It reads each person's records from their own PDS on every request and stores nothing, so any app can depend on it without trusting us with data, and anyone can run their own copy.
 */

import { getProfile, ProfileError, type ProfileErrorCode } from "@omote-social/profiles";

const CORS = {
  // Any app, on any origin, may ask how someone appears in it.
  "access-control-allow-origin": "*",
};

const xrpcError = (status: number, error: string, message: string) =>
  Response.json({ error, message }, { status, headers: CORS });

/** XRPC errors are 400s with a name; only a failure on someone else's server is our 502. */
const STATUS: Record<ProfileErrorCode, [number, string]> = {
  InvalidActor: [400, "InvalidRequest"],
  InvalidContext: [400, "InvalidContext"],
  ActorNotFound: [400, "ActorNotFound"],
  RecordUnavailable: [502, "UpstreamFailure"],
};

export const getProfileRoute = async (url: URL): Promise<Response> => {
  const actor = url.searchParams.get("actor");
  const context = url.searchParams.get("context");

  if (!actor || !context) {
    return xrpcError(400, "InvalidRequest", "Both actor and context are required.");
  }

  try {
    const profile = await getProfile(actor, context);

    return Response.json(profile, {
      headers: {
        ...CORS,
        // Brief: someone who just changed their profile should see it soon.
        "cache-control": "public, max-age=60",
      },
    });
  } catch (error) {
    if (error instanceof ProfileError) {
      const [status, name] = STATUS[error.code];
      return xrpcError(status, name, error.message);
    }

    throw error;
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/xrpc/")) {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            ...CORS,
            "access-control-allow-methods": "GET, OPTIONS",
            "access-control-allow-headers": "*",
          },
        });
      }

      if (url.pathname === "/xrpc/social.omote.getProfile" && request.method === "GET") {
        return getProfileRoute(url);
      }

      return xrpcError(404, "MethodNotImplemented", `${url.pathname.slice(6)} is not served here.`);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
