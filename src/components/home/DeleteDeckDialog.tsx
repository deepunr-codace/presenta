"use client";

import type { DeckSummary } from "@/lib/persist";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  deck: DeckSummary | null;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Confirmation before a deck is removed from this browser. */
export function DeleteDeckDialog({ deck, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={deck !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this deck?</DialogTitle>
          <DialogDescription>“{deck?.title || "Untitled deck"}” will be removed from this browser. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
