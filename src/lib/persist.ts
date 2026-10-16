import { del, get, set, update } from "idb-keyval";
import { newId } from "@/lib/deck/ids";
import { DeckImportSchema, DeckSchema, type Deck, type ThemeId } from "@/lib/deck/schema";
import { sanitizeHtml, stripTags } from "@/lib/text";

/**
 * IndexedDB persistence via idb-keyval. Nothing here touches IndexedDB at
 * module load, so the module is safe to import during SSR; only call the
 * functions from the client.
 */

export const DECK_INDEX_KEY = "presenta:decks";
export const deckKey = (id: string) => `presenta:deck:${id}` as const;

/** Imported files above this size are refused before they are read. */
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024;

export type DeckSummary = {
  id: string;
  title: string;
  updatedAt: string;
  slideCount: number;
  themeId: ThemeId;
};

function summarize(deck: Deck): DeckSummary {
  return {
    id: deck.id,
    title: deck.title,
    updatedAt: deck.updatedAt,
    slideCount: deck.slides.length,
    themeId: deck.themeId,
  };
}

function asIndex(value: unknown): DeckSummary[] {
  return Array.isArray(value) ? (value as DeckSummary[]) : [];
}

async function readIndex(): Promise<DeckSummary[]> {
  return asIndex(await get<DeckSummary[]>(DECK_INDEX_KEY));
}

function byUpdatedDesc(a: DeckSummary, b: DeckSummary): number {
  return b.updatedAt < a.updatedAt ? -1 : b.updatedAt > a.updatedAt ? 1 : 0;
}

/**
 * Write the deck, then fold its summary into the index inside one
 * read-modify-write transaction (`update`), so two saves racing each other
 * cannot drop one another's index entry.
 */
export async function saveDeck(deck: Deck): Promise<void> {
  await set(deckKey(deck.id), deck);
  const summary = summarize(deck);
  await update<DeckSummary[]>(DECK_INDEX_KEY, (current) => [summary, ...asIndex(current).filter((d) => d.id !== deck.id)].sort(byUpdatedDesc));
}

export async function loadDeckById(id: string): Promise<Deck | null> {
  const raw = await get<unknown>(deckKey(id));
  if (raw === undefined || raw === null) return null;
  const parsed = DeckSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function listDecks(): Promise<DeckSummary[]> {
  const index = await readIndex();
  return [...index].sort(byUpdatedDesc);
}

export async function deleteDeckById(id: string): Promise<void> {
  await del(deckKey(id));
  await update<DeckSummary[]>(DECK_INDEX_KEY, (current) => asIndex(current).filter((d) => d.id !== id));
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
 * Parse and validate a deck JSON file. Files over `IMPORT_MAX_BYTES` and
 * decks over the `DeckImportSchema` bounds are refused; text is sanitised and
 * duplicate ids are re-issued. If a deck with the same id is already stored,
 * the imported copy gets a fresh id and timestamps so it never overwrites the
 * existing one. Does not save; callers decide.
 */
export async function importDeckJson(file: File): Promise<Deck> {
  if (file.size > IMPORT_MAX_BYTES) {
    throw new DeckImportError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the import limit is ${IMPORT_MAX_BYTES / 1024 / 1024} MB.`);
  }
  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new DeckImportError("That file is not valid JSON.");
  }
  const parsed = DeckImportSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? ` at ${first.path.join(".")}` : "";
    throw new DeckImportError(`That file is not a Presenta deck${where}: ${first?.message ?? "invalid"}.`);
  }
  const deck = sanitizeDeckText(reIdDuplicates(parsed.data));
  const index = await readIndex();
  if (index.some((d) => d.id === deck.id)) {
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
