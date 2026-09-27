import { describe, expect, it } from "vitest";
import { imageChoices } from "./choices";

const blob = (link: string, mimeType = "image/jpeg") => ({
  $type: "blob",
  ref: { $link: link },
  mimeType,
  size: 1000,
});

describe("images to reuse", () => {
  it("offers each profile's own avatar once, Bluesky's first", () => {
    const profiles = new Map<string, unknown>([
      ["social.grain.actor.profile", { avatar: blob("bafkreigrain") }],
      ["dev.npmx.actor.profile", { avatar: blob("bafkreishared") }],
      ["app.bsky.actor.profile", { avatar: blob("bafkreishared"), banner: blob("bafkreibanner") }],
    ]);

    expect(imageChoices(profiles, "avatar").map((choice) => choice.collection)).toEqual([
      "app.bsky.actor.profile",
      "social.grain.actor.profile",
    ]);
  });

  it("keeps avatars and banners apart, since their shapes differ", () => {
    const profiles = new Map<string, unknown>([
      ["app.bsky.actor.profile", { avatar: blob("bafkreiavatar"), banner: blob("bafkreibanner") }],
    ]);

    expect(imageChoices(profiles, "banner").map((choice) => choice.image.ref.$link)).toEqual([
      "bafkreibanner",
    ]);
  });

  it("offers nothing a profile only hides or lacks", () => {
    const profiles = new Map<string, unknown>([
      ["social.omote.actor.profile", { avatar: null }],
      ["id.sifa.profile.self", {}],
    ]);

    expect(imageChoices(profiles, "avatar")).toEqual([]);
  });
});
