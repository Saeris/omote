import type { Did } from "@atcute/lexicons";
import { NSID_BASE_PROFILE, blobSchema, type Blob } from "@omote-social/lexicon";
import * as v from "valibot";
import type { Session } from "../auth";
import { isProfileCollection } from "./collections";
import { accepts, type FieldRule } from "./shape";

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

/** Write one profile record, at its `self` key. The record is complete: build it from the one read (see form-model.ts), so nothing another app wrote is lost. */
export const saveProfile = async (
  session: Session,
  collection: string,
  record: Record<string, unknown>,
): Promise<void> => {
  const response = await session.rpc.post("com.atproto.repo.putRecord", {
    input: {
      repo: session.did,
      collection: collection as never,
      rkey: "self",
      record: record as never,
    },
  });
  if (!response.ok) throw failure("Could not save", response.data);
};

/** Only the shared base is ever deleted here: removing an app's own record is that app's business. */
export const deleteBase = async (session: Session): Promise<void> => {
  const response = await session.rpc.post("com.atproto.repo.deleteRecord", {
    input: { repo: session.did, collection: NSID_BASE_PROFILE, rkey: "self" },
  });
  if (!response.ok) throw failure("Could not delete", response.data);
};

const FORMAT_NAME: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/gif": "GIF",
  "image/webp": "WebP",
  "image/avif": "AVIF",
};

/** An image rule in words: "PNG or JPEG, up to 1 MB". */
export const describeImageRule = (rule: FieldRule): string => {
  const formats = rule.accept?.some((type) => type.endsWith("/*"))
    ? undefined
    : rule.accept?.map((type) => FORMAT_NAME[type] ?? type);
  const list = formats && new Intl.ListFormat("en", { type: "disjunction" }).format(formats);
  const size = rule.maxSize && `up to ${rule.maxSize / 1_000_000} MB`;
  return [list, size].filter(Boolean).join(", ") || "any image";
};

/**
 * Upload an image to the account's PDS, for one record. Checked against that record's own lexicon first, so an image the app would refuse is refused here, with a reason.
 */
export const uploadImage = async (
  session: Session,
  file: globalThis.Blob,
  rule: FieldRule,
): Promise<Blob> => {
  if (!accepts(rule, file.type) || (rule.maxSize !== undefined && file.size > rule.maxSize)) {
    throw new Error(`This app takes ${describeImageRule(rule)}.`);
  }

  const response = await session.rpc.post("com.atproto.repo.uploadBlob", {
    input: file,
    headers: { "content-type": file.type },
  });
  if (!response.ok && response.status === 413) {
    // Within the app's limit but over the person's own server's, e.g. a self-hosted PDS at its 5 MB default.
    // Keyed on the status: the reference PDS names it PayloadTooLarge, and other servers may not.
    throw new Error("Your account's server won't accept an image this large. Try a smaller one.");
  }
  if (!response.ok) throw failure("Could not upload", response.data);

  return v.parse(blobSchema, response.data.blob);
};

export type { Did };
