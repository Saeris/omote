import * as v from "valibot";

/**
 * Suggestions for the sign-in field, from two places:
 *
 * - **handles signed in with on this device**, which never leave it;
 * - **Bluesky's public directory**, once two characters are typed. That sends what is typed to Bluesky's AppView, so the field says so. Resolving the chosen handle does not: sign-in itself still goes through DNS and the account's own server (see auth.ts).
 */

const REMEMBERED = "omote.handles";
const MAX_REMEMBERED = 5;
const MAX_SUGGESTIONS = 8;

/** Typed characters before Bluesky is asked: one letter matches too much to be useful. */
export const MIN_QUERY = 2;

export interface Suggestion {
  readonly handle: string;
  readonly displayName?: string;
  readonly avatar?: string;
  /** Signed in with on this device before. */
  readonly remembered?: true;
}

/** A handle as typed, in its canonical form: handles are case-insensitive, and people often paste one with its `@`. */
export const normaliseHandle = (input: string): string =>
  input.trim().replace(/^@/u, "").toLowerCase();

export const rememberedHandles = (): string[] => {
  try {
    const stored: unknown = JSON.parse(globalThis.localStorage.getItem(REMEMBERED) ?? "[]");
    return Array.isArray(stored)
      ? stored.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    // Blocked or corrupt storage: no suggestions from this device.
    return [];
  }
};

/** Most recent first, so the account used last is the first suggestion. */
export const rememberHandle = (handle: string): void => {
  try {
    const handles = [handle, ...rememberedHandles().filter((known) => known !== handle)];
    globalThis.localStorage.setItem(REMEMBERED, JSON.stringify(handles.slice(0, MAX_REMEMBERED)));
  } catch {
    // Blocked storage: the handle is simply not remembered.
  }
};

const actorsSchema = v.object({
  actors: v.array(
    v.object({
      handle: v.string(),
      displayName: v.optional(v.string()),
      avatar: v.optional(v.string()),
    }),
  ),
});

/** Bluesky's typeahead answer, or nothing if it isn't one. */
export const readActors = (body: unknown): Suggestion[] => {
  const parsed = v.safeParse(actorsSchema, body);
  if (!parsed.success) return [];

  return parsed.output.actors.map(({ handle, displayName, avatar }) => ({
    handle,
    ...(displayName?.trim() && { displayName }),
    ...(avatar && { avatar }),
  }));
};

export const searchHandles = async (query: string, signal: AbortSignal): Promise<Suggestion[]> => {
  const url = new URL("https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(MAX_SUGGESTIONS));

  const response = await fetch(url, { signal });
  // Suggestions are a convenience: a failure means none, never a broken sign-in.
  return response.ok ? readActors(await response.json()) : [];
};

/**
 * What to offer for what's typed: this device's handles first, then Bluesky's, each handle once.
 *
 * `handle.invalid` is left out: it is what an account whose handle no longer verifies is shown as, and it cannot be signed in with.
 */
export const suggest = (
  typed: string,
  remembered: readonly string[],
  found: readonly Suggestion[],
): Suggestion[] => {
  const query = normaliseHandle(typed);
  const mine = remembered
    .filter((handle) => handle.includes(query))
    .map((handle): Suggestion => ({ handle, remembered: true }));
  const known = new Set(mine.map((suggestion) => suggestion.handle));
  const theirs = found.filter(
    (suggestion) => !known.has(suggestion.handle) && suggestion.handle !== "handle.invalid",
  );

  return [...mine, ...theirs].slice(0, MAX_SUGGESTIONS);
};
