"use client";

import type { ReactNode } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import type { PendingRequest } from "@/lib/collab";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LockPhase } from "./useEditLock";

type Props = {
  phase: LockPhase;
  incoming: PendingRequest | null;
  onRequestEdit: () => void;
  onCancelRequest: () => void;
  onRespond: (allow: boolean) => void;
  /** Leave the editor for the read-only review page. */
  onViewOnly: () => void;
};

function Modal({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  // These prompts need an answer, so there is no close button and Escape or a click outside does nothing.
  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>{children}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Everything the edit lock needs to say: this deck is being edited by someone else (ask them to hand over, or view it),
 * your request is waiting, it was declined, you were handed over, and, for the person holding the lock, someone is asking.
 */
export function EditLockDialogs({ phase, incoming, onRequestEdit, onCancelRequest, onRespond, onViewOnly }: Props) {
  if (incoming && phase.kind === "editing") {
    return (
      <Modal title={`${incoming.requesterName} wants to edit this deck`} description={`If you allow, your changes are saved now and ${incoming.requesterName} takes over editing. You can keep viewing the deck.`}>
        <button type="button" className="ps-btn" onClick={() => onRespond(false)}>
          Not now
        </button>
        <button type="button" className="ps-btn ps-btn-primary" onClick={() => onRespond(true)}>
          Save and hand over
        </button>
      </Modal>
    );
  }

  switch (phase.kind) {
    case "held":
      return (
        <Modal title={`${phase.holderName} is editing this deck`} description="Only one person can edit at a time. Ask them to hand over, or look at the deck without editing.">
          <button type="button" className="ps-btn" onClick={onViewOnly}>
            View only
          </button>
          <button type="button" className="ps-btn ps-btn-primary" onClick={onRequestEdit}>
            Request to edit
          </button>
        </Modal>
      );
    case "waiting":
      return (
        <Modal title={`Waiting for ${phase.holderName}…`} description={`${phase.holderName} sees your request. Their changes are saved first, then you can start editing. If they leave, you get the deck straight away.`}>
          <span className="mr-auto inline-flex items-center gap-2 text-[13px] text-[var(--ps-smoke)]">
            <CircleNotch size={16} className="animate-spin" aria-hidden /> Waiting for an answer
          </span>
          <button type="button" className="ps-btn" onClick={onCancelRequest}>
            Cancel
          </button>
          <button type="button" className="ps-btn" onClick={onViewOnly}>
            View only
          </button>
        </Modal>
      );
    case "denied":
      return (
        <Modal title={`${phase.holderName} is not ready to hand over`} description="They are still working on this deck. You can ask again later, or view it without editing.">
          <button type="button" className="ps-btn" onClick={onViewOnly}>
            View only
          </button>
          <button type="button" className="ps-btn ps-btn-primary" onClick={onRequestEdit}>
            Ask again
          </button>
        </Modal>
      );
    case "handed":
      return (
        <Modal title={`Handed over to ${phase.to}`} description="Your changes are saved. They are editing the deck now, and you can keep viewing it.">
          <button type="button" className="ps-btn ps-btn-primary" onClick={onViewOnly}>
            View deck
          </button>
        </Modal>
      );
    case "lost":
      return (
        <Modal title="Someone else is editing now" description="Your editing session ended because another person took over, or your connection dropped for too long. Changes you made in the last few seconds may not have been saved.">
          <button type="button" className="ps-btn ps-btn-primary" onClick={onViewOnly}>
            View deck
          </button>
        </Modal>
      );
    default:
      return null;
  }
}
