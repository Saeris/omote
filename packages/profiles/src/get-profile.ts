import { Client, simpleFetchHandler } from "@atcute/client";
import {
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  DohJsonHandleResolver,
  LocalActorResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
  type ActorResolver,
} from "@atcute/identity-resolver";
import type { ActorIdentifier } from "@atcute/lexicons";
import { isActorIdentifier } from "@atcute/lexicons/syntax";
import {
  NSID_BSKY_PROFILE,
  NSID_PROFILE,
  baseProfileSchema,
  contextSchema,
  profileOverrideSchema,
  type Blob,
  type ProfileView,
} from "@omote/lexicon";
import * as v from "valibot";
import { mergeProfile } from "./merge";

export interface GetProfileOptions {
  /** Resolves a handle or DID to its DID, handle and PDS. Defaults to DNS-over-HTTPS and `.well-known` for handles, and PLC or the web for DIDs: no AppView of anyone's in the path. */
  readonly resolver?: ActorResolver;
  readonly fetch?: typeof globalThis.fetch;
  /** Milliseconds to wait on each network call. Default 10 seconds. */
  readonly timeout?: number;
}

export type ProfileErrorCode =
  | "InvalidActor"
  | "InvalidContext"
  | "ActorNotFound"
  | "RecordUnavailable";

export class ProfileError extends Error {
  constructor(
    readonly code: ProfileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProfileError";
  }
}

/** The resolver used when none is given. Exported so a caller can reuse one across many lookups. */
export const defaultResolver = (fetch?: typeof globalThis.fetch): ActorResolver =>
  new LocalActorResolver({
    handleResolver: new CompositeHandleResolver({
      methods: {
        dns: new DohJsonHandleResolver({
          dohUrl: "https://cloudflare-dns.com/dns-query",
          ...(fetch && { fetch }),
        }),
        http: new WellKnownHandleResolver({ ...(fetch && { fetch }) }),
      },
    }),
    didDocumentResolver: new CompositeDidDocumentResolver({
      methods: {
        plc: new PlcDidDocumentResolver({ ...(fetch && { fetch }) }),
        web: new WebDidDocumentResolver({ ...(fetch && { fetch }) }),
      },
    }),
  });

/** A blob as its own PDS serves it. Deliberately not a Bluesky CDN URL: the profile must not depend on any one app. */
export const blobUrl = (pds: string, did: string, blob: Blob): string => {
  const url = new URL("/xrpc/com.atproto.sync.getBlob", pds);
  url.searchParams.set("did", did);
  url.searchParams.set("cid", blob.ref.$link);

  return url.toString();
};

/** One record from a repo, or `undefined` if there is none. Any other failure is thrown: a missing profile and an unreachable PDS are different answers. */
const getRecord = async (
  client: Client,
  repo: string,
  collection: string,
  rkey: string,
  signal: AbortSignal,
) => {
  const response = await client.get("com.atproto.repo.getRecord", {
    params: { repo: repo as ActorIdentifier, collection: collection as never, rkey },
    signal,
  });

  if (response.ok) {
    return response.data.value;
  }

  if (response.data.error === "RecordNotFound") {
    return undefined;
  }

  throw new ProfileError(
    "RecordUnavailable",
    `Could not read ${collection}/${rkey}: ${response.data.error}`,
  );
};

/**
 * How an account appears in one context: that context's override over the account's base profile.
 *
 * Reads straight from the account's own PDS. A record that is missing is normal; one that fails its schema is treated as missing rather than failing the lookup, because it was written by someone else and a bad field there should cost that field, not the profile.
 */
export const getProfile = async (
  actor: string,
  context: string,
  options: GetProfileOptions = {},
): Promise<ProfileView> => {
  if (!isActorIdentifier(actor)) {
    throw new ProfileError("InvalidActor", `Not a handle or DID: ${actor}`);
  }

  // safeParse, not v.is: the guard would narrow `context` to never in the message below.
  if (!v.safeParse(contextSchema, context).success) {
    throw new ProfileError(
      "InvalidContext",
      `Not a context (an app's reversed domain, e.g. social.taproom): ${context}`,
    );
  }

  const signal = AbortSignal.timeout(options.timeout ?? 10_000);
  const resolver = options.resolver ?? defaultResolver(options.fetch);

  let resolved;
  try {
    resolved = await resolver.resolve(actor, { signal });
  } catch (error) {
    throw new ProfileError(
      "ActorNotFound",
      `Could not resolve ${actor}: ${(error as Error).message}`,
    );
  }

  const client = new Client({
    handler: simpleFetchHandler({
      service: resolved.pds,
      ...(options.fetch && { fetch: options.fetch }),
    }),
  });

  const [baseRecord, overrideRecord] = await Promise.all([
    getRecord(client, resolved.did, NSID_BSKY_PROFILE, "self", signal),
    getRecord(client, resolved.did, NSID_PROFILE, context, signal),
  ]);

  const base = v.safeParse(baseProfileSchema, baseRecord);
  const override = v.safeParse(profileOverrideSchema, overrideRecord);
  const { fields, sources } = mergeProfile(
    base.success ? base.output : undefined,
    override.success ? override.output : undefined,
  );

  const text = (value: unknown) => (typeof value === "string" ? value : undefined);
  const image = (value: unknown) =>
    typeof value === "object" && value !== null
      ? blobUrl(resolved.pds, resolved.did, value as Blob)
      : undefined;

  const view = {
    did: resolved.did,
    handle: resolved.handle,
    context,
    displayName: text(fields.displayName),
    description: text(fields.description),
    pronouns: text(fields.pronouns),
    website: text(fields.website),
    avatar: image(fields.avatar),
    banner: image(fields.banner),
    sources,
  };

  // Absent rather than undefined, so the JSON the service returns matches the lexicon.
  return Object.fromEntries(
    Object.entries(view).filter(([, value]) => value !== undefined),
  ) as unknown as ProfileView;
};
