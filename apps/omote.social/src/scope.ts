import { NSID_BASE_PROFILE } from "@omote-social/lexicon";

/**
 * What the editor asks for: the shared base, and images for it, nothing else.
 *
 * It cannot post, follow, or touch any app's profile record, Bluesky's included: it only reads them. One definition, used by both the sign-in request and the client metadata document, because bsky.social rejects a request whose scope the metadata does not declare.
 */
export const SCOPE = ["atproto", `repo:${NSID_BASE_PROFILE}`, "blob:image/*"].join(" ");
