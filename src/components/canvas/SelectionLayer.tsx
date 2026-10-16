"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Moveable, {
  type OnDrag,
  type OnDragStart,
  type OnResize,
  type OnResizeStart,
  type OnRotate,
  type OnRotateStart,
} from "react-moveable";
import { STAGE_H, STAGE_W, type Slide } from "@/lib/deck/schema";
import { useDeckStore } from "@/store/deck-store";

export type SelectionLayerProps = {
  slide: Slide;
  /** The unscaled wrapper that contains the scaled slide root. */
  slideWrap: HTMLElement | null;
  selectedIds: string[];
  /** Screen pixels per stage unit. */
  scale: number;
  /** Hides the handles while a text element is being edited. */
  editing: boolean;
  /**
   * A pointerdown that selected an element; the layer starts dragging from it
   * once react-moveable has picked up the new targets.
   */
  pendingDrag: MouseEvent | TouchEvent | null;
  onPendingDragConsumed: () => void;
};

type Frame = { x: number; y: number; w: number; h: number; rot: number; tx: number; ty: number };

const RATIO_TYPES = new Set(["image", "icon"]);

function elementIdOf(target: HTMLElement | SVGElement): string {
  return target.getAttribute("data-element-id") ?? "";
}

/**
 * react-moveable wrapper. Transforms are applied straight to the DOM while
 * dragging (in stage units, since moveable resolves the scaled ancestor) and
 * committed to the store once per gesture.
 */
export function SelectionLayer({ slide, slideWrap, selectedIds, scale, editing, pendingDrag, onPendingDragConsumed }: SelectionLayerProps) {
  const commit = useDeckStore((s) => s.commit);
  const moveableRef = useRef<Moveable>(null);
  const [targets, setTargets] = useState<HTMLElement[]>([]);
  const [guides, setGuides] = useState<HTMLElement[]>([]);
  const [shift, setShift] = useState(false);
  const frames = useRef(new Map<string, Frame>());

  const elementById = useMemo(() => new Map(slide.elements.map((e) => [e.id, e])), [slide.elements]);

  // Resolve selected ids to DOM nodes (unlocked only) and the rest to guidelines.
  useEffect(() => {
    if (!slideWrap) return;
    let cancelled = false;
    // The DOM is the external system here: read it once React has committed.
    queueMicrotask(() => {
      if (cancelled) return;
      const nodes = Array.from(slideWrap.querySelectorAll<HTMLElement>("[data-element-id]"));
      const selected = new Set(selectedIds);
      const next = editing ? [] : nodes.filter((n) => selected.has(elementIdOf(n)) && n.dataset.locked !== "true");
      const others = nodes.filter((n) => !selected.has(elementIdOf(n)));
      const mv = moveableRef.current;
      if (pendingDrag && next.length && mv) {
        const ev = pendingDrag;
        mv.waitToChangeTarget().then(() => {
          try {
            moveableRef.current?.dragStart(ev);
          } catch {
            /* the pointer was already released */
          }
        });
      }
      if (pendingDrag) onPendingDragConsumed();
      setTargets(next);
      setGuides(others);
    });
    return () => {
      cancelled = true;
    };
  }, [slideWrap, selectedIds, slide.elements, editing, pendingDrag, onPendingDragConsumed]);

  // Keep the control box aligned after store updates and rescales.
  useEffect(() => {
    moveableRef.current?.updateRect();
  }, [slide.elements, scale, targets]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => e.key === "Shift" && setShift(true);
    const up = (e: KeyboardEvent) => e.key === "Shift" && setShift(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const keepRatio = shift || (targets.length > 0 && targets.every((t) => RATIO_TYPES.has(t.dataset.elementType ?? "")));

  /* ---------- frame bookkeeping ---------- */

  const begin = useCallback(
    (target: HTMLElement | SVGElement): Frame => {
      const id = elementIdOf(target);
      const el = elementById.get(id);
      const f: Frame = el
        ? { x: el.x, y: el.y, w: el.w, h: el.h, rot: el.rotation, tx: 0, ty: 0 }
        : { x: 0, y: 0, w: 0, h: 0, rot: 0, tx: 0, ty: 0 };
      frames.current.set(id, f);
      return f;
    },
    [elementById],
  );

  const frameOf = (target: HTMLElement | SVGElement): Frame => frames.current.get(elementIdOf(target)) ?? begin(target);

  const paint = (target: HTMLElement | SVGElement, f: Frame) => {
    const s = (target as HTMLElement).style;
    s.transform = `translate(${f.tx}px, ${f.ty}px) rotate(${f.rot}deg)`;
    s.width = `${f.w}px`;
    s.height = `${f.h}px`;
  };

  const finish = (list: Array<HTMLElement | SVGElement>) => {
    const changes = list
      .map((t) => ({ id: elementIdOf(t), f: frames.current.get(elementIdOf(t)), t }))
      .filter((c): c is { id: string; f: Frame; t: HTMLElement | SVGElement } => Boolean(c.f));
    if (!changes.length) return;
    // Reset inline transforms so React's next render is the only source of truth.
    for (const { t, f } of changes) (t as HTMLElement).style.transform = `rotate(${f.rot}deg)`;
    const moved = changes.filter(({ id, f }) => {
      const el = elementById.get(id);
      return !el || Math.round(f.x + f.tx) !== el.x || Math.round(f.y + f.ty) !== el.y || Math.round(f.w) !== el.w || Math.round(f.h) !== el.h || f.rot !== el.rotation;
    });
    frames.current.clear();
    if (!moved.length) return;
    commit((d) => {
      const s = d.slides.find((sl) => sl.id === slide.id);
      if (!s) return;
      for (const { id, f } of moved) {
        const el = s.elements.find((e) => e.id === id);
        if (!el) continue;
        el.x = Math.round(f.x + f.tx);
        el.y = Math.round(f.y + f.ty);
        el.w = Math.max(1, Math.round(f.w));
        el.h = Math.max(1, Math.round(f.h));
        el.rotation = Math.round(f.rot * 10) / 10;
      }
    }, "Transform", { coalesce: "transform" });
  };

  /* ---------- single-target handlers ---------- */

  const onDragStart = (e: OnDragStart) => {
    const f = begin(e.target);
    e.set([f.tx, f.ty]);
  };
  const onDrag = (e: OnDrag) => {
    const f = frameOf(e.target);
    [f.tx, f.ty] = e.beforeTranslate;
    paint(e.target, f);
  };
  const onResizeStart = (e: OnResizeStart) => {
    const f = begin(e.target);
    if (e.dragStart) e.dragStart.set([f.tx, f.ty]);
  };
  const onResize = (e: OnResize) => {
    const f = frameOf(e.target);
    f.w = e.width;
    f.h = e.height;
    [f.tx, f.ty] = e.drag.beforeTranslate;
    paint(e.target, f);
  };
  const onRotateStart = (e: OnRotateStart) => {
    const f = begin(e.target);
    e.set(f.rot);
    if (e.dragStart) e.dragStart.set([f.tx, f.ty]);
  };
  const onRotate = (e: OnRotate) => {
    const f = frameOf(e.target);
    f.rot = e.beforeRotate;
    [f.tx, f.ty] = e.drag.beforeTranslate;
    paint(e.target, f);
  };

  if (!slideWrap || !targets.length) return null;

  const half = { x: (STAGE_W * scale) / 2, y: (STAGE_H * scale) / 2 };

  return (
    <Moveable
      ref={moveableRef}
      target={targets}
      origin={false}
      draggable
      throttleDrag={0}
      resizable
      keepRatio={keepRatio}
      rotatable
      rotationPosition="top"
      throttleRotate={shift ? 15 : 0}
      snappable
      snapContainer={slideWrap}
      snapThreshold={6}
      snapDirections={{ top: true, left: true, bottom: true, right: true, center: true, middle: true }}
      elementSnapDirections={{ top: true, left: true, bottom: true, right: true, center: true, middle: true }}
      elementGuidelines={guides}
      verticalGuidelines={[0, half.x, STAGE_W * scale]}
      horizontalGuidelines={[0, half.y, STAGE_H * scale]}
      isDisplaySnapDigit={false}
      checkInput
      preventClickEventOnDrag
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={(e) => finish([e.target])}
      onResizeStart={onResizeStart}
      onResize={onResize}
      onResizeEnd={(e) => finish([e.target])}
      onRotateStart={onRotateStart}
      onRotate={onRotate}
      onRotateEnd={(e) => finish([e.target])}
      onDragGroupStart={(e) => e.events.forEach(onDragStart)}
      onDragGroup={(e) => e.events.forEach(onDrag)}
      onDragGroupEnd={(e) => finish(e.targets)}
      onResizeGroupStart={(e) => e.events.forEach(onResizeStart)}
      onResizeGroup={(e) => e.events.forEach(onResize)}
      onResizeGroupEnd={(e) => finish(e.targets)}
      onRotateGroupStart={(e) => e.events.forEach(onRotateStart)}
      onRotateGroup={(e) => e.events.forEach(onRotate)}
      onRotateGroupEnd={(e) => finish(e.targets)}
    />
  );
}
