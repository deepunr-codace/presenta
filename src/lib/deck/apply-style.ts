import { newId } from "./ids";
import type { Deck, Slide, SlideBackground } from "./schema";
import { STUDIO_PACKS } from "./studio-packs";
import { TEMPLATE_DECKS } from "./template-decks";

/** What the user chose at generation time besides a plain theme. */
export type StyleSource = { kind: "template"; id: string } | { kind: "image"; dataUrl: string };

const TEMPLATES = [...TEMPLATE_DECKS, ...STUDIO_PACKS];

const isThemeBg = (b: SlideBackground) => b.kind === "theme";

/**
 * Carries a template's or an image's look onto a freshly generated deck. The deck's theme (fonts, colours) is already
 * set; this adds what a theme cannot: the template's cover artwork and backgrounds, or the image as the cover.
 */
export function applyStyleSource(deck: Deck, source: StyleSource | null | undefined): Deck {
  if (!source) return deck;
  if (source.kind === "image") return applyImage(deck, source.dataUrl);
  const tpl = TEMPLATES.find((t) => t.id === source.id);
  return tpl ? applyTemplate(deck, tpl.deck) : deck;
}

function applyImage(deck: Deck, dataUrl: string): Deck {
  if (!dataUrl) return deck;
  const slides = deck.slides.map((slide, i): Slide => {
    if (i === 0 || slide.layoutId === "closing") return { ...slide, background: { kind: "image", src: dataUrl, overlay: 0.55 } };
    if (slide.layoutId === "section") return { ...slide, background: { kind: "image", src: dataUrl, overlay: 0.72 } };
    return slide;
  });
  return { ...deck, slides };
}

function applyTemplate(deck: Deck, tpl: Deck): Deck {
  const tplCover = tpl.slides[0];
  const tplInner = tpl.slides.find((s, i) => i > 0 && !isThemeBg(s.background)) ?? tpl.slides[1];
  const slides = deck.slides.map((slide, i): Slide => {
    const isCover = i === 0;
    const isEnd = slide.layoutId === "closing" || slide.layoutId === "section";
    const source = isCover || isEnd ? tplCover : tplInner;
    if (!source) return slide;
    const background = isThemeBg(source.background) ? slide.background : source.background;
    // The cover keeps the template's decorative shapes behind the generated text.
    const decor =
      isCover && tplCover
        ? tplCover.elements
            .filter((el) => el.type === "shape")
            .map((el, k) => ({ ...structuredClone(el), id: newId("el"), z: -100 + k }))
        : [];
    return { ...slide, background, elements: [...decor, ...slide.elements] };
  });
  return { ...deck, slides };
}
