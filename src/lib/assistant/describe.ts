import { LAYOUTS } from "@/lib/deck/layouts";
import type { Deck, Element, PatchOp } from "@/lib/deck/schema";
import { getTheme } from "@/lib/deck/themes";
import { htmlToText } from "@/lib/text";
import { elementChip } from "./scope";

/** Plain-language descriptions of patch ops. `before` is the deck the ops were computed against. */
export function describeOps(ops: PatchOp[], before: Deck): string[] {
  return ops.map((op) => describeOp(op, before));
}

function slideTitle(deck: Deck, index: number): string {
  const s = deck.slides[index];
  const t = s?.content?.title?.trim();
  return t ? `“${clip(t, 40)}”` : `slide ${index + 1}`;
}

function elementOf(deck: Deck, slideIndex: number, elementId: string): Element | undefined {
  return deck.slides[slideIndex]?.elements.find((e) => e.id === elementId);
}

function elementName(deck: Deck, slideIndex: number, elementId: string): string {
  const el = elementOf(deck, slideIndex, elementId);
  const what = el ? elementChip(el).toLowerCase() : "an element";
  return `the ${what} on slide ${slideIndex + 1}`;
}

function layoutName(id: string): string {
  return LAYOUTS.find((l) => l.id === id)?.name ?? id;
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

function humanize(op: string): string {
  return op.replace(/([A-Z])/g, " $1").toLowerCase().trim();
}

function describeOp(op: PatchOp, before: Deck): string {
  switch (op.op) {
    case "replaceSlideContent":
      return `Rewrote slide ${op.slideIndex + 1} (${slideTitle(before, op.slideIndex)}) as “${clip(op.content.title, 40)}”`;
    case "insertSlide":
      return `Added slide ${op.atIndex + 1}: “${clip(op.content.title, 40)}”`;
    case "deleteSlide":
      return `Deleted slide ${op.slideIndex + 1} (${slideTitle(before, op.slideIndex)})`;
    case "moveSlide":
      return `Moved slide ${op.fromIndex + 1} to position ${op.toIndex + 1}`;
    case "setTitle":
      return `Renamed the deck to “${op.title}”`;
    case "setTheme":
      return `Switched the theme to ${getTheme(op.themeId).name}`;
    case "setLayout":
      return `Changed slide ${op.slideIndex + 1} to the ${layoutName(op.layoutId)} layout`;
    case "setSlideBackground": {
      const bg = op.background;
      const what =
        bg.kind === "theme" ? `the theme's ${bg.variant} background` : bg.kind === "solid" ? `a solid ${bg.color} background` : bg.kind === "gradient" ? "a gradient background" : "an image background";
      return `Gave slide ${op.slideIndex + 1} ${what}`;
    }
    case "setSlideNotes":
      return `Updated the speaker notes on slide ${op.slideIndex + 1}`;
    case "setElementText": {
      const text = htmlToText(op.html).replace(/\n/g, " · ");
      return `Changed ${elementName(before, op.slideIndex, op.elementId)} to “${clip(text, 60)}”`;
    }
    case "setElementStyle": {
      const s = op.style;
      const parts: string[] = [];
      if (s.fontSize !== undefined) parts.push(`size ${s.fontSize}`);
      if (s.fontWeight !== undefined) parts.push(`weight ${s.fontWeight}`);
      if (s.color !== undefined) parts.push(`colour ${s.color}`);
      if (s.align !== undefined) parts.push(`aligned ${s.align}`);
      if (s.valign !== undefined) parts.push(`vertical ${s.valign}`);
      if (s.lineHeight !== undefined) parts.push(`line height ${s.lineHeight}`);
      if (s.letterSpacing !== undefined) parts.push(`tracking ${s.letterSpacing}`);
      if (s.fontFamily !== undefined) parts.push(`${s.fontFamily} font`);
      return `Styled ${elementName(before, op.slideIndex, op.elementId)}${parts.length ? `: ${parts.join(", ")}` : ""}`;
    }
    case "setElementBox": {
      const parts: string[] = [];
      if (op.x !== undefined || op.y !== undefined) parts.push("position");
      if (op.w !== undefined || op.h !== undefined) parts.push("size");
      if (op.rotation !== undefined) parts.push("rotation");
      if (op.opacity !== undefined) parts.push("opacity");
      if (op.radius !== undefined) parts.push("corner radius");
      return `Adjusted the ${parts.join(", ") || "box"} of ${elementName(before, op.slideIndex, op.elementId)}`;
    }
    case "setImage": {
      if (op.src === "") return `Removed the image from ${elementName(before, op.slideIndex, op.elementId)}`;
      if (op.src) return `Set a new picture on ${elementName(before, op.slideIndex, op.elementId)}`;
      if (op.query) return `New image idea for slide ${op.slideIndex + 1}: “${clip(op.query, 60)}”`;
      return `Adjusted ${elementName(before, op.slideIndex, op.elementId)}`;
    }
    case "setCard": {
      const parts: string[] = [];
      if (op.title !== undefined) parts.push(`title “${clip(op.title, 30)}”`);
      if (op.body !== undefined) parts.push(`body “${clip(op.body, 40)}”`);
      if (op.value !== undefined) parts.push(`value ${op.value}`);
      if (op.icon !== undefined) parts.push(`icon ${op.icon}`);
      if (op.variant !== undefined) parts.push(`${op.variant} style`);
      return `Updated the card on slide ${op.slideIndex + 1}${parts.length ? `: ${parts.join(", ")}` : ""}`;
    }
    case "deleteElement":
      return `Deleted ${elementName(before, op.slideIndex, op.elementId)}`;
    case "duplicateElement":
      return `Duplicated ${elementName(before, op.slideIndex, op.elementId)}`;
    default: {
      const unknown = op as { op: string };
      return `Applied ${humanize(unknown.op)}`;
    }
  }
}

/** Where a set of ops landed: the element when every element op targets the same one, else the slide. */
export function opsTarget(ops: PatchOp[], before: Deck): { slideIndex: number; elementId?: string } | undefined {
  let slideIndex: number | undefined;
  let elementId: string | undefined | null = undefined;
  for (const op of ops) {
    const idx = "slideIndex" in op ? op.slideIndex : "atIndex" in op ? op.atIndex : undefined;
    if (idx === undefined) continue;
    if (slideIndex === undefined) slideIndex = idx;
    else if (slideIndex !== idx) return { slideIndex };
    if ("elementId" in op) {
      if (elementId === undefined) elementId = op.elementId;
      else if (elementId !== op.elementId) elementId = null;
    } else {
      elementId = null;
    }
  }
  if (slideIndex === undefined) return undefined;
  if (slideIndex >= before.slides.length) return undefined;
  return elementId ? { slideIndex, elementId } : { slideIndex };
}
