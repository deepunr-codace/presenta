/**
 * Records what pdf.js draws on a page canvas, call by call, so each drawing can become its own editable element instead
 * of one flattened picture. Only the page's own canvas is recorded; pdf.js's scratch canvases (groups, masks, patterns)
 * reach the page through drawImage and are captured as images.
 */

export type Pt = [number, number];
/** A path segment. "X" marks a part we cannot read back (arcs); such paths are never classified as simple shapes. */
export type Seg = { op: "M" | "L" | "C" | "Q" | "Z" | "X"; pts: Pt[] };
export type Box = { x: number; y: number; w: number; h: number };
export type Clip = { segs: Seg[]; rule: CanvasFillRule; bbox: Box | null };

type Style = string | CanvasGradient | CanvasPattern;

export type FillEvent = { kind: "fill"; segs: Seg[]; path: Path2D; transform: DOMMatrix; rule: CanvasFillRule; style: Style; alpha: number; composite: GlobalCompositeOperation; clips: Clip[] };
export type StrokeEvent = {
  kind: "stroke";
  segs: Seg[];
  path: Path2D;
  transform: DOMMatrix;
  style: Style;
  alpha: number;
  composite: GlobalCompositeOperation;
  clips: Clip[];
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
  dash: number[];
};
export type ImageEvent = { kind: "image"; canvas: HTMLCanvasElement; box: Box; alpha: number };
export type TextEvent = { kind: "text"; pt: Pt; color: string | null; font: string };
export type DrawEvent = FillEvent | StrokeEvent | ImageEvent | TextEvent;

const pathSegs = new WeakMap<Path2D, Seg[]>();

export function apply(m: DOMMatrix, x: number, y: number): Pt {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

export function transformSegs(segs: Seg[], m: DOMMatrix): Seg[] {
  return segs.map((s) => ({ op: s.op, pts: s.pts.map(([x, y]) => apply(m, x, y)) }));
}

export function segsBox(segs: Seg[]): Box | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of segs) {
    for (const [x, y] of s.pts) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

export function intersect(a: Box, b: Box): Box | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const btm = Math.min(a.y + a.h, b.y + b.h);
  return r > x && btm > y ? { x, y, w: r - x, h: btm - y } : null;
}

export function clipBox(clips: Clip[]): Box | null | undefined {
  let box: Box | null | undefined;
  for (const c of clips) {
    if (!c.bbox) continue;
    box = box === undefined ? c.bbox : box && intersect(box, c.bbox);
  }
  return box;
}

export function segsToPath(segs: Seg[]): Path2D {
  const p = new Path2D();
  for (const s of segs) {
    const q = s.pts;
    if (s.op === "M") p.moveTo(q[0][0], q[0][1]);
    else if (s.op === "L") p.lineTo(q[0][0], q[0][1]);
    else if (s.op === "C") p.bezierCurveTo(q[0][0], q[0][1], q[1][0], q[1][1], q[2][0], q[2][1]);
    else if (s.op === "Q") p.quadraticCurveTo(q[0][0], q[0][1], q[1][0], q[1][1]);
    else if (s.op === "Z") p.closePath();
  }
  return p;
}

/** Draws the clip paths that were active for an event onto a scratch context offset by (ox, oy). */
export function applyClips(ctx: CanvasRenderingContext2D, clips: Clip[], ox: number, oy: number, base: DOMMatrix = new DOMMatrix()): void {
  const m = base.multiply(new DOMMatrix().translate(-ox, -oy));
  for (const c of clips) {
    if (c.segs.some((s) => s.op === "X") || !c.segs.length) continue;
    ctx.setTransform(m);
    ctx.clip(segsToPath(c.segs), c.rule);
  }
}

function rectSegs(x: number, y: number, w: number, h: number): Seg[] {
  return [
    { op: "M", pts: [[x, y]] },
    { op: "L", pts: [[x + w, y]] },
    { op: "L", pts: [[x + w, y + h]] },
    { op: "L", pts: [[x, y + h]] },
    { op: "Z", pts: [] },
  ];
}

const MAX_IMAGE_SIDE = 2400;

/** Copies an image drawn onto the page into its own canvas right away, because pdf.js reuses its scratch canvases. */
function snapshotImage(target: CanvasRenderingContext2D, clips: Clip[], args: unknown[]): ImageEvent | null {
  const m = target.getTransform();
  const src = args[0] as CanvasImageSource & { width?: number; height?: number };
  let dx = 0;
  let dy = 0;
  let dw = Number(src.width ?? 0);
  let dh = Number(src.height ?? 0);
  if (args.length === 3) [dx, dy] = args.slice(1, 3) as number[];
  else if (args.length === 5) [dx, dy, dw, dh] = args.slice(1, 5) as number[];
  else if (args.length === 9) [dx, dy, dw, dh] = args.slice(5, 9) as number[];
  const corners = [apply(m, dx, dy), apply(m, dx + dw, dy), apply(m, dx, dy + dh), apply(m, dx + dw, dy + dh)];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  let box: Box | null = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  const cb = clipBox(clips);
  if (cb === null) return null;
  if (cb) box = intersect(box, cb);
  if (!box || box.w < 1 || box.h < 1) return null;
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(box.w, box.h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(box.w * scale));
  canvas.height = Math.max(1, Math.ceil(box.h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  const base = ctx.getTransform();
  applyClips(ctx, clips, box.x, box.y, base);
  ctx.setTransform(base.multiply(new DOMMatrix().translate(-box.x, -box.y)).multiply(m));
  (ctx.drawImage as (...a: unknown[]) => void)(...args);
  return { kind: "image", canvas, box, alpha: target.globalAlpha };
}

/**
 * Runs `draw` (a pdf.js page render) with the canvas API instrumented, and returns everything drawn on `target` in
 * paint order. Drawing still happens normally; the canvas itself is not used afterwards.
 */
export async function recordDrawing(target: CanvasRenderingContext2D, draw: () => Promise<unknown>): Promise<DrawEvent[]> {
  const events: DrawEvent[] = [];
  const C = CanvasRenderingContext2D.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const P = Path2D.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const saved = new Map<string, (...a: unknown[]) => unknown>();
  const savedP = new Map<string, (...a: unknown[]) => unknown>();

  let ctxPath: Seg[] = [];
  let clips: Clip[] = [];
  const stack: Clip[][] = [];

  const segsFor = (p: Path2D): Seg[] => pathSegs.get(p) ?? [{ op: "X", pts: [] }];
  const pushP = (p: Path2D, seg: Seg) => {
    const list = pathSegs.get(p);
    if (list) list.push(seg);
    else pathSegs.set(p, [seg]);
  };

  // Path2D: record segments in the path's own coordinates.
  const pathMethods: Record<string, (self: Path2D, a: number[]) => void> = {
    moveTo: (p, a) => pushP(p, { op: "M", pts: [[a[0], a[1]]] }),
    lineTo: (p, a) => pushP(p, { op: "L", pts: [[a[0], a[1]]] }),
    bezierCurveTo: (p, a) => pushP(p, { op: "C", pts: [[a[0], a[1]], [a[2], a[3]], [a[4], a[5]]] }),
    quadraticCurveTo: (p, a) => pushP(p, { op: "Q", pts: [[a[0], a[1]], [a[2], a[3]]] }),
    closePath: (p) => pushP(p, { op: "Z", pts: [] }),
    rect: (p, a) => rectSegs(a[0], a[1], a[2], a[3]).forEach((s) => pushP(p, s)),
    arc: (p) => pushP(p, { op: "X", pts: [] }),
    ellipse: (p) => pushP(p, { op: "X", pts: [] }),
    roundRect: (p) => pushP(p, { op: "X", pts: [] }),
  };
  for (const [name, rec] of Object.entries(pathMethods)) {
    const orig = P[name];
    if (typeof orig !== "function") continue;
    savedP.set(name, orig);
    P[name] = function (this: Path2D, ...a: unknown[]) {
      rec(this, a as number[]);
      return orig.apply(this, a);
    };
  }
  const origAddPath = P.addPath;
  if (typeof origAddPath === "function") {
    savedP.set("addPath", origAddPath);
    P.addPath = function (this: Path2D, ...a: unknown[]) {
      const src = a[0] as Path2D;
      const m = (a[1] as DOMMatrix | undefined) ?? new DOMMatrix();
      for (const s of transformSegs(segsFor(src), m)) pushP(this, s);
      return origAddPath.apply(this, a);
    };
  }

  const wrap = (name: string, rec: (ctx: CanvasRenderingContext2D, a: unknown[]) => void, after = false) => {
    const orig = C[name];
    if (typeof orig !== "function") return;
    saved.set(name, orig);
    C[name] = function (this: CanvasRenderingContext2D, ...a: unknown[]) {
      if (this !== target) return orig.apply(this, a);
      if (!after) rec(this, a);
      const out = orig.apply(this, a);
      if (after) rec(this, a);
      return out;
    };
  };

  // Context-level paths are stored already transformed, because the canvas applies the transform at each call.
  const dev = (ctx: CanvasRenderingContext2D, x: number, y: number) => apply(ctx.getTransform(), x, y);
  wrap("beginPath", () => {
    ctxPath = [];
  });
  wrap("moveTo", (c, a) => ctxPath.push({ op: "M", pts: [dev(c, a[0] as number, a[1] as number)] }));
  wrap("lineTo", (c, a) => ctxPath.push({ op: "L", pts: [dev(c, a[0] as number, a[1] as number)] }));
  wrap("bezierCurveTo", (c, a) => {
    const n = a as number[];
    ctxPath.push({ op: "C", pts: [dev(c, n[0], n[1]), dev(c, n[2], n[3]), dev(c, n[4], n[5])] });
  });
  wrap("quadraticCurveTo", (c, a) => {
    const n = a as number[];
    ctxPath.push({ op: "Q", pts: [dev(c, n[0], n[1]), dev(c, n[2], n[3])] });
  });
  wrap("closePath", () => ctxPath.push({ op: "Z", pts: [] }));
  wrap("rect", (c, a) => {
    const n = a as number[];
    ctxPath.push(...transformSegs(rectSegs(n[0], n[1], n[2], n[3]), c.getTransform()));
  });
  for (const name of ["arc", "ellipse", "roundRect", "arcTo"]) wrap(name, () => ctxPath.push({ op: "X", pts: [] }));

  wrap("save", () => stack.push(clips));
  wrap("restore", () => {
    clips = stack.pop() ?? [];
  });
  wrap("clip", (c, a) => {
    const usesPath = a[0] instanceof Path2D;
    const segs = usesPath ? transformSegs(segsFor(a[0] as Path2D), c.getTransform()) : ctxPath.slice();
    const rule = ((usesPath ? a[1] : a[0]) as CanvasFillRule | undefined) ?? "nonzero";
    clips = [...clips, { segs, rule, bbox: segs.some((s) => s.op === "X") ? null : segsBox(segs) }];
  });

  const fillLike = (c: CanvasRenderingContext2D, a: unknown[]): Omit<FillEvent, "kind" | "style"> => {
    const usesPath = a[0] instanceof Path2D;
    const m = c.getTransform();
    const path = usesPath ? (a[0] as Path2D) : segsToPath(ctxPath);
    const segs = usesPath ? transformSegs(segsFor(path), m) : ctxPath.slice();
    const rule = ((usesPath ? a[1] : a[0]) as CanvasFillRule | undefined) ?? "nonzero";
    return { segs, path, transform: usesPath ? m : new DOMMatrix(), rule, alpha: c.globalAlpha, composite: c.globalCompositeOperation, clips };
  };
  wrap("fill", (c, a) => events.push({ kind: "fill", ...fillLike(c, a), style: c.fillStyle as Style }));
  wrap("stroke", (c, a) => {
    const f = fillLike(c, a);
    events.push({ kind: "stroke", ...f, style: c.strokeStyle as Style, lineWidth: c.lineWidth, lineCap: c.lineCap, lineJoin: c.lineJoin, miterLimit: c.miterLimit, dash: c.getLineDash() });
  });
  wrap("fillRect", (c, a) => {
    const n = a as number[];
    const segs = transformSegs(rectSegs(n[0], n[1], n[2], n[3]), c.getTransform());
    events.push({ kind: "fill", segs, path: segsToPath(segs), transform: new DOMMatrix(), rule: "nonzero", style: c.fillStyle as Style, alpha: c.globalAlpha, composite: c.globalCompositeOperation, clips });
  });
  wrap("drawImage", (c, a) => {
    const ev = snapshotImage(c, clips, a);
    if (ev) events.push(ev);
  });
  wrap("putImageData", (c, a) => {
    const img = a[0] as ImageData;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d")?.putImageData(img, 0, 0);
    events.push({ kind: "image", canvas, box: { x: a[1] as number, y: a[2] as number, w: img.width, h: img.height }, alpha: 1 });
  });
  const textRec = (c: CanvasRenderingContext2D, a: unknown[]) =>
    events.push({ kind: "text", pt: dev(c, a[1] as number, a[2] as number), color: typeof c.fillStyle === "string" ? c.fillStyle : null, font: c.font });
  wrap("fillText", textRec);
  wrap("strokeText", textRec);

  try {
    await draw();
  } finally {
    for (const [name, fn] of saved) C[name] = fn;
    for (const [name, fn] of savedP) P[name] = fn;
  }
  return events;
}
