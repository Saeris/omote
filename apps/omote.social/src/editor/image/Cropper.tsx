import { useEffect, useId, useMemo, useRef } from "react";
import { mergeProps, useMove } from "react-aria";
import {
  Button,
  Label,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  cropRect,
  initialCrop,
  panBy,
  rotateClockwise,
  rotatedSize,
  zoomTo,
  type Crop,
  type Rect,
  type Size,
} from "./crop";
import { drawCrop, turnPhoto } from "./render";

export type FrameShape = "circle" | "rect";

/** How big the stage is on screen, and where the frame sits in it. The stage shows some of the photo around the frame, dimmed, so you can see what you're cutting off. */
const layout = (aspect: number): { stage: Size; frame: Rect } => {
  const width = 360;
  if (aspect === 1) {
    const side = 280;
    return { stage: { width, height: width }, frame: { x: 40, y: 40, width: side, height: side } };
  }
  const frameWidth = 330;
  const frameHeight = frameWidth / aspect;
  return {
    stage: { width, height: frameHeight + 80 },
    frame: { x: 15, y: 40, width: frameWidth, height: frameHeight },
  };
};

/** Screen pixels one arrow-key press moves the photo, and with Shift held. */
const STEP = 10;
const BIG_STEP = 50;
const ZOOM_STEP = 1.1;

const framePath = (ctx: CanvasRenderingContext2D, frame: Rect, shape: FrameShape) => {
  if (shape === "circle") {
    ctx.ellipse(
      frame.x + frame.width / 2,
      frame.y + frame.height / 2,
      frame.width / 2,
      frame.height / 2,
      0,
      0,
      Math.PI * 2,
    );
  } else {
    ctx.rect(frame.x, frame.y, frame.width, frame.height);
  }
};

/** A canvas that redraws a crop whenever it changes, at the screen's own pixel density. */
const useCropCanvas = (
  turned: HTMLCanvasElement,
  rect: Rect,
  size: Size,
  frame: Rect,
  overlay?: FrameShape,
) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const density = globalThis.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * density);
    canvas.height = Math.round(size.height * density);
    ctx.setTransform(density, 0, 0, density, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = "#171717";
    ctx.fillRect(0, 0, size.width, size.height);
    drawCrop(ctx, turned, rect, {
      x: frame.x * density,
      y: frame.y * density,
      width: frame.width * density,
      height: frame.height * density,
    });
    if (overlay) {
      // Dim everything outside the frame, then outline it.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, size.width, size.height);
      framePath(ctx, frame, overlay);
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fill("evenodd");
      ctx.beginPath();
      framePath(ctx, frame, overlay);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }, [turned, rect, size, frame, overlay]);
  return ref;
};

const Preview = ({
  turned,
  rect,
  size,
  shape,
}: {
  readonly turned: HTMLCanvasElement;
  readonly rect: Rect;
  readonly size: Size;
  readonly shape: FrameShape;
}) => {
  const frame = useMemo(() => ({ x: 0, y: 0, ...size }), [size]);
  const ref = useCropCanvas(turned, rect, size, frame);
  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ width: size.width, height: size.height }}
      className={shape === "circle" ? "rounded-full" : "rounded"}
    />
  );
};

/**
 * Frame a photo: move it behind a fixed frame, zoom and turn it.
 *
 * Everything the pointer does, the keyboard does too: the arrow keys move the photo (Shift for bigger steps), + and − zoom. Moving comes from React Aria's `useMove`, which treats drags, touches and arrow keys alike.
 */
export const Cropper = ({
  photo,
  aspect,
  shape,
  crop,
  onChange,
}: {
  readonly photo: ImageBitmap;
  readonly aspect: number;
  readonly shape: FrameShape;
  readonly crop: Crop;
  readonly onChange: (crop: Crop) => void;
}) => {
  const instructions = useId();
  const { stage, frame } = useMemo(() => layout(aspect), [aspect]);
  const turned = useMemo(() => turnPhoto(photo, crop.rotation), [photo, crop.rotation]);
  const turnedSize = rotatedSize(photo, crop.rotation);
  const rect = useMemo(
    () => cropRect(turnedSize, aspect, crop),
    // turnedSize is derived from photo and rotation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [photo, aspect, crop],
  );
  const stageRef = useCropCanvas(turned, rect, stage, frame, shape);

  // Kept in a ref so the native wheel and pinch listeners always see the latest crop.
  const latest = useRef({ crop, turnedSize, onChange });
  latest.current = { crop, turnedSize, onChange };
  const zoomBy = (factor: number) => {
    const { crop: current, turnedSize: size, onChange: change } = latest.current;
    change(zoomTo(current, size, aspect, current.zoom * factor));
  };

  const { moveProps } = useMove({
    onMove: (event) => {
      const step = event.shiftKey ? BIG_STEP : STEP;
      const scale = event.pointerType === "keyboard" ? step : 1;
      onChange(
        panBy(crop, turnedSize, aspect, frame.width, {
          x: event.deltaX * scale,
          y: event.deltaY * scale,
        }),
      );
    },
  });

  // Wheel and pinch need non-passive listeners to stop the page scrolling and zooming instead.
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomBy(Math.exp(-event.deltaY * 0.0015));
    };
    let pinch: { distance: number; zoom: number } | undefined;
    const distance = (touches: TouchList) => {
      const [a, b] = [touches[0], touches[1]];
      return a && b ? Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) : 0;
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        pinch = { distance: distance(event.touches), zoom: latest.current.crop.zoom };
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const { crop: current, turnedSize: size, onChange: change } = latest.current;
      change(
        zoomTo(current, size, aspect, (pinch.zoom * distance(event.touches)) / pinch.distance),
      );
    };
    const onTouchEnd = () => {
      pinch = undefined;
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    element.addEventListener("touchend", onTouchEnd);
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
    };
    // zoomBy reads the ref, so the listeners never need replacing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  const previews: Size[] =
    shape === "circle"
      ? [96, 48, 32].map((side) => ({ width: side, height: side }))
      : [{ width: 240, height: 240 / aspect }];

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={surface}
        {...mergeProps(moveProps, {
          onKeyDown: (event: React.KeyboardEvent) => {
            if (event.key === "+" || event.key === "=") zoomBy(ZOOM_STEP);
            else if (event.key === "-" || event.key === "_") zoomBy(1 / ZOOM_STEP);
          },
        })}
        tabIndex={0}
        role="group"
        aria-roledescription="image cropper"
        aria-label="Photo position"
        aria-describedby={instructions}
        className="cursor-move touch-none rounded-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-neutral-900"
      >
        <canvas
          ref={stageRef}
          aria-hidden
          style={{ width: stage.width, height: stage.height }}
          className="rounded-lg"
        />
      </div>
      <p id={instructions} className="sr-only">
        Drag the photo, or use the arrow keys, to move it inside the frame. Hold Shift to move
        further. Press plus or minus to zoom.
      </p>

      <div className="flex w-full max-w-[360px] items-center gap-3">
        <Slider
          className="flex flex-1 flex-col gap-1"
          minValue={MIN_ZOOM}
          maxValue={MAX_ZOOM}
          step={0.01}
          value={crop.zoom}
          onChange={(zoom) => onChange(zoomTo(crop, turnedSize, aspect, zoom))}
          formatOptions={{ style: "percent", maximumFractionDigits: 0 }}
        >
          <div className="flex justify-between text-xs text-neutral-600">
            <Label>Zoom</Label>
            <SliderOutput />
          </div>
          <SliderTrack className="relative h-5 w-full">
            {({ state }) => (
              <>
                <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-neutral-300" />
                <div
                  className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-neutral-900"
                  style={{ width: `${state.getThumbPercent(0) * 100}%` }}
                />
                <SliderThumb className="top-1/2 h-5 w-5 rounded-full border-2 border-neutral-900 bg-white data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2" />
              </>
            )}
          </SliderTrack>
        </Slider>
        <Button
          aria-label="Turn a quarter clockwise"
          onPress={() => onChange(rotateClockwise(crop, photo, aspect))}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          ↻
        </Button>
        <Button
          onPress={() => onChange(initialCrop(photo))}
          className="rounded-md px-2 py-1.5 text-sm text-neutral-600 underline underline-offset-2"
        >
          Reset
        </Button>
      </div>

      <div className="flex items-end gap-3" aria-hidden>
        {previews.map((size) => (
          <Preview key={size.width} turned={turned} rect={rect} size={size} shape={shape} />
        ))}
      </div>
    </div>
  );
};
