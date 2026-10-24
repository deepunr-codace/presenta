import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for IndexedDB (idb-keyval's get/set/del/update).
const store = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => void store.set(k, v),
  del: async (k: string) => void store.delete(k),
  update: async (k: string, fn: (v: unknown) => unknown) => void store.set(k, fn(store.get(k))),
}));

import { makeDeck } from "@/lib/deck/__tests__/fixtures";
import { deckKey, emptyTrash, listDecks, listTrash, loadDeckById, purgeDeck, restoreDeck, saveDeck, trashDeck, TRASH_RETENTION_DAYS } from "../persist";

beforeEach(() => store.clear());

describe("trash", () => {
  it("moves a deck out of the list and into the trash, keeping its data", async () => {
    const deck = makeDeck(2);
    await saveDeck(deck);
    expect(await trashDeck(deck.id)).toBe(true);
    expect(await listDecks()).toEqual([]);
    const trash = await listTrash();
    expect(trash.map((d) => d.id)).toEqual([deck.id]);
    expect(await loadDeckById(deck.id)).not.toBeNull();
  });

  it("restores a trashed deck to the list", async () => {
    const deck = makeDeck(1);
    await saveDeck(deck);
    await trashDeck(deck.id);
    expect(await restoreDeck(deck.id)).toBe(true);
    expect((await listDecks()).map((d) => d.id)).toEqual([deck.id]);
    expect(await listTrash()).toEqual([]);
  });

  it("returns false for unknown ids", async () => {
    expect(await trashDeck("nope")).toBe(false);
    expect(await restoreDeck("nope")).toBe(false);
  });

  it("purges one deck or the whole trash, removing the data", async () => {
    const a = makeDeck(1);
    const b = { ...makeDeck(1), id: "deck-b" };
    await saveDeck(a);
    await saveDeck(b);
    await trashDeck(a.id);
    await trashDeck(b.id);
    await purgeDeck(a.id);
    expect(store.has(deckKey(a.id))).toBe(false);
    expect((await listTrash()).map((d) => d.id)).toEqual([b.id]);
    await emptyTrash();
    expect(await listTrash()).toEqual([]);
    expect(store.has(deckKey(b.id))).toBe(false);
  });

  it("purges decks older than the retention window when the trash is listed", async () => {
    const old = makeDeck(1);
    await saveDeck(old);
    const longAgo = new Date(Date.now() - (TRASH_RETENTION_DAYS + 1) * 86_400_000);
    await trashDeck(old.id, longAgo);
    expect(await listTrash()).toEqual([]);
    expect(store.has(deckKey(old.id))).toBe(false);
  });
});
