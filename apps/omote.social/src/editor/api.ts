import type { Did } from "@atcute/lexicons";
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  NSID_BASE_PROFILE,
  blobSchema,
  type Blob,
} from "@omote-social/lexicon";
import * as v from "valibot";
import type { Session } from "../auth";
import { isProfileCollection } from "./collections";

/**
 * The editor's reads and writes, all against the signed-in account's own PDS.
 */

/** Every profile record in the account, keyed by collection: what `resolveProfile` takes. */
export type Profiles = ReadonlyMap<string, Record<string, unknown>>;

const failure = (what: string, data: { error: string; message?: string }): Error =>
  new Error(`${what}: ${data.message ?? data.error}`);

/**
 * Every app's profile record in this account, Bluesky's and the shared base included.
 *
 * `describeRepo` lists the collections, so this finds apps omote has never heard of. Each is read at `self`, where `extends` looks for a base.
 */
export const listProfiles = async (session: Session): Promise<Profiles> => {
  const described = await session.rpc.get("com.atproto.repo.describeRepo", {
    params: { repo: session.did },
  });
  if (!described.ok) throw failure("Could not list your records", described.data);

  const entries = await Promise.all(
    described.data.collections.filter(isProfileCollection).map(async (collection) => {
      const response = await session.rpc.get("com.atproto.repo.getRecord", {
        params: { repo: session.did, collection: collection as never, rkey: "self" },
      });
      if (!response.ok && response.data.error === "RecordNotFound") return undefined;
      if (!response.ok) throw failure(`Could not read ${collection}`, response.data);

      return [collection, response.data.value as Record<string, unknown>] as const;
    }),
  );

  return new Map(entries.filter((entry) => entry !== undefined));
};

export const saveBase = async (
  session: Session,
  record: Record<string, unknown>,
): Promise<void> => {
  const response = await session.rpc.post("com.atproto.repo.putRecord", {
    input: {
      repo: session.did,
      collection: NSID_BASE_PROFILE,
      rkey: "self",
      record: record as never,
    },
  });
  if (!response.ok) throw failure("Could not save", response.data);
};

export const deleteBase = async (session: Session): Promise<void> => {
  const response = await session.rpc.post("com.atproto.repo.deleteRecord", {
    input: { repo: session.did, collection: NSID_BASE_PROFILE, rkey: "self" },
  });
  if (!response.ok) throw failure("Could not delete", response.data);
};

/**
 * Upload an image to the account's PDS. Checked here first, so a too-large file is refused with a reason rather than a PDS error.
 */
export const uploadImage = async (session: Session, file: File): Promise<Blob> => {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new Error("Images must be PNG, JPEG, GIF, WebP or AVIF.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Images must be 10 MB or smaller.");
  }

  const response = await session.rpc.post("com.atproto.repo.uploadBlob", {
    input: file,
    headers: { "content-type": file.type },
  });
  if (!response.ok && response.status === 413) {
    // Within our ceiling but over the person's own server's, e.g. a self-hosted PDS at its 5 MB default.
    // Keyed on the status: the reference PDS names it PayloadTooLarge, and other servers may not.
    throw new Error("Your account's server won't accept an image this large. Try a smaller one.");
  }
  if (!response.ok) throw failure("Could not upload", response.data);

  return v.parse(blobSchema, response.data.blob);
};

export type { Did };
