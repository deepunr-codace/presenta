import { newId } from "@/lib/deck/ids";
import { STAGE_H, STAGE_W, type Deck, type Element, type Slide } from "@/lib/deck/schema";
import { getPdfJs } from "@/lib/import/source-files";
import { escapeHtml } from "@/lib/text";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_SLIDES = 100;
const MAX_RENDERED_BYTES = 24 * 1024 * 1024;

type Run = { str: string; x: number; y: number; w: number; size: number; bold: boolean };
type Line = { runs: Run[]; x: number; y: number; right: number; size: number; bold: boolean };

/** A 2D context whose text calls draw nothing, so the page renders as artwork only and the text can be rebuilt as real, editable text. */
function withoutText(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
  return new Proxy(ctx, {
    get(target, prop) {
      if (prop === "fillText" || prop === "strokeText") return () => undefined;
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value, target);
    },
  });
}

function toLines(runs: Run[]): Line[] {
  const sorted = [...runs].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const r of sorted) {
    const line = lines.find((l) => Math.abs(l.y - r.y) < Math.max(2, r.size * 0.45) && Math.abs(l.size - r.size) < r.size * 0.35);
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
      return Math.abs(last.size - l.size) < l.size * 0.2 && l.y - last.y > 0 && l.y - last.y < l.size * 1.9 && Math.abs(last.x - l.x) < l.size * 1.2;
    });
    if (block) block.push(l);
    else blocks.push([l]);
  }
  return blocks;
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
export async function importPdfDeck(file: File): Promise<Deck> {
  if (file.size > MAX_FILE_BYTES) throw new Error("PDF files must be smaller than 50 MB.");
  const lib = await getPdfJs();
  const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true });
  const pdf = await task.promise;
  try {
    if (!pdf.numPages || pdf.numPages > MAX_SLIDES) throw new Error(`PDF imports support 1 to ${MAX_SLIDES} pages.`);
    const slides: Slide[] = [];
    let renderedBytes = 0;
    for (let n = 1; n <= pdf.numPages; n += 1) {
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
      await page.render({ canvas, canvasContext: withoutText(context), viewport, background: "#ffffff" }).promise;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.84);
      renderedBytes += Math.floor(data.length * 0.75);
      if (renderedBytes > MAX_RENDERED_BYTES) throw new Error("The rendered PDF pages are too large to import together. Split the PDF into smaller files.");

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

      const elements: Element[] = [
        { id: newId("el"), type: "image", src: data, alt: `PDF page ${n} artwork`, fit: "contain", radius: 0, position: "50% 50%", overlay: 0, x: offX, y: offY, w: viewport.width, h: viewport.height, rotation: 0, z: 0, locked: false, opacity: 1 },
      ];
      const maxSize = Math.max(0, ...runs.map((r) => r.size));
      toBlocks(toLines(runs)).forEach((block, k) => {
        const size = block[0].size;
        const x = Math.min(...block.map((l) => l.x));
        const y = block[0].y;
        const w = Math.max(...block.map((l) => l.right)) - x;
        const lastLine = block[block.length - 1];
        const h = lastLine.y - y + lastLine.size * 1.35;
        const bgLum = luminanceAt(pixels.data, canvas.width, canvas.height, x - offX, y - offY, w, h);
        const bold = block[0].bold;
        const isTitle = size >= maxSize * 0.85 && size > 30;
        elements.push({
          id: newId("el"),
          type: "text",
          role: isTitle ? "title" : "body",
          html: block.map((l) => escapeHtml(lineText(l))).join("<br>"),
          x: Math.max(0, x - 4),
          y: Math.max(0, y - 2),
          w: Math.min(STAGE_W, w + 24),
          h: Math.max(size * 1.4, h + 4),
          rotation: 0,
          z: k + 1,
          locked: false,
          opacity: 1,
          align: "left",
          valign: "top",
          autoFit: false,
          style: { fontSize: Math.round(size), fontWeight: bold ? 700 : 400, color: bgLum < 0.5 ? "#ffffff" : "#111111", lineHeight: block.length > 1 ? Math.max(1.1, (block[1].y - block[0].y) / size) : 1.2, fontFamily: isTitle ? "display" : "body" },
        });
      });

      slides.push({ id: newId("slide"), layoutId: "blank", background: { kind: "theme", variant: "default" }, notes: `Imported from ${file.name} · page ${n}`, elements });
      canvas.width = 0;
      canvas.height = 0;
    }
    const now = new Date().toISOString();
    return { id: newId("deck"), title: file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ") || "Imported PDF", themeId: "paper", slides, createdAt: now, updatedAt: now, meta: { source: "import" }, version: 1 };
  } finally {
    await task.destroy();
  }
}
