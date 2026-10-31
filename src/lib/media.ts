import { fileToImageDataUrl } from "@/lib/image";

/**
 * The media library: images and videos kept in the signed-in user's account. Files live in Cloudflare R2 and are
 * uploaded straight from the browser with a presigned URL; the list of items comes from /api/media.
 */

/** One library image may be this large before it is refused (the image is also scaled to 1920 px). */
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
/** One library video may be this large before it is refused. */
export const MEDIA_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const THUMB_MAX_DIM = 360;

export type MediaItem = {
  id: string;
  name: string;
  kind: "image" | "video";
  mime: string;
  /** Size of the stored file in bytes. */
  bytes: number;
  width: number;
  height: number;
  /** Seconds, for videos. */
  duration: number | null;
  addedAt: string;
  /** Public URL of the file. */
  url: string;
  /** Public URL of the grid thumbnail (a poster frame for videos). */
  thumb: string;
};

function newestFirst(a: MediaItem, b: MediaItem): number {
  return b.addedAt < a.addedAt ? -1 : b.addedAt > a.addedAt ? 1 : 0;
}

async function readError(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? fallback);
}

/** Library items, newest first. */
export async function listMedia(): Promise<MediaItem[]> {
  const res = await fetch("/api/media", { cache: "no-store" });
  if (!res.ok) throw await readError(res, "Could not read the media library.");
  const body = (await res.json()) as { items?: MediaItem[] };
  return (Array.isArray(body.items) ? body.items : []).sort(newestFirst);
}

export async function deleteMedia(id: string): Promise<void> {
  const res = await fetch(`/api/media/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw await readError(res, "Could not delete that item.");
}

export async function renameMedia(id: string, name: string): Promise<void> {
  const res = await fetch(`/api/media/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
  if (!res.ok) throw await readError(res, "Could not rename that item.");
}

export function totalBytes(items: MediaItem[]): number {
  return items.reduce((n, m) => n + m.bytes, 0);
}

/** "812 KB", "4.2 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "0:42", "12:05". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Bytes of the payload in a base64 data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file is not an image the browser can decode."));
    img.src = src;
  });
}

type Thumb = { blob: Blob; mime: "image/jpeg" | "image/png" };

/** Scale a drawable down to the grid thumbnail size. PNG keeps transparency; everything else is JPEG. */
function makeThumb(source: CanvasImageSource, width: number, height: number, png: boolean): Promise<Thumb> {
  const scale = Math.min(1, THUMB_MAX_DIM / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("This browser could not make a thumbnail."));
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const mime = png ? "image/png" : "image/jpeg";
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve({ blob, mime }) : reject(new Error("This browser could not make a thumbnail."))), mime, 0.8),
  );
}

/** Load a video's size and length and grab a poster frame near the start. */
async function probeVideo(file: File): Promise<{ width: number; height: number; duration: number; thumb: Thumb }> {
  const src = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    video.playsInline = true;
    video.src = src;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("That video could not be read. Use an MP4 (H.264) or WebM file."));
    });
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("That video could not be read. Use an MP4 (H.264) or WebM file."));
      video.currentTime = Math.min(1, duration / 2);
    });
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    return { width, height, duration, thumb: await makeThumb(video, width, height, false) };
  } finally {
    URL.revokeObjectURL(src);
  }
}

async function put(url: string, blob: Blob, mime: string): Promise<void> {
  const res = await fetch(url, { method: "PUT", body: blob, headers: { "Content-Type": mime } });
  if (!res.ok) throw new Error("The upload to storage failed. Try again.");
}

/**
 * Upload an embedded base64 image to R2 and return its public URL. With `deck: true` it is stored as a deck picture,
 * which is not listed in the media library. Browser only.
 */
export async function uploadDataUrl(dataUrl: string, name: string, opts: { deck?: boolean } = {}): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/svg+xml" ? "svg" : (blob.type.split("/")[1] ?? "png");
  return (await addMediaFile(new File([blob], `${name}.${ext}`, { type: blob.type }), opts)).url;
}

/**
 * Add an image or video file to the library. Images are scaled and validated like any upload; videos must be MP4 or WebM
 * up to 100 MB. A thumbnail is made in the browser and both files go straight to R2. Browser only.
 */
export async function addMediaFile(file: File, opts: { deck?: boolean } = {}): Promise<MediaItem> {
  const isVideo = VIDEO_TYPES.has(file.type);
  const name = file.name.replace(/\.[a-z0-9]+$/i, "") || (isVideo ? "Untitled video" : "Untitled image");

  let body: Blob;
  let mime: string;
  let width: number;
  let height: number;
  let duration: number | null = null;
  let thumb: Thumb;

  if (isVideo) {
    if (file.size > MEDIA_VIDEO_MAX_BYTES) throw new Error(`That video is ${formatBytes(file.size)}; the limit is ${formatBytes(MEDIA_VIDEO_MAX_BYTES)}.`);
    const probe = await probeVideo(file);
    body = file;
    mime = file.type;
    ({ width, height, duration, thumb } = probe);
  } else {
    const dataUrl = await fileToImageDataUrl(file, { maxBytes: MEDIA_MAX_BYTES });
    const img = await loadImage(dataUrl);
    width = img.naturalWidth || img.width || 1;
    height = img.naturalHeight || img.height || 1;
    mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? file.type;
    body = await (await fetch(dataUrl)).blob();
    thumb = await makeThumb(img, width || THUMB_MAX_DIM, height || THUMB_MAX_DIM, mime !== "image/jpeg");
  }

  const res = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mime, bytes: body.size, width, height, duration, thumbMime: thumb.mime, thumbBytes: thumb.blob.size, source: opts.deck ? "deck" : "library" }),
  });
  if (!res.ok) throw await readError(res, "Could not start the upload.");
  const { item, uploadUrl, thumbUploadUrl } = (await res.json()) as { item: MediaItem; uploadUrl: string; thumbUploadUrl: string };

  try {
    await Promise.all([put(uploadUrl, body, mime), put(thumbUploadUrl, thumb.blob, thumb.mime)]);
  } catch (err) {
    await deleteMedia(item.id).catch(() => undefined);
    throw err;
  }
  return item;
}
