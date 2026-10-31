import { THEMES } from "@/lib/deck/themes";
import type { ThemeId } from "@/lib/deck/schema";
import { getPdfJs } from "@/lib/import/source-files";

const MAX_BYTES = 25 * 1024 * 1024;

export type StyleReference = { palette: string[]; accent: string; themeId: ThemeId; dark: boolean; /** JPEG data URL of the image or first PDF page, about 1280 px wide. */ preview: string };

let lastPreview = "";

function makePreview(source: CanvasImageSource, w: number, h: number): string {
  const scale = Math.min(1, 1280 / w);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

type Rgb = [number, number, number];

function hex(c: Rgb): string {
  return `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(h: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const lum = ([r, g, b]: Rgb) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const sat = ([r, g, b]: Rgb) => {
  const mx = Math.max(r, g, b);
  return mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
};
const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function sample(source: CanvasImageSource, w: number, h: number): ImageData {
  lastPreview = makePreview(source, w, h);
  const scale = Math.min(1, 160 / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser could not read the image.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function fileToImageData(file: File): Promise<ImageData> {
  if (file.size > MAX_BYTES) throw new Error("Reference files must be smaller than 25 MB.");
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    const lib = await getPdfJs();
    const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true });
    const pdf = await task.promise;
    try {
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2.5, 1280 / base.width) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("This browser could not read the PDF.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      return sample(canvas, canvas.width, canvas.height);
    } finally {
      await task.destroy();
    }
  }
  if (!file.type.startsWith("image/")) throw new Error("Choose a PDF or an image (PNG, JPG, WebP or SVG).");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return sample(img, img.naturalWidth || 320, img.naturalHeight || 180);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Reads the dominant colours of an image or the first page of a PDF and maps them to the closest built-in theme. */
export async function readStyleReference(file: File): Promise<StyleReference> {
  const { data } = await fileToImageData(file);
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let totalLum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    totalLum += lum([r, g, b]);
    count += 1;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n += 1;
    e.r += r;
    e.g += g;
    e.b += b;
    buckets.set(key, e);
  }
  if (!count) throw new Error("That file has no visible pixels to read.");
  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).map((e): Rgb => [e.r / e.n, e.g / e.n, e.b / e.n]);
  const palette: Rgb[] = [];
  for (const c of ranked) {
    if (palette.every((p) => dist(p, c) > 60)) palette.push(c);
    if (palette.length === 5) break;
  }
  const vivid = (c: Rgb) => sat(c) * Math.sqrt(Math.max(0, 1 - Math.abs(lum(c) - 0.5)));
  const accentRgb = [...ranked].sort((a, b) => vivid(b) - vivid(a))[0] ?? palette[0];
  const dark = totalLum / count < 0.45;
  const bg = palette[0] ?? ([20, 20, 20] as Rgb);

  let best: ThemeId = "glass-contrast";
  let bestScore = Infinity;
  for (const t of Object.values(THEMES)) {
    const tBg = parseHex(/^#/.test(t.colors.bg) ? t.colors.bg : t.swatch[0]);
    const score = dist(tBg, bg) + 0.8 * dist(parseHex(t.colors.accent), accentRgb) + ((lum(tBg) < 0.45) === dark ? 0 : 200);
    if (score < bestScore) {
      bestScore = score;
      best = t.id;
    }
  }
  return { palette: palette.map(hex), accent: hex(accentRgb), themeId: best, dark, preview: lastPreview };
}
