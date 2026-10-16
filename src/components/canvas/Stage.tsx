"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { STAGE_H, STAGE_W, type Element } from "@/lib/deck/schema";
import { resolveTheme } from "@/lib/deck/themes";
import { cn } from "@/lib/utils";
import { useDeckStore } from "@/store/deck-store";
import { SelectionLayer } from "./SelectionLayer";
import { SlideRenderer } from "./SlideRenderer";

type Marquee = { x0: number; y0: number; x1: number; y1: number };

const CLICK_SLOP = 4;

function isTypingTarget(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
}

function intersects(el: Element, r: { x: number; y: number; w: number; h: number }): boolean {
  return el.x < r.x + r.w && el.x + el.w > r.x && el.y < r.y + r.h && el.y + el.h > r.y;
}

export type StageProps = {
  className?: string;
};

/**
 * The editing canvas: fits the selected slide to its container, and owns
 * selection, marquee, inline-edit entry and keyboard shortcuts. Transform
 * handles live in `SelectionLayer`.
 */
export function Stage({ className }: StageProps) {
  const deck = useDeckStore((s) => s.deck);
  const selectedSlideId = useDeckStore((s) => s.selectedSlideId);
  const selectedElementIds = useDeckStore((s) => s.selectedElementIds);
  const editingElementId = useDeckStore((s) => s.editingElementId);
  const zoom = useDeckStore((s) => s.zoom);
  const selectElements = useDeckStore((s) => s.selectElements);
  const setEditingElement = useDeckStore((s) => s.setEditingElement);
  const commit = useDeckStore((s) => s.commit);
  const undo = useDeckStore((s) => s.undo);
  const redo = useDeckStore((s) => s.redo);
  const deleteElements = useDeckStore((s) => s.deleteElements);
  const duplicateElements = useDeckStore((s) => s.duplicateElements);

  const containerRef = useRef<HTMLDivElement>(null);
  const [slideWrap, setSlideWrap] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const marqueeRef = useRef<{ start: { x: number; y: number }; shift: boolean } | null>(null);
  const [pendingDrag, setPendingDrag] = useState<MouseEvent | TouchEvent | null>(null);

  const slide = useMemo(() => deck?.slides.find((s) => s.id === selectedSlideId) ?? deck?.slides[0] ?? null, [deck, selectedSlideId]);
  const theme = useMemo(() => (deck ? resolveTheme(deck) : null), [deck]);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const scale = typeof zoom === "number" ? zoom : Math.max(0.01, Math.min(size.w / STAGE_W, size.h / STAGE_H));
  const slideW = STAGE_W * scale;
  const slideH = STAGE_H * scale;
  const offset = { x: Math.max(0, (size.w - slideW) / 2), y: Math.max(0, (size.h - slideH) / 2) };

  const focusStage = useCallback(() => containerRef.current?.focus({ preventScroll: true }), []);
  const onPendingDragConsumed = useCallback(() => setPendingDrag(null), []);

  /* ---------- pointer: select, marquee ---------- */

  const toStage = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const px = clientX - (rect?.left ?? 0);
      const py = clientY - (rect?.top ?? 0);
      return { px, py, sx: (px - offset.x) / scale, sy: (py - offset.y) / scale };
    },
    [offset.x, offset.y, scale],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!slide || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(".moveable-control-box")) return;
    if (editingElementId && target.closest("[data-editing]")) return;

    const node = target.closest<HTMLElement>("[data-element-id]");
    if (node) {
      const id = node.dataset.elementId ?? "";
      const locked = node.dataset.locked === "true";
      const already = selectedElementIds.includes(id);
      if (e.shiftKey) {
        selectElements(already ? selectedElementIds.filter((x) => x !== id) : [...selectedElementIds, id]);
      } else if (!already) {
        selectElements([id]);
        if (!locked) setPendingDrag(e.nativeEvent);
      }
      focusStage();
      return;
    }

    // Empty stage: start a marquee.
    const { px, py } = toStage(e.clientX, e.clientY);
    marqueeRef.current = { start: { x: px, y: py }, shift: e.shiftKey };
    setMarquee({ x0: px, y0: py, x1: px, y1: py });
    e.currentTarget.setPointerCapture(e.pointerId);
    focusStage();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const m = marqueeRef.current;
    if (!m) return;
    const { px, py } = toStage(e.clientX, e.clientY);
    setMarquee({ x0: m.start.x, y0: m.start.y, x1: px, y1: py });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const m = marqueeRef.current;
    if (!m || !slide) return;
    marqueeRef.current = null;
    setMarquee(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const { px, py } = toStage(e.clientX, e.clientY);
    const dx = px - m.start.x;
    const dy = py - m.start.y;
    if (Math.abs(dx) < CLICK_SLOP && Math.abs(dy) < CLICK_SLOP) {
      if (!m.shift) selectElements([]);
      return;
    }
    const left = (Math.min(m.start.x, px) - offset.x) / scale;
    const top = (Math.min(m.start.y, py) - offset.y) / scale;
    const rect = { x: left, y: top, w: Math.abs(dx) / scale, h: Math.abs(dy) / scale };
    const hits = slide.elements.filter((el) => !el.locked && intersects(el, rect)).map((el) => el.id);
    selectElements(m.shift ? Array.from(new Set([...selectedElementIds, ...hits])) : hits);
  };

  const onDoubleClick = (e: ReactPointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const node = target.closest<HTMLElement>("[data-element-id]");
    if (!node || node.dataset.elementType !== "text") return;
    const id = node.dataset.elementId ?? "";
    if (editingElementId === id) return;
    selectElements([id]);
    setEditingElement(id);
  };

  /* ---------- keyboard ---------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!slide) return;
      if (useDeckStore.getState().editingElementId) return;
      const active = document.activeElement;
      if (isTypingTarget(active) && active !== containerRef.current) return;
      const meta = e.metaKey || e.ctrlKey;
      const ids = useDeckStore.getState().selectedElementIds;
      const movable = slide.elements.filter((el) => ids.includes(el.id) && !el.locked).map((el) => el.id);

      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && e.key.toLowerCase() === "d") {
        if (!movable.length) return;
        e.preventDefault();
        duplicateElements(slide.id, movable);
        return;
      }
      if (e.key === "Escape") {
        if (ids.length) selectElements([]);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!movable.length) return;
        e.preventDefault();
        deleteElements(slide.id, movable);
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const d = delta[e.key];
      if (d && movable.length) {
        e.preventDefault();
        commit((deckDraft) => {
          const s = deckDraft.slides.find((sl) => sl.id === slide.id);
          if (!s) return;
          for (const el of s.elements) {
            if (movable.includes(el.id)) {
              el.x += d[0];
              el.y += d[1];
            }
          }
        }, "Nudge", { coalesce: "nudge" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slide, undo, redo, duplicateElements, deleteElements, selectElements, commit]);

  // Leaving the slide ends any edit.
  useEffect(() => {
    if (editingElementId && slide && !slide.elements.some((el) => el.id === editingElementId)) setEditingElement(null);
  }, [slide, editingElementId, setEditingElement]);

  const marqueeStyle = marquee
    ? {
        left: Math.min(marquee.x0, marquee.x1),
        top: Math.min(marquee.y0, marquee.y1),
        width: Math.abs(marquee.x1 - marquee.x0),
        height: Math.abs(marquee.y1 - marquee.y0),
      }
    : null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Slide canvas"
      className={cn("ps-stage relative h-full w-full select-none overflow-hidden outline-none", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      {slide && theme ? (
        <div
          ref={setSlideWrap}
          className="ps-slide-shadow absolute"
          style={{ left: offset.x, top: offset.y, width: slideW, height: slideH }}
        >
          <SlideRenderer slide={slide} theme={theme} scale={scale} interactive editingElementId={editingElementId} onEditingEnd={focusStage} />
        </div>
      ) : (
        <div className="ps-body flex h-full items-center justify-center">No slide selected</div>
      )}
      {slide ? (
        <SelectionLayer
          slide={slide}
          slideWrap={slideWrap}
          selectedIds={selectedElementIds}
          scale={scale}
          editing={Boolean(editingElementId)}
          pendingDrag={pendingDrag}
          onPendingDragConsumed={onPendingDragConsumed}
        />
      ) : null}
      {marqueeStyle ? (
        <div className="ps-marquee" style={marqueeStyle} />
      ) : null}
    </div>
  );
}
