"use client";

import { CaretRight } from "@phosphor-icons/react";
import type { Scope } from "@/lib/assistant/scope";

export type ScopeBarProps = {
  /** The scope the assistant will act on. */
  scope: Scope;
  /** The narrowest scope available from the current selection (for the element chip). */
  narrowest: Scope;
  onPick: (kind: "deck" | "slide" | "element") => void;
};

/** Breadcrumb of 24 px chips: Deck › Slide N › element; the selected chip is primary-soft. */
export function ScopeBar({ scope, narrowest, onPick }: ScopeBarProps) {
  const hasSlide = narrowest.slideId !== null;
  const element = narrowest.kind === "element" ? narrowest : null;
  return (
    <div className="ps-scope-bar" role="group" aria-label="Assistant scope">
      <button type="button" className="ps-sb-chip" aria-pressed={scope.kind === "deck"} onClick={() => onPick("deck")} title="Ask about the whole deck">
        Deck
      </button>
      {hasSlide ? (
        <>
          <CaretRight size={10} weight="bold" className="ps-scope-sep" aria-hidden />
          <button type="button" className="ps-sb-chip" aria-pressed={scope.kind === "slide"} onClick={() => onPick("slide")} title="Ask about this slide">
            Slide {narrowest.slideIndex + 1}
          </button>
        </>
      ) : null}
      {element ? (
        <>
          <CaretRight size={10} weight="bold" className="ps-scope-sep" aria-hidden />
          <button type="button" className="ps-sb-chip" aria-pressed={scope.kind === "element"} onClick={() => onPick("element")} title={element.label}>
            {element.chip}
          </button>
        </>
      ) : null}
    </div>
  );
}
