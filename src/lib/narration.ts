import type { ChartElement, Element, Slide } from "@/lib/deck/schema";
import { htmlToText } from "@/lib/text";

/**
 * The words spoken for a slide. Speaker notes win; when a slide has none, the slide's own text is read in reading
 * order (top to bottom, left to right). Pure string work, so the presenter and the tests share it.
 */

/** One slide is never read for longer than this; a very dense slide is cut at a word boundary. */
export const NARRATION_MAX_CHARS = 1200;

/** Plain text from element HTML, with bullet lines turned into sentences so the voice pauses between them. */
function speakable(raw: string): string {
  const lines = htmlToText(raw)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return lines
    .map((line) => (/[.!?…:;]["')\]]?$/.test(line) ? line : `${line}.`))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function chartText(chart: ChartElement): string {
  const kind = { bar: "Bar chart", line: "Line chart", area: "Area chart", donut: "Donut chart" }[chart.kind];
  const parts = chart.series
    .filter((s) => s.values.length > 0)
    .map((s) => `${s.name || "Series"} ${s.values.join(", ")}`);
  if (!parts.length) return "";
  const labels = chart.labels.length ? ` Labels: ${chart.labels.join(", ")}.` : "";
  return `${kind}.${labels} ${parts.join(". ")}.`;
}

/** The readable pieces of one element, in the order they appear on the slide. */
function elementText(el: Element): string {
  switch (el.type) {
    case "text":
      return speakable(el.html);
    case "card":
      return speakable([el.index, el.value, el.title, el.body].filter(Boolean).join(". "));
    case "chart":
      return chartText(el);
    case "image":
      return el.alt ? speakable(el.alt) : "";
    case "video":
      return el.title ? speakable(el.title) : "";
    default:
      // Shapes and icons carry no words; their meaning is in the text around them.
      return "";
  }
}

/** Reading order: top to bottom, then left to right. */
function readingOrder(a: Element, b: Element): number {
  return a.y - b.y || a.x - b.x;
}

function clip(text: string): string {
  if (text.length <= NARRATION_MAX_CHARS) return text;
  const head = text.slice(0, NARRATION_MAX_CHARS);
  const at = head.lastIndexOf(" ");
  return `${(at > NARRATION_MAX_CHARS * 0.6 ? head.slice(0, at) : head).trimEnd()}…`;
}

/** What the narrator says for a slide: its notes, else its title, text, cards, charts and image descriptions. */
export function narrationText(slide: Slide | undefined | null): string {
  if (!slide) return "";

  const notes = speakable(slide.notes ?? "");
  if (notes) return clip(notes);

  const seen = new Set<string>();
  const parts: string[] = [];
  for (const el of [...slide.elements].sort(readingOrder)) {
    const text = elementText(el).trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    parts.push(text);
  }
  return clip(parts.join(" ").replace(/\s+/g, " ").trim());
}
