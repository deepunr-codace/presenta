"use client";

import type { DeckSummary } from "@/lib/persist";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  deck: DeckSummary | null;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Confirmation before a deck is moved to the trash. */
export function DeleteDeckDialog({ deck, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={deck !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move this deck to trash?</DialogTitle>
          <DialogDescription>“{deck?.title || "Untitled deck"}” will move to Trash. You can restore it there for 30 days.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Move to trash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
