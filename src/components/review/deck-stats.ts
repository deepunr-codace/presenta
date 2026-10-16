import { htmlToText } from "@/lib/text";
import type { Deck, Slide } from "@/lib/deck/schema";

/** Spoken-word pace used for the reading-time estimate. */
export const WORDS_PER_MINUTE = 180;

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Words of visible slide text (rich text stripped of tags; card titles, bodies and values). */
export function deckWordCount(deck: Deck): number {
  let words = 0;
  for (const slide of deck.slides) {
    for (const el of slide.elements) {
      if (el.type === "text") words += countWords(htmlToText(el.html));
      else if (el.type === "card") words += countWords([el.title, el.body, el.value ?? ""].join(" "));
    }
  }
  return words;
}

/** Minutes at 180 words per minute, one decimal ("0.0" for an empty deck). */
export function readingMinutes(words: number): string {
  return (words / WORDS_PER_MINUTE).toFixed(1);
}

/** Title of a slide for captions: its first text element, else the slide's layout name. */
export function slideTitle(slide: Slide): string {
  const text = slide.elements.filter((e) => e.type === "text").sort((a, b) => a.y - b.y || a.x - b.x)[0];
  const t = text && text.type === "text" ? htmlToText(text.html).split("\n")[0] : "";
  return t || slide.layoutId.replace(/-/g, " ");
}

/** Editor link for a deck, optionally deep-linked to a slide. */
export function editHref(deckId: string, slideId?: string): string {
  const base = `/edit/${encodeURIComponent(deckId)}`;
  return slideId ? `${base}?slide=${encodeURIComponent(slideId)}` : base;
}
