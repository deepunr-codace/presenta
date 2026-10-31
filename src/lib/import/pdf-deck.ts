import { newId } from "@/lib/deck/ids";
import { STAGE_H, STAGE_W, type Deck, type Element, type Slide } from "@/lib/deck/schema";
import { getPdfJs } from "@/lib/import/source-files";
import { escapeHtml } from "@/lib/text";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_SLIDES = 100;
const MAX_RENDERED_BYTES = 24 * 1024 * 1024;

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

type Box = { x0: number; y0: number; x1: number; y1: number };

/**
 * Some PDFs draw their text in a way that cannot be switched off while rendering (glyph paths, Type 3 fonts). When a
 * text box still shows ink after rendering, repaint it from the colours just left and right of it, row by row, which
 * rebuilds flat colours and gradients. The ink colour that was found is returned, so the new text can match it.
 */
function removeResidualText(img: ImageData, box: Box): { residual: boolean; ink: string | null } {
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

/**
 * Imports a PDF as an editable deck: each page becomes a slide whose artwork is a background picture and whose text is
 * rebuilt as real text boxes (position, size and weight are kept), so every line can be edited, moved or restyled.
 */
export async function importPdfDeck(file: File, report?: (pct: number, label: string) => void): Promise<Deck> {
  if (file.size > MAX_FILE_BYTES) throw new Error("PDF files must be smaller than 50 MB.");
  report?.(4, "Opening the PDF…");
  const lib = await getPdfJs();
  const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true });
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
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
      if (!context) throw new Error("This browser could not prepare the PDF pages for import.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await renderWithoutText(() => page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" }).promise);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);

      const offX = (STAGE_W - viewport.width) / 2;
      const offY = (STAGE_H - viewport.height) / 2;
      const content = await page.getTextContent();
      const runs: Run[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const [a, b, , , e, f] = lib.Util.transform(viewport.transform, item.transform);
        const size = Math.hypot(a, b);
        if (size < 4) continue;
        const style = content.styles[item.fontName];
        const family = `${style?.fontFamily ?? ""} ${item.fontName}`;
        runs.push({ str: item.str, x: e + offX, y: f - size + offY, w: item.width * scale, size, bold: /bold|black|heavy|semibold|demi/i.test(family) });
      }

      const maxSize = Math.max(0, ...runs.map((r) => r.size));
      const blocks = toBlocks(toLines(runs));
      const inks = blocks.map((block) => {
        const size = block[0].size;
        const pad = Math.ceil(size * 0.14) + 2;
        const x = Math.min(...block.map((l) => l.x));
        const right = Math.max(...block.map((l) => l.right));
        const last = block[block.length - 1];
        return removeResidualText(pixels, { x0: x - offX - pad, x1: right - offX + pad, y0: block[0].y - offY - pad, y1: last.y - offY + last.size * 1.3 + pad }).ink;
      });
      context.putImageData(pixels, 0, 0);
      const data = canvas.toDataURL("image/jpeg", 0.84);
      renderedBytes += Math.floor(data.length * 0.75);
      if (renderedBytes > MAX_RENDERED_BYTES) throw new Error("The rendered PDF pages are too large to import together. Split the PDF into smaller files.");

      const elements: Element[] = [
        { id: newId("el"), type: "image", src: data, alt: `PDF page ${n} artwork`, fit: "contain", radius: 0, position: "50% 50%", overlay: 0, x: offX, y: offY, w: viewport.width, h: viewport.height, rotation: 0, z: 0, locked: false, opacity: 1 },
      ];
      blocks.forEach((block, k) => {
        const size = block[0].size;
        const x = Math.min(...block.map((l) => l.x));
        const y = block[0].y;
        const right = Math.max(...block.map((l) => l.right));
        const w = right - x;
        const lastLine = block[block.length - 1];
        const h = lastLine.y - y + lastLine.size * 1.35;
        const mid = (x + right) / 2;
        const centred = block.length > 0 && block.every((l) => Math.abs((l.x + l.right) / 2 - mid) < size * 0.6) && block.some((l) => Math.abs(l.x - x) > size * 0.8 || block.length === 1);
        const bgLum = luminanceAt(pixels.data, canvas.width, canvas.height, x - offX, y - offY, w, h);
        const bold = block[0].bold;
        const isTitle = size >= maxSize * 0.85 && size > 30;
        elements.push({
          id: newId("el"),
          type: "text",
          role: isTitle ? "title" : "body",
          html: block.map((l) => escapeHtml(lineText(l))).join("<br>"),
          x: Math.max(0, centred && w > size * 2 ? mid - (w * 1.12 + 16) / 2 : x - 8),
          y: Math.max(0, y - 4),
          w: Math.min(STAGE_W, w * 1.12 + 16),
          h: Math.max(size * 1.5, h + 8),
          rotation: 0,
          z: k + 1,
          locked: false,
          opacity: 1,
          align: centred && w > size * 2 ? "center" : "left",
          valign: "top",
          autoFit: true,
          style: { fontSize: Math.round(size), fontWeight: bold ? 700 : 400, color: inks[k] ?? (bgLum < 0.5 ? "#ffffff" : "#111111"), lineHeight: block.length > 1 ? Math.max(1.1, (block[1].y - block[0].y) / size) : 1.2, fontFamily: isTitle ? "display" : "body" },
        });
      });

      slides.push({ id: newId("slide"), layoutId: "blank", background: { kind: "theme", variant: "default" }, notes: `Imported from ${file.name} · page ${n}`, elements });
      canvas.width = 0;
      canvas.height = 0;
    }
    report?.(97, "Finishing the deck…");
    const now = new Date().toISOString();
    return { id: newId("deck"), title: file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ") || "Imported PDF", themeId: "paper", slides, createdAt: now, updatedAt: now, meta: { source: "import" }, version: 1 };
  } finally {
    await task.destroy();
  }
}
