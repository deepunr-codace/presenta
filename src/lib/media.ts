import { del, get, set, update } from "idb-keyval";
import { newId } from "@/lib/deck/ids";
import { fileToImageDataUrl } from "@/lib/image";

/**
 * The media library: images kept in this browser (IndexedDB) so they can be reused across decks. A small index
 * holds each item's details and a thumbnail; the full image is stored separately and read only when it is used.
 */

export const MEDIA_INDEX_KEY = "presenta:media";
export const mediaKey = (id: string) => `presenta:media:${id}` as const;

/** One library image may be this large before it is refused (the image is also scaled to 1920 px). */
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
const THUMB_MAX_DIM = 360;

export type MediaItem = {
  id: string;
  name: string;
  mime: string;
  /** Size of the stored image in bytes. */
  bytes: number;
  width: number;
  height: number;
  addedAt: string;
  /** Small data URL for the grid. */
  thumb: string;
};

function asIndex(value: unknown): MediaItem[] {
  return Array.isArray(value) ? (value as MediaItem[]) : [];
}

function newestFirst(a: MediaItem, b: MediaItem): number {
  return b.addedAt < a.addedAt ? -1 : b.addedAt > a.addedAt ? 1 : 0;
}

/** Library items, newest first. */
export async function listMedia(): Promise<MediaItem[]> {
  return asIndex(await get<MediaItem[]>(MEDIA_INDEX_KEY)).sort(newestFirst);
}

/** Store an image and its index entry. */
export async function saveMediaRecord(item: MediaItem, dataUrl: string): Promise<void> {
  await set(mediaKey(item.id), dataUrl);
  await update<MediaItem[]>(MEDIA_INDEX_KEY, (current) => [item, ...asIndex(current).filter((m) => m.id !== item.id)].sort(newestFirst));
}

/** The full image as a data URL, or null if it is gone. */
export async function getMediaData(id: string): Promise<string | null> {
  const v = await get<unknown>(mediaKey(id));
  return typeof v === "string" ? v : null;
}

export async function deleteMedia(id: string): Promise<void> {
  await del(mediaKey(id));
  await update<MediaItem[]>(MEDIA_INDEX_KEY, (current) => asIndex(current).filter((m) => m.id !== id));
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

/** Add an image file to the library: scaled and validated like any upload, with a thumbnail for the grid. Browser only. */
export async function addMediaFile(file: File): Promise<MediaItem> {
  const dataUrl = await fileToImageDataUrl(file, { maxBytes: MEDIA_MAX_BYTES });
  const img = await loadImage(dataUrl);
  const width = img.naturalWidth || img.width || 1;
  const height = img.naturalHeight || img.height || 1;
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? file.type;

  let thumb = dataUrl;
  if (mime !== "image/svg+xml") {
    const scale = Math.min(1, THUMB_MAX_DIM / Math.max(width, height));
    if (scale < 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        thumb = canvas.toDataURL(mime === "image/png" ? "image/png" : "image/jpeg", 0.8);
      }
    }
  }

  const item: MediaItem = {
    id: newId("media"),
    name: file.name.replace(/\.[a-z0-9]+$/i, "") || "Untitled image",
    mime,
    bytes: dataUrlBytes(dataUrl),
    width,
    height,
    addedAt: new Date().toISOString(),
    thumb,
  };
  await saveMediaRecord(item, dataUrl);
  return item;
}
