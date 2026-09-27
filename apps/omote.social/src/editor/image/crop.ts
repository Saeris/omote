/**
 * The cropper's geometry, apart from any canvas so it can be tested.
 *
 * The frame is fixed and the photo moves behind it, as in Discord's and Bluesky's avatar editors. A crop is where the frame's centre sits on the photo, how far the photo is zoomed, and how it is turned. Everything is in the photo's own pixels, after rotation, so the crop means the same thing at any screen size.
 */

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect extends Point, Size {}

export type Rotation = 0 | 90 | 180 | 270;

export interface Crop {
  /** 1 fits the frame to the photo's shorter side; higher shows less of it. */
  readonly zoom: number;
  readonly rotation: Rotation;
  /** The frame's centre, in the rotated photo's pixels. */
  readonly center: Point;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** The photo's size once turned. */
export const rotatedSize = (size: Size, rotation: Rotation): Size =>
  rotation % 180 === 0 ? size : { width: size.height, height: size.width };

/** How much of the photo the frame shows: the largest area of the frame's shape that fits inside it, divided by the zoom. The frame is never left with an empty edge. */
export const visibleSize = (photo: Size, aspect: number, zoom: number): Size => {
  const fit =
    photo.width / photo.height > aspect
      ? { width: photo.height * aspect, height: photo.height }
      : { width: photo.width, height: photo.width / aspect };
  return { width: fit.width / zoom, height: fit.height / zoom };
};

/** A centre that keeps the frame inside the photo. */
export const clampCenter = (center: Point, photo: Size, visible: Size): Point => ({
  x: clamp(center.x, visible.width / 2, photo.width - visible.width / 2),
  y: clamp(center.y, visible.height / 2, photo.height - visible.height / 2),
});

/** Centred, unzoomed and upright: the whole photo, cropped only to the frame's shape. */
export const initialCrop = (photo: Size): Crop => ({
  zoom: MIN_ZOOM,
  rotation: 0,
  center: { x: photo.width / 2, y: photo.height / 2 },
});

/** The part of the (rotated) photo the frame shows. */
export const cropRect = (photo: Size, aspect: number, crop: Crop): Rect => {
  const visible = visibleSize(photo, aspect, crop.zoom);
  const center = clampCenter(crop.center, photo, visible);
  return {
    x: center.x - visible.width / 2,
    y: center.y - visible.height / 2,
    width: visible.width,
    height: visible.height,
  };
};

/**
 * Drag the photo by a distance on screen. Dragging right shows more of the photo's left, as moving a print under a mat does.
 *
 * `frameWidth` is the frame's width on screen, which sets how many photo pixels one screen pixel is worth.
 */
export const panBy = (
  crop: Crop,
  photo: Size,
  aspect: number,
  frameWidth: number,
  delta: Point,
): Crop => {
  const visible = visibleSize(photo, aspect, crop.zoom);
  const scale = visible.width / frameWidth;
  const center = { x: crop.center.x - delta.x * scale, y: crop.center.y - delta.y * scale };
  return { ...crop, center: clampCenter(center, photo, visible) };
};

/** Zoom, keeping the frame's centre where it is, and the frame inside the photo. */
export const zoomTo = (crop: Crop, photo: Size, aspect: number, zoom: number): Crop => {
  const next = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  return {
    ...crop,
    zoom: next,
    center: clampCenter(crop.center, photo, visibleSize(photo, aspect, next)),
  };
};

/**
 * Turn the photo a quarter clockwise, keeping the same part of it in the frame.
 *
 * `upright` is the photo's size before any rotation. A point (x, y) in the turned photo moves to (height − y, x) after a further clockwise quarter turn.
 */
export const rotateClockwise = (crop: Crop, upright: Size, aspect: number): Crop => {
  const before = rotatedSize(upright, crop.rotation);
  const rotation = ((crop.rotation + 90) % 360) as Rotation;
  const after = rotatedSize(upright, rotation);
  const center = { x: before.height - crop.center.y, y: crop.center.x };
  return {
    ...crop,
    rotation,
    center: clampCenter(center, after, visibleSize(after, aspect, crop.zoom)),
  };
};

/**
 * The size to save: as large as the part shown, up to `maxWidth`, in the frame's shape. Never larger than the photo holds, since upscaling only adds bytes.
 */
export const outputSize = (shown: Size, aspect: number, maxWidth: number): Size => {
  const width = Math.max(1, Math.round(Math.min(shown.width, maxWidth)));
  return { width, height: Math.max(1, Math.round(width / aspect)) };
};

/** Nothing was cropped away beyond what the frame's shape requires: the photo can be used as it is, if it already fits the app. */
export const isUntouched = (crop: Crop, photo: Size, aspect: number): boolean =>
  crop.zoom === MIN_ZOOM &&
  crop.rotation === 0 &&
  Math.abs(photo.width / photo.height - aspect) / aspect < 0.01;
