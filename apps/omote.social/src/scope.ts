import { NSID_PROFILE } from "@omote-social/lexicon";

/**
 * What the editor asks for: its own records and images for them, nothing else.
 *
 * It cannot post, follow, or touch the Bluesky profile it reads. One definition, used by both the sign-in request and the client metadata document, because bsky.social rejects a request whose scope the metadata does not declare.
 */
export const SCOPE = ["atproto", `repo:${NSID_PROFILE}`, "blob:image/*"].join(" ");
