import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";

/**
 * "You have unsaved changes." Keeping them is the default, and has focus, so a stray Enter never throws work away.
 */
export const DiscardDialog = ({
  profile,
  onKeep,
  onDiscard,
}: {
  /** The profile with the unsaved changes, by name. */
  readonly profile: string;
  readonly onKeep: () => void;
  readonly onDiscard: () => void;
}) => (
  <ModalOverlay
    isOpen
    isDismissable
    onOpenChange={(isOpen) => !isOpen && onKeep()}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
  >
    <Modal className="w-full max-w-sm rounded-xl bg-white shadow-xl">
      <Dialog role="alertdialog" className="flex flex-col gap-4 p-6 outline-none">
        <Heading slot="title" className="text-lg font-semibold">
          Discard your changes?
        </Heading>
        <p className="text-sm text-neutral-700">
          Your changes to {profile} haven't been saved. Leaving now loses them.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            autoFocus
            onPress={onKeep}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Keep editing
          </Button>
          <Button
            onPress={onDiscard}
            className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700"
          >
            Discard changes
          </Button>
        </div>
      </Dialog>
    </Modal>
  </ModalOverlay>
);
