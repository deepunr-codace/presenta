import type { PDFPageProxy, PageViewport } from "pdfjs-dist";

/**
 * Splits a PDF page into its pieces by rendering it once per drawing instruction, with every other painting
 * instruction skipped. Clips, transparency groups and soft masks still run, so each piece comes out exactly as it looks
 * on the page, on a transparent canvas, in its place. That is what lets designs exported from Canva, Figma or
 * PowerPoint (whose artwork lives inside masked groups) become separate, movable elements.
 */

export type Ops = Record<string, number>;
export type OpsFilter = (index: number, list: { fnArray: number[] }) => boolean;

/** A box in viewport pixels. */
export type PBox = { x: number; y: number; w: number; h: number };

export type Piece = {
  /** Operator indexes that draw this piece, in paint order. */
  ops: number[];
  box: PBox;
  /** Share of the box covered by opaque pixels. */
  coverage: number;
  /** Mean colour of the opaque pixels and whether nearly all of them have it. */
  color: [number, number, number];
  solid: boolean;
  /** Typical alpha of the opaque part (for see-through pieces). */
  alpha: number;
  /** Distance in from the corners along the diagonals before the piece starts (rounded corners, circles): the largest. */
  corner: number;
  /** Whether all four corners are rounded alike (a shape rounded on one side only is not a simple shape). */
  evenCorners: boolean;
};

export class TooManyPiecesError extends Error {}

/** Pages with more separate drawings than this are drawn as larger groups instead (see `importPdfDeck`). */
const MAX_PIECES = 220;
/** Width the pieces are measured at; fast, and still precise to about four page pixels at 1920. */
const PROBE_WIDTH = 480;

const PATH_PAINT = ["fill", "eoFill", "stroke", "closeStroke", "fillStroke", "eoFillStroke", "closeFillStroke", "closeEOFillStroke"];
const IMAGE_PAINT = [
  "paintImageXObject",
  "paintInlineImageXObject",
  "paintImageMaskXObject",
  "paintImageMaskXObjectGroup",
  "paintImageXObjectRepeat",
  "paintImageMaskXObjectRepeat",
  "paintSolidColorImageMask",
  "paintJpegXObject",
  "shadingFill",
];
const TEXT_SHOW = ["showText", "showSpacedText", "nextLineShowText", "nextLineSetSpacingShowText"];

/**
 * Which operators paint something, and which belong to soft masks (always kept: a mask is not a piece, but without it
 * the masked artwork would not show).
 */
export function paintPlan(OPS: Ops, list: { fnArray: number[]; argsArray: unknown[][] }) {
  const pathPaint = new Set(PATH_PAINT.map((n) => OPS[n]).filter((v) => typeof v === "number"));
  const imagePaint = new Set(IMAGE_PAINT.map((n) => OPS[n]).filter((v) => typeof v === "number"));
  const text = new Set(TEXT_SHOW.map((n) => OPS[n]).filter((v) => typeof v === "number"));
  const paint: number[] = [];
  const isPaint = new Uint8Array(list.fnArray.length);
  const inMask = new Uint8Array(list.fnArray.length);
  const isText = new Uint8Array(list.fnArray.length);
  const groups: boolean[] = [];
  let maskDepth = 0;
  list.fnArray.forEach((fn, i) => {
    if (fn === OPS.beginGroup) {
      const smask = Boolean((list.argsArray[i]?.[0] as { smask?: unknown } | undefined)?.smask);
      groups.push(smask);
      if (smask) maskDepth += 1;
      return;
    }
    if (fn === OPS.endGroup) {
      if (groups.pop()) maskDepth -= 1;
      return;
    }
    if (text.has(fn)) {
      isText[i] = 1;
      return;
    }
    // pdf.js 4+ puts the paint operator inside constructPath; older versions emit it as its own operator.
    const pathOp = fn === OPS.constructPath ? (list.argsArray[i]?.[0] as unknown) : fn;
    const paints = (typeof pathOp === "number" && pathPaint.has(pathOp)) || imagePaint.has(fn);
    if (!paints) return;
    if (maskDepth > 0) {
      inMask[i] = 1;
      return;
    }
    isPaint[i] = 1;
    paint.push(i);
  });
  return { paint, isPaint, inMask, isText };
}

type Plan = ReturnType<typeof paintPlan>;

/** A filter that keeps every non-painting operator, the masks, and the painting operators in `keep`. */
export function onlyOps(plan: Plan, keep: Set<number>, withText = false): OpsFilter {
  return (i) => {
    if (plan.isText[i]) return withText;
    if (!plan.isPaint[i]) return true;
    return keep.has(i);
  };
}

async function render(page: PDFPageProxy, viewport: PageViewport, canvas: HTMLCanvasElement, filter: OpsFilter): Promise<CanvasRenderingContext2D> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser could not prepare the PDF pages for import.");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport, background: "rgba(0,0,0,0)", operationsFilter: filter }).promise;
  return ctx;
}

/** Measure what one probe render drew. Returns null when it drew nothing visible. */
function measure(data: Uint8ClampedArray, W: number, H: number, k: number): Omit<Piece, "ops"> | null {
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (data[(y * W + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  let covered = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let strong = 0;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const i = (y * W + x) * 4;
      if (data[i + 3] > 12) covered += 1;
      if (data[i + 3] > 120) {
        // Colours are premultiplied-free in ImageData: average them directly.
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        a += data[i + 3];
        strong += 1;
      }
    }
  }
  if (!strong) return null;
  const mean: [number, number, number] = [r / strong, g / strong, b / strong];
  let near = 0;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const i = (y * W + x) * 4;
      if (data[i + 3] <= 120) continue;
      if (Math.abs(data[i] - mean[0]) + Math.abs(data[i + 1] - mean[1]) + Math.abs(data[i + 2] - mean[2]) < 30) near += 1;
    }
  }
  // How far in from each corner, along its diagonal, the piece starts.
  const steps = Math.min(w, h);
  const inset = (sx: number, sy: number, dx: number, dy: number) => {
    let d = 0;
    while (d < steps && data[((sy + dy * d) * W + (sx + dx * d)) * 4 + 3] <= 60) d += 1;
    return d;
  };
  const corners = [inset(x0, y0, 1, 1), inset(x1, y0, -1, 1), inset(x0, y1, 1, -1), inset(x1, y1, -1, -1)];
  const corner = Math.max(...corners);
  const evenCorners = corner - Math.min(...corners) <= Math.max(1, corner * 0.25);
  return {
    box: { x: x0 / k, y: y0 / k, w: w / k, h: h / k },
    coverage: covered / (w * h),
    color: mean,
    solid: near / strong > 0.96,
    alpha: a / strong / 255,
    corner: corner / k,
    evenCorners,
  };
}

export type ProbeResult = { pieces: Piece[]; plan: Plan; probeScale: number };

/**
 * The operator list the renderer itself walks, as handed to `operationsFilter`. Indexes must come from this list:
 * `getOperatorList()` can differ (annotations), and skipping the wrong operators breaks the renderer's state.
 */
async function renderedList(page: PDFPageProxy, viewport: PageViewport): Promise<{ fnArray: number[]; argsArray: unknown[][] }> {
  let captured: { fnArray: number[]; argsArray: unknown[][] } | null = null;
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  try {
    const vp = page.getViewport({ scale: (viewport.scale * 8) / viewport.width });
    await render(page, vp, canvas, (_i, l) => {
      captured ??= l as unknown as { fnArray: number[]; argsArray: unknown[][] };
      return false;
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
  if (!captured) throw new Error("The page has nothing to draw.");
  return captured;
}

/** Render every painting operator on its own at probe size and measure it. `onProgress` gets 0–1. */
export async function probePieces(page: PDFPageProxy, viewport: PageViewport, OPS: Ops, onProgress?: (f: number) => void): Promise<ProbeResult> {
  const list = await renderedList(page, viewport);
  const plan = paintPlan(OPS, list);
  if (plan.paint.length > MAX_PIECES) throw new TooManyPiecesError(`${plan.paint.length} drawings on this page.`);
  const k = Math.min(1, PROBE_WIDTH / viewport.width);
  const vp = page.getViewport({ scale: viewport.scale * k });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(vp.width));
  canvas.height = Math.max(1, Math.ceil(vp.height));
  const pieces: Piece[] = [];
  try {
    for (let n = 0; n < plan.paint.length; n += 1) {
      const i = plan.paint[n];
      const ctx = await render(page, vp, canvas, onlyOps(plan, new Set([i])));
      const m = measure(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, k);
      if (m) pieces.push({ ops: [i], ...m });
      onProgress?.((n + 1) / plan.paint.length);
    }
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
  return { pieces, plan, probeScale: k };
}

/** Render the given operators at full size and crop to `box` (viewport pixels). */
export async function renderCrop(page: PDFPageProxy, viewport: PageViewport, plan: Plan, ops: number[], box: PBox, withText = false): Promise<HTMLCanvasElement> {
  const full = document.createElement("canvas");
  full.width = Math.max(1, Math.ceil(viewport.width));
  full.height = Math.max(1, Math.ceil(viewport.height));
  try {
    await render(page, viewport, full, onlyOps(plan, new Set(ops), withText));
    const pad = 1;
    const x = Math.max(0, Math.floor(box.x) - pad);
    const y = Math.max(0, Math.floor(box.y) - pad);
    const w = Math.min(full.width - x, Math.ceil(box.w) + pad * 2);
    const h = Math.min(full.height - y, Math.ceil(box.h) + pad * 2);
    const out = document.createElement("canvas");
    out.width = Math.max(1, w);
    out.height = Math.max(1, h);
    out.getContext("2d")?.drawImage(full, x, y, w, h, 0, 0, w, h);
    return out;
  } finally {
    full.width = 0;
    full.height = 0;
  }
}

/** The colour that most text pixels in each box have, from one render of the real text only. */
export async function textInk(page: PDFPageProxy, viewport: PageViewport, plan: Plan, boxes: PBox[]): Promise<(string | null)[]> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  try {
    const ctx = await render(page, viewport, canvas, (i) => !plan.isPaint[i] || Boolean(plan.isText[i]));
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return boxes.map((b) => dominant(data, canvas.width, canvas.height, b));
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export function hex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

function dominant(data: Uint8ClampedArray, W: number, H: number, b: PBox): string | null {
  const counts = new Map<string, { n: number; rgb: [number, number, number] }>();
  const x0 = Math.max(0, Math.floor(b.x));
  const y0 = Math.max(0, Math.floor(b.y));
  const x1 = Math.min(W, Math.ceil(b.x + b.w));
  const y1 = Math.min(H, Math.ceil(b.y + b.h));
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 200) continue;
      const key = `${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`;
      const c = counts.get(key);
      if (c) c.n += 1;
      else counts.set(key, { n: 1, rgb: [data[i], data[i + 1], data[i + 2]] });
    }
  }
  let best: { n: number; rgb: [number, number, number] } | null = null;
  for (const c of counts.values()) if (!best || c.n > best.n) best = c;
  return best && best.n > 8 ? hex(best.rgb) : null;
}
