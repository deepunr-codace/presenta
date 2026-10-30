import type { Deck, Element, ReviseSelection, TextRole } from "@/lib/deck/schema";
import { htmlToText } from "@/lib/text";

/**
 * The assistant's current scope: the whole deck, one slide, or one element.
 * Derived from the deck store's selection; the user can widen it with the
 * scope chips (`widen`), never narrow it beyond what is selected.
 */

export type Scope = {
  kind: "deck" | "slide" | "element";
  /** Index of the slide in scope (the selected slide, or 0 for deck scope with no selection). */
  slideIndex: number;
  slideId: string | null;
  element?: Element;
  /** Long label, e.g. "Deck", "Slide 3", "Title on slide 3", "Card: Onboarding". */
  label: string;
  /** Short label for a chip, e.g. "Title", "Image", "Card: Onboarding". */
  chip: string;
};

type ScopeState = {
  deck: Deck | null;
  selectedSlideId: string | null;
  selectedElementIds: string[];
};

const ROLE_LABEL: Record<TextRole, string> = {
  title: "Title",
  subtitle: "Subtitle",
  heading: "Heading",
  body: "Body text",
  bullets: "Bullets",
  caption: "Caption",
  quote: "Quote",
  number: "Number",
  label: "Label",
};

/** Short chip text for an element ("Title", "Image", "Card: Onboarding"). */
export function elementChip(el: Element): string {
  switch (el.type) {
    case "text":
      return ROLE_LABEL[el.role];
    case "image":
      return "Image";
    case "card": {
      const t = el.title.trim();
      return t ? `Card: ${clip(t, 24)}` : "Card";
    }
    case "shape":
      return "Shape";
    case "icon":
      return "Icon";
    case "chart":
      return "Chart";
    case "video":
      return "Video";
  }
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

/** Compute the scope from store state; `widen` lifts it to slide or deck level. */
export function getScope(state: ScopeState, widen?: "deck" | "slide"): Scope {
  const deck = state.deck;
  if (!deck || deck.slides.length === 0) {
    return { kind: "deck", slideIndex: 0, slideId: null, label: "Deck", chip: "Deck" };
  }
  const foundIndex = state.selectedSlideId ? deck.slides.findIndex((s) => s.id === state.selectedSlideId) : -1;
  const slideIndex = foundIndex >= 0 ? foundIndex : 0;
  const slide = deck.slides[slideIndex];
  const n = slideIndex + 1;

  if (widen === "deck") return { kind: "deck", slideIndex, slideId: slide.id, label: "Deck", chip: "Deck" };

  const element = state.selectedElementIds.length === 1 ? slide.elements.find((e) => e.id === state.selectedElementIds[0]) : undefined;

  if (element && widen !== "slide") {
    const chip = elementChip(element);
    const label = element.type === "card" && chip.startsWith("Card:") ? chip : `${chip} on slide ${n}`;
    return { kind: "element", slideIndex, slideId: slide.id, element, label, chip };
  }
  return { kind: "slide", slideIndex, slideId: slide.id, label: `Slide ${n}`, chip: `Slide ${n}` };
}

/** The selection block for ReviseRequest; undefined at deck scope. */
export function selectionForApi(scope: Scope): ReviseSelection | undefined {
  if (scope.kind === "deck") return undefined;
  const sel: ReviseSelection = { slideIndex: scope.slideIndex };
  const el = scope.element;
  if (scope.kind !== "element" || !el) return sel;
  sel.elementId = el.id;
  sel.elementType = el.type;
  switch (el.type) {
    case "text":
      sel.text = htmlToText(el.html).slice(0, 2000);
      sel.role = el.role;
      break;
    case "card":
      sel.text = [el.value, el.title, el.body].filter(Boolean).join("\n").slice(0, 2000);
      break;
    case "image":
      if (el.query) sel.imageQuery = el.query.slice(0, 140);
      if (el.alt) sel.text = el.alt.slice(0, 300);
      break;
    default:
      break;
  }
  return sel;
}

/** Composer placeholder for the scope. */
export function scopePlaceholder(scope: Scope): string {
  switch (scope.kind) {
    case "deck":
      return "Ask for changes to the whole deck…";
    case "slide":
      return `Ask for changes to slide ${scope.slideIndex + 1}…`;
    case "element": {
      const el = scope.element;
      if (!el) return "Ask for changes to this element…";
      if (el.type === "text") return `Ask for changes to this ${ROLE_LABEL[el.role].toLowerCase()}…`;
      if (el.type === "card") return "Ask for changes to this card…";
      return `Ask for changes to this ${el.type}…`;
    }
  }
}
