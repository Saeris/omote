import type { Did } from "@atcute/lexicons";
import {
  MAX_IMAGE_BYTES,
  NSID_BSKY_PROFILE,
  NSID_PROFILE,
  baseProfileSchema,
  blobSchema,
  profileOverrideSchema,
  type BaseProfile,
  type Blob,
  type ProfileOverride,
} from "@omote/lexicon";
import * as v from "valibot";
import type { Session } from "../auth";

/**
 * The editor's reads and writes, all against the signed-in account's own PDS.
 */

export interface Override {
  /** The context, which is also the record key. */
  readonly context: string;
  /** Undefined when the record exists but cannot be read, e.g. written by another app with fields out of range. */
  readonly record: ProfileOverride | undefined;
  /** Why it could not be read. Shown, never hidden: it is still this person's record. */
  readonly problem?: string;
}

const failure = (what: string, data: { error: string; message?: string }): Error =>
  new Error(`${what}: ${data.message ?? data.error}`);

/** Every context this account has customised. */
export const listOverrides = async (session: Session): Promise<Override[]> => {
  const overrides: Override[] = [];
  let cursor: string | undefined;

  do {
    const response = await session.rpc.get("com.atproto.repo.listRecords", {
      params: {
        repo: session.did,
        collection: NSID_PROFILE,
        limit: 100,
        ...(cursor && { cursor }),
      },
    });
    if (!response.ok) throw failure("Could not list your profiles", response.data);

    for (const entry of response.data.records) {
      const parsed = v.safeParse(profileOverrideSchema, entry.value);
      const context = entry.uri.split("/").at(-1);
      if (!context) continue;
      overrides.push(
        parsed.success
          ? { context, record: parsed.output }
          : { context, record: undefined, problem: v.summarize(parsed.issues) },
      );
    }
    cursor = response.data.cursor;
  } while (cursor);

  return overrides;
};

/** The base profile every override falls back to, or undefined for an account that has none. */
export const getBase = async (session: Session): Promise<BaseProfile | undefined> => {
  const response = await session.rpc.get("com.atproto.repo.getRecord", {
    params: { repo: session.did, collection: NSID_BSKY_PROFILE, rkey: "self" },
  });

  if (!response.ok && response.data.error === "RecordNotFound") {
    return undefined;
  }
  if (!response.ok) throw failure("Could not read your base profile", response.data);

  const parsed = v.safeParse(baseProfileSchema, response.data.value);
  return parsed.success ? parsed.output : undefined;
};

export const saveOverride = async (
  session: Session,
  context: string,
  record: ProfileOverride,
): Promise<void> => {
  const response = await session.rpc.post("com.atproto.repo.putRecord", {
    input: { repo: session.did, collection: NSID_PROFILE, rkey: context, record: record as never },
  });
  if (!response.ok) throw failure("Could not save", response.data);
};

export const deleteOverride = async (session: Session, context: string): Promise<void> => {
  const response = await session.rpc.post("com.atproto.repo.deleteRecord", {
    input: { repo: session.did, collection: NSID_PROFILE, rkey: context },
  });
  if (!response.ok) throw failure("Could not delete", response.data);
};

/**
 * Upload an image to the account's PDS. Checked here first, so a too-large file is refused with a reason rather than a PDS error.
 */
export const uploadImage = async (session: Session, file: File): Promise<Blob> => {
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    throw new Error("Images must be PNG or JPEG.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Images must be 1 MB or smaller.");
  }

  const response = await session.rpc.post("com.atproto.repo.uploadBlob", {
    input: file,
    headers: { "content-type": file.type },
  });
  if (!response.ok) throw failure("Could not upload", response.data);

  return v.parse(blobSchema, response.data.blob);
};

export type { Did };
