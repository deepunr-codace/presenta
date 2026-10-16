import { newId } from "@/lib/deck/ids";
import { applyLayout, buildSlide } from "@/lib/deck/layouts";
import type { Deck, Element, PatchOp, Slide, Theme } from "@/lib/deck/schema";
import { sanitizeHtml, stripTags } from "@/lib/text";

/** Offset, in stage units, applied to a duplicated element so it does not sit exactly on the original. */
export const DUPLICATE_OFFSET = 24;

/** A revision never grows a deck past this many slides (matches the generation limit). */
export const MAX_SLIDES = 20;

/** Bounds for element geometry set by ops: positions may sit one stage off-canvas, sizes up to two stages. */
export const BOX_MIN = -1920;
export const BOX_MAX = 3840;
const ROTATION_MAX = 360;

/**
 * Apply a list of AI patch ops to a deck. Pure: the input deck is never
 * mutated and a new deck is returned. Ops with out-of-range indices or
 * unknown element ids are ignored; nothing here throws for well-typed input.
 */
export function applyOps(deck: Deck, ops: PatchOp[], theme: Theme): Deck {
  const next = structuredClone(deck);
  for (const op of ops) applyOp(next, op, theme);
  return next;
}

function inRange(index: number, slides: Slide[]): boolean {
  return Number.isInteger(index) && index >= 0 && index < slides.length;
}

function slideAt(deck: Deck, index: number): Slide | undefined {
  return inRange(index, deck.slides) ? deck.slides[index] : undefined;
}

function elementIn(slide: Slide | undefined, id: string): Element | undefined {
  return slide?.elements.find((el) => el.id === id);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Mutates `deck` (already a private clone) in place. */
function applyOp(deck: Deck, op: PatchOp, theme: Theme): void {
  switch (op.op) {
    case "replaceSlideContent": {
      if (!inRange(op.slideIndex, deck.slides)) return;
      const prev = deck.slides[op.slideIndex];
      const rebuilt = buildSlide(op.content, theme);
      deck.slides[op.slideIndex] = { ...rebuilt, id: prev.id };
      return;
    }
    case "insertSlide": {
      if (!Number.isInteger(op.atIndex) || op.atIndex < 0) return;
      if (deck.slides.length >= MAX_SLIDES) return;
      const at = Math.min(op.atIndex, deck.slides.length);
      deck.slides.splice(at, 0, buildSlide(op.content, theme));
      return;
    }
    case "deleteSlide": {
      if (!inRange(op.slideIndex, deck.slides)) return;
      // Never leave a deck without slides.
      if (deck.slides.length <= 1) return;
      deck.slides.splice(op.slideIndex, 1);
      return;
    }
    case "moveSlide": {
      if (!inRange(op.fromIndex, deck.slides) || !inRange(op.toIndex, deck.slides)) return;
      if (op.fromIndex === op.toIndex) return;
      const [slide] = deck.slides.splice(op.fromIndex, 1);
      deck.slides.splice(op.toIndex, 0, slide);
      return;
    }
    case "setTitle": {
      deck.title = op.title;
      return;
    }
    case "setTheme": {
      deck.themeId = op.themeId;
      return;
    }
    case "setLayout": {
      if (!inRange(op.slideIndex, deck.slides)) return;
      const slide = deck.slides[op.slideIndex];
      slide.layoutId = op.layoutId;
      if (slide.content) slide.elements = applyLayout(slide.content, op.layoutId, theme);
      return;
    }
    case "setSlideBackground": {
      const slide = slideAt(deck, op.slideIndex);
      if (!slide) return;
      slide.background = structuredClone(op.background);
      return;
    }
    case "setSlideNotes": {
      const slide = slideAt(deck, op.slideIndex);
      if (!slide) return;
      slide.notes = op.notes;
      return;
    }
    case "setElementText": {
      const el = elementIn(slideAt(deck, op.slideIndex), op.elementId);
      if (el?.type !== "text") return;
      // Model output is untrusted: keep only the list / emphasis tags the editor itself produces.
      el.html = sanitizeHtml(op.html);
      return;
    }
    case "setElementStyle": {
      // Only text elements carry typography; align / valign live on the element itself.
      const el = elementIn(slideAt(deck, op.slideIndex), op.elementId);
      if (el?.type !== "text") return;
      const { align, valign, ...style } = op.style;
      if (align !== undefined) el.align = align;
      if (valign !== undefined) el.valign = valign;
      if (style.fontSize !== undefined) el.style.fontSize = style.fontSize;
      if (style.fontWeight !== undefined) el.style.fontWeight = style.fontWeight;
      if (style.color !== undefined) el.style.color = style.color;
      if (style.lineHeight !== undefined) el.style.lineHeight = style.lineHeight;
      if (style.letterSpacing !== undefined) el.style.letterSpacing = style.letterSpacing;
      if (style.fontFamily !== undefined) el.style.fontFamily = style.fontFamily;
      return;
    }
    case "setElementBox": {
      const el = elementIn(slideAt(deck, op.slideIndex), op.elementId);
      if (!el) return;
      // Geometry is clamped so a stray value can never park an element unreachably far off-stage.
      if (op.x !== undefined) el.x = clamp(op.x, BOX_MIN, BOX_MAX);
      if (op.y !== undefined) el.y = clamp(op.y, BOX_MIN, BOX_MAX);
      if (op.w !== undefined && op.w > 0) el.w = clamp(op.w, 1, BOX_MAX);
      if (op.h !== undefined && op.h > 0) el.h = clamp(op.h, 1, BOX_MAX);
      if (op.rotation !== undefined) el.rotation = clamp(op.rotation, -ROTATION_MAX, ROTATION_MAX);
      if (op.opacity !== undefined) el.opacity = clamp01(op.opacity);
      // Radius exists on images and shapes only; other types ignore it.
      if (op.radius !== undefined && (el.type === "image" || el.type === "shape")) el.radius = clamp(op.radius, 0, BOX_MAX);
      return;
    }
    case "setImage": {
      const el = elementIn(slideAt(deck, op.slideIndex), op.elementId);
      if (el?.type !== "image") return;
      if (op.src !== undefined) {
        // An empty src removes the picture and falls back to the query placeholder.
        if (op.src === "") delete el.src;
        else el.src = op.src;
      }
      if (op.query !== undefined) el.query = op.query;
      if (op.fit !== undefined) el.fit = op.fit;
      if (op.overlay !== undefined) el.overlay = clamp01(op.overlay);
      if (op.position !== undefined) el.position = op.position;
      return;
    }
    case "setCard": {
      const el = elementIn(slideAt(deck, op.slideIndex), op.elementId);
      if (el?.type !== "card") return;
      // Card copy is plain text; tags the model slips in are dropped, the words stay.
      if (op.title !== undefined) el.title = stripTags(op.title);
      if (op.body !== undefined) el.body = stripTags(op.body);
      if (op.icon !== undefined) {
        if (op.icon === "") delete el.icon;
        else el.icon = op.icon;
      }
      if (op.value !== undefined) {
        if (op.value === "") delete el.value;
        else el.value = op.value;
      }
      if (op.variant !== undefined) el.variant = op.variant;
      return;
    }
    case "deleteElement": {
      const slide = slideAt(deck, op.slideIndex);
      if (!slide) return;
      slide.elements = slide.elements.filter((el) => el.id !== op.elementId);
      return;
    }
    case "duplicateElement": {
      const slide = slideAt(deck, op.slideIndex);
      const el = elementIn(slide, op.elementId);
      if (!slide || !el) return;
      const topZ = slide.elements.reduce((max, e) => Math.max(max, e.z), 0);
      const copy: Element = {
        ...structuredClone(el),
        id: newId("el"),
        x: el.x + DUPLICATE_OFFSET,
        y: el.y + DUPLICATE_OFFSET,
        z: topZ + 1,
        locked: false,
      };
      slide.elements.push(copy);
      return;
    }
    default: {
      const exhaustive: never = op;
      void exhaustive;
    }
  }
}
