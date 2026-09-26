/**
 * Resolve how an ATProto account appears in one app.
 *
 * The production path: an app resolves profiles itself, from the records, with no service of ours in between. The omote.social service answers the same question over XRPC, for prototyping and for apps that prefer not to resolve identities.
 */

export { blobUrl, defaultResolver, getProfile, ProfileError } from "./get-profile";
export type { GetProfileOptions, ProfileErrorCode } from "./get-profile";
export { mergeProfile } from "./merge";
export type { Merged } from "./merge";
export type { ProfileView, Source, Field } from "@omote/lexicon";
