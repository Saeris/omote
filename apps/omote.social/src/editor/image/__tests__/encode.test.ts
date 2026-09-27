import { describe, expect, it } from "vitest";
import type { FieldRule } from "../../shape";
import { encodeToFit, formatsFor, TooLargeError, type Encode } from "../encode";

const rule = (accept: string[], maxSize?: number): FieldRule => ({
  kind: "image",
  accept,
  ...(maxSize !== undefined && { maxSize }),
  required: false,
  nullable: false,
});

/** A pretend browser: sizes fall with quality and scale; `refuse` lists formats it can't encode, answering with PNG as Safari does. */
const browser =
  (bytesAt: (type: string, quality: number, scale: number) => number, refuse: string[] = []) =>
  (scale = 1): Encode =>
  async (type, quality) => {
    const actual = refuse.includes(type) ? "image/png" : type;
    return new Blob([new Uint8Array(bytesAt(actual, quality, scale))], { type: actual });
  };

const photo = (type: string, quality: number, scale: number) =>
  Math.round((type === "image/png" ? 3_000_000 : 1_500_000 * quality) * scale * scale);

describe("choosing a format", () => {
  it("prefers what comes out smallest, among what the app takes", () => {
    expect(formatsFor(rule(["image/png", "image/jpeg"]))).toEqual(["image/jpeg", "image/png"]);
    expect(formatsFor(rule(["image/*"]))).toEqual(["image/webp", "image/jpeg", "image/png"]);
  });
});

describe("fitting an app's limit", () => {
  it("keeps the best quality that fits, rather than squeezing further than needed", async () => {
    const pick = browser(photo);

    const blob = await encodeToFit(rule(["image/jpeg"], 1_200_000), pick(), pick);

    expect(blob.type).toBe("image/jpeg");
    // 0.92 and 0.85 are over 1.2 MB; 0.78 is the first under it.
    expect(blob.size).toBe(1_170_000);
  });

  it("falls back to JPEG where the browser can't write WebP, as Safari can't", async () => {
    const pick = browser(photo, ["image/webp"]);

    const blob = await encodeToFit(rule(["image/webp", "image/jpeg"], 2_000_000), pick(), pick);

    expect(blob.type).toBe("image/jpeg");
  });

  it("shrinks the image only once no quality fits at full size", async () => {
    const pick = browser(photo);

    // Quality 0.5 is still 750 KB at full size. At 80% it is 480 KB, and every higher quality is over.
    const blob = await encodeToFit(rule(["image/jpeg"], 500_000), pick(), pick);

    expect(blob.size).toBe(480_000);
  });

  it("says so when nothing fits, rather than saving something the app would refuse", async () => {
    const pick = browser(() => 10_000_000);

    await expect(encodeToFit(rule(["image/jpeg"], 1_000_000), pick(), pick)).rejects.toBeInstanceOf(
      TooLargeError,
    );
  });
});
