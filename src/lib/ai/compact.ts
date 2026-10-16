import type { Deck } from "@/lib/deck/schema";

const isDataUrl = (v: string | undefined): v is string => typeof v === "string" && v.startsWith("data:");

/**
 * A copy of the deck fit for a revise request: every embedded image (`data:`
 * element sources, image backgrounds and the brand logo) is blanked, because
 * the model only reads text and ids and the 1 MB request cap would otherwise
 * be spent on pixels. The original deck is left untouched; the editor applies
 * the returned ops to its own copy, so nothing is lost.
 */
export function compactDeckForRevise(deck: Deck): Deck {
  const copy = structuredClone(deck);
  for (const slide of copy.slides) {
    if (slide.background.kind === "image" && isDataUrl(slide.background.src)) slide.background.src = "";
    for (const el of slide.elements) {
      if (el.type === "image" && isDataUrl(el.src)) el.src = "";
    }
  }
  if (copy.meta.brand && isDataUrl(copy.meta.brand.logoDataUrl)) copy.meta.brand.logoDataUrl = "";
  return copy;
}
