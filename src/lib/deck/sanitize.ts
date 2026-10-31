import type { Deck, Slide } from "./schema";
import { sanitizeHtml, stripTags } from "@/lib/text";

/**
 * Makes a deck's words safe to render: text boxes keep only basic formatting (no attributes, https links only), card
 * text loses every tag. Run on every deck that crosses a trust boundary: imports, saves, template publishing, version
 * restores and what the server sends back. Mutates and returns the deck.
 */
export function sanitizeDeckText<T extends Pick<Deck, "slides">>(deck: T): T {
  for (const slide of deck.slides) sanitizeSlideText(slide);
  return deck;
}

export function sanitizeSlideText(slide: Slide): Slide {
  for (const el of slide.elements) {
    if (el.type === "text") el.html = sanitizeHtml(el.html);
    else if (el.type === "card") {
      el.title = stripTags(el.title);
      el.body = stripTags(el.body);
      if (el.value) el.value = stripTags(el.value);
    }
  }
  return slide;
}
