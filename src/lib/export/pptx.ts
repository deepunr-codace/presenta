import type PptxGenJS from "pptxgenjs";
import { CARD_TYPE_SCALE, TYPE_SCALE } from "@/lib/deck/layouts";
import { isDarkColor, slideTokens } from "@/lib/deck/tokens";
import { decodeEntities } from "@/lib/text";
import {
  STAGE_H,
  STAGE_W,
  type CardElement,
  type ChartElement,
  type Deck,
  type Element,
  type ImageElement,
  type ShapeElement,
  type Slide,
  type TextElement,
  type TextRole,
  type Theme,
} from "@/lib/deck/schema";

/**
 * PPTX export via pptxgenjs. The presentation is 16:9 (LAYOUT_WIDE, 13.333 x
 * 7.5 in), so one stage unit (1/1920 of the width) is 1/144 in and a stage
 * pixel of type is exactly 0.5 pt. pptxgenjs is imported lazily inside
 * `exportPptx` so this module can be imported anywhere without pulling the
 * browser-only bundle into SSR.
 */

/* ---------- Units ---------- */

const IN = (units: number): number => units / 144;
const PT = (units: number): number => units * 0.5;

/* ---------- Colours ---------- */

type ParsedColor = { hex: string; alpha: number };

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function byteHex(n: number): string {
  return clampByte(n).toString(16).padStart(2, "0").toUpperCase();
}

/** Parses a single hex or rgb(a) colour. Returns null for anything else. */
function parseCssColor(input: string): ParsedColor | null {
  const s = input.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const alpha = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { hex: h.slice(0, 6).toUpperCase(), alpha };
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(s);
  if (rgb) {
    const raw = rgb[4];
    const a = raw === undefined ? 1 : raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
    return {
      hex: byteHex(Number(rgb[1])) + byteHex(Number(rgb[2])) + byteHex(Number(rgb[3])),
      alpha: Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 1,
    };
  }
  return null;
}

/** First hex or rgb(a) colour inside an arbitrary CSS value such as a gradient. */
export function firstColor(css: string): string | null {
  const m = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/i.exec(css);
  return m ? m[0] : null;
}

/**
 * Resolves a colour to a 6-digit hex string without "#" for pptxgenjs.
 * Accepts hex, rgb(a), named tokens (looked up in `tokens`), and gradients
 * (first colour). Anything unparseable returns the fallback.
 */
export function toHex(color: string | undefined, fallback: string, tokens?: Readonly<Record<string, string>>): string {
  const fb = (): string => {
    const parsed = parseCssColor(fallback.startsWith("#") || /^rgb/i.test(fallback) ? fallback : `#${fallback}`);
    return parsed ? parsed.hex : "000000";
  };
  if (!color) return fb();
  const trimmed = color.trim();
  if (!trimmed) return fb();
  const token = tokens?.[trimmed];
  if (token !== undefined && token !== trimmed) return toHex(token, fallback);
  const direct = parseCssColor(trimmed);
  if (direct) return direct.hex;
  const nested = firstColor(trimmed);
  if (nested) {
    const parsed = parseCssColor(nested);
    if (parsed) return parsed.hex;
  }
  return fb();
}

/** Alpha of a colour (0..1); 1 when unknown. Tokens resolve through `tokens`. */
function alphaOf(color: string | undefined, tokens?: Readonly<Record<string, string>>): number {
  if (!color) return 1;
  const value = tokens?.[color.trim()] ?? color;
  const first = firstColor(value);
  const parsed = parseCssColor(value.trim()) ?? (first ? parseCssColor(first) : null);
  return parsed ? parsed.alpha : 1;
}

function isNoFill(color: string | undefined): boolean {
  if (!color) return false;
  const v = color.trim().toLowerCase();
  return v === "transparent" || v === "none";
}

/* ---------- HTML to text runs ---------- */

type TextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Starts a bulleted paragraph. */
  bullet?: boolean;
  /** Ends the paragraph after this run. */
  breakLine?: boolean;
};

const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote"]);

/**
 * Converts Tiptap HTML (or plain text) to pptxgenjs-style runs: `<li>` becomes
 * a bulleted paragraph, `<strong>`/`<b>` bold, `<em>`/`<i>` italic, and
 * `<br>`, `<p>` and other block boundaries end a paragraph.
 */
export function htmlToRuns(html: string): TextRun[] {
  const runs: TextRun[] = [];
  let bold = 0;
  let italic = 0;
  let inBullet = false;
  let paragraphOpen = false;

  const endParagraph = (): void => {
    if (paragraphOpen && runs.length > 0) runs[runs.length - 1].breakLine = true;
    paragraphOpen = false;
  };

  for (const m of html.matchAll(/<\/?([a-z][a-z0-9]*)\b[^>]*>|[^<]+/gi)) {
    const token = m[0];
    if (token.startsWith("<")) {
      const tag = m[1].toLowerCase();
      const closing = token.startsWith("</");
      if (tag === "strong" || tag === "b") bold += closing ? -1 : 1;
      else if (tag === "em" || tag === "i") italic += closing ? -1 : 1;
      else if (tag === "br") endParagraph();
      else if (tag === "li") {
        endParagraph();
        inBullet = !closing;
      } else if (BLOCK_TAGS.has(tag)) endParagraph();
      continue;
    }
    const text = decodeEntities(token).replace(/\s+/g, " ");
    if (!text.trim() && !paragraphOpen) continue;
    const run: TextRun = { text: paragraphOpen ? text : text.replace(/^\s+/, "") };
    if (bold > 0) run.bold = true;
    if (italic > 0) run.italic = true;
    if (inBullet && !paragraphOpen) run.bullet = true;
    runs.push(run);
    paragraphOpen = true;
  }

  // Trim trailing whitespace at paragraph ends and drop runs left empty.
  const out: TextRun[] = [];
  for (const run of runs) {
    if (run.breakLine) run.text = run.text.replace(/\s+$/, "");
    if (run.text.length === 0) {
      if (run.breakLine && out.length > 0) out[out.length - 1].breakLine = true;
      continue;
    }
    out.push(run);
  }
  if (out.length > 0) {
    const last = out[out.length - 1];
    last.text = last.text.replace(/\s+$/, "");
    delete last.breakLine;
    if (last.text.length === 0) out.pop();
  }
  return out;
}

/* ---------- Fonts and type ---------- */

const FONT_FACES: Record<string, string> = {
  "var(--font-inter-tight)": "Inter",
  "var(--font-inter)": "Inter",
  "var(--font-dm)": "DM Sans",
  "var(--font-oswald)": "Oswald",
  "var(--font-roboto)": "Roboto",
};

export function fontFaceFor(cssFamily: string): string {
  const v = cssFamily.trim();
  if (FONT_FACES[v]) return FONT_FACES[v];
  const first = v.split(",")[0]?.replace(/["']/g, "").trim() ?? "";
  return first && !first.startsWith("var(") ? first : "Inter";
}

const DISPLAY_ROLES: ReadonlySet<TextRole> = new Set(["title", "subtitle", "heading", "number", "quote"]);

const LINE_HEIGHT: Record<TextRole, number> = {
  title: 1.05,
  subtitle: 1.3,
  heading: 1.15,
  body: 1.4,
  bullets: 1.4,
  caption: 1.4,
  quote: 1.25,
  number: 1,
  label: 1.3,
};

const LETTER_SPACING: Partial<Record<TextRole, number>> = { title: -0.02, heading: -0.01, number: -0.03, label: 0.08 };

/* ---------- Export ---------- */

type SlideTokenMap = Readonly<Record<string, string>>;

/** Image source → data URL, or null when the download failed. Keys are the original `src` strings. */
export type ImageSources = ReadonlyMap<string, string | null>;

type Ctx = {
  pptx: PptxGenJS;
  theme: Theme;
  tokens: SlideTokenMap;
  limitations: Set<string>;
  images: ImageSources;
};

const REMOTE_IMAGE_FAILED = "Some linked images could not be downloaded and were exported as placeholder tiles.";

function tokensFor(theme: Theme, slide: Slide): SlideTokenMap {
  const vars = slideTokens(theme, slide.background).vars;
  return {
    ink: vars["--deck-ink"],
    muted: vars["--deck-muted"],
    accent: vars["--deck-accent"],
    accentInk: vars["--deck-accent-ink"],
    accentSoft: vars["--deck-accent-soft"],
    surface: vars["--deck-surface"],
    surfaceBorder: vars["--deck-surface-border"],
    line: vars["--deck-line"],
    bg: vars["--deck-bg"],
  };
}

type Frame = { x: number; y: number; w: number; h: number; rotate?: number };

function frame(el: Element): Frame {
  return { x: IN(el.x), y: IN(el.y), w: IN(el.w), h: IN(el.h), rotate: el.rotation || undefined };
}

function transparencyFor(alpha: number, opacity: number): number | undefined {
  const t = Math.round((1 - alpha * opacity) * 100);
  return t > 0 ? Math.min(100, t) : undefined;
}

/**
 * pptxgenjs image props for a source, or null when the picture is not
 * available: remote images are embedded from the pre-fetched data URL so a
 * single unreachable URL cannot reject the whole export.
 */
function imageSource(src: string, images: ImageSources): PptxGenJS.DataOrPathProps | null {
  const data = src.startsWith("data:") ? src : (images.get(src) ?? null);
  return data ? { data: data.replace(/^data:/, "") } : null;
}

function isRemoteSrc(src: string): boolean {
  return /^(?:https?:|blob:)/i.test(src);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

/** Download one image as a data URL; null on any failure (network, non-image, non-2xx). Never throws. */
export async function fetchImageAsDataUrl(src: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetchFn(src);
    if (!res.ok) return null;
    const type = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
    const buffer = new Uint8Array(await res.arrayBuffer());
    if (buffer.length === 0) return null;
    const mime = type.startsWith("image/") ? type : "image/png";
    return `data:${mime};base64,${bytesToBase64(buffer)}`;
  } catch {
    return null;
  }
}

/** Every remote image source in the deck (elements and backgrounds), fetched once each, in parallel. */
export async function resolveImageSources(deck: Deck, fetchFn: typeof fetch = fetch): Promise<ImageSources> {
  const sources = new Set<string>();
  for (const slide of deck.slides) {
    if (slide.background.kind === "image" && isRemoteSrc(slide.background.src)) sources.add(slide.background.src);
    for (const el of slide.elements) if (el.type === "image" && el.src && isRemoteSrc(el.src)) sources.add(el.src);
  }
  const entries = await Promise.all([...sources].map(async (src) => [src, await fetchImageAsDataUrl(src, fetchFn)] as const));
  return new Map(entries);
}

function applyBackground(pptxSlide: PptxGenJS.Slide, slide: Slide, ctx: Ctx): void {
  const { theme } = ctx;
  const bg = slide.background;
  switch (bg.kind) {
    case "theme":
      pptxSlide.background = { color: toHex(bg.variant === "alt" ? theme.colors.bgAlt : theme.colors.bg, theme.colors.bg) };
      break;
    case "solid":
      pptxSlide.background = { color: toHex(bg.color, theme.colors.bg) };
      break;
    case "gradient":
      pptxSlide.background = { color: toHex(firstColor(bg.css) ?? theme.colors.bg, theme.colors.bg) };
      ctx.limitations.add("Gradient backgrounds are flattened to their first colour.");
      break;
    case "image": {
      pptxSlide.background = { color: toHex(theme.colors.bg, "FFFFFF") };
      const source = bg.src ? imageSource(bg.src, ctx.images) : null;
      if (!source) {
        ctx.limitations.add(REMOTE_IMAGE_FAILED);
        break;
      }
      pptxSlide.addImage({
        ...source,
        x: 0,
        y: 0,
        w: IN(STAGE_W),
        h: IN(STAGE_H),
        sizing: { type: "cover", w: IN(STAGE_W), h: IN(STAGE_H) },
      });
      if (bg.overlay > 0) {
        pptxSlide.addShape(ctx.pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: IN(STAGE_W),
          h: IN(STAGE_H),
          fill: { color: "000000", transparency: Math.round((1 - bg.overlay) * 100) },
          line: { type: "none" },
        });
      }
      break;
    }
  }
}

function addTextElement(pptxSlide: PptxGenJS.Slide, el: TextElement, ctx: Ctx): void {
  const runs = htmlToRuns(el.html);
  if (runs.length === 0) return;
  const { theme, tokens } = ctx;
  const role = el.role;
  const family = el.style.fontFamily ?? (DISPLAY_ROLES.has(role) ? "display" : "body");
  const defaultWeight =
    role === "label" ? Math.max(theme.fonts.bodyWeight, 500) : family === "display" ? theme.fonts.displayWeight : theme.fonts.bodyWeight;
  const weight = el.style.fontWeight ?? defaultWeight;
  const sizePx = el.style.fontSize ?? TYPE_SCALE[role];
  const fontSize = PT(sizePx);
  const defaultColor = role === "caption" || role === "label" ? tokens.muted : role === "number" ? tokens.accent : tokens.ink;
  const color = el.style.color ? toHex(el.style.color, defaultColor, tokens) : toHex(defaultColor, "000000");
  const letter = el.style.letterSpacing ?? LETTER_SPACING[role];
  const uppercase = role === "label";

  const props: PptxGenJS.TextProps[] = runs.map((run) => ({
    text: uppercase ? run.text.toUpperCase() : run.text,
    options: {
      bold: run.bold === true || weight >= 600,
      italic: run.italic === true,
      bullet: run.bullet ? { indent: Math.round(fontSize * 1.1) } : undefined,
      breakLine: run.breakLine === true,
    },
  }));

  pptxSlide.addText(props, {
    ...frame(el),
    fontFace: fontFaceFor(family === "display" ? theme.fonts.display : theme.fonts.body),
    fontSize,
    color,
    align: el.align,
    valign: el.valign,
    fit: el.autoFit ? "shrink" : "none",
    margin: 0,
    lineSpacingMultiple: el.style.lineHeight ?? LINE_HEIGHT[role],
    charSpacing: letter !== undefined ? Math.round(letter * fontSize * 10) / 10 : undefined,
    transparency: transparencyFor(1, el.opacity),
    paraSpaceAfter: role === "bullets" ? fontSize * 0.35 : undefined,
  });
}

function addImageElement(pptxSlide: PptxGenJS.Slide, el: ImageElement, ctx: Ctx): void {
  const { theme, tokens } = ctx;
  const f = frame(el);
  const source = el.src ? imageSource(el.src, ctx.images) : null;
  if (el.src && !source) ctx.limitations.add(REMOTE_IMAGE_FAILED);
  if (source) {
    pptxSlide.addImage({
      ...source,
      ...f,
      altText: el.alt || undefined,
      sizing: { type: el.fit === "contain" ? "contain" : "cover", w: f.w, h: f.h },
      transparency: transparencyFor(1, el.opacity),
    });
    if (el.overlay > 0) {
      pptxSlide.addShape(ctx.pptx.ShapeType.roundRect, {
        ...f,
        rectRadius: IN(el.radius),
        fill: { color: "000000", transparency: Math.round((1 - el.overlay) * 100) },
        line: { type: "none" },
      });
    }
    return;
  }
  // Placeholder tile: light rounded rect with the image query as a caption.
  pptxSlide.addShape(ctx.pptx.ShapeType.roundRect, {
    ...f,
    rectRadius: IN(Math.min(el.radius, Math.min(el.w, el.h) / 2)),
    fill: {
      color: toHex(tokens.accentSoft, theme.colors.accentSoft, tokens),
      transparency: transparencyFor(alphaOf(tokens.accentSoft), el.opacity),
    },
    line: { color: toHex(tokens.line, "CCCCCC", tokens), width: 0.75, transparency: transparencyFor(alphaOf(tokens.line), 1) },
  });
  if (el.query) {
    pptxSlide.addText(el.query, {
      ...f,
      fontFace: fontFaceFor(theme.fonts.body),
      fontSize: PT(20),
      color: toHex(tokens.muted, "666666", tokens),
      align: "center",
      valign: "middle",
      fit: "shrink",
      margin: PT(32),
    });
  }
  if (!el.src) ctx.limitations.add("Images without a source are exported as placeholder tiles.");
}

function addShapeElement(pptxSlide: PptxGenJS.Slide, el: ShapeElement, ctx: Ctx): void {
  const { pptx, tokens } = ctx;
  const f = frame(el);
  const fillColor = el.kind === "line" ? (el.stroke ?? el.fill) : el.fill;
  const fill: PptxGenJS.ShapeFillProps = isNoFill(fillColor)
    ? { type: "none" }
    : { color: toHex(fillColor, tokens.accent, tokens), transparency: transparencyFor(alphaOf(fillColor, tokens), el.opacity) };
  const line: PptxGenJS.ShapeLineProps =
    el.kind !== "line" && el.stroke && el.strokeWidth > 0 && !isNoFill(el.stroke)
      ? {
          color: toHex(el.stroke, tokens.line, tokens),
          width: PT(el.strokeWidth),
          transparency: transparencyFor(alphaOf(el.stroke, tokens), el.opacity),
        }
      : { type: "none" };

  switch (el.kind) {
    case "ellipse":
      pptxSlide.addShape(pptx.ShapeType.ellipse, { ...f, fill, line });
      break;
    case "pill":
      pptxSlide.addShape(pptx.ShapeType.roundRect, { ...f, rectRadius: IN(Math.min(el.w, el.h) / 2), fill, line });
      break;
    case "line": {
      // Lines are drawn as thin filled rects so orientation and thickness match the canvas exactly.
      const thickness = el.strokeWidth > 0 ? el.strokeWidth : el.h;
      pptxSlide.addShape(pptx.ShapeType.rect, { ...f, h: IN(Math.max(1, Math.min(el.h, thickness))), fill, line: { type: "none" } });
      break;
    }
    case "rect":
      if (el.radius > 0) {
        pptxSlide.addShape(pptx.ShapeType.roundRect, { ...f, rectRadius: IN(Math.min(el.radius, Math.min(el.w, el.h) / 2)), fill, line });
      } else {
        pptxSlide.addShape(pptx.ShapeType.rect, { ...f, fill, line });
      }
      break;
  }
}

type CardPalette = {
  fill: string | null;
  border: { color: string; width: number } | null;
  ink: string;
  muted: string;
  mutedAlpha: number;
  accent: string;
};

function parseBorder(border: string): { color: string; width: number } | null {
  const m = /^\s*([\d.]+)px\s+\w+\s+(.+)$/.exec(border);
  if (!m) return null;
  const width = Number(m[1]);
  return width > 0 ? { color: m[2].trim(), width } : null;
}

function cardPaletteFor(el: CardElement, theme: Theme, tokens: SlideTokenMap): CardPalette {
  const c = theme.colors;
  switch (el.variant) {
    case "accent":
      return { fill: c.accent, border: null, ink: c.accentInk, muted: c.accentInk, mutedAlpha: 0.72, accent: c.accentInk };
    case "dark":
      return {
        fill: isDarkColor(c.bg) ? c.surface : c.ink,
        border: { color: c.line, width: 1 },
        ink: "#FFFFFF",
        muted: "#FFFFFF",
        mutedAlpha: 0.72,
        accent: c.accentSoft,
      };
    case "outline":
      return { fill: null, border: { color: tokens.line, width: 1.5 }, ink: tokens.ink, muted: tokens.muted, mutedAlpha: 1, accent: tokens.accent };
    case "surface":
    default:
      return { fill: theme.card.fill, border: parseBorder(theme.card.border), ink: c.ink, muted: c.muted, mutedAlpha: 1, accent: c.accent };
  }
}

function addCardElement(pptxSlide: PptxGenJS.Slide, el: CardElement, ctx: Ctx): void {
  const { pptx, theme, tokens } = ctx;
  const p = cardPaletteFor(el, theme, tokens);
  const f = frame(el);
  const radius = Math.min(theme.card.radius, Math.min(el.w, el.h) / 2);
  const fill: PptxGenJS.ShapeFillProps = p.fill
    ? { color: toHex(p.fill, theme.colors.surface, tokens), transparency: transparencyFor(alphaOf(p.fill, tokens), el.opacity) }
    : { type: "none" };
  const line: PptxGenJS.ShapeLineProps = p.border
    ? {
        color: toHex(p.border.color, tokens.line, tokens),
        width: PT(p.border.width),
        transparency: transparencyFor(alphaOf(p.border.color, tokens), el.opacity),
      }
    : { type: "none" };
  pptxSlide.addShape(radius > 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
    ...f,
    rectRadius: radius > 0 ? IN(radius) : undefined,
    fill,
    line,
  });

  const display = fontFaceFor(theme.fonts.display);
  const body = fontFaceFor(theme.fonts.body);
  const ink = toHex(p.ink, "000000", tokens);
  const accent = toHex(p.accent, ink, tokens);
  const muted = toHex(p.muted, ink, tokens);
  const compact = el.h < 260;
  const gap = PT(compact ? 8 : 12);
  const runs: PptxGenJS.TextProps[] = [];
  if (el.index) {
    runs.push({
      text: el.index,
      options: { fontFace: display, fontSize: PT(20), bold: true, color: accent, charSpacing: 0.6, breakLine: true, paraSpaceAfter: gap },
    });
  }
  if (el.value) {
    runs.push({
      text: el.value,
      options: {
        fontFace: display,
        fontSize: PT(CARD_TYPE_SCALE.value),
        bold: theme.fonts.displayWeight >= 600,
        color: el.variant === "surface" ? accent : ink,
        charSpacing: -1.4,
        breakLine: true,
        paraSpaceAfter: gap,
      },
    });
  }
  if (el.title) {
    runs.push({
      text: el.title,
      options: { fontFace: display, fontSize: PT(CARD_TYPE_SCALE.title), bold: true, color: ink, breakLine: true, paraSpaceAfter: gap },
    });
  }
  if (el.body) {
    runs.push({
      text: el.body,
      options: {
        fontFace: body,
        fontSize: PT(CARD_TYPE_SCALE.body),
        bold: theme.fonts.bodyWeight >= 600,
        color: muted,
        transparency: transparencyFor(p.mutedAlpha, 1),
        lineSpacingMultiple: 1.3,
      },
    });
  }
  if (runs.length > 0) {
    const last = runs[runs.length - 1];
    if (last.options) {
      last.options.breakLine = false;
      last.options.paraSpaceAfter = undefined;
    }
    const pad = Math.max(24, Math.min(40, Math.round(Math.min(el.w, el.h) * 0.1)));
    pptxSlide.addText(runs, {
      ...f,
      valign: "top",
      align: "left",
      fit: "shrink",
      margin: PT(pad),
      lineSpacingMultiple: 1.15,
      transparency: transparencyFor(1, el.opacity),
    });
  }
  if (el.icon) ctx.limitations.add("Card icons are not exported.");
}

function addChartElement(pptxSlide: PptxGenJS.Slide, el: ChartElement, ctx: Ctx): void {
  const { theme, tokens } = ctx;
  if (el.series.length === 0 || el.labels.length === 0) return;
  const type: PptxGenJS.CHART_NAME = el.kind === "donut" ? "doughnut" : el.kind === "area" ? "area" : el.kind === "line" ? "line" : "bar";
  const data: PptxGenJS.OptsChartData[] =
    el.kind === "donut"
      ? [{ name: el.series[0].name, labels: el.labels, values: el.series[0].values }]
      : el.series.map((s) => ({ name: s.name, labels: el.labels, values: s.values }));
  const ink = toHex(tokens.ink, "000000", tokens);
  const lineColor = toHex(tokens.line, "CCCCCC", tokens);
  const palette = [tokens.accent, tokens.accentSoft, tokens.muted, tokens.line, theme.colors.accentInk].map((c) => toHex(c, "888888", tokens));
  const fontFace = fontFaceFor(theme.fonts.body);
  const opts: PptxGenJS.IChartOpts = {
    ...frame(el),
    chartColors: palette,
    showLegend: el.kind === "donut" || el.series.length > 1,
    legendPos: el.kind === "donut" ? "r" : "b",
    legendColor: ink,
    legendFontFace: fontFace,
    legendFontSize: PT(18),
    catAxisLabelColor: ink,
    catAxisLabelFontFace: fontFace,
    catAxisLabelFontSize: PT(18),
    valAxisLabelColor: ink,
    valAxisLabelFontFace: fontFace,
    valAxisLabelFontSize: PT(16),
    catGridLine: { style: "none" },
    valGridLine: { color: lineColor, style: "solid", size: 0.5 },
    catAxisLineShow: false,
    valAxisLineShow: false,
    dataLabelColor: ink,
    dataLabelFontFace: fontFace,
    dataLabelFontSize: PT(16),
    showValue: false,
    lineDataSymbol: "none",
    lineSize: 3,
    barGapWidthPct: 60,
    holeSize: 60,
    showPercent: false,
  };
  pptxSlide.addChart(type, data, opts);
}

function addElement(pptxSlide: PptxGenJS.Slide, el: Element, ctx: Ctx): void {
  switch (el.type) {
    case "text":
      addTextElement(pptxSlide, el, ctx);
      break;
    case "image":
      addImageElement(pptxSlide, el, ctx);
      break;
    case "shape":
      addShapeElement(pptxSlide, el, ctx);
      break;
    case "card":
      addCardElement(pptxSlide, el, ctx);
      break;
    case "chart":
      addChartElement(pptxSlide, el, ctx);
      break;
    case "icon":
      ctx.limitations.add("Icon elements are not exported.");
      break;
  }
}

export function sanitizeFileName(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/[\p{Cc}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "deck").slice(0, 120);
}

/**
 * Builds and downloads `${title}.pptx`. Client-only: pptxgenjs is loaded on
 * demand. Remote images are downloaded first; one that fails becomes a
 * placeholder tile instead of failing the export. Resolves with the list of
 * things the export could not reproduce (icons, gradients, placeholder and
 * missing images), empty when the deck exported fully.
 */
export async function exportPptx(deck: Deck, theme: Theme): Promise<string[]> {
  const [PptxGen, images] = await Promise.all([import("pptxgenjs").then((m) => m.default), resolveImageSources(deck)]);
  const pptx = new PptxGen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = deck.title;
  pptx.author = "Presenta Studio";
  const limitations = new Set<string>();

  for (const slide of deck.slides) {
    const pptxSlide = pptx.addSlide();
    const ctx: Ctx = { pptx, theme, tokens: tokensFor(theme, slide), limitations, images };
    applyBackground(pptxSlide, slide, ctx);
    const elements = [...slide.elements].sort((a, b) => a.z - b.z);
    for (const el of elements) addElement(pptxSlide, el, ctx);
    if (slide.notes) pptxSlide.addNotes(slide.notes);
  }

  await pptx.writeFile({ fileName: `${sanitizeFileName(deck.title)}.pptx` });
  return Array.from(limitations);
}
