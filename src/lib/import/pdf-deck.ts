import { newId } from "@/lib/deck/ids";
import { STAGE_H, STAGE_W, type Deck, type Element, type Slide } from "@/lib/deck/schema";
import { getPdfJs } from "@/lib/import/source-files";
import { escapeHtml } from "@/lib/text";
import type { PDFPageProxy, PageViewport } from "pdfjs-dist";
import { recordDrawing, type Box } from "./pdf-record";
import { structurePage } from "./pdf-structure";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_SLIDES = 100;
const MAX_RENDERED_BYTES = 40 * 1024 * 1024;

type Run = { str: string; x: number; y: number; w: number; size: number; bold: boolean };
type Line = { runs: Run[]; x: number; y: number; right: number; size: number; bold: boolean };

/** Draws nothing for text while the page renders, so the page becomes artwork only; the text is rebuilt as real text boxes. */
async function renderWithoutText<T>(draw: () => Promise<T>): Promise<T> {
  const proto = CanvasRenderingContext2D.prototype;
  const { fillText, strokeText } = proto;
  proto.fillText = function noText() {};
  proto.strokeText = function noText() {};
  try {
    return await draw();
  } finally {
    proto.fillText = fillText;
    proto.strokeText = strokeText;
  }
}

function toLines(runs: Run[]): Line[] {
  const sorted = [...runs].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const r of sorted) {
    const line = lines.find(
      (l) => Math.abs(l.y - r.y) < Math.max(2, r.size * 0.45) && Math.abs(l.size - r.size) < r.size * 0.35 && r.x - l.right < r.size * 1.1 && r.x - l.right > -r.size * 0.6,
    );
    if (line) {
      line.runs.push(r);
      line.right = Math.max(line.right, r.x + r.w);
      line.x = Math.min(line.x, r.x);
    } else {
      lines.push({ runs: [r], x: r.x, y: r.y, right: r.x + r.w, size: r.size, bold: r.bold });
    }
  }
  for (const l of lines) l.runs.sort((a, b) => a.x - b.x);
  return lines.sort((a, b) => a.y - b.y || a.x - b.x);
}

function lineText(l: Line): string {
  let out = "";
  let prevRight = -Infinity;
  for (const r of l.runs) {
    if (out && r.x - prevRight > l.size * 0.18 && !out.endsWith(" ") && !r.str.startsWith(" ")) out += " ";
    out += r.str;
    prevRight = r.x + r.w;
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Groups lines into paragraph blocks: same size, left aligned and close together. */
function toBlocks(lines: Line[]): Line[][] {
  const blocks: Line[][] = [];
  for (const l of lines) {
    if (!lineText(l)) continue;
    const block = blocks.find((b) => {
      const last = b[b.length - 1];
      const overlap = Math.min(last.right, l.right) - Math.max(last.x, l.x);
      const sameColumn = overlap > Math.min(last.right - last.x, l.right - l.x) * 0.4;
      return Math.abs(last.size - l.size) < l.size * 0.2 && l.y - last.y > 0 && l.y - last.y < l.size * 1.9 && sameColumn;
    });
    if (block) block.push(l);
    else blocks.push([l]);
  }
  return blocks;
}

type Span = { x0: number; y0: number; x1: number; y1: number };

/**
 * Some PDFs draw their text in a way that cannot be switched off while rendering (glyph paths, Type 3 fonts). When a
 * text box still shows ink after rendering, repaint it from the colours just left and right of it, row by row, which
 * rebuilds flat colours and gradients. The ink colour that was found is returned, so the new text can match it.
 */
function removeResidualText(img: ImageData, box: Span): { residual: boolean; ink: string | null } {
  const { data, width: w, height: h } = img;
  const x0 = Math.max(3, Math.floor(box.x0));
  const x1 = Math.min(w - 4, Math.ceil(box.x1));
  const y0 = Math.max(0, Math.floor(box.y0));
  const y1 = Math.min(h, Math.ceil(box.y1));
  if (x1 - x0 < 6 || y1 <= y0) return { residual: false, ink: null };
  const edge = (y: number, xs: number[]) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const x of xs) {
      const i = (y * w + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    return [r / xs.length, g / xs.length, b / xs.length];
  };
  const estimates: number[][][] = [];
  let strong = 0;
  let total = 0;
  const ink = [0, 0, 0];
  let inkN = 0;
  for (let y = y0; y < y1; y += 1) {
    const L = edge(y, [x0 - 3, x0 - 2, x0 - 1]);
    const R = edge(y, [x1 + 1, x1 + 2, x1 + 3]);
    const row: number[][] = [];
    for (let x = x0; x < x1; x += 1) {
      const t = (x - x0) / (x1 - x0);
      const e = [L[0] + (R[0] - L[0]) * t, L[1] + (R[1] - L[1]) * t, L[2] + (R[2] - L[2]) * t];
      row.push(e);
      const i = (y * w + x) * 4;
      const d = Math.max(Math.abs(data[i] - e[0]), Math.abs(data[i + 1] - e[1]), Math.abs(data[i + 2] - e[2]));
      total += 1;
      if (d > 56) strong += 1;
      if (d > 140) {
        ink[0] += data[i];
        ink[1] += data[i + 1];
        ink[2] += data[i + 2];
        inkN += 1;
      }
    }
    estimates.push(row);
  }
  if (!total || strong / total < 0.02) return { residual: false, ink: null };
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const e = estimates[y - y0][x - x0];
      const i = (y * w + x) * 4;
      data[i] = e[0];
      data[i + 1] = e[1];
      data[i + 2] = e[2];
    }
  }
  const toHex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return { residual: true, ink: inkN ? "#" + toHex(ink[0] / inkN) + toHex(ink[1] / inkN) + toHex(ink[2] / inkN) : null };
}

function luminanceAt(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, bw: number, bh: number): number {
  let sum = 0;
  let n = 0;
  const x0 = Math.max(0, Math.floor(x)), x1 = Math.min(w, Math.ceil(x + bw));
  const y0 = Math.max(0, Math.floor(y)), y1 = Math.min(h, Math.ceil(y + bh));
  for (let py = y0; py < y1; py += 3) {
    for (let px = x0; px < x1; px += 3) {
      const i = (py * w + px) * 4;
      sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      n += 1;
    }
  }
  return n ? sum / n : 1;
}

/** Picks PNG when the picture has transparency, otherwise a smaller JPEG. */
function encode(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const step = Math.max(4, Math.floor(data.length / 4 / 20000) * 4);
    for (let i = 3; i < data.length; i += step) if (data[i] < 250) return canvas.toDataURL("image/png");
  }
  return canvas.toDataURL("image/jpeg", 0.88);
}

type Block = { lines: Line[]; box: Box };

function blockGeometry(block: Line[]) {
  const size = block[0].size;
  const x = Math.min(...block.map((l) => l.x));
  const y = block[0].y;
  const right = Math.max(...block.map((l) => l.right));
  const last = block[block.length - 1];
  const h = last.y - y + last.size * 1.35;
  return { size, x, y, right, w: right - x, h };
}

function textElements(blocks: Block[], colors: (string | null)[], z0: number, bold: boolean[] = []): Element[] {
  const maxSize = Math.max(0, ...blocks.map((b) => b.lines[0].size));
  return blocks.map(({ lines }, k): Element => {
    const { size, x, y, right, w, h } = blockGeometry(lines);
    const mid = (x + right) / 2;
    // A single line keeps left alignment, so editing grows it to the right like the original.
    const centred = lines.length > 1 && lines.every((l) => Math.abs((l.x + l.right) / 2 - mid) < size * 0.6) && lines.some((l) => Math.abs(l.x - x) > size * 0.8);
    const isTitle = size >= maxSize * 0.85 && size > 30;
    const centre = centred && w > size * 2;
    return {
      id: newId("el"),
      type: "text",
      role: isTitle ? "title" : "body",
      html: lines.map((l) => escapeHtml(lineText(l))).join("<br>"),
      x: Math.max(0, centre ? mid - (w * 1.12 + 16) / 2 : x - 8),
      y: Math.max(0, y - 4),
      w: Math.min(STAGE_W, w * 1.12 + 16),
      h: Math.max(size * 1.5, h + 8),
      rotation: 0,
      z: z0 + k,
      locked: false,
      opacity: 1,
      align: centre ? "center" : "left",
      valign: "top",
      autoFit: true,
      style: {
        fontSize: Math.round(size),
        fontWeight: lines[0].bold || bold[k] ? 700 : 400,
        color: colors[k] ?? "#111111",
        lineHeight: lines.length > 1 ? Math.max(1.1, (lines[1].y - lines[0].y) / size) : 1.2,
        fontFamily: isTitle ? "display" : "body",
      },
    };
  });
}

type PageCtx = { page: PDFPageProxy; viewport: PageViewport; offX: number; offY: number; n: number };
type PageResult = { elements: Element[]; background: Slide["background"] | null; bytes: number };

/** Every drawing on the page becomes its own element: shapes stay shapes, pictures and artwork become movable images. */
async function structuredPage({ page, viewport, offX, offY, n }: PageCtx, blocks: Block[]): Promise<PageResult> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser could not prepare the PDF pages for import.");
  try {
    const events = await recordDrawing(context, () => page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" }).promise);
    const textBoxes = blocks.map((b) => ({ x: b.box.x - offX, y: b.box.y - offY, w: b.box.w, h: b.box.h }));
    const s = structurePage(events, { width: canvas.width, height: canvas.height }, textBoxes);
    let bytes = 0;
    const elements: Element[] = s.items.map((item, k): Element => {
      const base = { id: newId("el"), x: item.box.x + offX, y: item.box.y + offY, w: Math.max(1, item.box.w), h: Math.max(1, item.box.h), rotation: 0, z: k + 1, locked: false, opacity: item.opacity };
      if (item.type === "shape") {
        return { ...base, type: "shape", kind: item.kind, fill: item.fill, stroke: item.stroke, strokeWidth: item.strokeWidth ?? 0, radius: item.radius };
      }
      const src = encode(item.canvas);
      bytes += Math.floor(src.length * 0.75);
      return { ...base, type: "image", src, alt: `PDF page ${n} image ${k + 1}`, fit: "cover", radius: 0, position: "50% 50%", overlay: 0 };
    });
    const bgLight = s.background ? luminanceOfColor(s.background) >= 0.5 : true;
    const colors = s.textColors.map((c) => c ?? (bgLight ? "#111111" : "#ffffff"));
    elements.push(...textElements(blocks, colors, elements.length + 1, s.textBold));
    let background: Slide["background"] | null = s.background ? { kind: "solid", color: s.background } : null;
    if (s.backgroundImage) {
      const src = encode(s.backgroundImage);
      bytes += Math.floor(src.length * 0.75);
      background = { kind: "image", src, overlay: 0 };
    }
    return { elements, background, bytes };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** The previous method, kept for pages too complex to split: one picture of the artwork plus editable text. */
async function flatPage({ page, viewport, offX, offY, n }: PageCtx, blocks: Block[]): Promise<PageResult> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!context) throw new Error("This browser could not prepare the PDF pages for import.");
  try {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await renderWithoutText(() => page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" }).promise);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const inks = blocks.map(({ lines }) => {
      const { size, x, right } = blockGeometry(lines);
      const pad = Math.ceil(size * 0.14) + 2;
      const last = lines[lines.length - 1];
      return removeResidualText(pixels, { x0: x - offX - pad, x1: right - offX + pad, y0: lines[0].y - offY - pad, y1: last.y - offY + last.size * 1.3 + pad }).ink;
    });
    context.putImageData(pixels, 0, 0);
    const src = canvas.toDataURL("image/jpeg", 0.84);
    const colors = blocks.map(({ lines }, k) => {
      const { x, y, w, h } = blockGeometry(lines);
      return inks[k] ?? (luminanceAt(pixels.data, canvas.width, canvas.height, x - offX, y - offY, w, h) < 0.5 ? "#ffffff" : "#111111");
    });
    const elements: Element[] = [
      { id: newId("el"), type: "image", src, alt: `PDF page ${n} artwork`, fit: "contain", radius: 0, position: "50% 50%", overlay: 0, x: offX, y: offY, w: viewport.width, h: viewport.height, rotation: 0, z: 0, locked: false, opacity: 1 },
      ...textElements(blocks, colors, 1),
    ];
    return { elements, background: null, bytes: Math.floor(src.length * 0.75) };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function luminanceOfColor(c: string): number {
  const m = /^#([0-9a-f]{6})/i.exec(c) ?? null;
  if (m) {
    const v = parseInt(m[1], 16);
    return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
  }
  const rgb = /rgba?\(([^)]+)\)/i.exec(c);
  if (rgb) {
    const [r, g, b] = rgb[1].split(",").map((x) => parseFloat(x));
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  return 1;
}

/**
 * Imports a PDF as an editable deck. Each page becomes a slide in which every drawing is its own element: text as
 * editable text boxes, boxes and circles as shapes, photos, icons and logos as separately movable images, and the page
 * colour as the slide background. A page with too many tiny pieces falls back to one artwork picture plus text.
 */
export async function importPdfDeck(file: File, report?: (pct: number, label: string) => void): Promise<Deck> {
  if (file.size > MAX_FILE_BYTES) throw new Error("PDF files must be smaller than 50 MB.");
  report?.(4, "Opening the PDF…");
  const lib = await getPdfJs();
  const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true, fontExtraProperties: true });
  const pdf = await task.promise;
  try {
    if (!pdf.numPages || pdf.numPages > MAX_SLIDES) throw new Error(`PDF imports support 1 to ${MAX_SLIDES} pages.`);
    const slides: Slide[] = [];
    let renderedBytes = 0;
    for (let n = 1; n <= pdf.numPages; n += 1) {
      report?.(8 + Math.round(((n - 1) / pdf.numPages) * 88), `Converting page ${n} of ${pdf.numPages} into editable slides…`);
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(STAGE_W / base.width, STAGE_H / base.height);
      const viewport = page.getViewport({ scale });
      const offX = (STAGE_W - viewport.width) / 2;
      const offY = (STAGE_H - viewport.height) / 2;

      // Loading the drawing instructions first also loads the fonts, so bold and other weights can be read from their names.
      await page.getOperatorList();
      const content = await page.getTextContent();
      const runs: Run[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const [a, b, , , e, f] = lib.Util.transform(viewport.transform, item.transform);
        const size = Math.hypot(a, b);
        if (size < 4) continue;
        const style = content.styles[item.fontName];
        let fontName = "";
        try {
          fontName = page.commonObjs.has(item.fontName) ? String((page.commonObjs.get(item.fontName) as { name?: string } | null)?.name ?? "") : "";
        } catch {
          fontName = "";
        }
        const family = `${style?.fontFamily ?? ""} ${item.fontName} ${fontName}`;
        runs.push({ str: item.str, x: e + offX, y: f - size + offY, w: item.width * scale, size, bold: /bold|black|heavy|semibold|demi/i.test(family) });
      }
      const blocks: Block[] = toBlocks(toLines(runs)).map((lines) => {
        const { x, y, w, h } = blockGeometry(lines);
        return { lines, box: { x, y, w, h } };
      });

      const ctx: PageCtx = { page, viewport, offX, offY, n };
      let result: PageResult;
      try {
        result = await structuredPage(ctx, blocks);
      } catch {
        // Too many tiny pieces, or a drawing we could not read: keep this page as one picture plus editable text.
        result = await flatPage(ctx, blocks);
      }
      renderedBytes += result.bytes;
      if (renderedBytes > MAX_RENDERED_BYTES) throw new Error("The PDF's pictures are too large to import together. Split the PDF into smaller files.");
      slides.push({
        id: newId("slide"),
        layoutId: "blank",
        background: result.background ?? { kind: "theme", variant: "default" },
        notes: `Imported from ${file.name} · page ${n}`,
        elements: result.elements,
      });
    }
    report?.(97, "Finishing the deck…");
    const now = new Date().toISOString();
    return { id: newId("deck"), title: file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ") || "Imported PDF", themeId: "paper", slides, createdAt: now, updatedAt: now, meta: { source: "import" }, version: 1 };
  } finally {
    await task.destroy();
  }
}
