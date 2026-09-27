import { describe, expect, it } from "vitest";
import {
  MAX_ZOOM,
  cropRect,
  initialCrop,
  isUntouched,
  outputSize,
  panBy,
  rotateClockwise,
  rotatedSize,
  zoomTo,
} from "./crop";

const landscape = { width: 4000, height: 3000 };
const SQUARE = 1;
const BANNER = 3;

describe("the frame", () => {
  it("starts on the middle of the photo, as large as the photo allows", () => {
    expect(cropRect(landscape, SQUARE, initialCrop(landscape))).toEqual({
      x: 500,
      y: 0,
      width: 3000,
      height: 3000,
    });
  });

  it("takes the frame's shape, so a banner from a portrait photo is a strip across it", () => {
    const portrait = { width: 3000, height: 4000 };

    expect(cropRect(portrait, BANNER, initialCrop(portrait))).toEqual({
      x: 0,
      y: 1500,
      width: 3000,
      height: 1000,
    });
  });
});

describe("moving the photo", () => {
  it("follows the drag, the way a print moves under a mat", () => {
    // A 300px frame showing 3000 photo pixels: each screen pixel is ten photo pixels.
    const moved = panBy(initialCrop(landscape), landscape, SQUARE, 300, { x: 20, y: 0 });

    expect(cropRect(landscape, SQUARE, moved).x).toBe(300);
  });

  it("never leaves an empty edge in the frame, however far it is dragged", () => {
    const moved = panBy(initialCrop(landscape), landscape, SQUARE, 300, { x: -10_000, y: 5000 });

    expect(cropRect(landscape, SQUARE, moved)).toEqual({
      x: 1000,
      y: 0,
      width: 3000,
      height: 3000,
    });
  });
});

describe("zooming", () => {
  it("shows less of the photo around the same point", () => {
    const zoomed = zoomTo(initialCrop(landscape), landscape, SQUARE, 2);

    expect(cropRect(landscape, SQUARE, zoomed)).toEqual({
      x: 1250,
      y: 750,
      width: 1500,
      height: 1500,
    });
  });

  it("stays within its range", () => {
    expect(zoomTo(initialCrop(landscape), landscape, SQUARE, 100).zoom).toBe(MAX_ZOOM);
    expect(zoomTo(initialCrop(landscape), landscape, SQUARE, 0.1).zoom).toBe(1);
  });

  it("pulls the frame back inside the photo when zooming out near an edge", () => {
    const atEdge = panBy(
      zoomTo(initialCrop(landscape), landscape, SQUARE, 3),
      landscape,
      SQUARE,
      300,
      {
        x: 10_000,
        y: 0,
      },
    );

    expect(cropRect(landscape, SQUARE, zoomTo(atEdge, landscape, SQUARE, 1)).x).toBe(0);
  });
});

describe("turning the photo", () => {
  it("swaps its sides", () => {
    const turned = rotateClockwise(initialCrop(landscape), landscape, SQUARE);

    expect(turned.rotation).toBe(90);
    expect(rotatedSize(landscape, turned.rotation)).toEqual({ width: 3000, height: 4000 });
  });

  it("keeps the same part of the photo in the frame", () => {
    // Zoomed onto the photo's top-left quarter, then turned: that corner is now top-right.
    const corner = { zoom: 4, rotation: 0 as const, center: { x: 1000, y: 750 } };

    const turned = rotateClockwise(corner, landscape, SQUARE);

    expect(turned.center).toEqual({ x: 2250, y: 1000 });
  });

  it("comes back upright after four turns", () => {
    let crop = initialCrop(landscape);
    for (let turn = 0; turn < 4; turn += 1) crop = rotateClockwise(crop, landscape, SQUARE);

    expect(crop).toEqual(initialCrop(landscape));
  });
});

describe("the saved image", () => {
  it("is no larger than the app needs", () => {
    expect(outputSize({ width: 3000, height: 3000 }, SQUARE, 1000)).toEqual({
      width: 1000,
      height: 1000,
    });
  });

  it("is never enlarged beyond what the photo holds", () => {
    expect(outputSize({ width: 400, height: 400 }, SQUARE, 1000)).toEqual({
      width: 400,
      height: 400,
    });
  });

  it("keeps the frame's shape", () => {
    expect(outputSize({ width: 3600, height: 1200 }, BANNER, 3000)).toEqual({
      width: 3000,
      height: 1000,
    });
  });
});

describe("an uncropped photo", () => {
  it("can be used as it is when it already has the frame's shape and nothing was changed", () => {
    const square = { width: 800, height: 800 };

    expect(isUntouched(initialCrop(square), square, SQUARE)).toBe(true);
    expect(isUntouched(zoomTo(initialCrop(square), square, SQUARE, 1.5), square, SQUARE)).toBe(
      false,
    );
    expect(isUntouched(initialCrop(landscape), landscape, SQUARE)).toBe(false);
  });
});
