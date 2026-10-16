import {
  KIND_TO_LAYOUT,
  STAGE_H,
  STAGE_W,
  type CardElement,
  type Deck,
  type Element,
  type Generation,
  type ImageElement,
  type LayoutId,
  type ShapeElement,
  type Slide,
  type SlideBackground,
  type SlideContent,
  type SlideKind,
  type TextElement,
  type TextRole,
  type Theme,
  type ThemeId,
} from "./schema";
import { newId } from "./ids";
import { resolveTheme } from "./themes";
import { escapeHtml } from "@/lib/text";

/* ---------- Grid & type scale ---------- */

const MARGIN = 96;
const GUTTER = 24;
/** Content box: left, top, width, height, right and bottom edges in stage units. */
const CX = MARGIN;
const CY = MARGIN;
const CW = STAGE_W - MARGIN * 2;
const CH = STAGE_H - MARGIN * 2;
const CR = CX + CW;
const CB = CY + CH;

export const TYPE_SCALE: Record<TextRole, number> = {
  title: 72,
  subtitle: 32,
  heading: 36,
  body: 28,
  bullets: 28,
  caption: 20,
  quote: 44,
  number: 96,
  label: 20,
};

const COVER_TITLE_SIZE = 88;

/** Type sizes inside card elements; cards carry no per-element style, so the renderer reads these. */
export const CARD_TYPE_SCALE = { title: 30, body: 22, value: 96 } as const;

export const LAYOUTS: { id: LayoutId; name: string; description: string; kinds: SlideKind[] }[] = [
  { id: "cover", name: "Cover", description: "Opening slide with a large title, subtitle and optional image.", kinds: ["cover"] },
  { id: "section", name: "Section", description: "Divider with an accent rule, big title and subtitle.", kinds: ["section"] },
  { id: "title-bullets", name: "Title and bullets", description: "Title with a bulleted list and optional image.", kinds: ["bullets"] },
  { id: "two-column", name: "Two columns", description: "Title over two headed bullet columns.", kinds: ["two-column"] },
  { id: "three-cards", name: "Three cards", description: "Title over a row of three cards.", kinds: ["cards"] },
  { id: "four-cards", name: "Four cards", description: "Title over a row of four cards.", kinds: ["cards"] },
  { id: "stats-row", name: "Stats row", description: "Title, optional intro and up to four big figures.", kinds: ["stats"] },
  { id: "quote", name: "Quote", description: "Centred quotation with attribution.", kinds: ["quote"] },
  { id: "image-left", name: "Image left", description: "Image on the left, title, body and bullets on the right.", kinds: ["image-text"] },
  { id: "image-right", name: "Image right", description: "Title, body and bullets on the left, image on the right.", kinds: ["image-text"] },
  { id: "process-steps", name: "Process steps", description: "Numbered step cards, up to six.", kinds: ["process"] },
  { id: "comparison", name: "Comparison", description: "Two side-by-side panels with headed lists.", kinds: ["comparison"] },
  { id: "closing", name: "Closing", description: "Final slide with a centred title, subtitle and call to action.", kinds: ["closing"] },
  { id: "blank", name: "Blank", description: "Empty slide.", kinds: [] },
];

const ALT_BACKGROUND_LAYOUTS: ReadonlySet<LayoutId> = new Set<LayoutId>(["cover", "section", "quote", "closing"]);

/* ---------- Helpers ---------- */

export type Box = { x: number; y: number; w: number; h: number };

function bulletsHtml(items: readonly string[]): string {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Increments z in draw order so later elements sit on top. */
class ZOrder {
  private next = 0;
  take(): number {
    return this.next++;
  }
}

type TextOpts = {
  align?: TextElement["align"];
  valign?: TextElement["valign"];
  fontSize?: number;
  fontFamily?: "display" | "body";
  fontWeight?: number;
};

function textEl(z: ZOrder, theme: Theme, role: TextRole, text: string, box: Box, opts: TextOpts = {}): TextElement {
  const isDisplay = role === "title" || role === "heading" || role === "quote" || role === "number";
  const fontFamily = opts.fontFamily ?? (isDisplay ? "display" : "body");
  const fontWeight = opts.fontWeight ?? (fontFamily === "display" ? theme.fonts.displayWeight : theme.fonts.bodyWeight);
  return {
    id: newId("el"),
    type: "text",
    role,
    html: role === "bullets" ? text : escapeHtml(text),
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    rotation: 0,
    z: z.take(),
    locked: false,
    opacity: 1,
    align: opts.align ?? "left",
    valign: opts.valign ?? "top",
    autoFit: true,
    style: { fontSize: opts.fontSize ?? TYPE_SCALE[role], fontFamily, fontWeight },
  };
}

function bulletsEl(z: ZOrder, theme: Theme, items: readonly string[], box: Box): TextElement {
  return textEl(z, theme, "bullets", bulletsHtml(items), box);
}

type CardOpts = {
  variant?: CardElement["variant"];
  title?: string;
  body?: string;
  icon?: string;
  value?: string;
  index?: string;
};

function cardEl(z: ZOrder, box: Box, opts: CardOpts): CardElement {
  return {
    id: newId("el"),
    type: "card",
    variant: opts.variant ?? "surface",
    title: opts.title ?? "",
    body: opts.body ?? "",
    icon: opts.icon,
    value: opts.value,
    index: opts.index,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    rotation: 0,
    z: z.take(),
    locked: false,
    opacity: 1,
  };
}

function imageEl(z: ZOrder, theme: Theme, query: string, box: Box): ImageElement {
  return {
    id: newId("el"),
    type: "image",
    query,
    alt: query,
    fit: "cover",
    radius: theme.radius,
    position: "50% 50%",
    overlay: 0,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    rotation: 0,
    z: z.take(),
    locked: false,
    opacity: 1,
  };
}

type ShapeOpts = { fill?: string; opacity?: number; radius?: number };

function shapeEl(z: ZOrder, kind: ShapeElement["kind"], box: Box, opts: ShapeOpts = {}): ShapeElement {
  return {
    id: newId("el"),
    type: "shape",
    kind,
    fill: opts.fill ?? "accent",
    strokeWidth: 0,
    radius: opts.radius ?? 0,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    rotation: 0,
    z: z.take(),
    locked: false,
    opacity: opts.opacity ?? 1,
  };
}

/** Split a row into `n` equal columns separated by the gutter. */
function columns(n: number, x = CX, w = CW): { x: number; w: number }[] {
  const colW = Math.floor((w - GUTTER * (n - 1)) / n);
  return Array.from({ length: n }, (_, i) => ({ x: x + i * (colW + GUTTER), w: colW }));
}

/* ---------- Layouts ---------- */

type LayoutFn = (c: SlideContent, theme: Theme, z: ZOrder) => Element[];

const cover: LayoutFn = (c, theme, z) => {
  const els: Element[] = [];
  const hasImage = Boolean(c.imageQuery);
  if (c.imageQuery) {
    const imgW = Math.floor(CW / 2) - GUTTER / 2;
    els.push(imageEl(z, theme, c.imageQuery, { x: CR - imgW, y: CY, w: imgW, h: CH }));
  }
  const textW = hasImage ? Math.floor(CW * 0.55) - GUTTER : 1400;
  const textX = hasImage ? CX : (STAGE_W - textW) / 2;
  const align = hasImage ? "left" : "center";
  els.push(
    textEl(z, theme, "title", c.title, { x: textX, y: 300, w: textW, h: 260 }, { align, valign: "bottom", fontSize: COVER_TITLE_SIZE }),
  );
  if (c.subtitle) {
    const subW = hasImage ? textW : 1200;
    const subX = hasImage ? CX : (STAGE_W - subW) / 2;
    els.push(textEl(z, theme, "subtitle", c.subtitle, { x: subX, y: 584, w: subW, h: 120 }, { align }));
  }
  if (c.body) {
    els.push(textEl(z, theme, "label", c.body, { x: CX, y: 900, w: hasImage ? textW : 800, h: 60 }, { valign: "bottom" }));
  }
  return els;
};

const section: LayoutFn = (c, theme, z) => {
  const els: Element[] = [];
  els.push(shapeEl(z, "rect", { x: CX, y: 380, w: 160, h: 6 }));
  els.push(textEl(z, theme, "title", c.title, { x: CX, y: 410, w: 1200, h: 200 }));
  if (c.subtitle) els.push(textEl(z, theme, "subtitle", c.subtitle, { x: CX, y: 634, w: 1000, h: 110 }));
  if (c.body) els.push(textEl(z, theme, "body", c.body, { x: CX, y: 770, w: 1000, h: 140 }));
  return els;
};

const titleBullets: LayoutFn = (c, theme, z) => {
  const els: Element[] = [];
  els.push(textEl(z, theme, "title", c.title, { x: CX, y: CY, w: 1200, h: 160 }, { valign: "bottom" }));
  const leftW = Math.floor(CW * 0.6);
  let y = 296;
  if (c.body) {
    els.push(textEl(z, theme, "body", c.body, { x: CX, y, w: leftW, h: 96 }));
    y = 416;
  }
  if (c.bullets && c.bullets.length > 0) {
    els.push(bulletsEl(z, theme, c.bullets, { x: CX, y, w: leftW, h: CB - y }));
  }
  if (c.imageQuery) {
    const imgW = Math.floor(CW * 0.35);
    els.push(imageEl(z, theme, c.imageQuery, { x: CR - imgW, y: CY, w: imgW, h: CH }));
  }
  return els;
};

const twoColumn: LayoutFn = (c, theme, z) => {
  const els: Element[] = [];
  els.push(textEl(z, theme, "title", c.title, { x: CX, y: CY, w: CW, h: 150 }, { valign: "bottom" }));
  const cols = columns(2);
  let y = 290;
  if (c.columnTitles) {
    els.push(textEl(z, theme, "heading", c.columnTitles[0], { x: cols[0].x, y, w: cols[0].w, h: 60 }));
    els.push(textEl(z, theme, "heading", c.columnTitles[1], { x: cols[1].x, y, w: cols[1].w, h: 60 }));
    y = 366;
  }
  if (c.bullets && c.bullets.length > 0) els.push(bulletsEl(z, theme, c.bullets, { x: cols[0].x, y, w: cols[0].w, h: CB - y }));
  if (c.bulletsRight && c.bulletsRight.length > 0) {
    els.push(bulletsEl(z, theme, c.bulletsRight, { x: cols[1].x, y, w: cols[1].w, h: CB - y }));
  }
  return els;
};

function cardsRow(slots: number): LayoutFn {
  return (c, theme, z) => {
    const els: Element[] = [];
    els.push(textEl(z, theme, "title", c.title, { x: CX, y: CY, w: CW, h: 150 }, { valign: "bottom" }));
    let y = 290;
    if (c.body) {
      els.push(textEl(z, theme, "body", c.body, { x: CX, y: 260, w: 1200, h: 90 }));
      y = 370;
    }
    const cols = columns(slots);
    const cards = c.cards ?? [];
    cards.slice(0, slots).forEach((card, i) => {
      els.push(cardEl(z, { x: cols[i].x, y, w: cols[i].w, h: CB - y }, { title: card.title, body: card.body, icon: card.icon }));
    });
    return els;
  };
}

const statsRow: LayoutFn = (c, theme, z) => {
  const els: Element[] = [];
  els.push(textEl(z, theme, "title", c.title, { x: CX, y: CY, w: CW, h: 150 }, { valign: "bottom" }));
  if (c.body) els.push(textEl(z, theme, "body", c.body, { x: CX, y: 260, w: 1200, h: 90 }));
  const stats = (c.stats ?? []).slice(0, 4);
  if (stats.length === 0) return els;
  const cols = columns(stats.length);
  stats.forEach((stat, i) => {
    els.push(cardEl(z, { x: cols[i].x, y: 400, w: cols[i].w, h: 400 }, { variant: "surface", value: stat.value, title: stat.label }));
  });
  return els;
};

const quote: LayoutFn = (c, theme, z) => {
  const els: Element[] = [];
  els.push(shapeEl(z, "ellipse", { x: 1320, y: 520, w: 560, h: 560 }, { opacity: 0.1 }));
  const text = c.quote?.text ?? c.body ?? c.title;
  els.push(textEl(z, theme, "quote", text, { x: 260, y: 240, w: 1400, h: 460 }, { align: "center", valign: "middle" }));
  const by = c.quote?.by ?? c.subtitle;
  if (by) els.push(textEl(z, theme, "caption", by, { x: 260, y: 724, w: 1400, h: 60 }, { align: "center" }));
  return els;
};

function imageSide(side: "left" | "right"): LayoutFn {
  return (c, theme, z) => {
    const els: Element[] = [];
    const imgW = Math.floor(CW * 0.45);
    const textW = CW - imgW - GUTTER;
    const imgX = side === "left" ? CX : CR - imgW;
    const textX = side === "left" ? CX + imgW + GUTTER : CX;
    els.push(imageEl(z, theme, c.imageQuery ?? c.title, { x: imgX, y: CY, w: imgW, h: CH }));
    els.push(textEl(z, theme, "title", c.title, { x: textX, y: CY, w: textW, h: 200 }, { valign: "bottom" }));
    let y = 320;
    if (c.subtitle) {
      els.push(textEl(z, theme, "subtitle", c.subtitle, { x: textX, y, w: textW, h: 80 }));
      y += 104;
    }
    if (c.body) {
      els.push(textEl(z, theme, "body", c.body, { x: textX, y, w: textW, h: 160 }));
      y += 184;
    }
    if (c.bullets && c.bullets.length > 0 && y < CB - 100) {
      els.push(bulletsEl(z, theme, c.bullets, { x: textX, y, w: textW, h: CB - y }));
    }
    return els;
  };
}

const processSteps: LayoutFn = (c, theme, z) => {
  const els: Element[] = [];
  els.push(textEl(z, theme, "title", c.title, { x: CX, y: CY, w: CW, h: 150 }, { valign: "bottom" }));
  const steps = (c.steps ?? []).slice(0, 6);
  if (steps.length === 0) return els;
  const top = 290;
  if (steps.length <= 3) {
    const cols = columns(steps.length);
    steps.forEach((step, i) => {
      els.push(cardEl(z, { x: cols[i].x, y: top, w: cols[i].w, h: 520 }, { index: pad2(i + 1), title: step.title, body: step.body }));
    });
  } else {
    const cols = columns(3);
    const rowH = Math.floor((CB - top - GUTTER) / 2);
    steps.forEach((step, i) => {
      const col = cols[i % 3];
      const y = top + Math.floor(i / 3) * (rowH + GUTTER);
      els.push(cardEl(z, { x: col.x, y, w: col.w, h: rowH }, { index: pad2(i + 1), title: step.title, body: step.body }));
    });
  }
  return els;
};

/** Inner padding of a comparison panel and the height its title row takes before the list starts. */
const PANEL_PAD = 40;
const PANEL_TITLE_H = 80;

/**
 * Two outline panels that carry only the column title; each column's list is
 * a sibling `bullets` text element placed inside the panel. Card bodies stay
 * plain text everywhere, so the digest, the export and the renderer never
 * see HTML in a card.
 */
const comparison: LayoutFn = (c, theme, z) => {
  const els: Element[] = [];
  els.push(textEl(z, theme, "title", c.title, { x: CX, y: CY, w: CW, h: 150 }, { valign: "bottom" }));
  const cols = columns(2);
  const [leftTitle, rightTitle] = c.columnTitles ?? ["", ""];
  const top = 290;
  const panelH = CB - top;
  els.push(cardEl(z, { x: cols[0].x, y: top, w: cols[0].w, h: panelH }, { variant: "outline", title: leftTitle }));
  els.push(cardEl(z, { x: cols[1].x, y: top, w: cols[1].w, h: panelH }, { variant: "outline", title: rightTitle }));
  const listY = top + PANEL_PAD + PANEL_TITLE_H;
  const listH = CB - PANEL_PAD - listY;
  const leftItems = c.bullets && c.bullets.length > 0 ? c.bullets : c.body ? [c.body] : [];
  if (leftItems.length > 0) {
    els.push(bulletsEl(z, theme, leftItems, { x: cols[0].x + PANEL_PAD, y: listY, w: cols[0].w - PANEL_PAD * 2, h: listH }));
  }
  if (c.bulletsRight && c.bulletsRight.length > 0) {
    els.push(bulletsEl(z, theme, c.bulletsRight, { x: cols[1].x + PANEL_PAD, y: listY, w: cols[1].w - PANEL_PAD * 2, h: listH }));
  }
  return els;
};

const closing: LayoutFn = (c, theme, z) => {
  const els: Element[] = [];
  els.push(textEl(z, theme, "title", c.title, { x: 260, y: 300, w: 1400, h: 220 }, { align: "center", valign: "bottom" }));
  if (c.subtitle) els.push(textEl(z, theme, "subtitle", c.subtitle, { x: 360, y: 544, w: 1200, h: 110 }, { align: "center" }));
  if (c.body) els.push(textEl(z, theme, "caption", c.body, { x: 360, y: 700, w: 1200, h: 80 }, { align: "center" }));
  return els;
};

const blank: LayoutFn = () => [];

const LAYOUT_FNS: Record<LayoutId, LayoutFn> = {
  cover,
  section,
  "title-bullets": titleBullets,
  "two-column": twoColumn,
  "three-cards": cardsRow(3),
  "four-cards": cardsRow(4),
  "stats-row": statsRow,
  quote,
  "image-left": imageSide("left"),
  "image-right": imageSide("right"),
  "process-steps": processSteps,
  comparison,
  closing,
  blank,
};

/* ---------- Public API ---------- */

/** Positions semantic content on the stage. Deterministic apart from element ids. */
export function applyLayout(content: SlideContent, layoutId: LayoutId, theme: Theme): Element[] {
  return LAYOUT_FNS[layoutId](content, theme, new ZOrder());
}

function defaultBackground(layoutId: LayoutId): SlideBackground {
  return { kind: "theme", variant: ALT_BACKGROUND_LAYOUTS.has(layoutId) ? "alt" : "default" };
}

export function buildSlide(content: SlideContent, theme: Theme, layoutId: LayoutId = KIND_TO_LAYOUT[content.kind]): Slide {
  return {
    id: newId("slide"),
    layoutId,
    background: defaultBackground(layoutId),
    elements: applyLayout(content, layoutId, theme),
    notes: content.notes ?? "",
    content,
  };
}

/** Size of the brand logo placed on cover and closing slides, in stage units. */
export const LOGO_BOX: Box = { x: CX, y: CY, w: 260, h: 90 };

const LOGO_KINDS: ReadonlySet<SlideKind> = new Set<SlideKind>(["cover", "closing"]);

/** A brand logo image at the top-left of the content box, drawn above everything else on the slide. */
function logoElement(logoDataUrl: string, slide: Pick<Slide, "elements">, alt = "Logo"): ImageElement {
  const z = slide.elements.reduce((m, e) => Math.max(m, e.z), -1) + 1;
  return {
    id: newId("el"),
    type: "image",
    src: logoDataUrl,
    alt,
    fit: "contain",
    radius: 0,
    position: "50% 50%",
    overlay: 0,
    x: LOGO_BOX.x,
    y: LOGO_BOX.y,
    w: LOGO_BOX.w,
    h: LOGO_BOX.h,
    rotation: 0,
    z,
    locked: false,
    opacity: 1,
  };
}

export function buildDeck(gen: Generation, themeId: ThemeId, meta: Deck["meta"] = {}): Deck {
  const theme = resolveTheme({ themeId, meta });
  const logo = meta.brand?.logoDataUrl;
  const now = new Date().toISOString();
  return {
    id: newId("deck"),
    title: gen.title,
    themeId,
    slides: gen.slides.map((content) => {
      const slide = buildSlide(content, theme);
      if (logo && LOGO_KINDS.has(content.kind)) slide.elements.push(logoElement(logo, slide, meta.brand?.company ?? "Logo"));
      return slide;
    }),
    createdAt: now,
    updatedAt: now,
    meta,
    version: 1,
  };
}
