"use client";

import { Sparkle } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SuggestionsBody, type SuggestionsBodyProps } from "./SuggestionsBody";

type Props = SuggestionsBodyProps & {
  /** Anchored tile on desktop, dialog on small screens. */
  variant: "inline" | "dialog";
  open?: boolean;
};

/** AI answer suggestions for the current intake question; picking fills the composer, the user can still edit. */
export function SuggestionsPanel({ variant, open, ...body }: Props) {
  if (variant === "dialog") {
    return (
      <Dialog open={open ?? false} onOpenChange={body.onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[14px]">
              <Sparkle size={14} weight="fill" className="text-[var(--ps-ink)]" /> Suggestions
            </DialogTitle>
            <DialogDescription>Pick one or write your own. You can edit it before sending.</DialogDescription>
          </DialogHeader>
          <SuggestionsBody {...body} />
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <div className="ps-tile p-3" aria-label="Suggestions">
      <div className="ps-label mb-2.5 flex items-center gap-1.5">
        <Sparkle size={12} weight="fill" /> Suggestions
      </div>
      <SuggestionsBody {...body} />
    </div>
  );
}
