import { isNsid } from "@atcute/lexicons/syntax";
import {
  FIELDS,
  MAX_EXTENDS,
  NSID_BASE_PROFILE,
  NSID_BSKY_PROFILE,
  blobSchema,
  type Blob,
  type Field,
  type Source,
} from "@omote-social/lexicon";
import * as v from "valibot";

/** A field's value before blobs become URLs. */
export type Value = string | Blob;

/** One profile record, as inheritance sees it. */
export interface ProfileRecord {
  /** The shared fields this record sets (a value) or hides (`null`). A field it is silent about is absent. */
  readonly fields: Partial<Record<Field, Value | null>>;
  /** Its bases, in order. Empty for a root. */
  readonly extends: readonly string[];
}

export interface Resolved {
  readonly fields: Partial<Record<Field, Value>>;
  readonly sources: Partial<Record<Field, Source>>;
  /** The records applied, lowest precedence first. */
  readonly chain: readonly string[];
}

export interface ResolveOptions {
  /** The bases to use when the record being resolved doesn't exist. Default: Bluesky's profile, then the shared base. */
  readonly defaultExtends?: readonly string[];
}

/** What an app should assume for someone who has no record of its own yet: Bluesky's profile, then the shared base if they have one. */
export const DEFAULT_EXTENDS: readonly string[] = [NSID_BSKY_PROFILE, NSID_BASE_PROFILE];

/** How deep a chain is followed, and how many records it may read in all. Bounds the work a hostile or broken chain can cause. */
export const MAX_DEPTH = 8;
export const MAX_RECORDS = 16;

const readText = (value: unknown) =>
  value === null ? null : typeof value === "string" && value.trim() !== "" ? value : undefined;

/** Only a web link: a website is shown as a link, and `javascript:` in someone's record must not become one. */
const readWebsite = (value: unknown) => {
  const text = readText(value);
  if (typeof text !== "string") return text;
  try {
    return ["http:", "https:"].includes(new URL(text).protocol) ? text : undefined;
  } catch {
    return undefined;
  }
};

const readImage = (value: unknown) => {
  if (value === null) return null;
  const parsed = v.safeParse(blobSchema, value);
  return parsed.success ? parsed.output : undefined;
};

const READERS: Record<Field, (value: unknown) => Value | null | undefined> = {
  displayName: readText,
  description: readText,
  pronouns: readText,
  website: readWebsite,
  avatar: readImage,
  banner: readImage,
};

/**
 * A profile record from any app, read field by field.
 *
 * Structural, as TypeScript checks an object against `Partial<Profile>`: a field takes part when it has a shared name and the shared type, and anything else is ignored rather than failing the record. A blank string is absent, because Bluesky writes `displayName: ""` when a name is cleared.
 */
export const readProfileRecord = (value: unknown): ProfileRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { fields: {}, extends: [] };
  }

  const record = value as Record<string, unknown>;
  const fields: Partial<Record<Field, Value | null>> = {};
  for (const field of FIELDS) {
    const read = READERS[field](record[field]);
    if (read !== undefined) fields[field] = read;
  }

  const bases = Array.isArray(record.extends)
    ? [...new Set(record.extends.filter((entry): entry is string => isNsid(entry)))]
    : [];

  return { fields, extends: bases.slice(0, MAX_EXTENDS) };
};

interface Layer extends ProfileRecord {
  readonly collection: string;
}

/**
 * The chain, lowest precedence first: each record after all of its bases, and each only once.
 *
 * Once is where this departs from tsconfig, which resolves each base on its own and merges the results, so a base reached twice applies twice and can undo what the first parent built on it. Here a record always wins over everything it builds on, however it is reached.
 */
const linearize = (
  records: ReadonlyMap<string, unknown>,
  collection: string,
  defaultExtends: readonly string[],
): Layer[] => {
  const layers: Layer[] = [];
  const visited = new Set<string>();

  const visit = (current: string, depth: number) => {
    if (visited.has(current) || depth > MAX_DEPTH || visited.size >= MAX_RECORDS) return;
    visited.add(current);

    const raw = records.get(current);
    if (raw === undefined && depth > 0) return;

    const record =
      raw === undefined ? { fields: {}, extends: defaultExtends } : readProfileRecord(raw);
    for (const base of record.extends) visit(base, depth + 1);
    if (raw !== undefined) layers.push({ collection: current, ...record });
  };

  visit(collection, 0);
  return layers;
};

/** Folds the chain: a value replaces what came before, `null` removes it, and silence changes nothing. */
const fold = (layers: readonly Layer[]): Resolved => {
  const fields: Partial<Record<Field, Value>> = {};
  const sources: Partial<Record<Field, Source>> = {};

  for (const { collection, fields: own } of layers) {
    for (const field of FIELDS) {
      const value = own[field];
      if (value === undefined) continue;

      if (value !== null) {
        fields[field] = value;
        sources[field] = { collection };
      } else if (fields[field] !== undefined || sources[field]?.hidden) {
        // Hiding only means something when there was a value to hide.
        delete fields[field];
        sources[field] = { collection, hidden: true };
      }
    }
  }

  return { fields, sources, chain: layers.map((layer) => layer.collection) };
};

/**
 * How the account appears in the app whose profile record is `collection`, from records already read.
 *
 * Pure, and the heart of the model, so every app that resolves profiles, through this library or by hand, lands on the same answer. `records` maps each collection to its `self` record; a collection that is not there has no record.
 */
export const resolveProfile = (
  records: ReadonlyMap<string, unknown>,
  collection: string,
  options: ResolveOptions = {},
): Resolved => fold(linearize(records, collection, options.defaultExtends ?? DEFAULT_EXTENDS));

/**
 * Reads `collection`'s record and every record its chain reaches, a level at a time so that bases at the same depth load together.
 *
 * `load` returns a collection's `self` record, or `undefined` when there is none. The result is what `resolveProfile` takes.
 */
export const loadChain = async (
  collection: string,
  load: (collection: string) => Promise<unknown>,
  options: ResolveOptions = {},
): Promise<Map<string, unknown>> => {
  const records = new Map<string, unknown>();
  const seen = new Set([collection]);
  let frontier = [collection];

  for (let depth = 0; frontier.length > 0 && depth <= MAX_DEPTH; depth += 1) {
    const loaded = await Promise.all(frontier.map(load));
    const next: string[] = [];

    frontier.forEach((current, index) => {
      const raw = loaded[index];
      if (raw !== undefined) records.set(current, raw);

      const bases =
        raw !== undefined
          ? readProfileRecord(raw).extends
          : depth === 0
            ? (options.defaultExtends ?? DEFAULT_EXTENDS)
            : [];
      for (const base of bases) {
        if (!seen.has(base) && seen.size < MAX_RECORDS) {
          seen.add(base);
          next.push(base);
        }
      }
    });

    frontier = next;
  }

  return records;
};
