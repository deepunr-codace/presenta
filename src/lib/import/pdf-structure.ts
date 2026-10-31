import { applyClips, clipBox, intersect, segsBox, type Box, type DrawEvent, type FillEvent, type Seg, type StrokeEvent } from "./pdf-record";

/** An element found on a PDF page, in page-canvas pixels and paint order. */
export type PdfItem =
  | { type: "shape"; kind: "rect" | "ellipse"; box: Box; fill: string; stroke?: string; strokeWidth?: number; radius: number; opacity: number; source: FillEvent | StrokeEvent }
  | { type: "image"; box: Box; canvas: HTMLCanvasElement; opacity: number };

export type PdfStructure = { background: string | null; backgroundImage: HTMLCanvasElement | null; items: PdfItem[]; textColors: (string | null)[]; textBold: boolean[] };

/** Too many separate pieces on one page means the page is better kept as one picture plus text. */
export class TooComplexError extends Error {}

const MAX_ITEMS = 180;
const GROUP_GAP = 14;

type Shape = { kind: "rect" | "ellipse"; radius: number };

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

/**
 * Recognises axis-aligned rectangles, rounded rectangles and ellipses from their outline, whatever number of curve
 * pieces the PDF used to draw corners and circles.
 */
function classify(segs: Seg[], box: Box): Shape | null {
  if (segs.some((s) => s.op === "X")) return null;
  if (segs.filter((s) => s.op === "M").length !== 1) return null;
  if (box.w < 1 || box.h < 1) return null;
  const tol = Math.max(0.75, Math.min(box.w, box.h) * 0.025);
  const left = box.x;
  const right = box.x + box.w;
  const top = box.y;
  const bottom = box.y + box.h;
  const ends = segs.flatMap((s) => (s.op === "C" ? [s.pts[2]] : s.op === "Q" ? [s.pts[1]] : s.pts));
  const curves = segs.filter((s) => s.op === "C" || s.op === "Q");
  const lines = segs.filter((s) => s.op === "L");

  if (!curves.length) {
    const corners = ends.every(([x, y]) => (near(x, left, tol) || near(x, right, tol)) && (near(y, top, tol) || near(y, bottom, tol)));
    return corners && lines.length >= 3 && lines.length <= 5 ? { kind: "rect", radius: 0 } : null;
  }

  // Ellipse: every point on the outline sits on the ellipse that fills the box.
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const onEllipse = ([x, y]: [number, number]) => {
    const nx = (x - cx) / (box.w / 2);
    const ny = (y - cy) / (box.h / 2);
    return Math.abs(Math.sqrt(nx * nx + ny * ny) - 1) < 0.04;
  };
  if (!lines.length && ends.length >= 4 && ends.every(onEllipse)) return { kind: "ellipse", radius: 0 };

  // Rounded rectangle: straight parts lie on the edges, curves sit on quarter circles in the corners.
  const onEdge = ([x, y]: [number, number]) => near(x, left, tol) || near(x, right, tol) || near(y, top, tol) || near(y, bottom, tol);
  let r = 0;
  for (const l of lines) {
    for (const [x, y] of l.pts) {
      const dx = Math.min(Math.abs(x - left), Math.abs(x - right));
      const dy = Math.min(Math.abs(y - top), Math.abs(y - bottom));
      // Along an edge, one distance is ~0 and the other is how far the straight part starts from the corner.
      r = Math.max(r, Math.min(Math.max(dx, dy), Math.min(box.w, box.h) / 2));
    }
  }
  if (!lines.length) r = Math.min(box.w, box.h) / 2;
  if (r < 0.5) return null;
  const roundTol = Math.max(1, r * 0.08);
  const fits = ends.every(([x, y]) => {
    const ccx = x < cx ? left + r : right - r;
    const ccy = y < cy ? top + r : bottom - r;
    const inCorner = (x < cx ? x <= left + r + tol : x >= right - r - tol) && (y < cy ? y <= top + r + tol : y >= bottom - r - tol);
    if (!inCorner) return onEdge([x, y]);
    return Math.abs(Math.hypot(x - ccx, y - ccy) - r) <= roundTol;
  });
  if (!fits) return null;
  const pill = Math.abs(r - Math.min(box.w, box.h) / 2) <= roundTol;
  return { kind: "rect", radius: Math.round(pill ? Math.min(box.w, box.h) / 2 : r) };
}

function strokeScale(e: StrokeEvent): number {
  const m = e.transform;
  return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
}

function expand(b: Box, by: number): Box {
  return { x: b.x - by, y: b.y - by, w: b.w + by * 2, h: b.h + by * 2 };
}

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Paints a set of vector drawings into one picture, keeping their clips, fills, strokes and transparency. */
function rasterize(events: (FillEvent | StrokeEvent)[], box: Box): HTMLCanvasElement | null {
  const scale = Math.min(2, 2400 / Math.max(box.w, box.h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(box.w * scale));
  canvas.height = Math.max(1, Math.ceil(box.h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  for (const e of events) {
    ctx.save();
    ctx.scale(scale, scale);
    const base = ctx.getTransform();
    applyClips(ctx, e.clips, box.x, box.y, base);
    ctx.setTransform(base.multiply(new DOMMatrix().translate(-box.x, -box.y)).multiply(e.transform));
    ctx.globalAlpha = e.alpha;
    ctx.globalCompositeOperation = e.composite;
    if (e.kind === "fill") {
      ctx.fillStyle = e.style;
      ctx.fill(e.path, e.rule);
    } else {
      ctx.strokeStyle = e.style;
      ctx.lineWidth = e.lineWidth;
      ctx.lineCap = e.lineCap;
      ctx.lineJoin = e.lineJoin;
      ctx.miterLimit = e.miterLimit;
      ctx.setLineDash(e.dash);
      ctx.stroke(e.path);
    }
    ctx.restore();
  }
  return canvas;
}

function eventBox(e: FillEvent | StrokeEvent): Box | null {
  let box = segsBox(e.segs);
  if (!box) return null;
  if (e.kind === "stroke") box = expand(box, (e.lineWidth * strokeScale(e)) / 2 + 1);
  const cb = clipBox(e.clips);
  if (cb === null) return null;
  return cb ? intersect(box, cb) : box;
}

/**
 * Turns the recorded drawing of one page into separate elements: plain shapes for rectangles, rounded boxes and ellipses,
 * images for photos and for anything drawn with curves or gradients (logos, icons, blobs), and the slide background. Ink
 * that falls inside a text box is the PDF's own text and is dropped, because the text is rebuilt as editable text.
 */
export function structurePage(events: DrawEvent[], page: { width: number; height: number }, textBoxes: Box[]): PdfStructure {
  const items: PdfItem[] = [];
  let background: string | null = null;
  let backgroundImage: HTMLCanvasElement | null = null;
  const textColors: (string | null)[] = textBoxes.map(() => null);
  const colorVotes: Map<string, number>[] = textBoxes.map(() => new Map());
  const boldVotes = textBoxes.map(() => ({ bold: 0, all: 0 }));
  const pageArea = page.width * page.height;

  let group: { events: (FillEvent | StrokeEvent)[]; box: Box } | null = null;
  const flush = () => {
    if (!group) return;
    const canvas = rasterize(group.events, group.box);
    if (canvas) items.push({ type: "image", box: group.box, canvas, opacity: 1 });
    group = null;
  };
  const addToGroup = (e: FillEvent | StrokeEvent, box: Box) => {
    if (group && intersect(expand(group.box, GROUP_GAP), box)) {
      group.events.push(e);
      group.box = union(group.box, box);
    } else {
      flush();
      group = { events: [e], box };
    }
  };

  const insideText = (box: Box): number => {
    for (let i = 0; i < textBoxes.length; i += 1) {
      const t = textBoxes[i];
      const hit = intersect(box, expand(t, 2));
      if (hit && hit.w * hit.h >= box.w * box.h * 0.6 && box.h <= t.h * 1.6) return i;
    }
    return -1;
  };
  const vote = (i: number, color: string | null) => {
    if (!color) return;
    colorVotes[i].set(color, (colorVotes[i].get(color) ?? 0) + 1);
  };

  for (const e of events) {
    if (e.kind === "text") {
      const i = textBoxes.findIndex((t) => e.pt[0] >= t.x - 2 && e.pt[0] <= t.x + t.w + 2 && e.pt[1] >= t.y - t.h && e.pt[1] <= t.y + t.h * 1.6);
      if (i >= 0) {
        vote(i, e.color);
        boldVotes[i].all += 1;
        if (/bold|[6-9]00/i.test(e.font)) boldVotes[i].bold += 1;
      }
      continue;
    }
    if (e.kind === "image") {
      flush();
      items.push({ type: "image", box: e.box, canvas: e.canvas, opacity: e.alpha });
      continue;
    }
    const box = eventBox(e);
    if (!box || box.w < 0.5 || box.h < 0.5) continue;
    const solid = typeof e.style === "string";

    // Glyphs drawn as outlines inside a text box are the PDF's text: the editable text replaces them.
    const t = insideText(box);
    if (t >= 0 && box.w * box.h < textBoxes[t].w * textBoxes[t].h * 1.1) {
      if (solid) vote(t, e.style as string);
      continue;
    }

    const plain = solid && e.composite === "source-over";
    if (e.kind === "fill" && plain && box.w * box.h >= pageArea * 0.97 && !items.length && !group) {
      background = e.style as string;
      continue;
    }

    const shape = plain ? classify(e.segs, segsBox(e.segs) ?? box) : null;
    if (e.kind === "fill" && shape) {
      flush();
      const full = segsBox(e.segs) ?? box;
      const clipped = shape.kind === "rect" && shape.radius === 0 ? box : full;
      items.push({ type: "shape", kind: shape.kind, box: clipped, fill: e.style as string, radius: shape.radius, opacity: e.alpha, source: e });
      continue;
    }
    if (e.kind === "stroke" && plain) {
      const sw = e.lineWidth * strokeScale(e);
      const last = items[items.length - 1];
      const own = segsBox(e.segs);
      // A border drawn right after its fill belongs to that shape.
      if (!group && last?.type === "shape" && own && near(own.x, last.box.x, 1.5) && near(own.y, last.box.y, 1.5) && near(own.w, last.box.w, 1.5) && near(own.h, last.box.h, 1.5)) {
        last.stroke = e.style as string;
        last.strokeWidth = Math.max(1, Math.round(sw));
        continue;
      }
      // A straight horizontal or vertical line becomes a thin bar.
      if (own && e.segs.length === 2 && e.segs[1].op === "L" && (own.w < 0.5 || own.h < 0.5)) {
        flush();
        const horizontal = own.h < 0.5;
        const bar: Box = horizontal ? { x: own.x, y: own.y - sw / 2, w: own.w, h: Math.max(1, sw) } : { x: own.x - sw / 2, y: own.y, w: Math.max(1, sw), h: own.h };
        items.push({ type: "shape", kind: "rect", box: bar, fill: e.style as string, radius: 0, opacity: e.alpha, source: e });
        continue;
      }
      const sshape = classify(e.segs, own ?? box);
      if (sshape && own) {
        flush();
        items.push({ type: "shape", kind: sshape.kind, box: own, fill: "transparent", stroke: e.style as string, strokeWidth: Math.max(1, Math.round(sw)), radius: sshape.radius, opacity: e.alpha, source: e });
        continue;
      }
    }

    // Gradients and patterns are painted now, since their sources can change later in the render.
    if (!solid) {
      flush();
      const canvas = rasterize([e], box);
      if (canvas && e.kind === "fill" && box.w * box.h >= pageArea * 0.97 && !items.length) {
        backgroundImage = canvas;
        continue;
      }
      if (canvas) items.push({ type: "image", box, canvas, opacity: 1 });
      continue;
    }
    addToGroup(e, box);
    if (items.length > MAX_ITEMS) throw new TooComplexError("Too many separate pieces on this page.");
  }
  flush();
  if (items.length > MAX_ITEMS) throw new TooComplexError("Too many separate pieces on this page.");

  colorVotes.forEach((votes, i) => {
    let best: string | null = null;
    let n = 0;
    for (const [c, k] of votes) {
      if (k > n) {
        best = c;
        n = k;
      }
    }
    textColors[i] = best;
  });
  const textBold = boldVotes.map((v) => v.all > 0 && v.bold / v.all > 0.5);
  return { background, backgroundImage, items, textColors, textBold };
}
