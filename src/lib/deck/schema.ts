import { z } from "zod";

/**
 * Presenta Studio deck schema. Single source of truth for the editor, the
 * AI routes, persistence and export. Coordinates are stage units on a
 * 1920 x 1080 canvas; the UI scales them.
 */

export const STAGE_W = 1920;
export const STAGE_H = 1080;

/* ---------- Theme ---------- */

export const ThemeIdSchema = z.enum(["glass-contrast", "cobalt-stripes", "sky-facet", "midnight", "paper"]);
export type ThemeId = z.infer<typeof ThemeIdSchema>;

export type Theme = {
  id: ThemeId;
  name: string;
  description: string;
  fonts: { display: string; body: string; displayWeight: number; bodyWeight: number; googleImport: string };
  colors: {
    bg: string;
    bgAlt: string;
    surface: string;
    surfaceBorder: string;
    ink: string;
    muted: string;
    accent: string;
    accentInk: string;
    accentSoft: string;
    line: string;
  };
  radius: number;
  /** CSS background for a default slide, and for the "alt" (dark/section) slide. */
  background: { default: string; alt: string };
  card: { fill: string; border: string; shadow: string; radius: number };
  /** Two colours shown as a swatch in pickers. */
  swatch: [string, string];
};

/* ---------- Safe strings ---------- */

const DATA_IMAGE_URL = /^data:image\/(?:png|jpeg|webp|gif|svg\+xml);base64,[a-z0-9+/=\s]*$/i;
const REMOTE_URL = /^(?:https?:\/\/[^\s/?#]+[^\s]*|blob:[^\s]+)$/i;

/**
 * Image sources and logos the deck may carry: `https:` (and `http:` for local
 * development), `blob:` object URLs the editor created, and base64 data URLs of
 * PNG, JPEG, WebP, GIF or SVG. Everything else (javascript:, file:, data:text/html, ...)
 * is rejected. Whitespace and control characters never pass.
 */
export function isSafeUrl(url: string): boolean {
  if (typeof url !== "string" || url.length === 0) return false;
  if (/[\u0000-\u001f\u007f]/.test(url)) return false;
  if (/^data:/i.test(url)) return DATA_IMAGE_URL.test(url);
  return REMOTE_URL.test(url);
}

/** Empty means "no image"; anything else must satisfy `isSafeUrl`. */
export const SafeUrlSchema = z.string().refine((v) => v === "" || isSafeUrl(v), {
  message: "Must be an https:, http:, blob: or base64 image data URL.",
});

const GRADIENT_CSS = /^(?:linear|radial|conic)-gradient\(/;

/** A CSS gradient image: `linear|radial|conic-gradient(...)` with no `url(` and no quotes, so it can never load anything. */
export function isSafeGradient(css: string): boolean {
  if (typeof css !== "string") return false;
  const v = css.trim();
  return GRADIENT_CSS.test(v) && !/url\(/i.test(v) && !/["']/.test(v);
}

export const GradientCssSchema = z.string().max(2000).refine(isSafeGradient, {
  message: "Must be a linear-, radial- or conic-gradient() without url() or quotes.",
});

/* ---------- Elements ---------- */

const Base = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  rotation: z.number().default(0),
  z: z.number().default(0),
  locked: z.boolean().default(false),
  opacity: z.number().min(0).max(1).default(1),
});

export const TextRoleSchema = z.enum(["title", "subtitle", "heading", "body", "bullets", "caption", "quote", "number", "label"]);
export type TextRole = z.infer<typeof TextRoleSchema>;

export const TextAlignSchema = z.enum(["left", "center", "right"]);
export const TextValignSchema = z.enum(["top", "middle", "bottom"]);

/** Per-element typography overrides; every field is optional so it doubles as a patch. */
export const TextStyleSchema = z.object({
  fontSize: z.number().optional(),
  fontWeight: z.number().optional(),
  color: z.string().optional(),
  lineHeight: z.number().optional(),
  letterSpacing: z.number().optional(),
  fontFamily: z.enum(["display", "body"]).optional(),
});
export type TextStyle = z.infer<typeof TextStyleSchema>;

export const TextElementSchema = Base.extend({
  type: z.literal("text"),
  role: TextRoleSchema,
  /**
   * Tiptap HTML; plain text is valid HTML. Not restricted here because the
   * editor writes it; AI ops and imported files pass through `sanitizeHtml`
   * (src/lib/text.ts) before the string reaches the deck.
   */
  html: z.string(),
  align: TextAlignSchema.default("left"),
  valign: TextValignSchema.default("top"),
  /** Shrink font to fit the box. */
  autoFit: z.boolean().default(true),
  style: TextStyleSchema.default({}),
});

export const ImageElementSchema = Base.extend({
  type: z.literal("image"),
  /** Picture source; see `isSafeUrl`. Absent (or empty) means the `query` placeholder is shown. */
  src: SafeUrlSchema.optional(),
  /** Search or generation prompt used when src is missing. */
  query: z.string().optional(),
  alt: z.string().default(""),
  fit: z.enum(["cover", "contain"]).default("cover"),
  radius: z.number().default(24),
  position: z.string().default("50% 50%"),
  /** 0..1 dark overlay strength. */
  overlay: z.number().min(0).max(1).default(0),
});

export const ShapeElementSchema = Base.extend({
  type: z.literal("shape"),
  kind: z.enum(["rect", "ellipse", "line", "pill"]),
  fill: z.string().default("accent"),
  stroke: z.string().optional(),
  strokeWidth: z.number().default(0),
  radius: z.number().default(0),
});

export const CardVariantSchema = z.enum(["surface", "accent", "dark", "outline"]);
export const CardElementSchema = Base.extend({
  type: z.literal("card"),
  variant: CardVariantSchema.default("surface"),
  title: z.string().default(""),
  body: z.string().default(""),
  /** Phosphor icon name, e.g. "Rocket". */
  icon: z.string().optional(),
  /** Big figure shown above the title for stat cards. */
  value: z.string().optional(),
  index: z.string().optional(),
});

export const IconElementSchema = Base.extend({
  type: z.literal("icon"),
  name: z.string(),
  color: z.string().default("accent"),
  weight: z.enum(["thin", "light", "regular", "bold", "fill", "duotone"]).default("regular"),
});

export const ChartElementSchema = Base.extend({
  type: z.literal("chart"),
  kind: z.enum(["bar", "line", "area", "donut"]),
  labels: z.array(z.string()),
  series: z.array(z.object({ name: z.string(), values: z.array(z.number()) })),
});

export function isSafeVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com") || host === "vimeo.com" || host.endsWith(".vimeo.com")) return true;
    return /\.(?:mp4|webm|ogg)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export const VideoElementSchema = Base.extend({
  type: z.literal("video"),
  src: z.string().max(2048).refine(isSafeVideoUrl, "Use a YouTube or Vimeo link, or a direct MP4, WebM or Ogg video URL."),
  title: z.string().max(120).default("Embedded video"),
});

export const ElementSchema = z.discriminatedUnion("type", [
  TextElementSchema,
  ImageElementSchema,
  ShapeElementSchema,
  CardElementSchema,
  IconElementSchema,
  ChartElementSchema,
  VideoElementSchema,
]);

export type TextElement = z.infer<typeof TextElementSchema>;
export type ImageElement = z.infer<typeof ImageElementSchema>;
export type ShapeElement = z.infer<typeof ShapeElementSchema>;
export type CardElement = z.infer<typeof CardElementSchema>;
export type IconElement = z.infer<typeof IconElementSchema>;
export type ChartElement = z.infer<typeof ChartElementSchema>;
export type VideoElement = z.infer<typeof VideoElementSchema>;
export type Element = z.infer<typeof ElementSchema>;
export type ElementType = Element["type"];
export const ElementTypeSchema = z.enum(["text", "image", "shape", "card", "icon", "chart", "video"]);

/* ---------- Slides & deck ---------- */

export const LayoutIdSchema = z.enum([
  "cover",
  "section",
  "title-bullets",
  "two-column",
  "three-cards",
  "four-cards",
  "stats-row",
  "quote",
  "image-left",
  "image-right",
  "process-steps",
  "comparison",
  "closing",
  "blank",
]);
export type LayoutId = z.infer<typeof LayoutIdSchema>;

export const SlideBackgroundSchema = z.union([
  z.object({ kind: z.literal("theme"), variant: z.enum(["default", "alt"]).default("default") }),
  z.object({ kind: z.literal("solid"), color: z.string() }),
  z.object({ kind: z.literal("gradient"), css: GradientCssSchema }),
  z.object({ kind: z.literal("image"), src: SafeUrlSchema, overlay: z.number().min(0).max(1).default(0.4) }),
]);
export type SlideBackground = z.infer<typeof SlideBackgroundSchema>;

export const SlideTransitionSchema = z.enum(["none", "fade", "push", "zoom"]);
export type SlideTransition = z.infer<typeof SlideTransitionSchema>;

export const SlideSchema = z.object({
  id: z.string(),
  layoutId: LayoutIdSchema,
  background: SlideBackgroundSchema.default({ kind: "theme", variant: "default" }),
  elements: z.array(ElementSchema),
  notes: z.string().default(""),
  /** Entrance effect used when this slide appears in presenter view. */
  transition: SlideTransitionSchema.optional(),
  /** Semantic content the slide was built from; kept so layouts can be re-applied. */
  content: z.lazy(() => SlideContentSchema).optional(),
});
export type Slide = z.infer<typeof SlideSchema>;

/* ---------- Brand preferences ---------- */

export const FontPairSchema = z.enum(["inter", "dm", "oswald", "roboto"]);
export type FontPair = z.infer<typeof FontPairSchema>;

export const BrandSchema = z.object({
  company: z.string().max(80).optional(),
  /** Data URL of an uploaded logo (PNG/SVG/JPG); see `isSafeUrl`. */
  logoDataUrl: SafeUrlSchema.optional(),
  /** Hex accent colour override, e.g. "#1B5FD9". */
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontPair: FontPairSchema.optional(),
  /** Free-text preferences the AI should respect (voice, words to avoid, etc.). */
  notes: z.string().max(400).optional(),
});
export type Brand = z.infer<typeof BrandSchema>;

export const DeckSchema = z.object({
  id: z.string(),
  title: z.string(),
  themeId: ThemeIdSchema,
  slides: z.array(SlideSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  meta: z
    .object({
      audience: z.string().optional(),
      tone: z.string().optional(),
      source: z.enum(["chat", "paste", "import", "blank"]).optional(),
      prompt: z.string().optional(),
      brief: z.lazy(() => BriefSchema).optional(),
      outline: z.lazy(() => OutlineSchema).optional(),
      brand: BrandSchema.optional(),
    })
    .default({}),
  version: z.literal(1).default(1),
});
export type Deck = z.infer<typeof DeckSchema>;

/** Size bounds applied to decks that arrive from outside the editor (JSON import). */
export const DECK_IMPORT_LIMITS = {
  slides: 100,
  elementsPerSlide: 200,
  html: 20_000,
  src: 2_000_000,
  notes: 2000,
} as const;

/**
 * `DeckSchema` plus size bounds for imported files. Kept separate so decks
 * already stored in the browser keep loading even when they exceed a bound;
 * only new files are held to it.
 */
export const DeckImportSchema = DeckSchema.superRefine((deck, ctx) => {
  const L = DECK_IMPORT_LIMITS;
  const tooLong = (path: (string | number)[], what: string, max: number) =>
    ctx.addIssue({ code: "custom", path, message: `${what} is longer than ${max.toLocaleString("en-US")} characters.` });
  if (deck.slides.length > L.slides) ctx.addIssue({ code: "custom", path: ["slides"], message: `A deck may have at most ${L.slides} slides.` });
  if (deck.meta.brand?.logoDataUrl && deck.meta.brand.logoDataUrl.length > L.src) tooLong(["meta", "brand", "logoDataUrl"], "The logo", L.src);
  deck.slides.forEach((slide, si) => {
    if (slide.elements.length > L.elementsPerSlide) {
      ctx.addIssue({ code: "custom", path: ["slides", si, "elements"], message: `A slide may have at most ${L.elementsPerSlide} elements.` });
    }
    if (slide.notes.length > L.notes) tooLong(["slides", si, "notes"], "Speaker notes", L.notes);
    if (slide.background.kind === "image" && slide.background.src.length > L.src) tooLong(["slides", si, "background", "src"], "The background image", L.src);
    slide.elements.forEach((el, ei) => {
      if (el.type === "text" && el.html.length > L.html) tooLong(["slides", si, "elements", ei, "html"], "Text", L.html);
      if (el.type === "image" && el.src && el.src.length > L.src) tooLong(["slides", si, "elements", ei, "src"], "An image", L.src);
    });
  });
});

/* ---------- AI content (semantic, layout-free) ---------- */

export const SlideKindSchema = z.enum([
  "cover",
  "section",
  "bullets",
  "two-column",
  "cards",
  "stats",
  "quote",
  "image-text",
  "process",
  "comparison",
  "closing",
]);
export type SlideKind = z.infer<typeof SlideKindSchema>;

export const SlideContentSchema = z.object({
  kind: SlideKindSchema,
  title: z.string().max(90),
  subtitle: z.string().max(160).optional(),
  body: z.string().max(400).optional(),
  bullets: z.array(z.string().max(110)).max(6).optional(),
  /** Second column for two-column and comparison layouts. */
  bulletsRight: z.array(z.string().max(110)).max(6).optional(),
  columnTitles: z.tuple([z.string().max(40), z.string().max(40)]).optional(),
  cards: z
    .array(z.object({ title: z.string().max(50), body: z.string().max(140), icon: z.string().optional() }))
    .max(4)
    .optional(),
  stats: z.array(z.object({ value: z.string().max(14), label: z.string().max(50) })).max(4).optional(),
  steps: z.array(z.object({ title: z.string().max(40), body: z.string().max(120) })).max(6).optional(),
  quote: z.object({ text: z.string().max(220), by: z.string().max(60).optional() }).optional(),
  /** Image search or generation prompt for layouts with imagery. */
  imageQuery: z.string().max(140).optional(),
  notes: z.string().max(400).optional(),
  /** Exact source labels that support this slide; rendered as a discreet footer. */
  sources: z.array(z.string().trim().min(1).max(300)).max(3).optional(),
});
export type SlideContent = z.infer<typeof SlideContentSchema>;

export const OutlineSchema = z.object({
  title: z.string().max(80),
  audience: z.string().max(80).optional(),
  tone: z.string().max(40).optional(),
  slides: z
    .array(
      z.object({
        title: z.string().max(80),
        kind: SlideKindSchema,
        goal: z.string().max(140),
        /** Two to four short points the slide should cover. */
        keyPoints: z.array(z.string().max(100)).max(4).optional(),
      }),
    )
    .min(3)
    .max(20),
});
export type Outline = z.infer<typeof OutlineSchema>;
export type OutlineItem = Outline["slides"][number];

export const GenerationSchema = z.object({
  title: z.string().max(80),
  slides: z.array(SlideContentSchema).min(3).max(20),
});
export type Generation = z.infer<typeof GenerationSchema>;

/* ---------- AI revise patch ---------- */

const SlideIndex = z.number().int().min(0);
const ElementId = z.string().min(1);

/** Style patch for a text element: typography overrides plus the element's own align / valign. */
export const ElementStylePatchSchema = TextStyleSchema.extend({
  align: TextAlignSchema.optional(),
  valign: TextValignSchema.optional(),
});
export type ElementStylePatch = z.infer<typeof ElementStylePatchSchema>;

export const PatchOpSchema = z.discriminatedUnion("op", [
  // Slide and deck level
  z.object({ op: z.literal("replaceSlideContent"), slideIndex: SlideIndex, content: SlideContentSchema }),
  z.object({ op: z.literal("insertSlide"), atIndex: SlideIndex, content: SlideContentSchema }),
  z.object({ op: z.literal("deleteSlide"), slideIndex: SlideIndex }),
  z.object({ op: z.literal("moveSlide"), fromIndex: SlideIndex, toIndex: SlideIndex }),
  z.object({ op: z.literal("setTitle"), title: z.string().max(80) }),
  z.object({ op: z.literal("setTheme"), themeId: ThemeIdSchema }),
  z.object({ op: z.literal("setLayout"), slideIndex: SlideIndex, layoutId: LayoutIdSchema }),
  z.object({ op: z.literal("setSlideBackground"), slideIndex: SlideIndex, background: SlideBackgroundSchema }),
  z.object({ op: z.literal("setSlideNotes"), slideIndex: SlideIndex, notes: z.string().max(400) }),
  // Element level (unknown element ids are ignored by applyOps)
  z.object({ op: z.literal("setElementText"), slideIndex: SlideIndex, elementId: ElementId, html: z.string() }),
  z.object({ op: z.literal("setElementStyle"), slideIndex: SlideIndex, elementId: ElementId, style: ElementStylePatchSchema }),
  z.object({
    op: z.literal("setElementBox"),
    slideIndex: SlideIndex,
    elementId: ElementId,
    x: z.number().optional(),
    y: z.number().optional(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
    rotation: z.number().optional(),
    opacity: z.number().min(0).max(1).optional(),
    /** Corner radius; applies to image and shape elements, ignored elsewhere. */
    radius: z.number().min(0).optional(),
  }),
  z.object({
    op: z.literal("setImage"),
    slideIndex: SlideIndex,
    elementId: ElementId,
    /** New image source (URL or data URL, see `isSafeUrl`). An empty string removes the image and keeps the query. */
    src: SafeUrlSchema.optional(),
    query: z.string().max(140).optional(),
    fit: z.enum(["cover", "contain"]).optional(),
    overlay: z.number().min(0).max(1).optional(),
    position: z.string().optional(),
  }),
  z.object({
    op: z.literal("setCard"),
    slideIndex: SlideIndex,
    elementId: ElementId,
    title: z.string().max(50).optional(),
    body: z.string().max(140).optional(),
    icon: z.string().optional(),
    value: z.string().max(14).optional(),
    variant: CardVariantSchema.optional(),
  }),
  z.object({ op: z.literal("deleteElement"), slideIndex: SlideIndex, elementId: ElementId }),
  z.object({ op: z.literal("duplicateElement"), slideIndex: SlideIndex, elementId: ElementId }),
]);
export type PatchOp = z.infer<typeof PatchOpSchema>;

export const RevisionSchema = z.object({
  summary: z.string().max(200),
  ops: z.array(PatchOpSchema).max(30),
});
export type Revision = z.infer<typeof RevisionSchema>;

/* ---------- Brief (collected by the chat intake) ---------- */

export const BriefSchema = z.object({
  topic: z.string().max(2000).optional(),
  audience: z.string().max(120).optional(),
  goal: z.string().max(200).optional(),
  mustInclude: z.array(z.string().max(120)).max(10).optional(),
  angle: z.string().max(200).optional(),
  /** Pasted source material, when the user started from content. */
  source: z.string().max(40000).optional(),
});
export type Brief = z.infer<typeof BriefSchema>;

export const BriefStageSchema = z.enum(["topic", "audience", "goal", "mustInclude", "angle", "confirm"]);
export type BriefStage = z.infer<typeof BriefStageSchema>;

export const ChatTurnSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) });
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

/** Ask the AI for dynamic answer suggestions for the current intake question. */
export const SuggestRequestSchema = z.object({
  stage: BriefStageSchema,
  question: z.string().max(400),
  brief: BriefSchema.default({}),
  history: z.array(ChatTurnSchema).max(30).default([]),
});
export type SuggestRequest = z.infer<typeof SuggestRequestSchema>;

export const SuggestResponseSchema = z.object({
  /** 3 to 6 short, concrete options the user can pick. */
  suggestions: z.array(z.string().max(120)).min(3).max(6),
  /** Optional one-line note on which angle usually works best. */
  hint: z.string().max(200).optional(),
});
export type SuggestResponse = z.infer<typeof SuggestResponseSchema>;

/** Build the deck outline from the brief or pasted content. */
export const OutlineRequestSchema = z.object({
  mode: z.enum(["chat", "paste"]),
  brief: BriefSchema.default({}),
  slideCount: z.number().int().min(3).max(20).default(10),
  tone: z.string().max(40).default("confident and clear"),
  language: z.string().max(30).default("English"),
});
export type OutlineRequest = z.infer<typeof OutlineRequestSchema>;

/* ---------- Generation request ---------- */

export const GenerateRequestSchema = z.object({
  mode: z.enum(["chat", "paste"]),
  /** Chat transcript or pasted content. */
  input: z.string().min(1).max(40000),
  slideCount: z.number().int().min(3).max(20).default(10),
  tone: z.string().max(40).default("confident and clear"),
  audience: z.string().max(80).optional(),
  themeId: ThemeIdSchema.default("glass-contrast"),
  language: z.string().max(30).default("English"),
  /** When present, generation must follow this outline slide by slide. */
  outline: OutlineSchema.optional(),
  brief: BriefSchema.optional(),
  brand: BrandSchema.optional(),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/**
 * What the user has focused in the editor when asking for a revision. With
 * only `slideIndex` the scope is the slide; with `elementId` the scope is one
 * element and the model must only touch that element unless the instruction
 * widens the scope.
 */
export const ReviseSelectionSchema = z.object({
  slideIndex: z.number().int().min(0),
  elementId: z.string().optional(),
  elementType: ElementTypeSchema.optional(),
  /** Current plain text of a text element or a card (title and body). */
  text: z.string().max(4000).optional(),
  role: TextRoleSchema.optional(),
  /** Current image query of an image element. */
  imageQuery: z.string().max(140).optional(),
});
export type ReviseSelection = z.infer<typeof ReviseSelectionSchema>;

export const ReviseRequestSchema = z.object({
  deck: DeckSchema,
  selectedSlideIndex: z.number().int().min(0).optional(),
  instruction: z.string().min(1).max(4000),
  selection: ReviseSelectionSchema.optional(),
});
export type ReviseRequest = z.infer<typeof ReviseRequestSchema>;

/** Map a semantic slide kind to its default layout. */
export const KIND_TO_LAYOUT: Record<SlideKind, LayoutId> = {
  cover: "cover",
  section: "section",
  bullets: "title-bullets",
  "two-column": "two-column",
  cards: "three-cards",
  stats: "stats-row",
  quote: "quote",
  "image-text": "image-right",
  process: "process-steps",
  comparison: "comparison",
  closing: "closing",
};
