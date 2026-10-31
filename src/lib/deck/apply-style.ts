import { newId } from "./ids";
import type { Deck, Element, Slide } from "./schema";
import { STUDIO_PACKS } from "./studio-packs";
import { TEMPLATE_DECKS } from "./template-decks";
import { escapeHtml } from "@/lib/text";

/** What the user chose at generation time besides a plain theme. */
export type StyleSource = { kind: "template"; id: string } | { kind: "image"; dataUrl: string };

const TEMPLATES = [...TEMPLATE_DECKS, ...STUDIO_PACKS];

/**
 * Carries a template's or an image's look onto a freshly generated deck. A template is applied as its whole design
 * system: every generated slide is rebuilt from the template slide that fits it best, keeping that slide's background,
 * shapes, pictures and text styles, with the generated words, pictures and charts placed into its slots.
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

/* ---------- Template as a design system ---------- */

type TextEl = Extract<Element, { type: "text" }>;
/** One piece of generated text, with where it sat (for reading order) and how important it is. */
type Item = { html: string; x: number; y: number; title: boolean };

const SPECIAL = new Set(["cover", "section", "closing"]);
/** Rows closer than this count as one row when reading left to right, top to bottom. */
const ROW = 28;
const reading = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.round(a.y / ROW) - Math.round(b.y / ROW) || a.x - b.x;

const para = (s: string) => `<p>${escapeHtml(s)}</p>`;

/** The generated slide's words: text boxes as they are, cards split into figure, heading and body. */
function itemsOf(slide: Slide): Item[] {
  const items: Item[] = [];
  for (const el of slide.elements) {
    if (el.type === "text") {
      if (!el.html.replace(/<[^>]+>/g, "").trim()) continue;
      items.push({ html: el.html, x: el.x, y: el.y, title: el.role === "title" });
    } else if (el.type === "card") {
      if (el.value) items.push({ html: para(el.value), x: el.x, y: el.y, title: false });
      if (el.title) items.push({ html: para(el.title), x: el.x, y: el.y + 1, title: false });
      if (el.body) items.push({ html: para(el.body), x: el.x, y: el.y + 2, title: false });
    }
  }
  return items;
}

/** The template slide's text boxes: the heading (largest type) and the rest in reading order. */
function slotsOf(slide: Slide): { heading: TextEl | null; rest: TextEl[] } {
  const texts = slide.elements.filter((e): e is TextEl => e.type === "text");
  if (!texts.length) return { heading: null, rest: [] };
  const size = (t: TextEl) => t.style?.fontSize ?? 32;
  const heading = [...texts].sort((a, b) => size(b) - size(a) || a.y - b.y)[0];
  return { heading, rest: texts.filter((t) => t !== heading).sort(reading) };
}

/** The template slide each generated slide is rebuilt from. Content slides of the same layout take turns. */
function chooser(tpl: Deck) {
  const slides = tpl.slides;
  const cover = slides.find((s) => s.layoutId === "cover") ?? slides[0];
  const section = slides.find((s) => s.layoutId === "section") ?? cover;
  const closing = slides.find((s) => s.layoutId === "closing") ?? cover;
  const content = slides.filter((s) => !SPECIAL.has(s.layoutId) && s !== cover);
  const used = new Map<Slide, number>();
  return (gen: Slide, index: number): Slide => {
    if (index === 0 || gen.layoutId === "cover") return cover;
    if (gen.layoutId === "section") return section;
    if (gen.layoutId === "closing") return closing;
    if (!content.length) return cover;
    const want = itemsOf(gen).length;
    const same = content.filter((s) => s.layoutId === gen.layoutId);
    const pool = same.length ? same : content;
    // Closest number of text slots; among equals, the one used least, so a deck does not repeat one slide.
    const score = (s: Slide) => {
      const { heading, rest } = slotsOf(s);
      return Math.abs((heading ? 1 : 0) + rest.length - want) * 10 + (used.get(s) ?? 0) * 4;
    };
    const pick = [...pool].sort((a, b) => score(a) - score(b))[0];
    used.set(pick, (used.get(pick) ?? 0) + 1);
    return pick;
  };
}

function rebuild(gen: Slide, tplSlide: Slide): Slide {
  const items = itemsOf(gen).sort(reading);
  const titleAt = Math.max(0, items.findIndex((i) => i.title));
  const title = items.splice(titleAt, 1)[0];
  const { heading, rest } = slotsOf(tplSlide);
  const fill = (slot: TextEl, html: string): TextEl => ({ ...structuredClone(slot), id: newId("el"), html, autoFit: true });

  const texts: TextEl[] = [];
  if (heading && title) texts.push(fill(heading, title.html));
  const slots = heading ? rest : [...rest];
  const words = title && !heading ? [title, ...items] : items;
  slots.forEach((slot, k) => {
    if (k < words.length) {
      // More words than slots: the last slot takes everything left over.
      const html = k === slots.length - 1 ? words.slice(k).map((w) => w.html).join("") : words[k].html;
      texts.push(fill(slot, html));
    }
  });
  if (!heading && !slots.length) {
    // The template slide has no text at all: keep the generated text boxes where they were.
    texts.push(...gen.elements.filter((e): e is TextEl => e.type === "text").map((e) => structuredClone(e)));
  } else if (!slots.length && words.length && heading) {
    // A template slide with a heading only: the rest goes in a box under it, in the heading's style but smaller.
    const h = texts[0] ?? fill(heading, "");
    texts.push({ ...structuredClone(h), id: newId("el"), html: words.map((w) => w.html).join(""), y: h.y + h.h + 24, h: 360, style: { ...h.style, fontSize: Math.max(22, Math.round((h.style?.fontSize ?? 64) * 0.4)), fontWeight: 400 } });
  }

  // Pictures and charts take the template's frames in reading order; extra ones keep their generated place.
  const tplImages = tplSlide.elements.filter((e) => e.type === "image").sort(reading);
  const genImages = gen.elements.filter((e) => e.type === "image").sort(reading);
  const tplCharts = tplSlide.elements.filter((e) => e.type === "chart");
  const genCharts = gen.elements.filter((e) => e.type === "chart");
  const placed: Element[] = [];
  const usedFrames = new Set<Element>();
  genImages.forEach((img, k) => {
    const frame = tplImages[k];
    if (frame && frame.type === "image" && img.type === "image") {
      usedFrames.add(frame);
      placed.push({ ...structuredClone(frame), id: newId("el"), src: img.src, query: img.query, alt: img.alt });
    } else placed.push(structuredClone(img));
  });
  genCharts.forEach((chart, k) => {
    const frame = tplCharts[k];
    if (frame) usedFrames.add(frame);
    placed.push(frame ? { ...structuredClone(chart), id: newId("el"), x: frame.x, y: frame.y, w: frame.w, h: frame.h, z: frame.z } : structuredClone(chart));
  });

  // The template's design: its shapes, icons and unused pictures stay; its own sample text and charts do not.
  const design = tplSlide.elements
    .filter((e) => e.type !== "text" && e.type !== "chart" && !usedFrames.has(e))
    .map((e) => ({ ...structuredClone(e), id: newId("el") }));

  const elements = [...design, ...placed, ...texts].map((e, z) => ({ ...e, z }));
  return { ...gen, background: structuredClone(tplSlide.background), elements };
}

function applyTemplate(deck: Deck, tpl: Deck): Deck {
  const choose = chooser(tpl);
  const slides = deck.slides.map((slide, i) => rebuild(slide, choose(slide, i)));
  return { ...deck, themeId: tpl.themeId, slides };
}
