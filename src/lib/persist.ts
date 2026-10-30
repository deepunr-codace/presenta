import { CLIENT_HEADER, getClientId } from "@/lib/client-id";
import { newId } from "@/lib/deck/ids";
import { DeckImportSchema, DeckSchema, type Deck, type ThemeId } from "@/lib/deck/schema";
import type { DriveDeck } from "@/lib/drive-db";
import { uploadDataUrl } from "@/lib/media";
import { sanitizeHtml, stripTags } from "@/lib/text";
import { importPptx } from "@/lib/import/pptx";
import { importPdfDeck } from "@/lib/import/pdf-deck";

/**
 * Deck persistence. Decks live in the signed-in user's account (Postgres, through /api/decks), so they follow the
 * user across devices. Nothing here runs at module load, so the module is safe to import during SSR; only call the
 * functions from the client.
 */

/** Imported files above this size are refused before they are read. */
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024;

/** A saved deck is sent in one request, and the host caps a request body at about 4.5 MB. */
const SAVE_BODY_SOFT_LIMIT = 3.5 * 1024 * 1024;
/** Embedded images smaller than this are never moved out of the deck. */
const MIN_EXTERNALIZE_CHARS = 100 * 1024;

export type DeckSummary = {
  id: string;
  title: string;
  updatedAt: string;
  slideCount: number;
  themeId: ThemeId;
  /** Which folder the deck is in (null: the top level). Present on the account's deck list. */
  folderId?: string | null;
  /** Stored size in bytes. */
  sizeBytes?: number;
  /** Who the deck is shared with, for the sharing indicator. */
  sharing?: DriveDeck["sharing"];
};

async function readError(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? fallback);
}

async function request(input: string, init: RequestInit | undefined, fallback: string): Promise<Response> {
  const res = await fetch(input, init);
  if (!res.ok) throw await readError(res, fallback);
  return res;
}

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json", [CLIENT_HEADER]: getClientId() }, body: JSON.stringify(body) });

/* ---------- Large embedded images ---------- */

const externalized = new Map<string, string>();
const deckBases = new Map<string, Deck>();

/** Every `data:image/...` string in the deck, with the object and key that hold it. */
function findDataUrls(node: unknown, out: { holder: Record<string, unknown>; key: string; value: string }[] = []) {
  if (Array.isArray(node)) {
    node.forEach((child, i) => {
      if (typeof child === "string") {
        if (child.startsWith("data:image/")) out.push({ holder: node as unknown as Record<string, unknown>, key: String(i), value: child });
      } else findDataUrls(child, out);
    });
  } else if (node && typeof node === "object") {
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (typeof child === "string") {
        if (child.startsWith("data:image/")) out.push({ holder: node as Record<string, unknown>, key, value: child });
      } else findDataUrls(child, out);
    }
  }
  return out;
}

/**
 * Keep a save under the request-size cap: when the deck is too big because of embedded base64 images, upload the
 * largest ones to the media library and save their URLs instead. The deck in the editor is not changed.
 */
async function fitForSave(deck: Deck): Promise<Deck> {
  if (JSON.stringify(deck).length <= SAVE_BODY_SOFT_LIMIT) return deck;
  const copy = structuredClone(deck);
  const found = findDataUrls(copy).filter((f) => f.value.length >= MIN_EXTERNALIZE_CHARS).sort((a, b) => b.value.length - a.value.length);
  let size = JSON.stringify(copy).length;
  for (const f of found) {
    if (size <= SAVE_BODY_SOFT_LIMIT) break;
    let url = externalized.get(f.value);
    if (!url) {
      url = await uploadDataUrl(f.value, "Slide image");
      externalized.set(f.value, url);
    }
    f.holder[f.key] = url;
    size -= f.value.length - url.length;
  }
  return copy;
}

/* ---------- Decks ---------- */

/** The last version received from the server, used for three-way concurrent-edit merges. */
export function getDeckBase(id: string): Deck | null {
  const base = deckBases.get(id);
  return base ? structuredClone(base) : null;
}

export function rememberDeckBase(deck: Deck): void {
  deckBases.set(deck.id, structuredClone(deck));
}

/** Save a deck to the account and adopt the server's merged version as the new base. */
export async function saveDeck(deck: Deck): Promise<Deck> {
  const body = await fitForSave(deck);
  const base = deckBases.get(deck.id) ?? null;
  const res = await request(`/api/decks/${encodeURIComponent(deck.id)}`, json("PUT", { deck: body, base }), "The deck could not be saved.");
  const response = (await res.json().catch(() => null)) as { deck?: unknown } | null;
  const parsed = DeckSchema.safeParse(response?.deck);
  const saved = parsed.success ? parsed.data : body;
  deckBases.set(deck.id, structuredClone(saved));
  return saved;
}

/** A deck with what the signed-in user may do with it, and who is editing it right now (if anyone). */
export type DeckAccess = { deck: Deck; role: "owner" | "editor" | "viewer"; editor: string | null };

/** Load a deck of mine, or one shared with me. Null when there is no such deck for me. */
export async function loadDeckWithAccess(id: string, rememberBase = true): Promise<DeckAccess | null> {
  const res = await fetch(`/api/decks/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw await readError(res, "The deck could not be loaded.");
  const body = (await res.json()) as { deck?: unknown; role?: DeckAccess["role"]; editor?: string | null };
  const parsed = DeckSchema.safeParse(body.deck);
  if (!parsed.success) return null;
  if (rememberBase) deckBases.set(id, structuredClone(parsed.data));
  return { deck: parsed.data, role: body.role ?? "owner", editor: body.editor ?? null };
}

export async function loadDeckById(id: string): Promise<Deck | null> {
  return (await loadDeckWithAccess(id))?.deck ?? null;
}

/** Decks in the list, newest first. */
export async function listDecks(): Promise<DeckSummary[]> {
  const res = await request("/api/decks", { cache: "no-store" }, "Could not read saved decks.");
  const body = (await res.json()) as { decks?: DeckSummary[] };
  return Array.isArray(body.decks) ? body.decks : [];
}

/** Delete a deck for good (the trash is the soft delete; see `trashDeck`). */
export async function deleteDeckById(id: string): Promise<void> {
  await request(`/api/decks/${encodeURIComponent(id)}`, { method: "DELETE" }, "The deck could not be deleted.");
}

export function exportDeckJson(deck: Deck): Blob {
  return new Blob([JSON.stringify(deck, null, 2)], { type: "application/json" });
}

class DeckImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeckImportError";
  }
}

/**
 * Make every slide and element id unique within the deck, keeping the first
 * occurrence and re-issuing later duplicates. Mutates and returns `deck`.
 */
function reIdDuplicates(deck: Deck): Deck {
  const slideIds = new Set<string>();
  for (const slide of deck.slides) {
    if (slideIds.has(slide.id)) slide.id = newId("slide");
    slideIds.add(slide.id);
    const elementIds = new Set<string>();
    for (const el of slide.elements) {
      if (elementIds.has(el.id)) el.id = newId("el");
      elementIds.add(el.id);
    }
  }
  return deck;
}

/** Strip anything but the editor's own tags from text, and every tag from card copy. Mutates and returns `deck`. */
function sanitizeDeckText(deck: Deck): Deck {
  for (const slide of deck.slides) {
    for (const el of slide.elements) {
      if (el.type === "text") el.html = sanitizeHtml(el.html);
      else if (el.type === "card") {
        el.title = stripTags(el.title);
        el.body = stripTags(el.body);
      }
    }
  }
  return deck;
}

/**
 * Import a Presenta JSON backup, PPTX, or PDF file. Data is validated and
 * sanitised where applicable; duplicate ids are re-issued. If the imported id
 * already exists, a fresh id is assigned. Does not save; callers decide.
 */
export async function importDeckFile(file: File): Promise<Deck> {
  if (file.size > IMPORT_MAX_BYTES) {
    throw new DeckImportError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the import limit is ${IMPORT_MAX_BYTES / 1024 / 1024} MB.`);
  }
  let deck: Deck;
  if (/\.pptx$/i.test(file.name)) {
    deck = await importPptx(file);
  } else if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    deck = await importPdfDeck(file);
  } else {
    const text = await file.text();
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      throw new DeckImportError("Choose a Presenta JSON backup, PowerPoint .pptx, or PDF file.");
    }
    const parsed = DeckImportSchema.safeParse(parsedJson);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const where = first?.path.length ? ` at ${first.path.join(".")}` : "";
      throw new DeckImportError(`That file is not a Presenta deck${where}: ${first?.message ?? "invalid"}.`);
    }
    deck = sanitizeDeckText(reIdDuplicates(parsed.data));
  }
  const idsRes = await request("/api/decks?ids=1", { cache: "no-store" }, "Could not check your saved decks.");
  const { ids } = (await idsRes.json()) as { ids?: string[] };
  if ((ids ?? []).includes(deck.id)) {
    const now = new Date().toISOString();
    return {
      ...deck,
      id: newId("deck"),
      createdAt: now,
      updatedAt: now,
      meta: { ...deck.meta, source: "import" },
    };
  }
  return { ...deck, meta: { ...deck.meta, source: deck.meta.source ?? "import" } };
}

/** Backward-compatible JSON import entry point. */
export async function importDeckJson(file: File): Promise<Deck> {
  return importDeckFile(file);
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* ---------- Trash (soft delete) ---------- */

/** A deck in the trash keeps its data; it is purged for good after this many days. */
export const TRASH_RETENTION_DAYS = 30;

export type TrashedDeck = DeckSummary & { trashedAt: string };

/** Move a deck out of the list and into the trash. Its data stays until it is purged. Returns false if it was not found. */
export async function trashDeck(id: string): Promise<boolean> {
  const res = await fetch(`/api/decks/${encodeURIComponent(id)}`, json("PATCH", { trashed: true }));
  if (res.status === 404) return false;
  if (!res.ok) throw await readError(res, "The deck could not be moved to the trash.");
  return true;
}

/** Put a trashed deck back in the deck list. Returns false if it is not in the trash. */
export async function restoreDeck(id: string): Promise<boolean> {
  const res = await fetch(`/api/decks/${encodeURIComponent(id)}`, json("PATCH", { trashed: false }));
  if (res.status === 404) return false;
  if (!res.ok) throw await readError(res, "The deck could not be restored.");
  return true;
}

/** Delete a trashed deck and its data for good. */
export async function purgeDeck(id: string): Promise<void> {
  await deleteDeckById(id);
}

export async function emptyTrash(): Promise<void> {
  await request("/api/decks?trash=1", { method: "DELETE" }, "The trash could not be emptied.");
}

/** Trashed decks, newest first. Decks past the retention window are purged by the server first. */
export async function listTrash(): Promise<TrashedDeck[]> {
  const res = await request("/api/decks?trash=1", { cache: "no-store" }, "Could not read the trash.");
  const body = (await res.json()) as { decks?: TrashedDeck[] };
  return Array.isArray(body.decks) ? body.decks : [];
}
