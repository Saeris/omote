import { accepts, type FieldRule } from "../shape";

/**
 * Turning a cropped image into a file an app accepts, with nothing but the browser.
 *
 * Formats are tried in order of how small they come out, among those the app takes; within each, quality steps down until the file fits the app's size limit. A browser that can't encode a format (Safari and WebP) hands back PNG instead of failing, so the result's type is checked rather than trusted.
 */

/** Smallest first, for a photo. PNG is last: lossless, so it rarely fits a limit a photo is near. */
const PREFERRED = ["image/webp", "image/jpeg", "image/png"] as const;

const QUALITIES = [0.92, 0.85, 0.78, 0.7, 0.6, 0.5] as const;

/** How many times to shrink the image by `SHRINK` before giving up, once no quality fits. */
const SHRINKS = 4;
const SHRINK = 0.8;

export type Encode = (type: string, quality: number) => Promise<Blob | null>;
export type Shrink = (factor: number) => Encode;

/** The formats to try for a rule, best first. */
export const formatsFor = (rule: FieldRule): string[] =>
  PREFERRED.filter((type) => accepts(rule, type));

export class TooLargeError extends Error {
  constructor() {
    super("This image can't be made small enough for this app. Try cropping in closer.");
    this.name = "TooLargeError";
  }
}

/**
 * The first encoding that fits: each format at falling quality, then the same again at smaller sizes.
 *
 * `encode` renders the image at its full output size; `shrink(factor)` gives an encoder for a smaller rendering. Both are passed in so the search can be tested without a canvas.
 */
export const encodeToFit = async (
  rule: FieldRule,
  encode: Encode,
  shrink: Shrink,
): Promise<Blob> => {
  const formats = formatsFor(rule);
  const fits = (blob: Blob) => rule.maxSize === undefined || blob.size <= rule.maxSize;

  for (let attempt = 0; attempt <= SHRINKS; attempt += 1) {
    const render = attempt === 0 ? encode : shrink(SHRINK ** attempt);
    for (const type of formats) {
      for (const quality of type === "image/png" ? [1] : QUALITIES) {
        const blob = await render(type, quality);
        // Not this browser's format: it answered with another. Move on to the next.
        if (!blob || blob.type !== type) break;
        if (fits(blob)) return blob;
      }
    }
  }

  throw new TooLargeError();
};

/** A canvas as an encoder, whichever kind the browser gives. */
export const canvasEncoder =
  (canvas: HTMLCanvasElement | OffscreenCanvas): Encode =>
  (type, quality) =>
    "convertToBlob" in canvas
      ? canvas.convertToBlob({ type, quality }).catch(() => null)
      : new Promise((resolve) => canvas.toBlob(resolve, type, quality));
