import { rotatedSize, type Rect, type Rotation, type Size } from "./crop";

/**
 * The browser side of cropping: opening a photo, turning it, and drawing part of it. Kept thin; the geometry lives in crop.ts.
 */

/** The longest side kept in memory. Larger than any app's output, small enough that a 48-megapixel phone photo doesn't strain a tab. */
const MAX_SIDE = 4096;

export class UnreadableImageError extends Error {
  constructor(file: { readonly type: string; readonly name?: string }) {
    const heic = /hei[cf]/iu.test(file.type) || /\.hei[cf]$/iu.test(file.name ?? "");
    super(
      heic
        ? "This browser can't open HEIC photos, which iPhones save by default. Open it in Safari, or export it as JPEG first."
        : "This browser can't open that file as an image.",
    );
    this.name = "UnreadableImageError";
  }
}

/** Open a photo, upright as its camera meant it, and no larger than we need. */
export const openPhoto = async (file: Blob & { readonly name?: string }): Promise<ImageBitmap> => {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UnreadableImageError(file);
  }

  const scale = MAX_SIDE / Math.max(bitmap.width, bitmap.height);
  if (scale >= 1) return bitmap;

  const smaller = await createImageBitmap(bitmap, {
    resizeWidth: Math.round(bitmap.width * scale),
    resizeHeight: Math.round(bitmap.height * scale),
    resizeQuality: "high",
  });
  bitmap.close();
  return smaller;
};

const canvasOf = (size: Size): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  return canvas;
};

const context = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw images.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
};

/** The photo turned clockwise by `rotation`, as its own canvas, so every crop after it is a plain rectangle. */
export const turnPhoto = (photo: ImageBitmap, rotation: Rotation): HTMLCanvasElement => {
  const size = rotatedSize(photo, rotation);
  const canvas = canvasOf(size);
  const ctx = context(canvas);
  ctx.translate(size.width / 2, size.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(photo, -photo.width / 2, -photo.height / 2);
  return canvas;
};

/**
 * Draw `rect` of the turned photo so it fills `frame` inside a canvas of `size`, with whatever lies around the frame drawn around it. Used for the cropper's stage and for its previews.
 */
export const drawCrop = (
  ctx: CanvasRenderingContext2D,
  turned: HTMLCanvasElement,
  rect: Rect,
  frame: Rect,
): void => {
  const scale = frame.width / rect.width;
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.setTransform(scale, 0, 0, scale, frame.x - rect.x * scale, frame.y - rect.y * scale);
  ctx.drawImage(turned, 0, 0);
  ctx.restore();
};

/**
 * The finished image: `rect` of the turned photo at `size`.
 *
 * Drawn over white, so a transparent PNG saved as JPEG gets a white background rather than a black one. Large reductions are halved in steps first; one big step in a canvas leaves the result soft and speckled.
 */
export const renderOutput = (
  turned: HTMLCanvasElement,
  rect: Rect,
  size: Size,
): HTMLCanvasElement => {
  let source: HTMLCanvasElement = turned;
  let area: Rect = rect;
  while (area.width / 2 >= size.width) {
    const half = canvasOf({
      width: Math.round(area.width / 2),
      height: Math.round(area.height / 2),
    });
    context(half).drawImage(
      source,
      area.x,
      area.y,
      area.width,
      area.height,
      0,
      0,
      half.width,
      half.height,
    );
    source = half;
    area = { x: 0, y: 0, width: half.width, height: half.height };
  }

  const canvas = canvasOf(size);
  const ctx = context(canvas);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(source, area.x, area.y, area.width, area.height, 0, 0, size.width, size.height);
  return canvas;
};
