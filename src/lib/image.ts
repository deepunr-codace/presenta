/**
 * Browser-side image intake for uploads: size check, decode, downscale on a
 * canvas and encode to a data URL that fits comfortably in IndexedDB.
 */

const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const IMAGE_MAX_DIM = 1920;

/** Types the deck schema accepts as data URLs (see `isSafeUrl`); anything else is re-encoded on a canvas. */
const PASSTHROUGH_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

export class ImageIntakeError extends Error {}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new ImageIntakeError("Could not read the file."));
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new ImageIntakeError("Could not read the file.")));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageIntakeError("That file is not an image the browser can decode."));
    img.src = src;
  });
}

type ImageIntakeOptions = { maxBytes?: number; maxDim?: number };

/**
 * File → data URL. SVGs pass through untouched (they scale losslessly);
 * PNG, JPEG and WebP pass through when they already fit; rasters larger than
 * `maxDim` on either side, GIFs and every other type (BMP, AVIF, HEIC, ...)
 * are redrawn on a canvas so the result is always a PNG or JPEG data URL the
 * deck schema accepts. PNG/WebP/GIF keep transparency, the rest become JPEG.
 */
export async function fileToImageDataUrl(file: File, opts: ImageIntakeOptions = {}): Promise<string> {
  const maxBytes = opts.maxBytes ?? IMAGE_MAX_BYTES;
  const maxDim = opts.maxDim ?? IMAGE_MAX_DIM;
  if (!file.type.startsWith("image/")) throw new ImageIntakeError("Choose an image file (PNG, JPG, WebP, GIF or SVG).");
  if (file.size > maxBytes) throw new ImageIntakeError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`);

  const original = await readAsDataUrl(file);
  if (file.type === "image/svg+xml") return original;

  const img = await loadImage(original);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new ImageIntakeError("That image has no size.");
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const passthrough = PASSTHROUGH_TYPES.has(file.type);
  if (scale === 1 && passthrough) return original;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if (passthrough) return original;
    throw new ImageIntakeError("That image format needs re-encoding, which this browser could not do.");
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const keepAlpha = file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
  return keepAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.88);
}

/** Open a native file picker for images and resolve with the chosen file (or null). */
export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
