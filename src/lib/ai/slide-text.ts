import type { LayoutId, Slide, SlideContent, SlideKind } from "@/lib/deck/schema";
import { htmlToText } from "@/lib/text";

const LAYOUT_TO_KIND: Record<LayoutId, SlideKind> = {
  cover: "cover",
  section: "section",
  "title-bullets": "bullets",
  "two-column": "two-column",
  "three-cards": "cards",
  "four-cards": "cards",
  "stats-row": "stats",
  quote: "quote",
  "image-left": "image-text",
  "image-right": "image-text",
  "process-steps": "process",
  comparison: "comparison",
  closing: "closing",
  blank: "bullets",
};

/** Elements whose left edge is at or past the stage's centre line belong to the right column. */
export const COLUMN_SPLIT_X = 960;

function kindForLayout(layoutId: LayoutId): SlideKind {
  return LAYOUT_TO_KIND[layoutId];
}

function splitBullets(text: string): string[] {
  return text.split("\n").map((b) => b.replace(/^[-•*]\s*/, "").slice(0, 110));
}

/**
 * Semantic content for a slide. Uses `slide.content` when present, otherwise
 * reconstructs an approximation from the slide's text and card elements. Two
 * bullet lists side by side become `bullets` and `bulletsRight`; headings (or
 * title-only panels) above them become `columnTitles` on column layouts.
 */
export function deriveContent(slide: Slide): SlideContent {
  if (slide.content) return slide.content;

  const kind = kindForLayout(slide.layoutId);
  const columnar = kind === "two-column" || kind === "comparison";
  const content: SlideContent = { kind, title: "" };
  const bulletsLeft: string[] = [];
  const bulletsRight: string[] = [];
  const headings: string[] = [];
  const bodyParts: string[] = [];
  const cards: { title: string; body: string; icon?: string }[] = [];
  const stats: { value: string; label: string }[] = [];

  const ordered = [...slide.elements].sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
  for (const el of ordered) {
    if (el.type === "text") {
      const text = htmlToText(el.html);
      if (!text) continue;
      switch (el.role) {
        case "title":
          if (!content.title) content.title = text.slice(0, 90);
          else bodyParts.push(text);
          break;
        case "heading":
          if (!content.title) content.title = text.slice(0, 90);
          else headings.push(text);
          break;
        case "subtitle":
          if (!content.subtitle) content.subtitle = text.slice(0, 160);
          else bodyParts.push(text);
          break;
        case "bullets":
          (el.x < COLUMN_SPLIT_X ? bulletsLeft : bulletsRight).push(...splitBullets(text));
          break;
        case "quote":
          content.quote = { text: text.slice(0, 220) };
          break;
        case "caption":
          if (content.quote && !content.quote.by) content.quote.by = text.slice(0, 60);
          else bodyParts.push(text);
          break;
        default:
          bodyParts.push(text);
      }
    } else if (el.type === "card") {
      if (el.value) stats.push({ value: el.value.slice(0, 14), label: (el.title || el.body).slice(0, 50) });
      else if (columnar && !el.body && el.title) headings.push(el.title);
      else cards.push({ title: el.title.slice(0, 50), body: el.body.slice(0, 140), ...(el.icon ? { icon: el.icon } : {}) });
    }
  }

  // A lone list that happens to sit on the right is still the slide's main list.
  if (bulletsLeft.length === 0 && bulletsRight.length > 0) bulletsLeft.push(...bulletsRight.splice(0));

  if (columnar && headings.length >= 2) content.columnTitles = [headings[0].slice(0, 40), headings[1].slice(0, 40)];
  else bodyParts.push(...headings);

  if (!content.title) content.title = (bodyParts.shift() ?? bulletsLeft[0] ?? cards[0]?.title ?? "Untitled slide").slice(0, 90);
  if (bulletsLeft.length) content.bullets = bulletsLeft.slice(0, 6);
  if (bulletsRight.length) content.bulletsRight = bulletsRight.slice(0, 6);
  if (bodyParts.length) content.body = bodyParts.join(" ").slice(0, 400);
  if (cards.length) content.cards = cards.slice(0, 4);
  if (stats.length) content.stats = stats.slice(0, 4);
  if (slide.notes) content.notes = slide.notes.slice(0, 400);
  return content;
}
