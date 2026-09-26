/**
 * Resolve how an ATProto account appears in one app: that app's profile record, folded over the records it extends.
 *
 * The production path: an app resolves profiles itself, from the records, with no service of ours in between. The omote.social service answers the same question over XRPC, for prototyping and for apps that prefer not to resolve identities.
 */

export { blobUrl, defaultResolver, getProfile, ProfileError } from "./get-profile";
export type { GetProfileOptions, ProfileErrorCode } from "./get-profile";
export {
  DEFAULT_EXTENDS,
  MAX_DEPTH,
  MAX_RECORDS,
  loadChain,
  readProfileRecord,
  resolveProfile,
} from "./resolve";
export type { ProfileRecord, Resolved, ResolveOptions, Value } from "./resolve";
export type { ProfileView, Source, Field } from "@omote-social/lexicon";
