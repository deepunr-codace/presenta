"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Plus } from "@phosphor-icons/react";
import { resolveTheme } from "@/lib/deck/themes";
import { useDeckStore } from "@/store/deck-store";
import { FilmstripTile } from "./FilmstripTile";

const DRAG_THRESHOLD = 5;

type Drag = { from: number; to: number };

/** 200 px column of slide thumbnails: click to select, arrow keys to move, drag to reorder. */
export function Filmstrip() {
  const deck = useDeckStore((s) => s.deck);
  const selectedSlideId = useDeckStore((s) => s.selectedSlideId);
  const selectSlide = useDeckStore((s) => s.selectSlide);
  const reorderSlides = useDeckStore((s) => s.reorderSlides);
  const addSlide = useDeckStore((s) => s.addSlide);
  const duplicateSlide = useDeckStore((s) => s.duplicateSlide);
  const deleteSlide = useDeckStore((s) => s.deleteSlide);

  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragRef = useRef<(Drag & { startY: number; active: boolean }) | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const slides = deck?.slides ?? [];
  const selectedIndex = slides.findIndex((s) => s.id === selectedSlideId);
  const theme = useMemo(() => (deck ? resolveTheme(deck) : null), [deck]);

  useEffect(() => {
    if (selectedIndex >= 0) rowRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!deck || !theme) return null;

  /** Index in the array-without-`from` where the pointer would insert. */
  const targetIndex = (clientY: number, from: number): number => {
    let to = 0;
    rowRefs.current.forEach((row, i) => {
      if (!row || i === from) return;
      const r = row.getBoundingClientRect();
      if (clientY > r.top + r.height / 2) to += 1;
    });
    return to;
  };

  const onPointerDown = (i: number) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    dragRef.current = { from: i, to: i, startY: e.clientY, active: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.active) {
      if (Math.abs(e.clientY - d.startY) < DRAG_THRESHOLD) return;
      d.active = true;
    }
    const to = targetIndex(e.clientY, d.from);
    if (to !== d.to || !drag) {
      d.to = to;
      setDrag({ from: d.from, to });
    }
  };

  const onPointerUp = (i: number) => (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d) return;
    if (d.active) {
      if (d.to !== d.from) reorderSlides(d.from, d.to);
    } else {
      selectSlide(slides[i].id);
    }
  };

  const onPointerCancel = () => {
    dragRef.current = null;
    setDrag(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    if (slides.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const current = selectedIndex < 0 ? 0 : selectedIndex;
    const next = e.key === "ArrowUp" ? Math.max(0, current - 1) : Math.min(slides.length - 1, current + 1);
    selectSlide(slides[next].id);
  };

  return (
    <aside className="ps-filmstrip">
      <div className="ps-filmstrip-list" tabIndex={0} role="listbox" aria-label="Slides" aria-activedescendant={selectedSlideId ? `filmstrip-${selectedSlideId}` : undefined} onKeyDown={onKeyDown}>
        {slides.map((slide, i) => {
          const dropLine = drag && drag.to === i && drag.to !== drag.from ? (drag.to < drag.from ? "top" : "bottom") : null;
          return (
            <FilmstripTile
              key={slide.id}
              rowRef={(el) => {
                rowRefs.current[i] = el;
              }}
              slide={slide}
              theme={theme}
              index={i}
              active={slide.id === selectedSlideId}
              dragging={drag?.from === i}
              dropLine={dropLine}
              canDelete={slides.length > 1}
              onPointerDown={onPointerDown(i)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp(i)}
              onPointerCancel={onPointerCancel}
              onDuplicate={() => duplicateSlide(slide.id)}
              onAddAfter={() => addSlide(i)}
              onDelete={() => deleteSlide(slide.id)}
            />
          );
        })}
      </div>
      <div className="ps-filmstrip-foot">
        <button type="button" className="ps-btn ps-btn-block" onClick={() => addSlide(slides.length - 1)}>
          <Plus size={12} />
          Add slide
        </button>
      </div>
    </aside>
  );
}
