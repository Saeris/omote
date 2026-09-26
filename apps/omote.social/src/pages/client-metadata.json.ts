import type { APIRoute } from "astro";
import { EDITOR_PATH } from "../paths";
import { DECLARED_SCOPE } from "../scope";

/**
 * `/client-metadata.json`: how an authorization server learns what this app is. A public client: there is no backend, so there is no secret.
 */

export const prerender = true;

/** Where this copy is served. Set PUBLIC_SITE_ORIGIN when self-hosting. */
const ORIGIN = import.meta.env.PUBLIC_SITE_ORIGIN ?? "https://omote.social";

export const GET: APIRoute = () =>
  Response.json(
    {
      client_id: `${ORIGIN}/client-metadata.json`,
      client_name: "omote",
      client_uri: ORIGIN,
      redirect_uris: [`${ORIGIN}${EDITOR_PATH}`],
      // Everything omote may ever request; sign-in asks for a subset (see scope.ts).
      scope: DECLARED_SCOPE,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      application_type: "web",
      token_endpoint_auth_method: "none",
      dpop_bound_access_tokens: true,
    },
    { headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" } },
  );
