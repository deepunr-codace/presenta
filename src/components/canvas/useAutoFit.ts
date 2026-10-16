"use client";

import { useLayoutEffect, type RefObject } from "react";

const AUTOFIT_MIN = 12;
const AUTOFIT_STEP = 2;

/**
 * Content overflows when it exceeds the containing box. The box (parent) is
 * the limit rather than the element itself: an auto-height element's
 * scrollHeight includes glyph boxes that poke past tight line-heights, so it
 * is always a few px over its own clientHeight.
 */
function overflows(el: HTMLElement, box: HTMLElement): boolean {
  const limitH = Math.max(el.clientHeight, box.clientHeight);
  const limitW = Math.max(el.clientWidth, box.clientWidth);
  return el.scrollHeight > limitH + 1 || el.scrollWidth > limitW + 1;
}

/**
 * Shrinks the element's font-size (in 2 px steps, never below 12 px) until its
 * content fits inside it. The element must be size-constrained (e.g. a fixed
 * height, or `max-height: 100%` inside a fixed box) with `overflow: hidden`.
 *
 * Re-measures after layout, when the parent box resizes, and after web fonts
 * finish loading. `deps` should list the inputs that change the content
 * (html, box size, typography).
 */
export function useAutoFit(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  baseFontSize: number,
  deps: ReadonlyArray<unknown> = [],
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // The containing box is both the size limit and what we observe: shrinking
    // the text changes the element's own height and would otherwise loop.
    const box = el.parentElement ?? el;

    const fit = () => {
      el.style.fontSize = `${baseFontSize}px`;
      if (!enabled) return;
      let size = baseFontSize;
      while (size > AUTOFIT_MIN && overflows(el, box)) {
        size = Math.max(AUTOFIT_MIN, size - AUTOFIT_STEP);
        el.style.fontSize = `${size}px`;
      }
    };

    fit();

    let lastW = box.clientWidth;
    let lastH = box.clientHeight;
    const ro = new ResizeObserver(() => {
      if (box.clientWidth === lastW && box.clientHeight === lastH) return;
      lastW = box.clientWidth;
      lastH = box.clientHeight;
      fit();
    });
    ro.observe(box);

    let cancelled = false;
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => {
        if (!cancelled) fit();
      });
    }

    return () => {
      cancelled = true;
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, enabled, baseFontSize, ...deps]);
}
