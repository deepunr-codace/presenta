"use client";

import { LAYOUTS } from "@/lib/deck/layouts";
import type { Slide } from "@/lib/deck/schema";
import { useDeckStore } from "@/store/deck-store";
import { LayoutSchematic } from "./LayoutSchematic";

type Props = { slide: Slide };

/** Grid of layout tiles; picking one re-applies the slide's source content to that layout. */
export function LayoutPicker({ slide }: Props) {
  const applyLayoutToSlide = useDeckStore((s) => s.applyLayoutToSlide);
  const canApply = slide.content !== undefined;

  return (
    <div className="space-y-2">
      <div className="ps-layout-grid" role="listbox" aria-label="Layouts">
        {LAYOUTS.map((layout) => {
          const active = layout.id === slide.layoutId;
          return (
            <button
              key={layout.id}
              type="button"
              role="option"
              aria-selected={active}
              disabled={!canApply}
              title={layout.description}
              onClick={() => {
                if (!active) applyLayoutToSlide(slide.id, layout.id);
              }}
              className="ps-layout-tile"
            >
              <LayoutSchematic id={layout.id} className="border border-[var(--ps-line)]" />
              <span>{layout.name}</span>
            </button>
          );
        })}
      </div>
      {!canApply ? <p className="ps-caption">This slide has no source content, so layouts cannot be re-applied. Ask the assistant to rewrite it, or add elements by hand.</p> : null}
    </div>
  );
}
