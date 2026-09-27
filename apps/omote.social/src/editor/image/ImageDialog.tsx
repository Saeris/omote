import type { Blob as BlobRef } from "@omote-social/lexicon";
import { blobUrl } from "@omote-social/profiles";
import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DropZone,
  FileTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Text,
} from "react-aria-components";
import type { Session } from "../../auth";
import { describeImageRule } from "../api";
import { nameOf } from "../collections";
import { accepts, type FieldRule } from "../shape";
import { cropRect, initialCrop, isUntouched, outputSize, rotatedSize, type Crop } from "./crop";
import type { Choice } from "./choices";
import { Cropper, type FrameShape } from "./Cropper";
import { canvasEncoder, encodeToFit } from "./encode";
import { openPhoto, renderOutput, turnPhoto } from "./render";

/** What was chosen: an image already in the account, reused as it is, or a new file to upload. */
export type Picked =
  | { readonly kind: "existing"; readonly image: BlobRef }
  | { readonly kind: "new"; readonly file: Blob };

export type { Choice };

export interface ImageKind {
  readonly noun: "avatar" | "banner";
  readonly aspect: number;
  readonly shape: FrameShape;
  /** Width to save at most. Bluesky's own app saves avatars at 1000px and banners at 3000px. */
  readonly maxWidth: number;
}

export const AVATAR: ImageKind = { noun: "avatar", aspect: 1, shape: "circle", maxWidth: 1000 };
export const BANNER: ImageKind = { noun: "banner", aspect: 3, shape: "rect", maxWidth: 3000 };

/** Where the photo being cropped came from, so an untouched one can be used without re-encoding. */
type Source =
  | { readonly kind: "file"; readonly file: File }
  | { readonly kind: "existing"; readonly image: BlobRef };

const fitsAsIs = (rule: FieldRule, type: string, size: number) =>
  accepts(rule, type) && (rule.maxSize === undefined || size <= rule.maxSize);

const TILE =
  "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-6 text-sm font-medium data-[drop-target]:border-neutral-900 data-[drop-target]:bg-neutral-100";

/**
 * Choosing an avatar or banner, as Discord does it: upload a new image or reuse one you already have, then frame it. Whatever comes out is made to fit this app's formats and size, so a large photo is never refused.
 */
export const ImageDialog = ({
  session,
  kind,
  rule,
  choices,
  onPicked,
  onClose,
}: {
  readonly session: Session;
  readonly kind: ImageKind;
  readonly rule: FieldRule;
  readonly choices: readonly Choice[];
  readonly onPicked: (picked: Picked) => void;
  readonly onClose: () => void;
}) => {
  const [source, setSource] = useState<Source>();
  const [photo, setPhoto] = useState<ImageBitmap>();
  const [crop, setCrop] = useState<Crop>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => () => photo?.close(), [photo]);

  const open = async (next: Source) => {
    setProblem(undefined);
    setBusy(true);
    try {
      const file =
        next.kind === "file"
          ? next.file
          : await fetch(blobUrl(session.pds, session.did, next.image)).then((response) => {
              if (!response.ok) throw new Error("That image couldn't be loaded from your server.");
              return response.blob();
            });
      const opened = await openPhoto(file);
      setSource(next);
      setPhoto(opened);
      setCrop(initialCrop(opened));
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!source || !photo || !crop) return;
    setBusy(true);
    setProblem(undefined);
    try {
      // Used as it is when nothing was cropped away and it already fits: no re-encoding, and an animated image stays animated.
      if (isUntouched(crop, photo, kind.aspect)) {
        if (
          source.kind === "existing" &&
          fitsAsIs(rule, source.image.mimeType, source.image.size)
        ) {
          onPicked({ kind: "existing", image: source.image });
          return;
        }
        if (source.kind === "file" && fitsAsIs(rule, source.file.type, source.file.size)) {
          onPicked({ kind: "new", file: source.file });
          return;
        }
      }

      const turned = turnPhoto(photo, crop.rotation);
      const rect = cropRect(rotatedSize(photo, crop.rotation), kind.aspect, crop);
      const size = outputSize(rect, kind.aspect, kind.maxWidth);
      const file = await encodeToFit(
        rule,
        canvasEncoder(renderOutput(turned, rect, size)),
        (factor) =>
          canvasEncoder(
            renderOutput(turned, rect, {
              width: Math.max(1, Math.round(size.width * factor)),
              height: Math.max(1, Math.round(size.height * factor)),
            }),
          ),
      );
      onPicked({ kind: "new", file });
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openFile = (files: FileList | File[] | null) => {
    const file = files?.[0];
    if (file) void open({ kind: "file", file });
  };

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={(isOpen) => !isOpen && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <Modal className="max-h-full w-full max-w-lg overflow-auto rounded-xl bg-white shadow-xl">
        <Dialog className="flex flex-col gap-5 p-6 outline-none">
          {({ close }) => (
            <>
              <Heading slot="title" className="text-lg font-semibold">
                {photo
                  ? `Frame your ${kind.noun}`
                  : `Choose ${kind.noun === "avatar" ? "an avatar" : "a banner"}`}
              </Heading>

              {photo && crop ? (
                <Cropper
                  photo={photo}
                  aspect={kind.aspect}
                  shape={kind.shape}
                  crop={crop}
                  onChange={setCrop}
                />
              ) : (
                <>
                  <DropZone
                    className={TILE}
                    onDrop={async (event) => {
                      const item = event.items.find((drop) => drop.kind === "file");
                      if (item?.kind === "file") openFile([await item.getFile()]);
                    }}
                  >
                    <FileTrigger acceptedFileTypes={["image/*"]} onSelect={openFile}>
                      <Button
                        isDisabled={busy}
                        className="rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-60"
                      >
                        {busy ? "Opening…" : "Upload an image"}
                      </Button>
                    </FileTrigger>
                    <Text slot="label" className="text-xs font-normal text-neutral-600">
                      Or drop one here. Any size: it's framed and fitted for this app.
                    </Text>
                  </DropZone>

                  {choices.length > 0 && (
                    <section aria-labelledby="reuse-heading" className="flex flex-col gap-2">
                      <h3 id="reuse-heading" className="text-sm font-medium">
                        Your {kind.noun}s in other profiles
                      </h3>
                      <ul className="flex flex-wrap gap-3">
                        {choices.map((choice) => (
                          <li key={choice.image.ref.$link}>
                            <Button
                              isDisabled={busy}
                              aria-label={`Use your ${kind.noun} from ${nameOf(choice.collection)}`}
                              onPress={() => void open({ kind: "existing", image: choice.image })}
                              className={`block overflow-hidden bg-neutral-200 outline-offset-2 data-[focus-visible]:outline-2 ${
                                kind.shape === "circle"
                                  ? "h-16 w-16 rounded-full"
                                  : "h-16 w-48 rounded-md"
                              }`}
                            >
                              <img
                                src={blobUrl(session.pds, session.did, choice.image)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </>
              )}

              <p className="text-xs text-neutral-600">
                This app takes {describeImageRule(rule)}. Larger images are resized to fit.
              </p>
              {problem && (
                <p role="alert" className="text-sm text-red-700">
                  {problem}
                </p>
              )}

              <div className="flex justify-end gap-3">
                {photo && (
                  <Button
                    onPress={() => {
                      setPhoto(undefined);
                      setSource(undefined);
                      setCrop(undefined);
                    }}
                    className="mr-auto text-sm text-neutral-600 underline underline-offset-2"
                  >
                    Choose another
                  </Button>
                )}
                <Button
                  onPress={close}
                  className="rounded-md border border-neutral-300 px-4 py-2 text-sm"
                >
                  Cancel
                </Button>
                {photo && (
                  <Button
                    onPress={() => void apply()}
                    isDisabled={busy}
                    className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {busy ? "Preparing…" : "Apply"}
                  </Button>
                )}
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
