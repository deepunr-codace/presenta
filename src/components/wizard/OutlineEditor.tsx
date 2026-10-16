"use client";

import { useRef, useState, type PointerEvent } from "react";
import { Plus } from "@phosphor-icons/react";
import type { Outline, OutlineItem } from "@/lib/deck/schema";
import { SECONDARY_BTN } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { OutlineRow } from "./OutlineRow";

const MIN_SLIDES = 3;
const MAX_SLIDES = 20;

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

type Props = {
  outline: Outline;
  onChange: (next: Outline) => void;
};

/** Editable outline in one card: deck title, numbered slide rows (drag the handle to reorder), count and "Add slide". */
export function OutlineEditor({ outline, onChange }: Props) {
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);

  const setSlides = (slides: OutlineItem[]) => onChange({ ...outline, slides });
  const patchSlide = (i: number, patch: Partial<OutlineItem>) => setSlides(outline.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const addSlide = (after: number) => {
    if (outline.slides.length >= MAX_SLIDES) return;
    const item: OutlineItem = { title: "New slide", kind: "bullets", goal: "What this slide should get across.", keyPoints: [] };
    const next = [...outline.slides];
    next.splice(after + 1, 0, item);
    setSlides(next);
  };

  const deleteSlide = (i: number) => {
    if (outline.slides.length <= MIN_SLIDES) return;
    setSlides(outline.slides.filter((_, j) => j !== i));
  };

  /* Pointer-driven reorder: the handle captures the pointer; the insertion index follows the pointer's y. */
  const insertionIndex = (clientY: number): number => {
    const rows = rowRefs.current;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]?.getBoundingClientRect();
      if (r && clientY < r.top + r.height / 2) return i;
    }
    return rows.length;
  };

  const onHandleDown = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: i, over: i });
  };
  const onHandleMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const over = insertionIndex(e.clientY);
    if (over !== drag.over) setDrag({ ...drag, over });
  };
  const onHandleUp = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const { from, over } = drag;
    setDrag(null);
    const to = over > from ? over - 1 : over;
    if (to !== from) setSlides(move(outline.slides, from, to));
  };

  const n = outline.slides.length;

  return (
    <div className="ps-glass">
      <div className="pb-4">
        <label htmlFor="outline-title" className="ps-label block">
          Deck title
        </label>
        <input id="outline-title" value={outline.title} maxLength={80} onChange={(e) => onChange({ ...outline, title: e.target.value })} className="ps-focus mt-1 w-full min-w-0 rounded-[var(--ps-r-input)] bg-transparent text-[20px] leading-7 font-normal tracking-[-0.01em] text-[var(--ps-ink)] outline-none placeholder:text-[var(--ps-ash)]" placeholder="Untitled deck" />
      </div>

      <ol className={cn("space-y-2 border-t border-[var(--ps-line-2)] pt-4", drag && "select-none")} aria-label="Slides">
        {outline.slides.map((slide, i) => {
          const above = drag !== null && drag.over === i && !(drag.from === i || drag.from === i - 1);
          const below = drag !== null && i === n - 1 && drag.over === n && drag.from !== n - 1;
          return (
            <OutlineRow
              key={i}
              rowRef={(el) => {
                rowRefs.current[i] = el;
              }}
              slide={slide}
              index={i}
              dragging={drag?.from === i}
              dropLine={above ? "above" : below ? "below" : null}
              canDelete={n > MIN_SLIDES}
              onPatch={(patch) => patchSlide(i, patch)}
              onDelete={() => deleteSlide(i)}
              onHandleDown={onHandleDown(i)}
              onHandleMove={onHandleMove}
              onHandleUp={onHandleUp}
              onHandleCancel={() => setDrag(null)}
            />
          );
        })}
      </ol>

      <div className="ps-caption mt-4 flex items-center justify-between px-1">
        <span>
          {n} of {MAX_SLIDES} slides
        </span>
        <Button variant="outline" size="sm" className={cn(SECONDARY_BTN, "h-8 px-3.5")} onClick={() => addSlide(n - 1)} disabled={n >= MAX_SLIDES}>
          <Plus data-icon="inline-start" /> Add slide
        </Button>
      </div>
    </div>
  );
}
