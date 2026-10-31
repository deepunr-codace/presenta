import { z } from "zod";

/**
 * "Smart convert": an AI model looks at a rendered PDF page and its text lines and lays the page out as editable
 * elements. Positions use a 0–1000 grid over the page in both directions, so the answer does not depend on page size.
 */

const Coord = z.number().min(-50).max(1050);

export const SmartLineSchema = z.object({
  id: z.number().int().min(0).max(999),
  text: z.string().max(300),
  x: Coord,
  y: Coord,
  w: Coord,
  h: Coord,
});

export const SmartPageRequestSchema = z.object({
  /** JPEG of the page as it looks, at most about 2.5 MB. */
  image: z.string().startsWith("data:image/").max(3_500_000),
  /** The page's real text, line by line, with where each line sits. */
  lines: z.array(SmartLineSchema).max(200),
  /** Width / height of the page. */
  aspect: z.number().min(0.2).max(5),
});

export const SmartElementSchema = z.object({
  type: z.enum(["text", "shape", "image"]),
  x: Coord,
  y: Coord,
  w: Coord,
  h: Coord,
  /** text: ids of the lines that form this text box, top to bottom. */
  lines: z.array(z.number().int()).max(60),
  /** text: colour of the letters; shape: fill colour. "#rrggbb". */
  color: z.string().max(32),
  /** text only. */
  weight: z.enum(["regular", "bold"]),
  /** text only. */
  align: z.enum(["left", "center", "right"]),
  /** shape only. */
  shape: z.enum(["rect", "rounded", "pill", "ellipse", "line"]),
  /** shape only: border colour, or "" for none. */
  border: z.string().max(32),
  /** 0–1. */
  opacity: z.number().min(0).max(1),
});

export const SmartPageSchema = z.object({
  /** The plain page colour behind everything, "#rrggbb". */
  background: z.string().max(32),
  /** Back to front. */
  elements: z.array(SmartElementSchema).max(80),
});

export type SmartLine = z.infer<typeof SmartLineSchema>;
export type SmartPageRequest = z.infer<typeof SmartPageRequestSchema>;
export type SmartElement = z.infer<typeof SmartElementSchema>;
export type SmartPage = z.infer<typeof SmartPageSchema>;

export const SMART_PAGE_SYSTEM = `You turn one slide, given as a picture plus its text lines, into editable design elements for a presentation editor.

Coordinates: a 0-1000 grid over the slide in both directions (x from the left edge, y from the top edge, w and h as sizes on the same grid). Be precise; measure against the picture.

Return:
- background: the slide's plain base colour as #rrggbb (the colour you would see where nothing else is drawn).
- elements: everything on the slide, back to front, as:
  - "shape": solid boxes, cards, pills, circles, bars, dividers and lines that are a single flat colour (optionally with a border). Use shape "rect" (square corners), "rounded" (rounded corners), "pill" (fully round ends), "ellipse" (circles and ovals) or "line" (thin bars and rules). color is the fill; border is the outline colour or "".
  - "image": anything that is not a flat shape and not text: photos, logos, icons, illustrations, screenshots, charts, gradients, glows and textured or decorative areas. Give a box that tightly covers it. A whole icon (including its round badge behind it) is one image. Large decorative gradient areas are images too.
  - "text": each text box made of the given lines. lines lists the ids of the lines that belong together (a heading, a paragraph, one bullet, one button label). Every given line must be used exactly once. color is the letters' colour as you see it, weight is "bold" for heavy or semibold type, align is how the lines sit in their box.
- opacity is 1 unless something is clearly see-through.
- For fields that do not apply to an element, use: lines [], color "", weight "regular", align "left", shape "rect", border "".

Do not invent text. Do not merge separate cards into one shape. Text goes after (above) the shapes and images it sits on.`;

export function buildSmartPageUserText(req: Pick<SmartPageRequest, "lines" | "aspect">): string {
  const lines = req.lines.map((l) => `${l.id}: [x ${Math.round(l.x)}, y ${Math.round(l.y)}, w ${Math.round(l.w)}, h ${Math.round(l.h)}] ${JSON.stringify(l.text)}`).join("\n");
  return `The slide is ${req.aspect.toFixed(3)} times as wide as it is tall.\n\nText lines (id: box, text):\n${lines || "(no text on this slide)"}\n\nReturn the JSON layout.`;
}
