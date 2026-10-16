"use client";

import type { Deck } from "@/lib/deck/schema";
import { resolveTheme } from "@/lib/deck/themes";
import { cn } from "@/lib/utils";
import { FitSlide } from "@/components/canvas/FitSlide";

type Props = {
  /** undefined while loading, null when unavailable. */
  deck: Deck | null | undefined;
  className?: string;
};

/** First slide of a deck as a 16:9 tile; pulses while loading and says so when the preview is unavailable. */
export function DeckThumb({ deck, className }: Props) {
  return (
    <FitSlide
      slide={deck?.slides[0]}
      theme={deck ? resolveTheme(deck) : null}
      className={cn("rounded-[var(--ps-r-sm)] border border-[var(--ps-line)] bg-[var(--ps-plate)]", className)}
      fallback={
        <div className={cn("absolute inset-0", deck === undefined && "animate-pulse")} aria-hidden>
          {deck === null ? <div className="ps-caption flex h-full items-center justify-center">Preview unavailable</div> : null}
        </div>
      }
    />
  );
}
